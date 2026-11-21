import { useId, useState } from "react";
import { Link } from "../app/router";
import { useApp } from "../app/state";
import { T } from "../app/strings";
import { recordAnswer, toggleBookmark } from "../lib/progress";
import { itSignById } from "../content/italy/signs";
import type { ItQuestion } from "../content/italy/types";
import { Bi, useBiText } from "./Bi";
import { Icon } from "./Icon";
import { ItSignImage } from "./ItSignImage";

interface Props {
  question: ItQuestion;
  sessionId: string;
  index: number;
  total: number;
  onNext?: () => void;
  /** The answer already given in this session, so returning to a question shows it again. */
  answered?: boolean;
  onAnswered?: (answer: boolean) => void;
}

/**
 * One Italian true/false question (VERO / FALSO).
 *
 * Deliberately separate from QuestionCard: the German exam is multiple choice with option ids and
 * points, and nothing here touches it. Both cards use the same existing classes, so the two sections
 * look like one app without any new styling.
 */
export function ItQuestionCard({ question: q, sessionId, index, total, onNext, answered, onAnswered }: Props) {
  const { progress, update } = useApp();
  const label = useBiText();
  const [given, setGiven] = useState<boolean | null>(answered ?? null);
  const legendId = useId();
  const sign = q.signId ? itSignById(q.signId) : undefined;
  const reveal = given !== null;
  const correct = given === q.answer;
  const bookmarked = progress.bookmarks.includes(q.id);

  const answer = (value: boolean) => {
    if (reveal) return;
    setGiven(value);
    update((p) => recordAnswer(p, sessionId, q.id, value === q.answer, Date.now()));
    onAnswered?.(value);
  };

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
          {reveal && isRight && <span className="option-tag ok" data-testid="it-tag-correct"><Bi t={T.correctAnswers} inline /></span>}
          {reveal && isSel && !isRight && <span className="option-tag bad" data-testid="it-tag-wrong"><Bi t={T.wrongChoice} inline /></span>}
        </span>
      </label>
    );
  };

  return (
    <article className="card question-card" aria-labelledby={legendId} data-testid="it-question-card" data-qid={q.id}>
      <div className="question-heading">
        <strong><Bi t={T.it.title} /></strong>
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
        </div>
      )}

      {reveal && onNext && (
        <div className="q-actions">
          <button type="button" className="btn btn-primary" onClick={onNext} data-testid="it-next"><Bi t={T.it.next} /></button>
        </div>
      )}
    </article>
  );
}
