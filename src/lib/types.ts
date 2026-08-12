export type LicenseStatus = "available" | "activated" | "disabled" | "expired";
export type UserRole = "parent" | "admin";
export type MasteryStatus = "pas_commence" | "en_cours" | "maitrise" | "a_renforcer";
export type AnalysisStatus = "reussi" | "partiel" | "a_revoir";

export type UserRecord = {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  activeLicenseId?: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  createdAt: string;
};

export type LicenseRecord = {
  id: string;
  keyHash: string;
  keyPrefix: string;
  keySuffix: string;
  product: string;
  status: LicenseStatus;
  maxStudents: number;
  createdAt: string;
  activatedAt?: string;
  activatedBy?: string;
  expiresAt?: string;
  orderReference?: string;
  notes?: string;
};

export type LicenseActivationRecord = {
  id: string;
  licenseId: string;
  userId: string;
  activatedAt: string;
  visibleSuffix: string;
};

export type StudentRecord = {
  id: string;
  parentUserId: string;
  firstName: string;
  level: string;
  school?: string;
  currentAreaSlug: string;
  currentTopicSlug: string;
  objective: "reprendre_les_bases" | "suivre_les_cours" | "preparer_un_devoir" | "preparer_le_bepc";
  createdAt: string;
  targetMinutes: number;
  studyDays: number[];
};

export type SubjectRecord = {
  id: string;
  name: string;
  slug: string;
};

export type LearningAreaRecord = {
  id: string;
  subjectId: string;
  name: string;
  slug: string;
  orderIndex: number;
};

export type TopicRecord = {
  id: string;
  areaId: string;
  name: string;
  slug: string;
  orderIndex: number;
};

export type ExerciseRecord = {
  id: string;
  document: string;
  section: string;
  exerciseNumber: string;
  topicSlug: string;
  difficulty: "facile" | "intermediaire" | "defi";
  estimatedMinutes: number;
  instructions: string;
  correctionReference: string;
};

export type TopicProgressRecord = {
  id: string;
  studentId: string;
  topicSlug: string;
  score: number;
  mastery: MasteryStatus;
  updatedAt: string;
};

export type WorkSubmissionRecord = {
  id: string;
  studentId: string;
  exerciseId: string;
  comment?: string;
  fileNames: string[];
  storedPaths: string[];
  createdAt: string;
};

export type AIAnalysisRecord = {
  id: string;
  submissionId: string;
  score: number;
  status: AnalysisStatus;
  pointsForts: string[];
  erreurs: string[];
  notionsARevoir: string[];
  conseilEleve: string;
  conseilParent: string;
  exercicesRecommandes: string[];
  provider: "gemini" | "local";
  createdAt: string;
};

export type StudyPlanItemRecord = {
  dayLabel: string;
  topic: string;
  exercises: string;
};

export type StudyPlanRecord = {
  id: string;
  studentId: string;
  examDate: string;
  createdAt: string;
  items: StudyPlanItemRecord[];
};

export type NotificationRecord = {
  id: string;
  userId: string;
  type: "exercise_a_faire" | "travail_analyse" | "notion_a_revoir" | "devoir_proche" | "nouvelle_recommandation";
  message: string;
  createdAt: string;
  read: boolean;
};

export type ReminderPreferenceRecord = {
  id: string;
  studentId: string;
  days: number[];
  hour: string;
};

export type AuditRecord = {
  id: string;
  actorUserId: string;
  action: string;
  createdAt: string;
  payload: string;
};

export type AppDatabase = {
  users: UserRecord[];
  sessions: SessionRecord[];
  licenses: LicenseRecord[];
  activations: LicenseActivationRecord[];
  students: StudentRecord[];
  subjects: SubjectRecord[];
  learningAreas: LearningAreaRecord[];
  topics: TopicRecord[];
  exercises: ExerciseRecord[];
  topicProgress: TopicProgressRecord[];
  submissions: WorkSubmissionRecord[];
  analyses: AIAnalysisRecord[];
  studyPlans: StudyPlanRecord[];
  notifications: NotificationRecord[];
  reminders: ReminderPreferenceRecord[];
  audits: AuditRecord[];
};
