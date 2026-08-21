import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const statePath = join(tmpdir(), "elan-scolaire-annual-validation.json");
const password = "Elan-Validation-2026!";

if (!url || !anonKey || !serviceKey) throw new Error("Variables Supabase manquantes.");

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const client = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const must = (condition, message) => { if (!condition) throw new Error(message); };
const expectOk = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; };
const save = (state) => writeFile(statePath, JSON.stringify(state, null, 2), "utf8");

async function signIn(email) {
  const supabase = client();
  expectOk(await supabase.auth.signInWithPassword({ email, password }), `Connexion ${email}`);
  return supabase;
}

async function cleanup(state, removeState = true) {
  if (!state) return;
  for (const path of state.storagePaths ?? []) await admin.storage.from("student-work").remove([path]);
  if (state.studentIds?.length) {
    const { data: submissions } = await admin.from("work_submissions").select("id").in("student_id", state.studentIds);
    const submissionIds = (submissions ?? []).map((row) => row.id);
    if (submissionIds.length) await admin.from("ai_analyses").delete().in("submission_id", submissionIds);
    await admin.from("work_submissions").delete().in("student_id", state.studentIds);
    const { data: enrollments } = await admin.from("student_annual_enrollments").select("id").in("student_id", state.studentIds);
    const annualIds = (enrollments ?? []).map((row) => row.id);
    if (annualIds.length) {
      await admin.from("student_week_item_progress").delete().in("enrollment_id", annualIds);
      await admin.from("student_week_progress").delete().in("enrollment_id", annualIds);
    }
    await admin.from("student_annual_enrollments").delete().in("student_id", state.studentIds);
    const { data: prepEnrollments } = await admin.from("student_program_enrollments").select("id").in("student_id", state.studentIds);
    const prepIds = (prepEnrollments ?? []).map((row) => row.id);
    if (prepIds.length) {
      await admin.from("student_program_item_progress").delete().in("enrollment_id", prepIds);
      await admin.from("student_program_day_progress").delete().in("enrollment_id", prepIds);
    }
    await admin.from("student_program_enrollments").delete().in("student_id", state.studentIds);
    await admin.from("students").delete().in("id", state.studentIds);
  }
  if (state.weekId) {
    await admin.from("annual_week_items").delete().eq("week_id", state.weekId);
    await admin.from("annual_program_weeks").delete().eq("id", state.weekId);
  }
  if (state.userIds?.length) {
    await admin.from("license_activations").delete().in("user_id", state.userIds);
    await admin.from("profiles").delete().in("id", state.userIds);
  }
  if (state.licenseIds?.length) await admin.from("license_keys").delete().in("id", state.licenseIds);
  for (const userId of state.userIds ?? []) await admin.auth.admin.deleteUser(userId);
  if (removeState) await rm(statePath, { force: true });
}

async function setup() {
  const run = Date.now().toString(36);
  const state = { run, userIds: [], studentIds: [], licenseIds: [], storagePaths: [] };
  await save(state);
  try {
    const annualProgram = expectOk(await admin.from("annual_programs").select("id").eq("slug", "suivi-annuel-3e").single(), "Programme annuel");
    const week = expectOk(await admin.from("annual_program_weeks").insert({
      annual_program_id: annualProgram.id, week_number: 1, school_term: "TEST_ONLY",
      title: "TEST_WEEK_1", objective: "Fixture technique temporaire", estimated_minutes: 15,
      instructions: "CODEX_TEST — ne pas utiliser comme contenu commercial", published: true,
      content_ready: true, sort_order: 1,
    }).select("id").single(), "Fixture semaine");
    state.weekId = week.id;
    const items = expectOk(await admin.from("annual_week_items").insert([1, 2, 3].map((sortOrder) => ({
      week_id: week.id, item_type: sortOrder === 3 ? "weekly_test" : "exercise",
      title: `CODEX_TEST_ITEM_${sortOrder}`, instructions: "Fixture technique temporaire",
      estimated_minutes: 5, sort_order: sortOrder, published: true,
    }))).select("id,sort_order").order("sort_order"), "Fixtures items");
    state.itemIds = items.map((row) => row.id);
    await save(state);

    for (const label of ["a", "b"]) {
      const email = `codex.annual.${label}.${run}@example.test`;
      const auth = expectOk(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `CODEX TEST ${label.toUpperCase()}` } }), `Création Parent ${label}`);
      const userId = auth.user.id;
      const studentId = randomUUID();
      const licenseId = randomUUID();
      state.userIds.push(userId); state.studentIds.push(studentId); state.licenseIds.push(licenseId);
      state[`email${label.toUpperCase()}`] = email;
      await save(state);
      expectOk(await admin.from("license_keys").insert({
        id: licenseId, key_hash: `CODEX_TEST_${run}_${label}`, key_prefix: "CODEX-TEST",
        key_suffix: `${run}${label}`.slice(-4), product: "CODEX TEST ONLY", status: "activated",
        max_students: 1, activated_at: new Date().toISOString(), notes: "Fixture temporaire validation annuelle",
      }), `Licence ${label}`);
      expectOk(await admin.from("profiles").upsert({ id: userId, role: "parent", full_name: `CODEX TEST ${label.toUpperCase()}`, email, active_license_id: licenseId }), `Profil ${label}`);
      expectOk(await admin.from("license_keys").update({ activated_by: userId }).eq("id", licenseId), `Propriétaire licence ${label}`);
      expectOk(await admin.from("license_activations").insert({ id: randomUUID(), license_id: licenseId, user_id: userId, visible_suffix: `${run}${label}`.slice(-4) }), `Activation ${label}`);
      expectOk(await admin.from("students").insert({
        id: studentId, parent_user_id: userId, first_name: `Élève Test ${label.toUpperCase()}`, level: "3e",
        school: "CODEX TEST", current_area_slug: "test", current_topic_slug: "test",
        objective: "validation-technique", target_minutes: 15, study_days: [1], active_phase: "preparation",
      }), `Élève ${label}`);
    }

    const parentA = await signIn(state.emailA);
    const parentB = await signIn(state.emailB);
    const prepEnrollmentId = expectOk(await parentA.rpc("start_pret_pour_la_3e_14_jours", { p_student_id: state.studentIds[0] }), "Démarrage préparation A");
    state.prepEnrollmentId = prepEnrollmentId;
    const days = expectOk(await parentA.from("student_program_day_progress").select("id,program_day_id,learning_program_days(day_number)").eq("enrollment_id", prepEnrollmentId), "Jours A");
    const day14 = days.find((row) => row.learning_program_days?.day_number === 14);
    const first13 = days.filter((row) => row.learning_program_days?.day_number <= 13).map((row) => row.id);
    must(day14 && first13.length === 13, "Les 14 jours de test ne sont pas disponibles.");
    expectOk(await parentA.from("student_program_day_progress").update({ status: "completed", started_at: new Date().toISOString(), completed_at: new Date().toISOString() }).in("id", first13), "Jours 1-13 completed");
    expectOk(await parentA.from("student_program_day_progress").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", day14.id), "Jour 14 in_progress");
    expectOk(await parentA.from("student_program_day_progress").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", day14.id), "Jour 14 completed");
    expectOk(await parentA.from("student_program_day_progress").update({ status: "completed" }).eq("id", day14.id), "Transition répétée");
    expectOk(await parentA.rpc("start_annual_tracking", { p_student_id: state.studentIds[0] }), "Enrollment annuel A répété");
    expectOk(await parentB.rpc("start_annual_tracking", { p_student_id: state.studentIds[1] }), "Enrollment annuel B");

    const enrollmentA = expectOk(await parentA.from("student_annual_enrollments").select("id").eq("student_id", state.studentIds[0]).single(), "Enrollment A");
    const enrollmentB = expectOk(await parentB.from("student_annual_enrollments").select("id").eq("student_id", state.studentIds[1]).single(), "Enrollment B");
    state.enrollmentIds = [enrollmentA.id, enrollmentB.id];
    await save(state);

    expectOk(await parentA.from("student_week_progress").insert({ enrollment_id: enrollmentA.id, week_id: week.id, status: "not_started" }), "Progression semaine A");
    for (const status of ["in_progress", "completed", "needs_review"]) {
      expectOk(await parentA.from("student_week_progress").update({ status, started_at: new Date().toISOString(), completed_at: status === "completed" ? new Date().toISOString() : null }).eq("enrollment_id", enrollmentA.id).eq("week_id", week.id), `Semaine ${status}`);
    }
    for (let index = 0; index < items.length; index += 1) {
      expectOk(await parentA.from("student_week_item_progress").insert({ enrollment_id: enrollmentA.id, week_item_id: items[index].id, status: "not_started" }), `Item ${index + 1}`);
      const statuses = index === 0 ? ["in_progress", "completed"] : index === 1 ? ["in_progress", "needs_review"] : ["in_progress"];
      for (const status of statuses) expectOk(await parentA.from("student_week_item_progress").update({ status, attempts: 1, last_attempt_at: new Date().toISOString() }).eq("enrollment_id", enrollmentA.id).eq("week_item_id", items[index].id), `Item ${index + 1} ${status}`);
    }

    const bWeek = expectOk(await parentB.from("student_week_progress").insert({ enrollment_id: enrollmentB.id, week_id: week.id, status: "in_progress" }).select("id").single(), "Progression semaine B");
    const bItem = expectOk(await parentB.from("student_week_item_progress").insert({ enrollment_id: enrollmentB.id, week_item_id: items[0].id, status: "in_progress" }).select("id").single(), "Progression item B");
    state.bWeekProgressId = bWeek.id; state.bItemProgressId = bItem.id;

    const pdf = new TextEncoder().encode("%PDF-1.4\n% CODEX TEST\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
    for (let index = 0; index < 2; index += 1) {
      const path = `${state.userIds[index]}/${state.studentIds[index]}/${randomUUID()}/codex-test.pdf`;
      const owner = index === 0 ? parentA : parentB;
      expectOk(await owner.storage.from("student-work").upload(path, pdf, { contentType: "application/pdf" }), `Upload ${index === 0 ? "A" : "B"}`);
      state.storagePaths.push(path);
    }
    await save(state);
    must(!((await parentA.storage.from("student-work").createSignedUrl(state.storagePaths[0], 60)).error), "Signed URL A refusée.");
    must(!!((await parentA.storage.from("student-work").createSignedUrl(state.storagePaths[1], 60)).error), "Parent A peut signer le fichier B.");
    const crossUploadPath = `${state.userIds[1]}/${state.studentIds[1]}/${randomUUID()}/forbidden.pdf`;
    must(!!((await parentA.storage.from("student-work").upload(crossUploadPath, pdf, { contentType: "application/pdf" })).error), "Parent A peut uploader dans B.");

    const annualSubmissionId = randomUUID();
    expectOk(await parentA.from("work_submissions").insert({ id: annualSubmissionId, student_id: state.studentIds[0], comment: "CODEX TEST annual", file_names: ["codex-test.pdf"], storage_paths: [state.storagePaths[0]], annual_week_id: week.id, annual_week_item_id: items[1].id }), "Soumission annuelle A");
    state.annualSubmissionId = annualSubmissionId;
    const phase1SubmissionId = randomUUID();
    const day14Item = expectOk(await admin.from("learning_program_items").select("id").eq("program_day_id", day14.program_day_id).neq("item_type", "guided_example").limit(1).single(), "Item Jour 14");
    expectOk(await parentA.from("work_submissions").insert({ id: phase1SubmissionId, student_id: state.studentIds[0], comment: "CODEX TEST phase1", file_names: ["codex-test.pdf"], storage_paths: [state.storagePaths[0]], program_day_id: day14.program_day_id, program_item_id: day14Item.id }), "Soumission Phase 1 A");
    state.phase1SubmissionId = phase1SubmissionId;
    await save(state);

    const bEnrollmentSeen = expectOk(await parentA.from("student_annual_enrollments").select("id").eq("id", enrollmentB.id), "Lecture enrollment B");
    const bWeekSeen = expectOk(await parentA.from("student_week_progress").select("id").eq("id", bWeek.id), "Lecture semaine B");
    const bItemSeen = expectOk(await parentA.from("student_week_item_progress").select("id").eq("id", bItem.id), "Lecture item B");
    must(bEnrollmentSeen.length === 0 && bWeekSeen.length === 0 && bItemSeen.length === 0, "Parent A lit des données B.");
    const crossStart = await parentA.rpc("start_annual_tracking", { p_student_id: state.studentIds[1] });
    must(!!crossStart.error, "Parent A peut démarrer l’annuel B.");
    const crossSubmission = await parentA.from("work_submissions").insert({ id: randomUUID(), student_id: state.studentIds[1], file_names: [], storage_paths: [], annual_week_id: week.id, annual_week_item_id: items[0].id });
    must(!!crossSubmission.error, "Parent A peut soumettre pour B.");

    const counts = expectOk(await admin.from("student_annual_enrollments").select("id", { count: "exact" }).eq("student_id", state.studentIds[0]).eq("annual_program_id", annualProgram.id), "Comptage enrollment A");
    state.results = {
      day14Completed: true, annualEnrollmentA: counts.length === 1, duplicateEnrollmentCount: counts.length,
      phaseAfterTransition: (await admin.from("students").select("active_phase").eq("id", state.studentIds[0]).single()).data?.active_phase,
      prepEnrollmentStatus: (await admin.from("student_program_enrollments").select("status").eq("id", prepEnrollmentId).single()).data?.status,
      rlsCrossReadBlocked: true, rlsCrossMutationBlocked: true, storageOwnSignedUrl: true,
      storageCrossSignedUrlBlocked: true, storageCrossUploadBlocked: true, annualSubmission: true, phase1Submission: true,
    };
    await save(state);
    console.log(JSON.stringify({ statePath, emailA: state.emailA, emailB: state.emailB, password, results: state.results }, null, 2));
  } catch (error) {
    await cleanup(state);
    throw error;
  }
}

async function report() {
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const submissions = expectOk(await admin.from("work_submissions").select("id,annual_week_id,annual_week_item_id,program_day_id,program_item_id").in("student_id", state.studentIds), "Soumissions");
  const analyses = submissions.length ? expectOk(await admin.from("ai_analyses").select("submission_id,provider,notions_a_revoir").in("submission_id", submissions.map((row) => row.id)), "Analyses") : [];
  console.log(JSON.stringify({ ...state.results, submissions: submissions.length, analyses: analyses.length, analysisProviders: [...new Set(analyses.map((row) => row.provider))] }, null, 2));
}

async function clean() {
  const state = JSON.parse(await readFile(statePath, "utf8"));
  await cleanup(state);
  console.log(JSON.stringify({ cleaned: true, run: state.run }));
}

const action = process.argv[2];
if (action === "setup") await setup();
else if (action === "report") await report();
else if (action === "cleanup") await clean();
else throw new Error("Usage: node scripts/validate-annual-remote.mjs setup|report|cleanup");
