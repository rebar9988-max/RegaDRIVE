import { useMemo, useState } from "react";
import { Link } from "../app/router";
import { useApp } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { ItQuestionCard } from "../components/ItQuestionCard";
import { ItSignImage } from "../components/ItSignImage";
import { IT_CONTENT } from "../app/content";
import { itQuestionsOf } from "../content/italy/access";
import { IT_PLANNED_TOTAL } from "../content/italy/chapters";
import { questionStatus } from "../lib/progress";

const newSession = () => `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Italy's start screen: the 16 chapters of the syllabus with what is available in each. */
export function ItalyHome() {
  const { progress, settings } = useApp();
  const answered = IT_CONTENT.questions.filter((q) => progress.questions[q.id]).length;
  const mastered = IT_CONTENT.questions.filter((q) => questionStatus(progress.questions[q.id], settings.masteryThreshold) === "mastered").length;
  return (
    <section className="stack" data-testid="italy-home">
      <h1><Bi t={T.it.title} /></h1>
      <p className="card muted small"><Bi t={T.it.reviewNotice} /></p>
      {IT_CONTENT.questions.length === 0 && <p className="card" data-testid="italy-in-review"><Bi t={T.contentInReview} /></p>}
      <div className="grid grid-2 compact-stats">
        <div className="card stat"><span className="num" dir="ltr">{IT_CONTENT.questions.length}</span><span className="stat-label"><Bi t={T.it.questionsHere} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{answered}</span><span className="stat-label"><Bi t={T.answeredL} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{mastered}</span><span className="stat-label"><Bi t={T.mastered} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{IT_PLANNED_TOTAL}</span><span className="stat-label"><Bi t={T.it.plannedTotal} /></span></div>
      </div>
      <h2><Bi t={T.it.chapters} /></h2>
      <ul className="grid grid-tiles" data-testid="italy-chapters">
        {IT_CONTENT.chapters.map((c) => {
          const n = itQuestionsOf(IT_CONTENT, c.id).length;
          return (
            <li key={c.id}>
              <Link href={`/practice?chapter=${c.id}`} className="card card-link tile" data-testid={`italy-chapter-${c.id}`} aria-disabled={n === 0 ? true : undefined}>
                <span className="badge" dir="ltr">{c.id}</span>
                <strong><Bi t={c.title} /></strong>
                <span className="small muted" dir="ltr">{n} / {c.plannedCount}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Italy's practice run: the true/false questions of one chapter, or of every chapter. */
export function ItalyPractice() {
  const label = useBiText();
  const chapter = useMemo(() => {
    const raw = new URLSearchParams(location.search).get("chapter");
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && IT_CONTENT.chapters.some((c) => c.id === n) ? n : null;
  }, []);
  const [session, setSession] = useState(newSession);
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  // Snapshot the list once per run, so answering never reshuffles the current set.
  const list = useMemo(
    () => (chapter === null ? IT_CONTENT.questions : itQuestionsOf(IT_CONTENT, chapter)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally recomputed only on chapter/session change
    [chapter, session],
  );
  const restart = () => { setSession(newSession()); setPos(0); setDone({}); };
  const title = chapter === null ? null : IT_CONTENT.chapters.find((c) => c.id === chapter);
  const q = list[pos];

  if (list.length === 0) {
    return (
      <section className="stack" data-testid="italy-practice-empty">
        <h1><Bi t={T.it.title} /></h1>
        <p className="card"><Bi t={IT_CONTENT.questions.length === 0 ? T.contentInReview : T.it.noQuestionsYet} /></p>
        <Link href="/" className="btn"><Bi t={T.it.backToChapters} /></Link>
      </section>
    );
  }
  if (!q) {
    return (
      <section className="stack" data-testid="italy-practice-done">
        <h1><Bi t={T.it.finished} /></h1>
        <div className="q-actions">
          <button type="button" className="btn btn-primary" onClick={restart} data-testid="italy-again"><Bi t={T.it.again} /></button>
          <Link href="/" className="btn"><Bi t={T.it.backToChapters} /></Link>
        </div>
      </section>
    );
  }
  return (
    <section className="stack" data-testid="italy-practice" aria-label={label(T.it.title)}>
      {title && <h1><Bi t={title.title} /></h1>}
      <ItQuestionCard
        key={q.id}
        question={q}
        sessionId={session}
        index={pos}
        total={list.length}
        answered={done[q.id]}
        onAnswered={(a) => setDone((d) => ({ ...d, [q.id]: a }))}
        onNext={() => setPos((p) => p + 1)}
      />
    </section>
  );
}

/** Italy's sign gallery: the illustrations that are available for the Italian section. */
export function ItalySigns() {
  return (
    <section className="stack" data-testid="italy-signs">
      <h1><Bi t={T.nav.signs} /></h1>
      {IT_CONTENT.signs.length === 0 && <p className="card"><Bi t={T.contentInReview} /></p>}
      <ul className="grid grid-tiles">
        {IT_CONTENT.signs.map((s) => (
          <li key={s.id}>
            <div className="card tile">
              <ItSignImage sign={s} labelled={false} />
              <strong><Bi t={s.name} /></strong>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
