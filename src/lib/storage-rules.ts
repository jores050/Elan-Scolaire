const MAX_UPLOAD_FILES = 4;
const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

type UploadLike = {
  name: string;
  size: number;
  type: string;
};

export function createStorageError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export function normalizeUploadFilename(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function buildSubmissionStoragePath(parentUserId: string, studentId: string, submissionId: string, fileName: string) {
  return `${parentUserId}/${studentId}/${submissionId}/${normalizeUploadFilename(fileName)}`;
}

export function isOwnedStoragePath(storagePath: string, parentUserId: string, studentId?: string) {
  const parts = storagePath.split("/");
  if (parts.length < 4) return false;
  if (parts[0] !== parentUserId) return false;
  if (studentId && parts[1] !== studentId) return false;
  return true;
}

export function validateSubmissionFiles(files: UploadLike[]) {
  if (files.length === 0) throw createStorageError(400, "Aucun fichier fourni.");
  if (files.length > MAX_UPLOAD_FILES) throw createStorageError(400, `Maximum ${MAX_UPLOAD_FILES} fichiers.`);
  for (const file of files) {
    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number])) {
      throw createStorageError(400, `Format non autorisé: ${file.type || file.name}`);
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      throw createStorageError(400, `Fichier trop volumineux: ${file.name}`);
    }
  }
}
