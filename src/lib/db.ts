import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { curriculum, topicLabels } from "./topics.ts";
import type {
  AIAnalysisRecord,
  AppDatabase,
  ExerciseRecord,
  LearningAreaRecord,
  LicenseRecord,
  NotificationRecord,
  SessionRecord,
  StudentRecord,
  StudyPlanItemRecord,
  StudyPlanRecord,
  TopicProgressRecord,
  TopicRecord,
  UserRecord,
  WorkSubmissionRecord,
} from "./types.ts";

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, original] = stored.split(":");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(original, "hex"));
}

function ensureDbPath() {
  const dbPath = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "dev-db.json");
  const dir = path.dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const uploadsPath = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "uploads");
  if (!existsSync(uploadsPath)) mkdirSync(uploadsPath, { recursive: true });
  return dbPath;
}

function seedExercises(): ExerciseRecord[] {
  return [
    {
      id: makeId("ex"),
      document: "Guide Prêt pour la 3e",
      section: "Jour 7",
      exerciseNumber: "3 à 5",
      topicSlug: "thales",
      difficulty: "facile",
      estimatedMinutes: 35,
      instructions: "Fais les exercices 3, 4 et 5 sur Thalès.",
      correctionReference: "Guide p.42",
    },
    {
      id: makeId("ex"),
      document: "Guide des méthodes",
      section: "SA1",
      exerciseNumber: "1 à 3",
      topicSlug: "triangle-rectangle",
      difficulty: "intermediaire",
      estimatedMinutes: 30,
      instructions: "Travaille les exercices express 1 à 3.",
      correctionReference: "Fiche triangle rectangle",
    },
    {
      id: makeId("ex"),
      document: "Banque BEPC",
      section: "Mini devoir",
      exerciseNumber: "Sujet type A",
      topicSlug: "equations",
      difficulty: "defi",
      estimatedMinutes: 40,
      instructions: "Entraîne-toi sur les équations type devoir.",
      correctionReference: "Sujet corrigé A",
    },
  ];
}

function seedDb(): AppDatabase {
  const subjectId = makeId("subject");
  const learningAreas: LearningAreaRecord[] = [];
  const topics: TopicRecord[] = [];
  curriculum.forEach((area, areaIndex) => {
    const areaId = makeId("area");
    learningAreas.push({
      id: areaId,
      subjectId,
      name: area.name,
      slug: area.slug,
      orderIndex: areaIndex + 1,
    });
    area.topics.forEach((topicSlug, topicIndex) => {
      topics.push({
        id: makeId("topic"),
        areaId,
        name: topicLabels[topicSlug],
        slug: topicSlug,
        orderIndex: topicIndex + 1,
      });
    });
  });

  const adminId = makeId("user");
  const demoParentId = makeId("user");
  const demoStudentId = makeId("student");
  const demoLicenseId = makeId("license");
  const demoSubmissionId = makeId("sub");
  const demoAnalysisId = makeId("analysis");
  const exercises = seedExercises();

  const db: AppDatabase = {
    users: [
      {
        id: adminId,
        role: "admin",
        fullName: "Admin Elan",
        email: "admin@elan.local",
        passwordHash: hashPassword("Admin123!"),
        createdAt: now(),
      },
      {
        id: demoParentId,
        role: "parent",
        fullName: "Aïcha",
        email: "aicha@demo.local",
        passwordHash: hashPassword("Demo123!"),
        createdAt: now(),
        activeLicenseId: demoLicenseId,
      },
    ],
    sessions: [],
    licenses: [
      {
        id: demoLicenseId,
        keyHash: hashText("ELAN-3E-DEMO-2026-0001"),
        keyPrefix: "ELAN-3E",
        keySuffix: "0001",
        product: "PRÊT POUR LA 3e — MATHS BÉNIN",
        status: "active",
        maxStudents: 2,
        createdAt: now(),
        activatedAt: now(),
        activatedBy: demoParentId,
      },
    ],
    activations: [
      {
        id: makeId("activation"),
        licenseId: demoLicenseId,
        userId: demoParentId,
        activatedAt: now(),
        visibleSuffix: "0001",
      },
    ],
    students: [
      {
        id: demoStudentId,
        parentUserId: demoParentId,
        firstName: "Junior",
        level: "3e",
        school: "CEG Pahou",
        currentAreaSlug: "sa1",
        currentTopicSlug: "thales",
        objective: "suivre_les_cours",
        createdAt: now(),
        targetMinutes: 35,
        studyDays: [1, 2, 4, 6],
      },
    ],
    subjects: [{ id: subjectId, name: "Mathématiques 3e Bénin", slug: "maths-3e-benin" }],
    learningAreas,
    topics,
    exercises,
    topicProgress: [
      { id: makeId("progress"), studentId: demoStudentId, topicSlug: "nombres-reels", score: 82, mastery: "maitrise", updatedAt: now() },
      { id: makeId("progress"), studentId: demoStudentId, topicSlug: "valeur-absolue", score: 76, mastery: "maitrise", updatedAt: now() },
      { id: makeId("progress"), studentId: demoStudentId, topicSlug: "thales", score: 48, mastery: "a_renforcer", updatedAt: now() },
      { id: makeId("progress"), studentId: demoStudentId, topicSlug: "triangle-rectangle", score: 60, mastery: "a_renforcer", updatedAt: now() },
    ],
    submissions: [
      {
        id: demoSubmissionId,
        studentId: demoStudentId,
        exerciseId: exercises[0]?.id ?? "",
        comment: "J’ai eu du mal à la question 2.",
        fileNames: ["demo-thales.jpg"],
        storedPaths: ["demo/demo-thales.jpg"],
        createdAt: now(),
      },
    ],
    analyses: [
      {
        id: demoAnalysisId,
        submissionId: demoSubmissionId,
        score: 13,
        status: "partiel",
        pointsForts: ["Bonne mise en place de Thalès", "Raisonnement global correct"],
        erreurs: ["Rapports inversés à la question 2"],
        notionsARevoir: ["Correspondance des côtés"],
        conseilEleve: "Tu avances bien. Reprends la correspondance des côtés avant de refaire l’exercice.",
        conseilParent: "Revoir calmement la méthode Thalès puis refaire 2 exercices courts.",
        exercicesRecommandes: ["Exercices 2 et 3"],
        provider: "local",
        createdAt: now(),
      },
    ],
    studyPlans: [],
    notifications: [
      { id: makeId("notif"), userId: demoParentId, type: "exercise_a_faire", message: "Junior a un travail prévu aujourd’hui : Thalès — exercices 3 à 5.", createdAt: now(), read: false },
    ],
    reminders: [{ id: makeId("reminder"), studentId: demoStudentId, days: [1, 2, 4, 6], hour: "18:00" }],
    audits: [],
  };
  return db;
}

export function readDb(): AppDatabase {
  const file = ensureDbPath();
  if (!existsSync(file)) {
    const seeded = seedDb();
    writeFileSync(file, JSON.stringify(seeded, null, 2), "utf8");
    return seeded;
  }
  return JSON.parse(readFileSync(file, "utf8")) as AppDatabase;
}

export function writeDb(db: AppDatabase) {
  const file = ensureDbPath();
  writeFileSync(file, JSON.stringify(db, null, 2), "utf8");
}

export function createSession(userId: string) {
  const db = readDb();
  const session: SessionRecord = { id: makeId("session"), userId, createdAt: now() };
  db.sessions.push(session);
  writeDb(db);
  return session;
}

export function getUserBySession(sessionId: string) {
  const db = readDb();
  const session = db.sessions.find((item) => item.id === sessionId);
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.userId);
  return user ?? null;
}

export function destroySession(sessionId: string) {
  const db = readDb();
  db.sessions = db.sessions.filter((item) => item.id !== sessionId);
  writeDb(db);
}

export function findUserByEmail(email: string) {
  return readDb().users.find((item) => item.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function createUser(input: Pick<UserRecord, "role" | "fullName" | "email"> & { password: string; activeLicenseId?: string }) {
  const db = readDb();
  if (db.users.some((item) => item.email.toLowerCase() === input.email.toLowerCase())) {
    throw new Error("Un compte existe déjà avec cet email.");
  }
  const user: UserRecord = {
    id: makeId("user"),
    role: input.role,
    fullName: input.fullName,
    email: input.email.toLowerCase(),
    passwordHash: hashPassword(input.password),
    createdAt: now(),
    activeLicenseId: input.activeLicenseId,
  };
  db.users.push(user);
  writeDb(db);
  return user;
}

export function authenticateUser(email: string, password: string) {
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return user;
}

export function generateLicensePlainText() {
  const pieces = [
    randomBytes(2).toString("hex").toUpperCase(),
    randomBytes(2).toString("hex").toUpperCase(),
    randomBytes(2).toString("hex").toUpperCase(),
  ];
  return `ELAN-3E-${pieces.join("-")}`;
}

export function createLicenseBatch(count: number, product = "PRÊT POUR LA 3e — MATHS BÉNIN") {
  const db = readDb();
  const generated: Array<LicenseRecord & { plainText: string }> = [];
  for (let i = 0; i < count; i += 1) {
    const plainText = generateLicensePlainText();
    const suffix = plainText.slice(-4);
    const license: LicenseRecord = {
      id: makeId("license"),
      keyHash: hashText(plainText),
      keyPrefix: "ELAN-3E",
      keySuffix: suffix,
      product,
      status: "available",
      maxStudents: 2,
      createdAt: now(),
    };
    db.licenses.push(license);
    generated.push({ ...license, plainText });
  }
  writeDb(db);
  return generated;
}

export function verifyLicense(code: string) {
  const db = readDb();
  const license = db.licenses.find((item) => item.keyHash === hashText(code.trim().toUpperCase()));
  if (!license) return { ok: false as const, reason: "invalide" };
  if (license.status === "disabled") return { ok: false as const, reason: "desactivee" };
  if (license.status === "expired") return { ok: false as const, reason: "expiree" };
  if (license.status === "active") return { ok: false as const, reason: "deja_utilisee" };
  return { ok: true as const, license };
}

export function activateLicense(code: string, userId: string) {
  const db = readDb();
  const license = db.licenses.find((item) => item.keyHash === hashText(code.trim().toUpperCase()));
  if (!license) throw new Error("Clé invalide.");
  if (license.status !== "available") throw new Error("Cette clé ne peut pas être activée.");
  license.status = "active";
  license.activatedAt = now();
  license.activatedBy = userId;
  const user = db.users.find((item) => item.id === userId);
  if (user) user.activeLicenseId = license.id;
  db.activations.push({
    id: makeId("activation"),
    licenseId: license.id,
    userId,
    activatedAt: now(),
    visibleSuffix: license.keySuffix,
  });
  db.audits.push({
    id: makeId("audit"),
    actorUserId: userId,
    action: "license_activated",
    createdAt: now(),
    payload: JSON.stringify({ suffix: license.keySuffix }),
  });
  writeDb(db);
  return license;
}

export function createStudent(input: Omit<StudentRecord, "id" | "createdAt">) {
  const db = readDb();
  const user = db.users.find((item) => item.id === input.parentUserId);
  if (!user?.activeLicenseId) throw new Error("Aucune licence active.");
  const license = db.licenses.find((item) => item.id === user.activeLicenseId);
  const count = db.students.filter((item) => item.parentUserId === input.parentUserId).length;
  if (!license || count >= license.maxStudents) throw new Error("La limite d’élèves pour cette licence est atteinte.");
  const student: StudentRecord = { ...input, id: makeId("student"), createdAt: now() };
  db.students.push(student);
  db.audits.push({ id: makeId("audit"), actorUserId: input.parentUserId, action: "student_created", createdAt: now(), payload: JSON.stringify({ studentId: student.id }) });
  writeDb(db);
  return student;
}

export function listStudentsForParent(parentUserId: string) {
  return readDb().students.filter((item) => item.parentUserId === parentUserId);
}

export function getStudent(studentId: string) {
  return readDb().students.find((item) => item.id === studentId) ?? null;
}

export function setStudentCurrentTopic(studentId: string, areaSlug: string, topicSlug: string) {
  const db = readDb();
  const student = db.students.find((item) => item.id === studentId);
  if (!student) throw new Error("Élève introuvable.");
  student.currentAreaSlug = areaSlug;
  student.currentTopicSlug = topicSlug;
  writeDb(db);
  return student;
}

export function updateStudentSettings(studentId: string, targetMinutes: number, studyDays: number[]) {
  const db = readDb();
  const student = db.students.find((item) => item.id === studentId);
  if (!student) throw new Error("Élève introuvable.");
  student.targetMinutes = targetMinutes;
  student.studyDays = studyDays;
  writeDb(db);
  return student;
}

export function getExercisesByTopic(topicSlug: string) {
  return readDb().exercises.filter((item) => item.topicSlug === topicSlug);
}

export function getProgressForStudent(studentId: string) {
  return readDb().topicProgress.filter((item) => item.studentId === studentId);
}

export function upsertTopicProgress(studentId: string, topicSlug: string, score: number) {
  const db = readDb();
  const mastery: TopicProgressRecord["mastery"] = score >= 80 ? "maitrise" : score < 45 ? "a_reprendre" : "a_renforcer";
  const existing = db.topicProgress.find((item) => item.studentId === studentId && item.topicSlug === topicSlug);
  if (existing) {
    existing.score = score;
    existing.mastery = mastery;
    existing.updatedAt = now();
  } else {
    db.topicProgress.push({ id: makeId("progress"), studentId, topicSlug, score, mastery, updatedAt: now() });
  }
  writeDb(db);
}

export function createSubmission(input: Omit<WorkSubmissionRecord, "id" | "createdAt">) {
  const db = readDb();
  const submission: WorkSubmissionRecord = { ...input, id: makeId("submission"), createdAt: now() };
  db.submissions.push(submission);
  writeDb(db);
  return submission;
}

export function createAnalysis(input: Omit<AIAnalysisRecord, "id" | "createdAt">) {
  const db = readDb();
  const analysis: AIAnalysisRecord = { ...input, id: makeId("analysis"), createdAt: now() };
  db.analyses.push(analysis);
  writeDb(db);
  return analysis;
}

export function addNotification(entry: Omit<NotificationRecord, "id" | "createdAt" | "read">) {
  const db = readDb();
  db.notifications.unshift({ id: makeId("notif"), createdAt: now(), read: false, ...entry });
  writeDb(db);
}

export function getLatestAnalysisForStudent(studentId: string) {
  const db = readDb();
  const submissionIds = db.submissions.filter((item) => item.studentId === studentId).map((item) => item.id);
  return db.analyses.find((item) => submissionIds.includes(item.submissionId)) ?? null;
}

export function listSubmissionsForStudent(studentId: string) {
  return readDb().submissions.filter((item) => item.studentId === studentId);
}

export function listAnalyses() {
  return readDb().analyses;
}

export function createStudyPlan(studentId: string, examDate: string, items: StudyPlanItemRecord[]) {
  const db = readDb();
  const plan: StudyPlanRecord = { id: makeId("plan"), studentId, examDate, createdAt: now(), items };
  db.studyPlans.unshift(plan);
  writeDb(db);
  return plan;
}

export function listStudyPlans(studentId: string) {
  return readDb().studyPlans.filter((item) => item.studentId === studentId);
}

export function listNotifications(userId: string) {
  return readDb().notifications.filter((item) => item.userId === userId).slice(0, 6);
}

export function exportLicensesCsv() {
  const db = readDb();
  const rows = [["suffix", "status", "product", "created_at", "activated_at"]].concat(
    db.licenses.map((item) => [item.keySuffix, item.status, item.product, item.createdAt, item.activatedAt ?? ""])
  );
  return rows.map((row) => row.join(",")).join("\n");
}
