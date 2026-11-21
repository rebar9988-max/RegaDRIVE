import type { Lang } from "../../app/i18n.ts";
import type { ItText } from "./types.ts";

/**
 * Reading language for an Italian text. Sorani and Badini are authored wording; Kurmanji, German and
 * Arabic are drafted translations. When a translation is missing the text falls back to Sorani, the
 * language every Italian item is authored in — never silently to Italian, which is the source line
 * shown underneath (see src/app/anyText.ts).
 */
export function pickIt(t: ItText, lang: Lang): { text: string; lang: Lang } {
  if (lang === "ckb") return { text: t.ckb, lang };
  const v = lang === "kmr-arab" ? t.kmrArab : t[lang];
  return v ? { text: v, lang } : { text: t.ckb, lang: "ckb" };
}

/** The Italian source wording. For Italy this is the second line, as the German original is for Germany. */
export const itSource = (t: ItText): string => t.it;
