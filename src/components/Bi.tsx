import type { ElementType } from "react";
import type { Bilingual } from "../content/types";
import { useApp } from "../app/state";
import { LANGS, langDir, pick } from "../app/i18n";

/**
 * The learner's language first (Sorani, Kurmanji, Arabic or German), and the German original directly
 * below it when "show German" is on. Each line carries its own lang/dir, so the page layout never mirrors.
 */
export function Bi({ t, as: Tag = "div", className = "", inline = false }: { t: Bilingual; as?: ElementType; className?: string; inline?: boolean }) {
  const { settings } = useApp();
  const p = pick(t, settings.lang);
  const withDe = settings.withGerman && p.lang !== "de";
  // Invisible, inert translations share the primary grid cell, reserving the
  // tallest natural wrapping height across scripts without clipping resized text.
  const ghost = settings.withGerman && p.lang === "de" && !inline;
  return (
    <Tag className={`bi${inline ? " inline" : ""} ${className}`.trim()}>
      <span className="pri" lang={p.lang} dir={langDir(p.lang)}>{p.text}</span>
      {withDe && <span className="de" lang="de" dir="ltr">{t.de}</span>}
      {ghost && <span className="de ghost" aria-hidden="true" dir="ltr">{t.de}</span>}
      {!inline && <i className="bi-reserve" aria-hidden="true">{LANGS.map(({ id }) =>
        <span key={id} data-script={id} dir={langDir(id)}>{pick(t, id).text}</span>
       )}</i>}
    </Tag>
  );
}

/** Plain-string helper for attributes (aria-label, title) and single-line labels. */
export function useBiText() {
  const { settings } = useApp();
  return (t: Bilingual) => pick(t, settings.lang).text;
}
