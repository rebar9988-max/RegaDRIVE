import type { ElementType } from "react";
import type { Bilingual } from "../content/types";
import { useApp } from "../app/state";

/** Kurdish Sorani (RTL) first, German (LTR) directly below — or one language, per the learner's mode. */
export function Bi({ t, as: Tag = "div", className = "", inline = false }: { t: Bilingual; as?: ElementType; className?: string; inline?: boolean }) {
  const { settings } = useApp();
  const m = settings.langMode;
  return (
    <Tag className={`bi${inline ? " inline" : ""} ${className}`.trim()}>
      {m !== "de" && <span className="ckb" lang="ckb" dir="rtl">{t.ckb}</span>}
      {m !== "ckb" && <span className="de" lang="de" dir="ltr">{t.de}</span>}
    </Tag>
  );
}

/** Plain-string helper for attributes (aria-label, title). */
export function useBiText() {
  const { settings } = useApp();
  return (t: Bilingual) => (settings.langMode === "de" ? t.de : t.ckb);
}
