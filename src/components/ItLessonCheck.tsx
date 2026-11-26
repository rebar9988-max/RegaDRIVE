import { useId, useState } from "react";
import { T } from "../app/strings";
import type { ItLessonCheck as Check } from "../content/italy/lessons";
import { Bi } from "./Bi";
import { Icon } from "./Icon";

/**
 * A self-check inside an Italian lesson: the learner judges a statement true or false and sees why.
 *
 * It belongs to the lesson material, not to the examination bank: it is never scored, never counted
 * towards progress and never presented as a ministerial question. The exam bank stays separate
 * (src/content/italy/questions.ts) and separately reviewed.
 */
export function ItLessonCheck({ check, index }: { check: Check; index: number }) {
  const [given, setGiven] = useState<boolean | null>(null);
  const id = useId();
  const answered = given !== null;
  const right = given === check.answer;

  const btn = (value: boolean) => {
    const chosen = given === value;
    const isKey = check.answer === value;
    const cls = ["btn", "it-check-btn", chosen && "is-selected", answered && isKey && "is-correct", answered && chosen && !isKey && "is-wrong"].filter(Boolean).join(" ");
    return (
      <button type="button" className={cls} disabled={answered} aria-pressed={chosen}
        onClick={() => setGiven(value)} data-testid={`it-check-${value ? "vero" : "falso"}`}>
        <Bi t={value ? T.it.checkAnswerTrue : T.it.checkAnswerFalse} inline />
        <span lang="it" dir="ltr">{value ? "VERO" : "FALSO"}</span>
      </button>
    );
  };

  return (
    <div className="card it-check" data-testid="it-lesson-check">
      <p className="it-check-q" id={id}><span className="badge" dir="ltr">{index + 1}</span> <Bi t={check.statement} inline /></p>
      <div className="it-check-row" role="group" aria-labelledby={id}>{btn(true)}{btn(false)}</div>
      {answered && (
        <div className={`feedback ${right ? "ok" : "bad"}`} role="status" data-testid="it-check-why">
          <div className="feedback-title"><Icon name={right ? "check" : "info"} /><Bi t={right ? T.it.yourAnswerRight : T.it.yourAnswerWrong} inline /></div>
          <Bi t={check.why} />
        </div>
      )}
    </div>
  );
}
