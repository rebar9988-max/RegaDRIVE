import type { Bilingual } from "../content/types";

/**
 * Learner languages. Sorani (ckb) and German (de) exist for every text; Kurmanji (kmr, Latin script)
 * and Arabic (ar) exist for every built-in text and fall back to German for imported items that are
 * not translated yet.
 *
 * The page layout is always the same right-to-left RegaDRIVE layout: switching the language changes
 * only the words and their text direction, never the position of the navigation, cards or buttons.
 */
export type Lang = "ckb" | "kmr" | "ar" | "de";

export const LANGS: { id: Lang; native: string; flag: string | null }[] = [
  { id: "ckb", native: "کوردی (سۆرانی)", flag: "/flags/kurdistan.png" },
  { id: "kmr", native: "Kurdî (Kurmancî)", flag: "/flags/kurdistan.png" },
  { id: "ar", native: "العربية", flag: null },
  { id: "de", native: "Deutsch", flag: "/flags/de.png" },
];

export const isLang = (v: unknown): v is Lang => v === "ckb" || v === "kmr" || v === "ar" || v === "de";

export const langDir = (l: Lang): "rtl" | "ltr" => (l === "ckb" || l === "ar" ? "rtl" : "ltr");

/** Text in the requested language plus the language it is actually written in (German when a translation is missing). */
export function pick(t: Bilingual, lang: Lang): { text: string; lang: Lang } {
  if (lang === "ckb") return { text: t.ckb, lang };
  if (lang === "de") return { text: t.de, lang };
  const v = t[lang];
  return v ? { text: v, lang } : { text: t.de, lang: "de" };
}

/** Translation of a vocabulary word into the learner's language (Sorani when the learner reads German). */
export function vocabMeaning(v: { ckb: string; kmr?: string; ar?: string }, lang: Lang): { text: string; lang: Lang } {
  if (lang === "kmr" && v.kmr) return { text: v.kmr, lang };
  if (lang === "ar" && v.ar) return { text: v.ar, lang };
  return { text: v.ckb, lang: "ckb" };
}
