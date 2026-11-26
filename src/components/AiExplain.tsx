import { useState } from "react";
import { isLang, langDir, type Lang } from "../app/i18n";
import { useApp } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "./Bi";
import { Icon } from "./Icon";

type Result = { text: string; lang: Lang };

export function AiExplain({ questionId }: { questionId: string }) {
  const { online, settings } = useApp();
  if (!online) return null;
  return <ExplanationControl key={`${questionId}:${settings.lang}`} questionId={questionId} lang={settings.lang} />;
}

function ExplanationControl({ questionId, lang }: { questionId: string; lang: Lang }) {
  const label = useBiText();
  // The reviewed explanation stays visible on the card while providers are tried and on any failure.
  const [result, setResult] = useState<"idle" | "loading" | "fallback" | Result>("idle");
  const run = async () => {
    setResult("loading");
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId, lang }),
        signal: AbortSignal.timeout(17_000),
      });
      const data = await res.json() as { generated?: boolean; text?: string; lang?: unknown };
      if (res.ok && data.generated === true && typeof data.text === "string" && data.text && isLang(data.lang)) {
        setResult({ text: data.text, lang: data.lang });
      } else {
        setResult("fallback");
      }
    } catch {
      setResult("fallback");
    }
  };
  if (result === "fallback") return null;
  if (typeof result === "object") return (
    <div className="notice small" role="status" style={{ marginTop: 12 }}>
      <p style={{ whiteSpace: "pre-wrap" }} lang={result.lang} dir={langDir(result.lang)}>{result.text}</p>
      <p className="muted" style={{ marginTop: 8 }}><Bi t={T.aiNote} /></p>
    </div>
  );
  return (
    <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}
      onClick={() => void run()} aria-busy={result === "loading"} disabled={result === "loading"}>
      <Icon name="sparkle" />{label(T.explainAi)}
    </button>
  );
}
