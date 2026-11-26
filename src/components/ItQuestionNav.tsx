import { ITU } from "../content/italy/ui";
import { Bi, useBiText } from "./Bi";

/**
 * The overview of a run: one numbered cell per statement, jumping straight to any of them.
 *
 * Shared by the exam and the practice run so the two behave and read the same way. State never rests
 * on colour alone: each cell's accessible name carries it in words ("3, senza risposta"), and the
 * current cell is marked with aria-current.
 */
export interface ItNavCell {
  index: number;
  id: string;
  /** Exam: answered or not. Practice: whether it was got right, since the key is shown at once. */
  state: "unanswered" | "answered" | "correct" | "wrong";
  flagged?: boolean;
}

export function ItQuestionNav({ cells, current, onGo, testId }: {
  cells: readonly ItNavCell[];
  current: number;
  onGo: (index: number) => void;
  testId: string;
}) {
  const label = useBiText();
  const stateWord = (state: ItNavCell["state"]) =>
    state === "answered" ? ITU.nav.answered
      : state === "correct" ? ITU.nav.correct
      : state === "wrong" ? ITU.nav.wrong
      : ITU.nav.unanswered;

  return (
    <nav className="card it-nav" aria-label={label(ITU.nav.title)} data-testid={testId}>
      <h2 className="small"><Bi t={ITU.nav.title} inline /></h2>
      <ol className="it-nav-grid">
        {cells.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={`it-nav-cell is-${c.state}${c.flagged ? " is-flagged" : ""}${c.index === current ? " is-current" : ""}`}
              aria-current={c.index === current ? "true" : undefined}
              aria-label={`${label(ITU.nav.open)} ${c.index + 1}: ${label(stateWord(c.state))}${c.flagged ? `, ${label(ITU.nav.flagged)}` : ""}`}
              onClick={() => onGo(c.index)}
              data-testid={`${testId}-cell-${c.index + 1}`}
            >
              <span dir="ltr" aria-hidden="true">{c.index + 1}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
