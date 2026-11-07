import { MASTERY_THRESHOLD_DEFAULT } from "../lib/progress";
import { isLang, type Lang } from "./i18n";

/** lang: the learner's reading language. withGerman: show the German original under it (ignored when lang is "de"). */
export interface Settings { lang: Lang; withGerman: boolean; masteryThreshold: number; dailyGoal: number }
export const defaultSettings: Settings = { lang: "ckb", withGerman: true, masteryThreshold: MASTERY_THRESHOLD_DEFAULT, dailyGoal: 10 };

/** Reads stored settings, including the earlier { langMode: "bi" | "ckb" | "de" } format. */
export function normalizeSettings(stored: unknown): Settings {
  if (!stored || typeof stored !== "object") return defaultSettings;
  const s = stored as Partial<Settings> & { langMode?: unknown };
  const legacy = s.langMode === "de" ? { lang: "de" as const, withGerman: true } : s.langMode === "ckb" ? { lang: "ckb" as const, withGerman: false } : s.langMode === "bi" ? { lang: "ckb" as const, withGerman: true } : {};
  const out: Settings = { ...defaultSettings, ...legacy };
  if (isLang(s.lang)) out.lang = s.lang;
  if (typeof s.withGerman === "boolean") out.withGerman = s.withGerman;
  if (typeof s.masteryThreshold === "number") out.masteryThreshold = s.masteryThreshold;
  if (typeof s.dailyGoal === "number") out.dailyGoal = s.dailyGoal;
  return out;
}
