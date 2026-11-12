import { MASTERY_THRESHOLD_DEFAULT } from "../lib/progress";
import { isLang, type Lang } from "./i18n";

/** lang: the learner's reading language. withGerman: show the German original under it (ignored when lang is "de"). */
export type CountryId = "DE" | "IT";
export interface Settings { country: CountryId | null; lang: Lang; withGerman: boolean; masteryThreshold: number; dailyGoal: number }
/** Storage key for per-country data. Germany keeps the original key (no migration); every other country gets its own. */
export const countryKey = (base: string, country: CountryId | null) => (country === "IT" ? `${base}:IT` : base);
export const defaultSettings: Settings = { country: null, lang: "ckb", withGerman: true, masteryThreshold: MASTERY_THRESHOLD_DEFAULT, dailyGoal: 10 };

/** Reads stored settings, including the earlier { langMode: "bi" | "ckb" | "de" } format. */
export function normalizeSettings(stored: unknown): Settings {
  if (!stored || typeof stored !== "object") return defaultSettings;
  const s = stored as Partial<Settings> & { langMode?: unknown };
  const legacy = s.langMode === "de" ? { lang: "de" as const, withGerman: true } : s.langMode === "ckb" ? { lang: "ckb" as const, withGerman: false } : s.langMode === "bi" ? { lang: "ckb" as const, withGerman: true } : {};
  const out: Settings = { ...defaultSettings, ...legacy };
  if (s.country === "DE" || s.country === "IT") out.country = s.country;
  if (isLang(s.lang)) out.lang = s.lang;
  if (typeof s.withGerman === "boolean") out.withGerman = s.withGerman;
  if (typeof s.masteryThreshold === "number") out.masteryThreshold = s.masteryThreshold;
  if (typeof s.dailyGoal === "number") out.dailyGoal = s.dailyGoal;
  return out;
}
