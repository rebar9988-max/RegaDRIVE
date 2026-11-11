import { T } from "../app/strings";
import { Bi, useBiText } from "./Bi";

export type NavState = "open" | "answered" | "correct" | "wrong";
export interface NavItem { id: string; state: NavState; flagged?: boolean }

/**
 * Numbered overview of a question set. Each number is a real button, so it works with touch, keyboard and
 * screen readers; state is announced in words and never by colour alone.
 */
export function QuestionNavigator({ items, current, onGo }: { items: NavItem[]; current: number; onGo: (index: number) => void }) {
  const label = useBiText();
  const words: Record<NavState, string> = { open: label(T.notAnswered), answered: label(T.answeredL), correct: label(T.correct), wrong: label(T.incorrectF) };
  return (
    <nav className="q-nav" aria-label={label(T.questionList)} data-testid="question-nav">
      <ol className="q-nav-grid" dir="ltr">
        {items.map((it, i) => (
          <li key={it.id}>
            <button type="button" className={`q-nav-item is-${it.state}${it.flagged ? " is-flagged" : ""}`} aria-current={i === current ? "step" : undefined}
              aria-label={`${label(T.question)} ${i + 1}: ${words[it.state]}${it.flagged ? `, ${label(T.flagged)}` : ""}`}
              onClick={() => onGo(i)} data-testid={`nav-${i + 1}`}>{i + 1}</button>
          </li>
        ))}
      </ol>
      <ul className="q-nav-legend small muted">
        {(items.some((i) => i.state === "correct" || i.state === "wrong") ? (["correct", "wrong"] as const) : (["answered", "open"] as const)).map((s) => (
          <li key={s}><span className={`q-nav-dot is-${s}`} aria-hidden="true" /><Bi t={s === "correct" ? T.correct : s === "wrong" ? T.incorrectF : s === "answered" ? T.answeredL : T.notAnswered} inline /></li>
        ))}
        {items.some((i) => i.flagged) && <li><span className="q-nav-dot is-flagged" aria-hidden="true" /><Bi t={T.flagged} inline /></li>}
      </ul>
    </nav>
  );
}
