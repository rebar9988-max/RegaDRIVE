import { useId, useState } from "react";
import type { Question } from "../content/types";
import { signById } from "../content/signs";
import { topicById } from "../content/topics";
import { isAnswerCorrect } from "../lib/shared/exam";
import { recordAnswer, toggleBookmark } from "../lib/progress";
import { useApp } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "./Bi";
import { SignIcon } from "./SignIcon";
import { Icon } from "./Icon";

interface Props {
  question: Question;
  mode: "practice" | "exam";
  sessionId: string;
  index?: number;
  total?: number;
  /** Exam mode: controlled selection. */
  selected?: string[];
  onSelect?: (ids: string[]) => void;
  onNext?: () => void;
}

export function QuestionCard({ question: q, mode, sessionId, index, total, selected: controlled, onSelect, onNext }: Props) {
  const { progress, update } = useApp();
  const label = useBiText();
  const [local, setLocal] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const selected = controlled ?? local;
  const legendId = useId();
  const sign = q.signId ? signById(q.signId) : undefined;
  const topic = topicById(q.topicId);
  const correct = isAnswerCorrect(selected, q.correct);
  const reveal = mode === "practice" && checked;
  const bookmarked = progress.bookmarks.includes(q.id);

  const toggle = (id: string) => {
    if (reveal) return;
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    if (controlled) onSelect?.(next); else setLocal(next);
  };

  const check = () => {
    if (checked || selected.length === 0) return;
    setChecked(true);
    update((p) => recordAnswer(p, sessionId, q.id, isAnswerCorrect(selected, q.correct), Date.now()));
  };

  return (
    <article className="card" aria-labelledby={legendId} data-testid="question-card" data-qid={q.id}>
      <div className="q-meta">
        {index !== undefined && total !== undefined && <span className="badge" dir="ltr">{index + 1} / {total}</span>}
        {q.points !== null && <span className="badge"><Bi t={{ ckb: `${q.points} ${T.points.ckb}`, de: `${q.points} ${T.points.de}` }} inline /></span>}
        <span className="badge badge-outline">{q.categoryType}</span>
        {topic && <span className="badge badge-outline"><Bi t={topic.title} inline /></span>}
        <span className="spacer" />
        <button type="button" className="chip" aria-pressed={bookmarked} onClick={() => update((p) => toggleBookmark(p, q.id))}>
          <Icon name="bookmark" /><span>{label(bookmarked ? T.bookmarked : T.bookmark)}</span>
        </button>
      </div>

      {sign && <SignIcon sign={sign} className="q-sign" label={`${label(sign.name)} (${sign.stvoNumber})`} />}

      <fieldset className="options" aria-describedby={`${legendId}-hint`}>
        <legend id={legendId} className="q-prompt"><Bi t={q.prompt} /></legend>
        <p id={`${legendId}-hint`} className="muted small" style={{ marginTop: -8, marginBottom: 4 }}><Bi t={T.multipleHint} inline /></p>
        {q.options.map((o) => {
          const isSel = selected.includes(o.id);
          const isRight = q.correct.includes(o.id);
          const cls = ["option", isSel && "is-selected", reveal && isRight && "is-correct", reveal && isSel && !isRight && "is-wrong", reveal && "is-disabled"].filter(Boolean).join(" ");
          return (
            <label key={o.id} className={cls} data-testid={`option-${o.id}`}>
              <input type="checkbox" checked={isSel} disabled={reveal} onChange={() => toggle(o.id)} />
              <Bi t={o.text} />
            </label>
          );
        })}
      </fieldset>

      {reveal && (
        <div className={`feedback ${correct ? "ok" : "bad"}`} role="status" data-testid="feedback">
          <div className="feedback-title"><Bi t={correct ? T.correct : T.incorrect} inline /></div>
          <Bi t={q.explanation} />
          <AiExplain questionId={q.id} />
        </div>
      )}

      {mode === "practice" && (
        <div className="q-actions">
          {!checked
            ? <button type="button" className="btn btn-primary" disabled={selected.length === 0} onClick={check} data-testid="check"><Bi t={T.checkAnswer} /></button>
            : onNext && <button type="button" className="btn btn-primary" onClick={onNext} data-testid="next"><Bi t={T.next} /></button>}
        </div>
      )}

      <div className="row small muted" style={{ marginTop: 16 }}>
        <span className="badge badge-outline"><Bi t={T.originalQ} inline /></span>
        {q.reviewStatus !== "approved" && <span className="badge badge-outline"><Bi t={T.pendingReview} inline /></span>}
      </div>
      <p className="copyright muted"><Bi t={T.copyright} /></p>
    </article>
  );
}

function AiExplain({ questionId }: { questionId: string }) {
  const { online } = useApp();
  const label = useBiText();
  const [state, setState] = useState<"idle" | "loading" | "done" | "unavailable">("idle");
  const [text, setText] = useState("");
  if (!online) return null;
  const run = async () => {
    setState("loading");
    try {
      const r = await fetch("/api/ai/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionId }) });
      const j = (await r.json()) as { text?: string };
      if (r.ok && j.text) { setText(j.text); setState("done"); } else setState("unavailable");
    } catch { setState("unavailable"); }
  };
  return (
    <div style={{ marginTop: 12 }}>
      {state === "idle" && <button type="button" className="btn btn-secondary btn-sm" onClick={run}><Icon name="sparkle" />{label(T.explainAi)}</button>}
      {state === "loading" && <button type="button" className="btn btn-secondary btn-sm" aria-busy="true" disabled>{label(T.explainAi)}</button>}
      {state === "unavailable" && <p className="small muted" role="status"><Bi t={T.aiUnavailable} /></p>}
      {state === "done" && <div className="notice small" role="status"><p style={{ whiteSpace: "pre-wrap" }}>{text}</p><p className="muted" style={{ marginTop: 8 }}><Bi t={T.aiNote} /></p></div>}
    </div>
  );
}
