import { useEffect, useMemo, useState } from "react";
import { Link } from "../app/router";
import { useApp, useNow } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { ItQuestionCard } from "../components/ItQuestionCard";
import { ItSignImage } from "../components/ItSignImage";
import { useItApproved } from "../app/approved";
import { IT_CHAPTERS, IT_PLANNED_TOTAL } from "../content/italy/chapters";
import type { ItQuestion } from "../content/italy/types";
import { PATENTE_B_RULES_IT, scoreItExam } from "../lib/shared/examIt";
import { formatClock, itTimeLeft, pickItExam } from "../lib/itExam";
import { questionStatus } from "../lib/progress";
import { IT_FREE_FOREVER_LABEL } from "../lib/shared/accessPolicy";

const newSession = () => `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const inChapter = (qs: readonly ItQuestion[], chapter: number) => qs.filter((q) => q.chapter === chapter);

/** Shown while the approved list is being fetched, and when the fetch failed (fail closed: nothing is shown). */
function Gate({ loading, failed }: { loading: boolean; failed: boolean }) {
  if (loading) return <p className="card muted" aria-busy="true" data-testid="italy-loading">…</p>;
  if (failed) return <p className="card" role="status" data-testid="italy-gate-failed"><Bi t={T.contentInReview} /></p>;
  return <p className="card" role="status" data-testid="italy-in-review"><Bi t={T.contentInReview} /></p>;
}

/** Italy's start screen: the 16 chapters of the syllabus with what is approved in each. */
export function ItalyHome() {
  const { progress, settings } = useApp();
  const approved = useItApproved();
  const answered = approved.questions.filter((q) => progress.questions[q.id]).length;
  const mastered = approved.questions.filter((q) => questionStatus(progress.questions[q.id], settings.masteryThreshold) === "mastered").length;
  return (
    <section className="stack" data-testid="italy-home">
      <h1><Bi t={T.it.title} /></h1>
      <p className="card" data-testid="italy-free-forever" lang="it" dir="ltr"><strong>{IT_FREE_FOREVER_LABEL}</strong></p>
      <p className="card muted small"><Bi t={T.it.reviewNotice} /></p>
      <p className="card muted small" data-testid="italy-free"><Bi t={T.it.free} /></p>
      {approved.questions.length === 0 && <Gate loading={approved.loading} failed={approved.failed} />}
      <div className="grid grid-2 compact-stats">
        <div className="card stat"><span className="num" dir="ltr">{approved.questions.length}</span><span className="stat-label"><Bi t={T.it.questionsHere} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{answered}</span><span className="stat-label"><Bi t={T.answeredL} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{mastered}</span><span className="stat-label"><Bi t={T.mastered} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{IT_PLANNED_TOTAL}</span><span className="stat-label"><Bi t={T.it.plannedTotal} /></span></div>
      </div>
      <h2><Bi t={T.it.chapters} /></h2>
      <ul className="grid grid-tiles" data-testid="italy-chapters">
        {IT_CHAPTERS.map((c) => {
          const n = inChapter(approved.questions, c.id).length;
          return (
            <li key={c.id}>
              <Link href={`/practice?chapter=${c.id}`} className="card card-link tile" data-testid={`italy-chapter-${c.id}`}>
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
  const approved = useItApproved();
  const chapter = useMemo(() => {
    const raw = new URLSearchParams(location.search).get("chapter");
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && IT_CHAPTERS.some((c) => c.id === n) ? n : null;
  }, []);
  const [session, setSession] = useState(newSession);
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  // Snapshot the list once per run, so answering never reshuffles the current set.
  const list = useMemo(
    () => (chapter === null ? approved.questions : inChapter(approved.questions, chapter)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally recomputed only on chapter/session/bank change
    [chapter, session, approved.questions],
  );
  const restart = () => { setSession(newSession()); setPos(0); setDone({}); };
  const title = chapter === null ? null : IT_CHAPTERS.find((c) => c.id === chapter);
  const q = list[pos];

  if (list.length === 0) {
    return (
      <section className="stack" data-testid="italy-practice-empty">
        <h1><Bi t={T.it.title} /></h1>
        {approved.questions.length === 0 ? <Gate loading={approved.loading} failed={approved.failed} /> : <p className="card"><Bi t={T.it.noQuestionsYet} /></p>}
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

/** Italy's sign gallery: the illustrations that are approved for the Italian section. */
export function ItalySigns() {
  const approved = useItApproved();
  return (
    <section className="stack" data-testid="italy-signs">
      <h1><Bi t={T.nav.signs} /></h1>
      {approved.signs.length === 0 && <Gate loading={approved.loading} failed={approved.failed} />}
      <ul className="grid grid-tiles">
        {approved.signs.map((s) => (
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

/**
 * Italy's mock exam: the real ministerial format — 30 true/false statements, 20 minutes, at most 3
 * errors (src/lib/shared/examIt.ts). It can only start with 30 approved questions: a shorter paper
 * would not be this exam, so until then the screen says plainly what is missing.
 */
export function ItalyExam() {
  const rules = PATENTE_B_RULES_IT;
  const approved = useItApproved();
  const [paper, setPaper] = useState<ItQuestion[] | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [handedInByLearner, setHandedIn] = useState(false);
  const [pos, setPos] = useState(0);
  const [session, setSession] = useState(newSession);
  const now = useNowTicking(paper !== null && !handedInByLearner);
  const left = paper === null ? rules.minutes * 60 : itTimeLeft(startedAt, now, rules);
  // Time over ends the exam on its own: derived from the clock, never written into state.
  const handedIn = handedInByLearner || (paper !== null && left === 0);

  const start = () => {
    const picked = pickItExam(approved.questions, rules);
    if (!picked) return;
    setPaper(picked); setStartedAt(Date.now()); setAnswers({}); setPos(0); setHandedIn(false); setSession(newSession());
  };

  if (paper === null) {
    const enough = approved.questions.length >= rules.questionCount;
    return (
      <section className="stack" data-testid="italy-exam">
        <h1><Bi t={T.it.exam} /></h1>
        <p className="card"><Bi t={T.it.examRules} /></p>
        <div className="grid grid-2 compact-stats">
          <div className="card stat"><span className="num" dir="ltr">{approved.questions.length}</span><span className="stat-label"><Bi t={T.it.examApproved} /></span></div>
          <div className="card stat"><span className="num" dir="ltr">{rules.questionCount}</span><span className="stat-label"><Bi t={T.it.examNeeded} /></span></div>
        </div>
        {enough
          ? <button type="button" className="btn btn-primary" onClick={start} data-testid="italy-exam-start"><Bi t={T.it.examStart} /></button>
          : <p className="card" role="status" data-testid="italy-exam-blocked"><Bi t={T.it.examNeedsMore} /></p>}
        <p className="small muted"><Bi t={T.it.examRulesSource} /> <bdi dir="ltr">({rules.version})</bdi></p>
      </section>
    );
  }

  if (handedIn) {
    const result = scoreItExam(paper.map((q) => ({ questionId: q.id, correct: answers[q.id] === q.answer })), rules);
    return (
      <section className="stack" data-testid="italy-exam-result">
        <h1><Bi t={result.passed ? T.it.examPassed : T.it.examFailed} /></h1>
        <div className="grid grid-2 compact-stats">
          <div className="card stat"><span className="num" dir="ltr">{result.errors}</span><span className="stat-label"><Bi t={T.it.examErrors} /></span></div>
          <div className="card stat"><span className="num" dir="ltr">{rules.maxErrors}</span><span className="stat-label"><Bi t={T.it.examNeeded} /></span></div>
        </div>
        <div className="q-actions">
          <button type="button" className="btn btn-primary" onClick={() => setPaper(null)} data-testid="italy-exam-again"><Bi t={T.it.again} /></button>
          <Link href="/" className="btn"><Bi t={T.it.backToChapters} /></Link>
        </div>
      </section>
    );
  }

  const q = paper[pos]!;
  return (
    <section className="stack" data-testid="italy-exam-running">
      <p className="card" role="timer" data-testid="italy-exam-clock"><Bi t={T.it.examTimeLeft} inline />: <span className="num" dir="ltr">{formatClock(left)}</span></p>
      <ItQuestionCard
        key={q.id}
        question={q}
        mode="exam"
        sessionId={session}
        index={pos}
        total={paper.length}
        answered={answers[q.id]}
        onAnswered={(a) => setAnswers((prev) => ({ ...prev, [q.id]: a }))}
        onNext={() => (pos + 1 < paper.length ? setPos(pos + 1) : setHandedIn(true))}
      />
    </section>
  );
}

/**
 * A clock that ticks once a second while the exam paper is open. It stops on its own at the end of the
 * 20 minutes, so the result screen does not keep re-rendering.
 */
function useNowTicking(active: boolean): number {
  const minute = useNow();
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  // The per-second value can be one tick behind a freshly started exam, so the minute clock is the floor.
  return active ? Math.max(tick, minute) : minute;
}
