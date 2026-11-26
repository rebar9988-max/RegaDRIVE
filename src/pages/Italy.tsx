import "./italy.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "../app/router";
import { useApp, useNow } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { Icon } from "../components/Icon";
import { ItQuestionCard } from "../components/ItQuestionCard";
import { ItSignImage } from "../components/ItSignImage";
import { useItApproved } from "../app/approved";
import { IT_CHAPTERS, IT_PLANNED_TOTAL } from "../content/italy/chapters";
import type { ItQuestion } from "../content/italy/types";
import { PATENTE_B_RULES_IT, scoreItExam } from "../lib/shared/examIt";
import { formatClock, itClockState, itExamCells, itExamNextOpen, itExamReview, itExamUnanswered, itTimeLeft, pickItExam } from "../lib/itExam";
import { questionStatus } from "../lib/progress";
import { isItLessonDone, isItPracticeMode, itChapterSources, itChapterStats, itLessonNeighbours, itLessonsDone, itOverall, itPracticeSet, toggleItLessonDone, type ItPracticeMode } from "../lib/italyStudy";
import { itLessonFor } from "../content/italy/lessons";
import { ItLessonCheck } from "../components/ItLessonCheck";
import { itSignById } from "../content/italy/signs";
import { IT_CONTENT_REGISTRY } from "../content/italy/registry";
import { IT_FREE_FOREVER_LABEL } from "../lib/shared/accessPolicy";

const inChapter = (questions: readonly ItQuestion[], chapter: number) => questions.filter((q) => q.chapter === chapter);
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
  const [search, setSearch] = useState("");
  const errors = approved.questions.filter((q) => progress.questions[q.id]?.lastCorrect === false).length;
  const percent = approved.questions.length ? Math.round(mastered / approved.questions.length * 100) : 0;
  const chapters = IT_CHAPTERS.filter((c) => label(c.title).toLocaleLowerCase().includes(search.toLocaleLowerCase()) || c.title.it.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return (
    <section className="stack italy-dashboard" data-testid="italy-home">
      <header className="it-welcome">
        <span className="it-country" lang="it" dir="ltr">🇮🇹 ITALIA · PATENTE B</span>
        <h1><Bi t={T.it.title} /></h1>
        <p data-testid="italy-free-forever" lang="it" dir="ltr">{IT_FREE_FOREVER_LABEL}</p>
      </header>
      <div className="it-feature">
        <div className="stack">
          <span className="it-eyebrow"><Bi t={T.nav.practice} /></span>
          <h2><Bi t={T.it.chapters} /></h2>
          <p><Bi t={T.it.examRules} /></p>
          <Link href="/practice" className="btn btn-primary"><Bi t={T.nav.practice} /></Link>
        </div>
        <div className="it-progress">
          <div className="it-ring" style={{ background: `conic-gradient(var(--success) ${percent}%, var(--track) 0)` }}>
            <strong dir="ltr">{percent}%</strong>
          </div>
          <Bi t={T.mastered} />
          <span dir="ltr">{mastered} / {approved.questions.length}</span>
        </div>
      </div>
      <nav className="q-actions" aria-label={label(T.it.lessons)} data-testid="italy-quick">
        <Link href="/learn" className="btn btn-primary" data-testid="italy-go-lessons"><Bi t={T.it.lessons} /></Link>
        <Link href="/progress" className="btn" data-testid="italy-go-progress"><Bi t={T.nav.progress} /></Link>
      </nav>
      <div className="it-actions">
        <Link href="/exam" className="card it-action"><span className="it-action-symbol" aria-hidden="true">◷</span><strong><Bi t={T.it.exam} /></strong><span className="muted"><Bi t={T.it.examRules} /></span></Link>
        <Link href="/practice?mode=wrong" className="card it-action"><span className="it-action-symbol" aria-hidden="true">↺</span><strong><Bi t={T.reviewMistakes} /></strong><span className="it-count" dir="ltr">{errors}</span></Link>
        <Link href="/signs" className="card it-action"><span className="it-action-symbol" aria-hidden="true">△</span><strong><Bi t={T.nav.signs} /></strong><span className="it-count" dir="ltr">{approved.signs.length}</span></Link>
        <Link href="/practice?mode=new" className="card it-action"><span className="it-action-symbol" aria-hidden="true">✧</span><strong><Bi t={T.unanswered} /></strong><span className="it-count" dir="ltr">{approved.questions.length - answered}</span></Link>
      </div>
      <div className="it-metrics">
        <div><strong dir="ltr">{approved.questions.length}</strong><Bi t={T.it.questionsHere} /></div>
        <div><strong dir="ltr">{answered}</strong><Bi t={T.answeredL} /></div>
        <div><strong dir="ltr">{mastered}</strong><Bi t={T.mastered} /></div>
        <div><strong dir="ltr">{itLessonsDone(progress)}/{IT_CHAPTERS.length}</strong><Bi t={T.it.lessonsDone} /></div>
      </div>
      {approved.questions.length === 0 && <Gate loading={approved.loading} failed={approved.failed} />}
      <div className="it-chapter-heading">
        <h2><Bi t={T.it.chapters} /></h2>
        <input type="search" aria-label={label(T.it.chapters)} placeholder={label(T.it.chapters)} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <ul className="it-chapters" data-testid="italy-chapters">
        {chapters.map((c) => {
          const questions = inChapter(approved.questions, c.id);
          const completed = questions.filter((q) => questionStatus(progress.questions[q.id], settings.masteryThreshold) === "mastered").length;
          return <li key={c.id}>
            <Link href={`/practice?chapter=${c.id}`} className="card card-link it-chapter" data-testid={`italy-chapter-${c.id}`}>
              <span className="it-chapter-number" dir="ltr">{String(c.id).padStart(2, "0")}</span>
              <div className="it-chapter-body"><strong><Bi t={c.title} /></strong>
                <progress value={completed} max={questions.length || 1} aria-label={label(c.title)} />
                <span className="small muted"><Bi t={T.mastered} inline /> <bdi>{completed} / {questions.length}</bdi></span>
              </div>
            </Link>
          </li>;
        })}
      </ul>
      {chapters.length === 0 && <p role="status"><Bi t={T.it.noQuestionsYet} /></p>}
      <aside className="card it-notice">
        <p className="muted small"><Bi t={T.it.reviewNotice} /></p>
        <p className="muted small" data-testid="italy-free"><Bi t={T.it.free} /></p>
        <p className="muted small"><Bi t={T.it.plannedTotal} inline /> <bdi>{IT_PLANNED_TOTAL}</bdi></p>
      </aside>
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
    const m: ItPracticeMode = asked === "errors" ? "wrong" : isItPracticeMode(asked) ? asked : ch !== null ? "chapter" : "all";
    return { chapter: ch, mode: m };
  }, []);
  const [run, setRun] = useState(() => ({ session: newSession(), progress }));
  const session = run.session;
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  // Keep progress fixed for the current run, including when the approved bank loads asynchronously.
  const list = useMemo(
    () => itPracticeSet(approved.questions, run.progress, mode, chapter, settings.masteryThreshold),
    [approved.questions, run.progress, mode, chapter, settings.masteryThreshold],
  );
  const restart = () => { setRun({ session: newSession(), progress }); setPos(0); setDone({}); };
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
        onPrev={pos > 0 ? () => setPos(pos - 1) : undefined}
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
 *
 * The paper is answered the way the real test is: in any order, with the overview as the flow, any
 * answer changeable, statements markable for a second look, and the paper handed in when the learner
 * says so — or when the 20 minutes are over.
 */
export function ItalyExam() {
  const rules = PATENTE_B_RULES_IT;
  const approved = useItApproved();
  const label = useBiText();
  const { progress, update } = useApp();
  const [paper, setPaper] = useState<ItQuestion[] | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [handedInByLearner, setHandedIn] = useState(false);
  const [asking, setAsking] = useState(false);
  const [pos, setPos] = useState(0);
  const [session, setSession] = useState(newSession);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const recorded = useRef(0);
  const now = useNowTicking(paper !== null && !handedInByLearner);
  const left = paper === null ? rules.minutes * 60 : itTimeLeft(startedAt, now, rules);
  // Time over ends the exam on its own: derived from the clock, never written into state.
  const handedIn = handedInByLearner || (paper !== null && left === 0);
  const history = progress.examHistory;

  const start = () => {
    const picked = pickItExam(approved.questions, rules);
    if (!picked) return;
    setPaper(picked); setStartedAt(Date.now()); setAnswers({}); setFlags({}); setPos(0);
    setHandedIn(false); setAsking(false); setOnlyErrors(false); recorded.current = 0; setSession(newSession());
  };

  const result = paper === null ? null : scoreItExam(paper.map((q) => ({ questionId: q.id, correct: answers[q.id] === q.answer })), rules);

  /**
   * The attempt is written once, when the paper is handed in. The progress document is already its own
   * per country (progressKey), so an Italian attempt lands in Italy's history and never counts towards
   * the German section. The guard is a ref: writing it must not itself cause a render.
   */
  useEffect(() => {
    if (!handedIn || paper === null || result === null || recorded.current === startedAt) return;
    recorded.current = startedAt;
    const attempt = { at: Date.now(), passed: result.passed, errorPoints: result.errors, totalPoints: paper.length, rulesVersion: result.rulesVersion };
    update((p) => ({ ...p, examHistory: [...p.examHistory, attempt].slice(-50) }));
  }, [handedIn, paper, result, startedAt, update]);

  if (paper === null) {
    const enough = approved.questions.length >= rules.questionCount;
    const recent = [...history].slice(-5).reverse();
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
        <section className="card it-history" aria-labelledby="it-history-title">
          <h2 id="it-history-title" className="small"><Bi t={T.it.examHistory} inline /></h2>
          {recent.length === 0
            ? <p className="muted small" data-testid="italy-exam-nohistory"><Bi t={T.it.examNoHistory} inline /></p>
            : <ul className="it-history-list" data-testid="italy-exam-history">
                {recent.map((a) => (
                  <li key={a.at} className={a.passed ? "is-pass" : "is-fail"}>
                    <span className="it-history-mark" aria-hidden="true"><Icon name={a.passed ? "check" : "close"} /></span>
                    <strong><Bi t={a.passed ? T.it.examPassed : T.it.examFailed} inline /></strong>
                    <span className="muted small"><Bi t={T.it.examErrors} inline /> <bdi dir="ltr">{a.errorPoints} / {a.totalPoints}</bdi></span>
                  </li>
                ))}
              </ul>}
        </section>
        <p className="small muted"><Bi t={T.it.examRulesSource} /> <bdi dir="ltr">({rules.version})</bdi></p>
      </section>
    );
  }

  if (handedIn && result !== null) {
    const rows = itExamReview(paper, answers);
    const shown = onlyErrors ? rows.filter((r) => !r.correct) : rows;
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
        <div className="it-chapter-heading">
          <h2><Bi t={T.it.examReview} /></h2>
          <button type="button" className="chip" aria-pressed={onlyErrors} onClick={() => setOnlyErrors((v) => !v)} data-testid="italy-exam-filter">
            <Icon name="target" /><span>{label(onlyErrors ? T.it.examAllQuestions : T.it.examOnlyErrors)}</span>
          </button>
        </div>
        <ol className="it-review" data-testid="italy-exam-review">
          {shown.map((r) => (
            <li key={r.question.id} className={`card it-review-row ${r.correct ? "is-correct" : "is-wrong"}`} data-testid={`italy-review-${r.question.id}`}>
              <div className="it-review-head">
                <span className="it-review-mark" aria-hidden="true"><Icon name={r.correct ? "check" : "close"} /></span>
                <span className="badge badge-outline"><Bi t={T.it.chapter} inline /> <span dir="ltr">{r.question.chapter}</span></span>
              </div>
              <Bi t={r.question.prompt} className="it-review-prompt" />
              <p className="small">
                <Bi t={T.it.examYourAnswer} inline />{": "}
                <strong>{r.given === null ? label(T.it.examUnanswered) : label(r.given ? T.it.vero : T.it.falso)}</strong>
                {!r.correct && <> · <Bi t={T.correctAnswers} inline />{": "}<strong>{label(r.question.answer ? T.it.vero : T.it.falso)}</strong></>}
              </p>
              {!r.correct && <div className="it-review-why"><Bi t={r.question.explanation} /></div>}
            </li>
          ))}
        </ol>
      </section>
    );
  }

  const q = paper[pos]!;
  const cells = itExamCells(paper, answers, flags);
  const open = itExamUnanswered(paper, answers);
  const clock = itClockState(left, rules);
  const nextOpen = itExamNextOpen(paper, answers, pos);
  return (
    <section className="stack" data-testid="italy-exam-running">
      <div className={`card it-exam-bar it-clock-${clock}`}>
        <p role="timer" data-testid="italy-exam-clock" className="it-exam-clock">
          <Icon name="exam" /><Bi t={T.it.examTimeLeft} inline />: <span className="num" dir="ltr">{formatClock(left)}</span>
        </p>
        <p className="small muted" data-testid="italy-exam-open">
          <Bi t={T.answeredL} inline /> <bdi dir="ltr">{paper.length - open} / {paper.length}</bdi>
        </p>
        <button type="button" className="btn btn-primary" onClick={() => (open > 0 ? setAsking(true) : setHandedIn(true))} data-testid="italy-exam-handin">
          <Bi t={T.it.examHandIn} />
        </button>
      </div>

      {asking && (
        <div className="card it-handin-ask" role="alertdialog" aria-labelledby="it-handin-title" data-testid="italy-exam-confirm">
          <strong id="it-handin-title"><Bi t={T.it.examHandInAsk} inline /></strong>
          <p className="small"><Bi t={T.it.examUnanswered} inline /> <bdi dir="ltr">{open}</bdi></p>
          <div className="q-actions">
            <button type="button" className="btn btn-primary" onClick={() => setHandedIn(true)} data-testid="italy-exam-handin-yes"><Bi t={T.it.examHandInYes} /></button>
            <button type="button" className="btn" onClick={() => setAsking(false)}><Bi t={T.it.back} /></button>
          </div>
        </div>
      )}

      <ItQuestionCard
        key={q.id}
        question={q}
        mode="exam"
        sessionId={session}
        index={pos}
        total={paper.length}
        answered={answers[q.id]}
        flagged={flags[q.id] === true}
        onToggleFlag={() => setFlags((f) => ({ ...f, [q.id]: !f[q.id] }))}
        onAnswered={(a) => setAnswers((prev) => ({ ...prev, [q.id]: a }))}
        onPrev={pos > 0 ? () => setPos(pos - 1) : undefined}
        onNext={() => setPos(pos + 1 < paper.length ? pos + 1 : nextOpen ?? pos)}
      />

      <nav className="card it-nav" aria-label={label(T.it.examOverview)} data-testid="italy-exam-nav">
        <h2 className="small"><Bi t={T.it.examOverview} inline /></h2>
        <ol className="it-nav-grid">
          {cells.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`it-nav-cell${c.answered ? " is-answered" : ""}${c.flagged ? " is-flagged" : ""}${c.index === pos ? " is-current" : ""}`}
                aria-current={c.index === pos ? "true" : undefined}
                aria-label={`${label(T.it.examOpenQuestion)} ${c.index + 1}`}
                onClick={() => setPos(c.index)}
                data-testid={`italy-exam-cell-${c.index + 1}`}
              >
                <span dir="ltr">{c.index + 1}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
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
  const { progress, settings, update } = useApp();
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
        <div className="grid grid-2 compact-stats">
          <div className="card stat"><span className="num" dir="ltr">{itLessonsDone(progress)}</span><span className="stat-label"><Bi t={T.it.lessonsDone} /></span></div>
          <div className="card stat"><span className="num" dir="ltr">{IT_CHAPTERS.length}</span><span className="stat-label"><Bi t={T.it.lessons} /></span></div>
        </div>
        <ul className="grid grid-tiles">
          {stats.map((s) => (
            <li key={s.chapter.id}>
              <Link href={`/learn?chapter=${s.chapter.id}`} className="card card-link tile" data-testid={`italy-lesson-${s.chapter.id}`}>
                <span className="badge" dir="ltr">{s.chapter.id}</span>
                <strong><Bi t={s.chapter.title} /></strong>
                {isItLessonDone(progress, s.chapter.id)
                  ? <span className="badge"><Bi t={T.it.markedDone} inline /></span>
                  : <span className="small muted" dir="ltr">{s.mastered} / {s.total}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const stat = stats.find((s) => s.chapter.id === chapter)!;
  const lesson = itLessonFor(chapter);
  const { prev, next } = itLessonNeighbours(chapter);
  const done = isItLessonDone(progress, chapter);
  const sources = lesson
    ? lesson.sources
    : itChapterSources(chapter, approved.questions, (id) => IT_CONTENT_REGISTRY.get(id)?.provenance.sourceRefs ?? []);
  const signs = (lesson?.signIds ?? [...new Set(approved.questions.filter((q) => q.chapter === chapter).map((q) => q.signId))].flatMap((id) => (id ? [id] : [])))
    .flatMap((id) => { const found = itSignById(id); return found ? [found] : []; });

  return (
    <section className="stack it-lesson" data-testid="italy-lesson">
      <p className="it-lesson-kicker">
        <Bi t={T.it.lessonOf} inline /> <span dir="ltr">{chapter} / {IT_CHAPTERS.length}</span>
        {done && <span className="badge" data-testid="italy-lesson-done-badge"><Bi t={T.it.markedDone} inline /></span>}
      </p>
      <h1><Bi t={stat.chapter.title} /></h1>

      {lesson ? (
        <>
          <div className="card"><Bi t={lesson.intro} /></div>

          <div className="card">
            <h2><Bi t={T.it.legalBasis} /></h2>
            <ul className="it-points" data-testid="italy-lesson-points">
              {lesson.points.map((pt, i) => (
                <li key={i}>
                  <Bi t={pt.text} />
                  {pt.ref && <span className="it-point-ref" lang="it" dir="ltr">{pt.ref}</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="card" data-testid="italy-lesson-example">
            <h2><Bi t={T.it.example} /></h2>
            <Bi t={lesson.example} />
          </div>

          {signs.length > 0 && (
            <div className="card" data-testid="italy-lesson-signs">
              <h2><Bi t={T.it.signsOfChapter} /></h2>
              <ul className="it-lesson-signs">
                {signs.map((sign) => (
                  <li key={sign.id}>
                    <ItSignImage sign={sign} labelled={false} />
                    <span className="it-sign-name"><Bi t={sign.name} /></span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h2><Bi t={T.it.selfCheck} /></h2>
          {lesson.checks.map((check, i) => <ItLessonCheck key={check.id} check={check} index={i} />)}
        </>
      ) : (
        <p className="card" role="status"><Bi t={T.contentInReview} /></p>
      )}

      {sources.length > 0 && (
        <div className="card">
          <h2><Bi t={T.it.legalBasis} /></h2>
          <ul className="stack" data-testid="italy-lesson-sources">
            {sources.map((ref) => <li key={ref} className="small" lang="it" dir="ltr">{ref}</li>)}
          </ul>
        </div>
      )}

      <div className="it-lesson-nav">
        <button type="button" className={`btn ${done ? "" : "btn-primary"}`} aria-pressed={done}
          onClick={() => update((prog) => toggleItLessonDone(prog, chapter))} data-testid="italy-lesson-done">
          <Bi t={done ? T.it.markedDone : T.it.markDone} inline />
        </button>
        {stat.total > 0 && <Link href={`/practice?chapter=${chapter}`} className="btn" data-testid="italy-lesson-practice"><Bi t={T.it.startPractice} /></Link>}
      </div>
      <div className="it-lesson-nav">
        {prev !== null && <Link href={`/learn?chapter=${prev}`} className="btn" data-testid="italy-lesson-prev"><Bi t={T.it.prevLesson} /></Link>}
        {next !== null && <Link href={`/learn?chapter=${next}`} className="btn" data-testid="italy-lesson-next"><Bi t={T.it.nextLesson} /></Link>}
        <Link href="/learn" className="btn"><Bi t={T.it.lessons} /></Link>
      </div>
    </section>
  );
}

/** Italy's progress: what the learner has done, per chapter, with the two review runs. */
export function ItalyProgress() {
  const { progress, settings } = useApp();
  const label = useBiText();
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
            <div className="progressbar" role="progressbar" aria-label={label(s.chapter.title)} aria-valuemin={0} aria-valuemax={s.total || 1} aria-valuenow={s.mastered}>
              <span style={{ width: `${s.total === 0 ? 0 : (s.mastered / s.total) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
