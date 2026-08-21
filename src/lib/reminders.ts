const APP_TIME_ZONE = "Africa/Porto-Novo";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getFormatter() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
}

export function getReminderTimezone() {
  return APP_TIME_ZONE;
}

export function getZonedParts(date = new Date()): ZonedParts {
  const parts = Object.fromEntries(
    getFormatter().formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday] ?? 0,
  };
}

export function parseReminderHour(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

export function normalizeReminderDays(values: number[]) {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0 && value <= 6))].sort((a, b) => a - b);
}

export function isReminderDue(input: {
  days: number[];
  hour: string;
  now?: Date;
  windowMinutes?: number;
}) {
  const now = input.now ?? new Date();
  const windowMinutes = input.windowMinutes ?? 10;
  const parsedHour = parseReminderHour(input.hour);
  if (!parsedHour) return false;
  const days = normalizeReminderDays(input.days);
  const parts = getZonedParts(now);
  if (!days.includes(parts.weekday)) return false;
  const currentMinutes = (parts.hour * 60) + parts.minute;
  const targetMinutes = (parsedHour.hour * 60) + parsedHour.minute;
  return currentMinutes >= targetMinutes && currentMinutes < targetMinutes + windowMinutes;
}

export function getLocalDateKey(date = new Date()) {
  const parts = getZonedParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getLocalWeekKey(date = new Date()) {
  const parts = getZonedParts(date);
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const isoWeekday = parts.weekday === 0 ? 7 : parts.weekday;
  base.setUTCDate(base.getUTCDate() - (isoWeekday - 1));
  return base.toISOString().slice(0, 10);
}

export function getLicenseReminderMilestone(daysRemaining: number | null) {
  if (daysRemaining == null) return null;
  if ([14, 7, 3, 1].includes(daysRemaining)) return daysRemaining;
  return null;
}

export function getWeekdayLabel(day: number) {
  return ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][day] ?? `Jour ${day}`;
}
