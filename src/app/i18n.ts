import { italianInterface } from "./italyInterface.ts";
import type { Bilingual } from "../content/types";

/**
 * Learner languages. Sorani (ckb) and German (de) exist for every text; Kurmanji (kmr, Latin script)
 * and Arabic (ar) exist for every built-in text and fall back to German for imported items that are
 * not translated yet.
 *
 * "kmr-arab" is Duhok Badini: Kurmanji written in Arabic script, right to left. It is a reading
 * language of its own and never replaces Latin-script Kurmanji. Only the Italian content carries
 * Badini wording of its own (src/content/italy); for German content and for interface strings a
 * Badini reader falls back to Sorani, the nearest script and language, not to German.
 *
 * The page layout is always the same right-to-left RegaDRIVE layout: switching the language changes
 * only the words and their text direction, never the position of the navigation, cards or buttons.
 */
export type Lang = "ckb" | "kmr" | "kmr-arab" | "ar" | "de" | "it";

export const LANGS: { id: Lang; native: string; flag: string | null }[] = [
  { id: "ckb", native: "کوردی (سۆرانی)", flag: "/flags/kurdistan.png" },
  { id: "kmr", native: "Kurdî (Kurmancî)", flag: "/flags/kurdistan.png" },
  { id: "kmr-arab", native: "بادینی (دهۆک)", flag: "/flags/kurdistan.png" },
  { id: "ar", native: "العربية", flag: null },
  { id: "de", native: "Deutsch", flag: "/flags/de.png" },
];

export const ITALY_LANGS: typeof LANGS = [
  LANGS[0],
  LANGS[2],
  { id: "it", native: "Italiano", flag: "/flags/it.svg" },
];
export const languagesFor = (country: "DE" | "IT" | null) => country === "IT" ? ITALY_LANGS : LANGS;

export const isLang = (v: unknown): v is Lang => v === "ckb" || v === "kmr" || v === "kmr-arab" || v === "ar" || v === "de" || v === "it";

export const langDir = (l: Lang): "rtl" | "ltr" => (l === "ckb" || l === "ar" || l === "kmr-arab" ? "rtl" : "ltr");

/** Text in the requested language plus the language it is actually written in (German when a translation is missing). */
export function pick(t: Bilingual, lang: Lang): { text: string; lang: Lang } {
  if (lang === "it") return italianInterface[t.de] ? { text: italianInterface[t.de], lang } : { text: t.ckb, lang: "ckb" };
  if (lang === "ckb") return { text: t.ckb, lang };
  if (lang === "de") return { text: t.de, lang };
  // German content and interface strings have no Badini wording of their own: Sorani is the fallback.
  if (lang === "kmr-arab") return { text: t.ckb, lang: "ckb" };
  const v = t[lang];
  return v ? { text: v, lang } : { text: t.de, lang: "de" };
}

/** Translation of a vocabulary word into the learner's language (Sorani when the learner reads German). */
export function vocabMeaning(v: { ckb: string; kmr?: string; ar?: string }, lang: Lang): { text: string; lang: Lang } {
  // Badini readers get Sorani here too; the vocabulary is German-content vocabulary.
  if (lang === "kmr" && v.kmr) return { text: v.kmr, lang };
  if (lang === "ar" && v.ar) return { text: v.ar, lang };
  return { text: v.ckb, lang: "ckb" };
}
