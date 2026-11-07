import type { ElementType } from "react";
import type { Bilingual } from "../content/types";
import { useApp } from "../app/state";
import { langDir, pick } from "../app/i18n";

/**
 * The learner's language first (Sorani, Kurmanji, Arabic or German), and the German original directly
 * below it when "show German" is on. Each line carries its own lang/dir, so the page layout never mirrors.
 */
export function Bi({ t, as: Tag = "div", className = "", inline = false }: { t: Bilingual; as?: ElementType; className?: string; inline?: boolean }) {
  const { settings } = useApp();
  const p = pick(t, settings.lang);
  const withDe = settings.withGerman && p.lang !== "de";
  // German as the main language has no second line. Two invisible half-height placeholders (one
  // above, one below) keep the same height as in Sorani, Kurmanji and Arabic and keep the text
  // centred, so nothing jumps up or down when switching.
  const ghost = settings.withGerman && p.lang === "de" && !inline;
  const spacer = ghost ? <span className="de ghost" aria-hidden="true" dir="ltr">{t.de}</span> : null;
  return (
    <Tag className={`bi${inline ? " inline" : ""} ${className}`.trim()}>
      {spacer}
      <span className="pri" lang={p.lang} dir={langDir(p.lang)}>{p.text}</span>
      {withDe && <span className="de" lang="de" dir="ltr">{t.de}</span>}
      {spacer}
    </Tag>
  );
}

/** Plain-string helper for attributes (aria-label, title) and single-line labels. */
export function useBiText() {
  const { settings } = useApp();
  return (t: Bilingual) => pick(t, settings.lang).text;
}
