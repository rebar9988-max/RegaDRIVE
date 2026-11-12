import { Link } from "../app/router";
import { useId, useState } from "react";
import type { Question } from "../content/types";
import { signById } from "../content/signs";
import { topicById } from "../content/topics";
import { isQuestionAnswerCorrect } from "../lib/answers";
import { QuestionMedia } from "./QuestionMedia";
import type { PlayCounts } from "../lib/mediaPlays";
import { recordAnswer, toggleBookmark } from "../lib/progress";
import { useApp } from "../app/state";
import { langDir } from "../app/i18n";
import { T } from "../app/strings";
import { Bi, useBiText } from "./Bi";
import { SignIcon } from "./SignIcon";
import { Icon } from "./Icon";

interface Props {
  question: Question;
  /** "review": read-only, shows the given selection against the answer key (exam evaluation). Nothing is scored. */
  mode: "practice" | "exam" | "review";
  sessionId: string;
  index?: number;
  total?: number;
  /** Exam mode: controlled selection. */
  selected?: string[];
  onSelect?: (ids: string[]) => void;
  onNext?: () => void;
  /** Practice: the answer already checked in this session, restored when the learner comes back to the question. */
  checkedAnswer?: string[];
  onChecked?: (ids: string[]) => void;
  /** Exam: video play counts (five plays per clip), stored by the exam so a reload cannot reset them. */
  plays?: { counts: PlayCounts; onPlay: (key: string) => void };
}

export function QuestionCard({ question: q, mode, sessionId, index, total, selected: controlled, onSelect, onNext, checkedAnswer, onChecked, plays }: Props) {
  const { progress, update } = useApp();
  const label = useBiText();
  const [local, setLocal] = useState<string[]>(checkedAnswer ?? []);
  const [checked, setChecked] = useState(checkedAnswer !== undefined);
  const selected = controlled ?? local;
  const legendId = useId();
  const sign = q.signId ? signById(q.signId) : undefined;
  const topic = topicById(q.topicId);
  const correct = isQuestionAnswerCorrect(q, selected);
  const isNumber = q.answerType === "number";
  // The answer key is shown only after the learner handed the answer in — never while choosing.
  const reveal = mode === "review" || (mode === "practice" && checked);
  const bookmarked = progress.bookmarks.includes(q.id);

  const toggle = (id: string) => {
    if (reveal) return;
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    if (controlled) onSelect?.(next); else setLocal(next);
  };
  const setNumber = (v: string) => {
    if (reveal) return;
    const next = v.trim() === "" ? [] : [v];
    if (controlled) onSelect?.(next); else setLocal(next);
  };

  const check = () => {
    if (checked || selected.length === 0) return;
    setChecked(true);
    onChecked?.(selected);
    update((p) => recordAnswer(p, sessionId, q.id, isQuestionAnswerCorrect(q, selected), Date.now()));
  };

  return (
    <article className="card question-card" aria-labelledby={legendId} data-testid="question-card" data-qid={q.id}>
      {index !== undefined && total !== undefined && <>
        <div className="question-heading"><strong><Bi t={mode === "practice" ? { ckb: "پرسیاری ڕاهێنان", de: "Übungsfrage", kmr: "Pirsa rahênanê", ar: "سؤال تدريبي" } : mode === "review" ? T.examReview : T.mockExam} /></strong><span className="question-counter" dir="ltr">{index + 1} / {total}</span>{mode === "practice" && <Link href="/" className="icon-button" aria-label={label({ ckb: "داخستنی ڕاهێنان", de: "Übung schließen", kmr: "Rahênanê bigire", ar: "إغلاق التدريب" })}><Icon name="close" /></Link>}</div>
        <div className="progressbar question-progress" role="progressbar" aria-label={label({ ckb: "ڕێڕەوی پرسیارەکان", de: "Fragenfortschritt", kmr: "Pêşketina pirsan", ar: "تقدّم الأسئلة" })} aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + 1}><span style={{ width: `${(index + 1) / total * 100}%` }} /></div>
      </>}
      <div className="q-meta">
        {index !== undefined && total !== undefined && <span className="badge" dir="ltr">{index + 1} / {total}</span>}
        {q.points !== null && <span className="badge"><Bi t={{ ckb: `${q.points} ${T.points.ckb}`, de: `${q.points} ${T.points.de}`, kmr: `${q.points} ${T.points.kmr}`, ar: `${q.points} ${T.points.ar}` }} inline /></span>}
        <span className="badge badge-outline">{q.categoryType}</span>
        {topic && <span className="badge badge-outline"><Bi t={topic.title} inline /></span>}
        <span className="spacer" />
        <button type="button" className="chip" aria-pressed={bookmarked} onClick={() => update((p) => toggleBookmark(p, q.id))}>
          <Icon name="bookmark" /><span>{label(bookmarked ? T.bookmarked : T.bookmark)}</span>
        </button>
      </div>

      <fieldset className="options" aria-describedby={`${legendId}-hint`}>
        <legend id={legendId} className="q-prompt"><Bi t={q.prompt} /></legend>
        {sign && <SignIcon sign={sign} className="q-sign" label={`${label(sign.name)} (${sign.stvoNumber})`} />}
        {q.media?.map((m) => <QuestionMedia key={m.key} media={m} plays={mode === "exam" ? plays : undefined} />)}
        <p id={`${legendId}-hint`} className="muted small q-hint"><Bi t={isNumber ? T.numberHint : T.multipleHint} inline /></p>
        {isNumber && (
          <label className={`option${reveal ? (correct ? " is-correct" : " is-wrong") : ""}`} style={{ gridTemplateColumns: "1fr" }}>
            <span className="sr-only">{label(T.numberHint)}</span>
            <input className="input" type="text" inputMode="decimal" autoComplete="off" dir="ltr" value={selected[0] ?? ""}
              disabled={reveal} onChange={(e) => setNumber(e.target.value)} data-testid="number-answer" style={{ width: "100%", height: 48, margin: 0 }} />
          </label>
        )}
        {!isNumber && q.options.map((o) => {
          const isSel = selected.includes(o.id);
          const isRight = q.correct.includes(o.id);
          const cls = ["option", isSel && "is-selected", reveal && isRight && "is-correct", reveal && isSel && !isRight && "is-wrong", reveal && "is-disabled"].filter(Boolean).join(" ");
          return (
            <label key={o.id} className={cls} data-testid={`option-${o.id}`}>
              <input type="checkbox" className="q-check" checked={isSel} disabled={reveal} onChange={() => toggle(o.id)} />
              <span className="option-body">
                <Bi t={o.text} />
                {reveal && isRight && <span className="option-tag ok" data-testid="tag-correct"><Bi t={T.correctAnswers} inline /></span>}
                {reveal && isSel && !isRight && <span className="option-tag bad" data-testid="tag-wrong"><Bi t={T.wrongChoice} inline /></span>}
              </span>
            </label>
          );
        })}
      </fieldset>

      {reveal && (
        <div className={`feedback ${correct ? "ok" : "bad"}`} role="status" data-testid="feedback">
          <div className="feedback-title"><Bi t={correct ? T.correct : selected.length === 0 ? T.notAnswered : T.incorrect} inline /></div>
          {!correct && q.points !== null && <p className="error-points" data-testid="error-points"><span className="num error-points-value" dir="ltr">{q.points}</span><Bi t={T.errorPointsLost} inline /></p>}
          {isNumber && !correct && q.numericAnswer !== undefined && <p className="num-block"><Bi t={T.correctAnswers} inline />: <span className="num">{String(q.numericAnswer).replace(".", ",")}</span></p>}
          <div className="explanation-heading"><Icon name="info" /><Bi t={{ ckb: "ڕوونکردنەوە", de: "Erklärung", kmr: "Şirove", ar: "الشرح" }} /></div>
          <Bi t={q.explanation} />
          {mode === "practice" && <AiExplain questionId={q.id} />}
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
  const { online, settings } = useApp();
  const label = useBiText();
  const [state, setState] = useState<"idle" | "loading" | "done" | "unavailable">("idle");
  const [text, setText] = useState("");
  if (!online) return null;
  const run = async () => {
    setState("loading");
    try {
      const r = await fetch("/api/ai/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionId, lang: settings.lang }) });
      const j = (await r.json()) as { text?: string };
      if (r.ok && j.text) { setText(j.text); setState("done"); } else setState("unavailable");
    } catch { setState("unavailable"); }
  };
  return (
    <div style={{ marginTop: 12 }}>
      {state === "idle" && <button type="button" className="btn btn-secondary btn-sm" onClick={run}><Icon name="sparkle" />{label(T.explainAi)}</button>}
      {state === "loading" && <button type="button" className="btn btn-secondary btn-sm" aria-busy="true" disabled>{label(T.explainAi)}</button>}
      {state === "unavailable" && <p className="small muted" role="status"><Bi t={T.aiUnavailable} /></p>}
      {state === "done" && <div className="notice small" role="status"><p style={{ whiteSpace: "pre-wrap" }} lang={settings.lang} dir={langDir(settings.lang)}>{text}</p><p className="muted" style={{ marginTop: 8 }}><Bi t={T.aiNote} /></p></div>}
    </div>
  );
}
