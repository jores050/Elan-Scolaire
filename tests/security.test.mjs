import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSubmissionStoragePath,
  isOwnedStoragePath,
  normalizeUploadFilename,
  validateSubmissionFiles,
} from "../src/lib/storage-rules.ts";

test("Parent A ne peut pas valider un chemin storage appartenant à Parent B", () => {
  const path = buildSubmissionStoragePath("parent-b", "student-b", "submission-1", "copie 1.jpg");
  assert.equal(isOwnedStoragePath(path, "parent-a", "student-a"), false);
});

test("Parent A peut valider un chemin storage qui lui appartient", () => {
  const path = buildSubmissionStoragePath("parent-a", "student-a", "submission-1", "copie 1.jpg");
  assert.equal(isOwnedStoragePath(path, "parent-a", "student-a"), true);
});

test("Le nom de fichier est normalisé pour le stockage", () => {
  assert.equal(normalizeUploadFilename("copie 1(é).jpg"), "copie_1___.jpg");
});

test("Refuse un MIME interdit", () => {
  assert.throws(
    () =>
      validateSubmissionFiles([
        {
          name: "script.exe",
          type: "application/octet-stream",
          size: 10,
          async arrayBuffer() {
            return new ArrayBuffer(0);
          },
        },
      ]),
    /Format non autorisé/
  );
});

test("Refuse plus de 4 fichiers", () => {
  const files = Array.from({ length: 5 }, (_, index) => ({
    name: `copie-${index}.jpg`,
    type: "image/jpeg",
    size: 10,
    async arrayBuffer() {
      return new ArrayBuffer(0);
    },
  }));
  assert.throws(() => validateSubmissionFiles(files), /Maximum 4 fichiers/);
});

test("Refuse un fichier trop volumineux", () => {
  assert.throws(
    () =>
      validateSubmissionFiles([
        {
          name: "gros.pdf",
          type: "application/pdf",
          size: 10 * 1024 * 1024,
          async arrayBuffer() {
            return new ArrayBuffer(0);
          },
        },
      ]),
    /Fichier trop volumineux/
  );
});
