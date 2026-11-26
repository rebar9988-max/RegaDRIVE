import { useEffect, useId } from "react";
import { Link } from "../app/router";
import { useApp } from "../app/state";
import { T } from "../app/strings";
import { recordAnswer, toggleBookmark } from "../lib/progress";
import { itSignById } from "../content/italy/signs";
import type { ItQuestion } from "../content/italy/types";
import { AiExplain } from "./AiExplain";
import { Bi, useBiText } from "./Bi";
import { Icon } from "./Icon";
import { ItSignImage } from "./ItSignImage";

interface Props {
  question: ItQuestion;
  /** "practice": the answer key and the explanation appear as soon as the learner answers.
   *  "exam": nothing is revealed and nothing is scored until the paper is handed in, as in the real test. */
  mode?: "practice" | "exam";
  sessionId: string;
  index: number;
  total: number;
  onNext?: () => void;
  /** Goes back one statement. Absent on the first one, so the control is never a dead end. */
  onPrev?: () => void;
  /** The answer already given in this session, so returning to a question shows it again. */
  answered?: boolean;
  onAnswered?: (answer: boolean) => void;
  /** Exam only: marked for a second look before handing in. Separate from the bookmark, which is kept for good. */
  flagged?: boolean;
  onToggleFlag?: () => void;
}

/**
 * One Italian true/false question (VERO / FALSO).
 *
 * Deliberately separate from QuestionCard: the German exam is multiple choice with option ids and
 * points, and nothing here touches it. Both cards use the same existing classes, so the two sections
 * look like one app without any new styling.
 *
 * In an exam the answer can be changed and the statement revisited until the paper is handed in, as in
 * the real test; in practice the answer stands once it is given, because it has already been scored.
 */
export function ItQuestionCard({ question: q, mode = "practice", sessionId, index, total, onNext, onPrev, answered, onAnswered, flagged = false, onToggleFlag }: Props) {
  const { progress, update } = useApp();
  const label = useBiText();
  const legendId = useId();
  const sign = q.signId ? itSignById(q.signId) : undefined;
  const exam = mode === "exam";
  // The answer lives with the run, not in the card: both parents keep it, so a statement the learner
  // comes back to shows the answer it already carries and a changed answer needs no local copy.
  const given = answered ?? null;
  // The answer key is shown only after the learner handed the answer in — and in an exam, not at all.
  const reveal = !exam && given !== null;
  const correct = given === q.answer;
  const bookmarked = progress.bookmarks.includes(q.id);

  const answer = (value: boolean) => {
    if (reveal) return;
    // Practice counts towards progress; an exam is scored as a whole when it is handed in.
    if (!exam) update((p) => recordAnswer(p, sessionId, q.id, value === q.answer, Date.now()));
    onAnswered?.(value);
  };

  /**
   * Keyboard: 1 / V answers VERO, 2 / F answers FALSO, Enter moves on. Letters and digits only, so the
   * shortcut never depends on the reading direction of the chosen language. Typing in a field, a held
   * modifier, or focus on a control the key would also operate is left alone.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (el?.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const key = e.key.toLowerCase();
      if (key === "1" || key === "v") { e.preventDefault(); answer(true); return; }
      if (key === "2" || key === "f") { e.preventDefault(); answer(false); return; }
      if (e.key === "Enter" && tag !== "BUTTON" && tag !== "A" && onNext && (exam || reveal)) { e.preventDefault(); onNext(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const option = (value: boolean) => {
    const isSel = given === value;
    const isRight = q.answer === value;
    const cls = ["option", isSel && "is-selected", reveal && isRight && "is-correct", reveal && isSel && !isRight && "is-wrong", reveal && "is-disabled"].filter(Boolean).join(" ");
    return (
      <label key={String(value)} className={cls} data-testid={`it-option-${value ? "vero" : "falso"}`}>
        <input type="radio" name={`${legendId}-answer`} className="q-check" checked={isSel} disabled={reveal} onChange={() => answer(value)} />
        <span className="option-body">
          <Bi t={value ? T.it.vero : T.it.falso} />
          <span className="option-tag" lang="it" dir="ltr">{value ? "VERO" : "FALSO"}</span>
          <kbd className="it-key" aria-hidden="true">{value ? "V" : "F"}</kbd>
          {reveal && isRight && <span className="option-tag ok" data-testid="it-tag-correct"><Bi t={T.correctAnswers} inline /></span>}
          {reveal && isSel && !isRight && <span className="option-tag bad" data-testid="it-tag-wrong"><Bi t={T.wrongChoice} inline /></span>}
        </span>
      </label>
    );
  };

  return (
    <article className="card question-card" aria-labelledby={legendId} data-testid="it-question-card" data-qid={q.id}>
      <div className="question-heading">
        <strong><Bi t={exam ? T.it.exam : T.it.title} /></strong>
        <span className="question-counter" dir="ltr">{index + 1} / {total}</span>
        <Link href="/" className="icon-button" aria-label={label(T.it.backToChapters)}><Icon name="close" /></Link>
      </div>
      <div className="progressbar question-progress" role="progressbar" aria-label={label(T.it.chapters)} aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + 1}>
        <span style={{ width: `${(index + 1) / total * 100}%` }} />
      </div>
      <div className="q-meta">
        <span className="badge" dir="ltr">{index + 1} / {total}</span>
        <span className="badge badge-outline"><Bi t={T.it.chapter} inline /> <span dir="ltr">{q.chapter}</span></span>
        <span className="spacer" />
        {exam && onToggleFlag && (
          <button type="button" className="chip" aria-pressed={flagged} onClick={onToggleFlag} data-testid="it-flag">
            <Icon name="pin" /><span>{label(flagged ? T.it.examFlagged : T.it.examFlag)}</span>
          </button>
        )}
        <button type="button" className="chip" aria-pressed={bookmarked} onClick={() => update((p) => toggleBookmark(p, q.id))}>
          <Icon name="bookmark" /><span>{label(bookmarked ? T.bookmarked : T.bookmark)}</span>
        </button>
      </div>

      <fieldset className="options" aria-describedby={`${legendId}-hint`}>
        <legend id={legendId} className="q-prompt"><Bi t={q.prompt} /></legend>
        {sign && <ItSignImage sign={sign} />}
        <p id={`${legendId}-hint`} className="muted small q-hint"><Bi t={T.it.reviewNotice} inline /></p>
        {option(true)}
        {option(false)}
      </fieldset>

      {reveal && (
        <div className={`feedback ${correct ? "ok" : "bad"}`} role="status" data-testid="it-feedback">
          <div className="feedback-title"><Bi t={correct ? T.it.yourAnswerRight : T.it.yourAnswerWrong} inline /></div>
          <div className="explanation-heading"><Icon name="info" /><Bi t={T.it.explanation} /></div>
          <Bi t={q.explanation} />
          <AiExplain questionId={q.id} />
        </div>
      )}

      {((exam || reveal) && onNext) || onPrev ? (
        <div className="q-actions">
          {onPrev && <button type="button" className="btn" onClick={onPrev} data-testid="it-prev"><Bi t={T.it.back} /></button>}
          {(exam || reveal) && onNext && <button type="button" className="btn btn-primary" onClick={onNext} data-testid="it-next"><Bi t={T.it.next} /></button>}
        </div>
      ) : null}
    </article>
  );
}
