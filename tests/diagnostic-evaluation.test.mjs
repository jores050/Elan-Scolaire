import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

test("une erreur isolée ne bascule pas automatiquement une notion en a_reprendre", async () => {
  const { diagnosticReferential } = await import(pathToFileURL(path.join(root, "src/lib/diagnostic-referential.ts")).href);
  const { evaluateDiagnosticTopicResults } = await import(pathToFileURL(path.join(root, "src/lib/diagnostic-evaluation.ts")).href);

  const results = evaluateDiagnosticTopicResults(
    diagnosticReferential,
    [
      {
        referenceId: "DIAG-15",
        topicSlug: "equations",
        result: "incorrect",
        evidence: "Une seule équation mal résolue.",
        confidence: "medium",
      },
    ],
    new Map(),
  );

  assert.equal(results[0].topicSlug, "equations");
  assert.equal(results[0].mastery, "a_renforcer");
});

test("deux signaux faibles sur une même notion peuvent déclencher a_reprendre", async () => {
  const { diagnosticReferential } = await import(pathToFileURL(path.join(root, "src/lib/diagnostic-referential.ts")).href);
  const { evaluateDiagnosticTopicResults } = await import(pathToFileURL(path.join(root, "src/lib/diagnostic-evaluation.ts")).href);

  const results = evaluateDiagnosticTopicResults(
    diagnosticReferential,
    [
      {
        referenceId: "DIAG-01",
        topicSlug: "relatifs_signes",
        result: "incorrect",
        evidence: "Erreurs de signes répétées.",
        confidence: "high",
      },
      {
        referenceId: "DIAG-02",
        topicSlug: "relatifs_signes",
        result: "incorrect",
        evidence: "Produit et quotient de relatifs non maîtrisés.",
        confidence: "high",
      },
    ],
    new Map(),
  );

  assert.equal(results[0].topicSlug, "relatifs_signes");
  assert.equal(results[0].mastery, "a_reprendre");
});
