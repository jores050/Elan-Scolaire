import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const dataFile = path.join(projectRoot, "data", "dev-db.json");
if (fs.existsSync(dataFile)) fs.rmSync(dataFile, { force: true });

const db = await import("../src/lib/db.ts");

test("la génération de clés crée des codes utilisables une seule fois", () => {
  const batch = db.createLicenseBatch(2);
  assert.equal(batch.length, 2);
  const plain = batch[0].plainText;
  const verify = db.verifyLicense(plain);
  assert.equal(verify.ok, true);
  const user = db.createUser({ role: "parent", fullName: "Parent Test", email: "parent@test.local", password: "Secret123!" });
  db.activateLicense(plain, user.id);
  const secondVerify = db.verifyLicense(plain);
  assert.equal(secondVerify.ok, false);
});

test("un parent ne voit que ses propres élèves", () => {
  const userA = db.createUser({ role: "parent", fullName: "A", email: "a@test.local", password: "Secret123!" });
  const userB = db.createUser({ role: "parent", fullName: "B", email: "b@test.local", password: "Secret123!" });
  const [licenseA] = db.createLicenseBatch(1);
  const [licenseB] = db.createLicenseBatch(1);
  db.activateLicense(licenseA.plainText, userA.id);
  db.activateLicense(licenseB.plainText, userB.id);
  db.createStudent({
    parentUserId: userA.id,
    firstName: "Junior A",
    level: "3e",
    school: "",
    currentAreaSlug: "sa1",
    currentTopicSlug: "thales",
    objective: "suivre_les_cours",
    targetMinutes: 35,
    studyDays: [1, 2],
  });
  const studentsA = db.listStudentsForParent(userA.id);
  const studentsB = db.listStudentsForParent(userB.id);
  assert.equal(studentsA.length, 1);
  assert.equal(studentsB.length, 0);
});

test("un plan de travail peut être créé", () => {
  const demoStudent = db.readDb().students[0];
  const plan = db.createStudyPlan(demoStudent.id, "2026-08-20", [{ dayLabel: "J-1", topic: "Thalès", exercises: "3 exercices" }]);
  assert.equal(plan.items.length, 1);
});
