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
import { isItPracticeMode, itChapterSources, itChapterStats, itOverall, itPracticeSet, type ItPracticeMode } from "../lib/italyStudy";
import { IT_CONTENT_REGISTRY } from "../content/italy/registry";
import { itSignById } from "../content/italy/signs";
import { IT_FREE_FOREVER_LABEL } from "../lib/shared/accessPolicy";

const newSession = () => `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Shown while the approved list is being fetched, and when the fetch failed (fail closed: nothing is shown). */
function Gate({ loading, failed }: { loading: boolean; failed: boolean }) {
  if (loading) return <p className="card muted" aria-busy="true" data-testid="italy-loading">…</p>;
  if (failed) return <p className="card" role="status" data-testid="italy-gate-failed"><Bi t={T.contentInReview} /></p>;
  return <p className="card" role="status" data-testid="italy-in-review"><Bi t={T.contentInReview} /></p>;
}

/** Italy's start screen: the 16 chapters of the syllabus with what is approved in each. */
export function ItalyHome() {
  const { progress, settings } = useApp();
  const label = useBiText();
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
      <nav className="q-actions" aria-label={label(T.it.lessons)} data-testid="italy-quick">
        <Link href="/learn" className="btn btn-primary" data-testid="italy-go-lessons"><Bi t={T.it.lessons} /></Link>
        <Link href="/practice" className="btn" data-testid="italy-go-practice"><Bi t={T.it.startPractice} /></Link>
        <Link href="/progress" className="btn" data-testid="italy-go-progress"><Bi t={T.nav.progress} /></Link>
        <Link href="/exam" className="btn" data-testid="italy-go-exam"><Bi t={T.it.exam} /></Link>
      </nav>
    </section>
  );
}

/** Italy's practice run: the true/false questions of one chapter, or of every chapter. */
export function ItalyPractice() {
  const label = useBiText();
  const approved = useItApproved();
  const { progress, settings } = useApp();
  const { chapter, mode } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("chapter");
    const n = raw === null ? NaN : Number(raw);
    const ch = Number.isInteger(n) && IT_CHAPTERS.some((c) => c.id === n) ? n : null;
    const asked = params.get("mode");
    const m: ItPracticeMode = isItPracticeMode(asked) ? asked : ch !== null ? "chapter" : "all";
    return { chapter: ch, mode: m };
  }, []);
  const [session, setSession] = useState(newSession);
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  // Snapshot the list once per run, so answering never reshuffles the current set.
  const list = useMemo(
    () => itPracticeSet(approved.questions, progress, mode, chapter, settings.masteryThreshold),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a run keeps the set it started with; only a new run or a new bank changes it
    [chapter, mode, session, approved.questions],
  );
  const restart = () => { setSession(newSession()); setPos(0); setDone({}); };
  const title = mode === "wrong" ? { title: T.it.reviewWrong }
    : mode === "bookmarks" ? { title: T.it.reviewBookmarks }
    : chapter === null ? null : IT_CHAPTERS.find((c) => c.id === chapter) ?? null;
  const q = list[pos];

  if (list.length === 0) {
    return (
      <section className="stack" data-testid="italy-practice-empty">
        <h1><Bi t={title?.title ?? T.it.title} /></h1>
        {approved.questions.length === 0
          ? <Gate loading={approved.loading} failed={approved.failed} />
          : <p className="card" role="status"><Bi t={mode === "wrong" || mode === "bookmarks" ? T.it.noneToReview : T.it.noQuestionsYet} /></p>}
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

/**
 * Italy's lessons: the syllabus itself as the structure. Each chapter page shows the legal basis of its
 * own questions (Codice della Strada references recorded with the content), the signs that belong to
 * them and the learner's progress — nothing is written here that a reviewer has not seen.
 */
export function ItalyLessons() {
  const { progress, settings } = useApp();
  const approved = useItApproved();
  const chapter = useMemo(() => {
    const raw = new URLSearchParams(location.search).get("chapter");
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && IT_CHAPTERS.some((c) => c.id === n) ? n : null;
  }, []);
  const stats = itChapterStats(progress, approved.questions, settings.masteryThreshold);

  if (chapter === null) {
    return (
      <section className="stack" data-testid="italy-lessons">
        <h1><Bi t={T.it.lessons} /></h1>
        <p className="card muted small"><Bi t={T.it.lessonIntro} /></p>
        {approved.questions.length === 0 && <Gate loading={approved.loading} failed={approved.failed} />}
        <ul className="grid grid-tiles">
          {stats.map((s) => (
            <li key={s.chapter.id}>
              <Link href={`/learn?chapter=${s.chapter.id}`} className="card card-link tile" data-testid={`italy-lesson-${s.chapter.id}`}>
                <span className="badge" dir="ltr">{s.chapter.id}</span>
                <strong><Bi t={s.chapter.title} /></strong>
                <span className="small muted" dir="ltr">{s.mastered} / {s.total}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const stat = stats.find((s) => s.chapter.id === chapter)!;
  const sources = itChapterSources(chapter, approved.questions, (id) => IT_CONTENT_REGISTRY.get(id)?.provenance.sourceRefs ?? []);
  const signs = [...new Set(approved.questions.filter((q) => q.chapter === chapter).map((q) => q.signId))]
    .flatMap((id) => (id ? [itSignById(id)] : []))
    .flatMap((s) => (s ? [s] : []));
  return (
    <section className="stack" data-testid="italy-lesson">
      <h1><Bi t={stat.chapter.title} /></h1>
      <div className="grid grid-2 compact-stats">
        <div className="card stat"><span className="num" dir="ltr">{stat.total}</span><span className="stat-label"><Bi t={T.it.questionsHere} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{stat.mastered}</span><span className="stat-label"><Bi t={T.it.masteredCount} /></span></div>
      </div>
      {sources.length > 0 && (
        <div className="card stack" data-testid="italy-lesson-sources">
          <h2 className="section-title"><Bi t={T.it.legalBasis} /></h2>
          <ul className="stack">{sources.map((ref) => <li key={ref} className="small" lang="it" dir="ltr">{ref}</li>)}</ul>
        </div>
      )}
      {signs.length > 0 && (
        <div className="stack" data-testid="italy-lesson-signs">
          <h2 className="section-title"><Bi t={T.it.signsOfChapter} /></h2>
          <ul className="grid grid-tiles">
            {signs.map((s) => (
              <li key={s.id}><div className="card tile"><ItSignImage sign={s} labelled={false} /><strong><Bi t={s.name} /></strong></div></li>
            ))}
          </ul>
        </div>
      )}
      <div className="q-actions">
        {stat.total > 0 && <Link href={`/practice?chapter=${chapter}`} className="btn btn-primary" data-testid="italy-lesson-practice"><Bi t={T.it.startPractice} /></Link>}
        <Link href="/learn" className="btn"><Bi t={T.it.lessons} /></Link>
      </div>
    </section>
  );
}

/** Italy's progress: what the learner has done, per chapter, with the two review runs. */
export function ItalyProgress() {
  const { progress, settings } = useApp();
  const approved = useItApproved();
  const all = itOverall(progress, approved.questions, settings.masteryThreshold);
  const stats = itChapterStats(progress, approved.questions, settings.masteryThreshold);
  return (
    <section className="stack" data-testid="italy-progress">
      <h1><Bi t={T.nav.progress} /></h1>
      {approved.questions.length === 0 && <Gate loading={approved.loading} failed={approved.failed} />}
      <div className="grid grid-2 compact-stats">
        <div className="card stat"><span className="num" dir="ltr">{all.answered}</span><span className="stat-label"><Bi t={T.answeredL} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{all.mastered}</span><span className="stat-label"><Bi t={T.it.masteredCount} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{all.wrong}</span><span className="stat-label"><Bi t={T.it.wrongCount} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{all.bookmarked}</span><span className="stat-label"><Bi t={T.it.reviewBookmarks} /></span></div>
      </div>
      <div className="q-actions">
        <Link href="/practice?mode=wrong" className="btn btn-primary" data-testid="italy-review-wrong"><Bi t={T.it.reviewWrong} /></Link>
        <Link href="/practice?mode=bookmarks" className="btn" data-testid="italy-review-bookmarks"><Bi t={T.it.reviewBookmarks} /></Link>
      </div>
      <h2 className="section-title"><Bi t={T.it.chapterProgress} /></h2>
      <ul className="stack" data-testid="italy-progress-chapters">
        {stats.map((s) => (
          <li key={s.chapter.id} className="card">
            <div className="q-meta">
              <span className="badge" dir="ltr">{s.chapter.id}</span>
              <strong><Bi t={s.chapter.title} /></strong>
              <span className="spacer" />
              <span className="small muted" dir="ltr">{s.mastered}/{s.total}</span>
            </div>
            <div className="progressbar" role="progressbar" aria-valuemin={0} aria-valuemax={s.total} aria-valuenow={s.mastered}>
              <span style={{ width: `${s.total === 0 ? 0 : (s.mastered / s.total) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
