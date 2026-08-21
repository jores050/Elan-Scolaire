import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

test("les rappels d’étude respectent le jour et la fenêtre horaire", async () => {
  const reminderHelpers = await import(
    pathToFileURL(path.join(root, "src/lib/reminders.ts")).href
  );

  assert.equal(
    reminderHelpers.isReminderDue({
      days: [4],
      hour: "18:30",
      now: new Date("2026-08-20T17:32:00.000Z"),
    }),
    true
  );

  assert.equal(
    reminderHelpers.isReminderDue({
      days: [3],
      hour: "18:30",
      now: new Date("2026-08-20T17:32:00.000Z"),
    }),
    false
  );
});

test("les alertes licence ne partent qu’aux jalons utiles", async () => {
  const { getLicenseReminderMilestone } = await import(
    pathToFileURL(path.join(root, "src/lib/reminders.ts")).href
  );

  assert.equal(getLicenseReminderMilestone(14), 14);
  assert.equal(getLicenseReminderMilestone(7), 7);
  assert.equal(getLicenseReminderMilestone(5), null);
  assert.equal(getLicenseReminderMilestone(1), 1);
});

test("la production configure un cron Vercel quotidien pour les notifications", () => {
  const vercelConfig = fs.readFileSync(
    path.join(root, "vercel.json"),
    "utf8"
  );

  assert.match(
    vercelConfig,
    /"path"\s*:\s*"\/api\/cron\/notifications"/
  );

  // 15:00 UTC = 16:00 au Bénin
  assert.match(
    vercelConfig,
    /"schedule"\s*:\s*"0 15 \* \* \*"/
  );
});

test("la page parametres documente le rappel quotidien", () => {
  const settingsPage = fs.readFileSync(
    path.join(root, "src/app/app/parametres/page.tsx"),
    "utf8"
  );

  assert.match(settingsPage, /16\s*h/i);
  assert.match(settingsPage, /notifications in-app/i);
});