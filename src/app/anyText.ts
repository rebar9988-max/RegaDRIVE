import type { Bilingual } from "../content/types";
import type { ItText } from "../content/italy/types";
import { pickIt } from "../content/italy/text";
import { pick, type Lang } from "./i18n";

/**
 * The two content models the learner UI can show: German (Bilingual, source language German) and
 * Italian (ItText, source language Italian). The content systems stay separate; this module is the
 * single boundary where the shared text components decide which one they were handed.
 */
export type AnyText = Bilingual | ItText;

export const isItText = (t: AnyText): t is ItText => typeof (t as ItText).it === "string";

/** The source language of a text: the language its wording was written in and reviewed against. */
export const sourceLang = (t: AnyText): "de" | "it" => (isItText(t) ? "it" : "de");
export const sourceText = (t: AnyText): string => (isItText(t) ? t.it : t.de);

/**
 * The learner's line and, when the source line is switched on, the original underneath it.
 * No second line when the learner is already reading the source language.
 */
export function textLines(t: AnyText, lang: Lang, withSource: boolean): {
  primary: { text: string; lang: Lang };
  source: { text: string; lang: "de" | "it" } | null;
} {
  const primary = isItText(t) ? pickIt(t, lang) : pick(t, lang);
  const src = sourceLang(t);
  const same = primary.lang === src;
  return { primary, source: withSource && !same ? { text: sourceText(t), lang: src } : null };
}
