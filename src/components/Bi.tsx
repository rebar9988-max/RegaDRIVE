import type { ElementType } from "react";
import { useApp } from "../app/state";
import { langDir } from "../app/i18n";
import { isItText, sourceText, textLines, type AnyText } from "../app/anyText";

/**
 * The learner's language first (Sorani, Kurmanji, Badini, Arabic or German), and the source wording
 * directly below it when "show the original" is on — German for the German content, Italian for the
 * Italian content. Each line carries its own lang/dir, so the page layout never mirrors.
 */
export function Bi({ t, as: Tag = "div", className = "", inline = false }: { t: AnyText; as?: ElementType; className?: string; inline?: boolean }) {
  const { settings } = useApp();
  const { primary, source } = textLines(t, settings.lang, settings.withGerman && (settings.country !== "IT" || isItText(t)));
  // Reading the source language itself has no second line. Two invisible half-height placeholders (one
  // above, one below) keep the same height as in the other languages and keep the text centred, so
  // nothing jumps up or down when switching.
  const ghost = settings.withGerman && !source && !inline;
  const spacer = ghost ? <span className="de ghost" aria-hidden="true" dir="ltr">{sourceText(t)}</span> : null;
  return (
    <Tag className={`bi${inline ? " inline" : ""} ${className}`.trim()}>
      {spacer}
      <span className="pri" lang={primary.lang} dir={langDir(primary.lang)}>{primary.text}</span>
      {source && <span className="de" lang={source.lang} dir="ltr">{source.text}</span>}
      {spacer}
    </Tag>
  );
}

/** Plain-string helper for attributes (aria-label, title) and single-line labels. */
export function useBiText() {
  const { settings } = useApp();
  return (t: AnyText) => textLines(t, settings.lang, false).primary.text;
}
