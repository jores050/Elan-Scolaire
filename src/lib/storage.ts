import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNED_URL_EXPIRES_SECONDS, STORAGE_BUCKET, TEST_UPLOAD_DIR } from "@/lib/config";
import { buildSubmissionStoragePath, createStorageError, isOwnedStoragePath, normalizeUploadFilename, validateSubmissionFiles } from "@/lib/storage-rules";

type UploadLike = {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function shouldUseTestStorage() {
  return process.env.NODE_ENV === "test";
}

export { buildSubmissionStoragePath, isOwnedStoragePath, normalizeUploadFilename, validateSubmissionFiles };

export async function uploadSubmissionFiles(input: {
  parentUserId: string;
  studentId: string;
  submissionId: string;
  files: UploadLike[];
}) {
  validateSubmissionFiles(input.files);

  if (shouldUseTestStorage()) {
    const folder = path.join(/* turbopackIgnore: true */ process.cwd(), TEST_UPLOAD_DIR, input.parentUserId, input.studentId, input.submissionId);
    mkdirSync(folder, { recursive: true });
    const storedPaths: string[] = [];
    for (const file of input.files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const normalizedName = normalizeUploadFilename(file.name);
      const dest = path.join(folder, normalizedName);
      writeFileSync(dest, bytes);
      storedPaths.push(buildSubmissionStoragePath(input.parentUserId, input.studentId, input.submissionId, file.name));
    }
    return storedPaths;
  }

  const supabase = await createSupabaseServerClient();
  const storedPaths: string[] = [];
  for (const file of input.files) {
    const storagePath = buildSubmissionStoragePath(input.parentUserId, input.studentId, input.submissionId, file.name);
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw createStorageError(500, error.message);
    storedPaths.push(storagePath);
  }
  return storedPaths;
}

export async function createSignedSubmissionUrl(storagePath: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, SIGNED_URL_EXPIRES_SECONDS);
  if (error || !data?.signedUrl) throw createStorageError(500, error?.message ?? "Impossible de générer l'URL signée.");
  return data.signedUrl;
}
