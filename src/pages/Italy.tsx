import "./italy.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "../app/router";
import { useApp, useNow } from "../app/state";
import { countryKey } from "../app/settings";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { ItQuestionCard } from "../components/ItQuestionCard";
import { ItQuestionNav, type ItNavCell } from "../components/ItQuestionNav";
import { ItSignImage } from "../components/ItSignImage";
import { ProgressRing } from "../components/ProgressRing";
import { useItApproved } from "../app/approved";
import { IT_CHAPTERS, IT_PLANNED_TOTAL } from "../content/italy/chapters";
import type { ItQuestion, ItText } from "../content/italy/types";
import { PATENTE_B_RULES_IT, scoreItExam } from "../lib/shared/examIt";
import { IT_EXAM_SESSION_KEY, formatClock, itClockState, itExamCells, itExamNextOpen, itExamReview, itExamErrorsByChapter, itExamUnanswered, itTimeLeft, pickItExam, restoreItExamSession, type ItExamSession } from "../lib/itExam";
import { questionStatus, recordAnswer } from "../lib/progress";
import { kv } from "../lib/storage";
import { IT_PRACTICE_SESSION_KEY, itPracticeCells, itPracticeLeft, newItPracticeSession, restoreItPracticeSession } from "../lib/itPractice";
import { isItIncrocioSolved, isItLessonDone, isItPracticeMode, itChapterSources, itChapterStats, itIncrociSolved, itLessonNeighbours, itLessonsDone, itNextIncrocio, itNextStep, itOverall, itPracticeSet, itReadiness, itStats, itStrongChapters, itWeakChapters, markItIncrocioSolved, toggleItLessonDone, type ItNextStep, type ItPracticeMode, type ItReadinessLevel } from "../lib/italyStudy";
import { IT_INCROCI, IT_INCROCI_GROUPS, itIncrocioById, itIncrocioNeighbours, itIncrociOf, type ItIncrocio } from "../content/italy/incroci";
import { ItIncrocioScene } from "../components/ItIncrocioScene";
import { ITU } from "../content/italy/ui";
import { Icon, type IconName } from "../components/Icon";
import { itLessonFor } from "../content/italy/lessons";
import { ItLessonCheck } from "../components/ItLessonCheck";
import { itSignById } from "../content/italy/signs";
import { IT_CONTENT_REGISTRY } from "../content/italy/registry";

const inChapter = (questions: readonly ItQuestion[], chapter: number) => questions.filter((q) => q.chapter === chapter);
const newSession = () => `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Shown while the approved list is being fetched, and when the fetch failed (fail closed: nothing is shown). */
function Gate({ loading, failed }: { loading: boolean; failed: boolean }) {
  if (loading) return <p className="card muted" aria-busy="true" data-testid="italy-loading">…</p>;
  if (failed) return <p className="card" role="status" data-testid="italy-gate-failed"><Bi t={T.contentInReview} /></p>;
  return <p className="card" role="status" data-testid="italy-in-review"><Bi t={T.contentInReview} /></p>;
}

/** The eight areas of the Italian course, each with its own screen. */
type ItTile = { href: string; icon: IconName; title: ItText; sub: ItText; tone: string };

const IT_TILES: ItTile[] = [
  { href: "/practice", icon: "check", title: ITU.tiles.practice, sub: ITU.tiles.practiceSub, tone: "emerald" },
  { href: "/learn", icon: "book", title: ITU.tiles.theory, sub: ITU.tiles.theorySub, tone: "sky" },
  { href: "/practice?mode=wrong", icon: "target", title: ITU.tiles.mistakes, sub: ITU.tiles.mistakesSub, tone: "rose" },
  { href: "/progress", icon: "chart", title: ITU.tiles.stats, sub: ITU.tiles.statsSub, tone: "violet" },
  { href: "/incroci", icon: "car", title: ITU.tiles.incroci, sub: ITU.tiles.incrociSub, tone: "indigo" },
  { href: "/exam", icon: "trophy", title: ITU.tiles.exam, sub: ITU.tiles.examSub, tone: "amber" },
  { href: "/signs", icon: "sign", title: ITU.tiles.signs, sub: ITU.tiles.signsSub, tone: "teal" },
  // The study guide has no screen of its own: it opens whatever the next step actually is.
  { href: "", icon: "sparkle", title: ITU.tiles.guide, sub: ITU.tiles.guideSub, tone: "slate" },
];

/** Where the study guide points, per step. One link, never a list of maybes. */
const IT_STEP_LINK: Record<ItNextStep, string> = {
  startLesson: "/learn?chapter=1",
  continueLesson: "/learn",
  fixMistakes: "/practice?mode=wrong",
  trainIncroci: "/incroci",
  takeExam: "/exam",
  waitForContent: "/learn",
};
const IT_STEP_TEXT = {
  startLesson: ITU.guide.startLesson,
  continueLesson: ITU.guide.continueLesson,
  fixMistakes: ITU.guide.fixMistakes,
  trainIncroci: ITU.guide.trainIncroci,
  takeExam: ITU.guide.takeExam,
  waitForContent: ITU.guide.waitForContent,
} satisfies Record<ItNextStep, ItText>;

/** A soft 3D ring that shows one real percentage and nothing else. */
function ItRing({ percent, label }: { percent: number; label: string }) {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="it-ring" role="img" aria-label={`${label}: ${safe}%`} style={{ background: `conic-gradient(var(--rd-green, #22c55e) ${safe}%, var(--track) 0)` }}>
      <strong dir="ltr">{safe}%</strong>
    </div>
  );
}

/**
 * Italy's start screen. One board with every area of the course, the learner's real figures and a
 * single suggested next step; underneath, the 16 chapters of the syllabus with their own progress.
 */
export function ItalyHome() {
  const { progress, settings } = useApp();
  const label = useBiText();
  const approved = useItApproved();
  const answered = approved.questions.filter((q) => progress.questions[q.id]).length;
  const mastered = approved.questions.filter((q) => questionStatus(progress.questions[q.id], settings.masteryThreshold) === "mastered").length;
  const [search, setSearch] = useState("");
  const errors = approved.questions.filter((q) => progress.questions[q.id]?.lastCorrect === false).length;
  const ready = itReadiness(progress, approved.questions, settings.masteryThreshold);
  const lessonsDone = itLessonsDone(progress);
  const solvedScenes = itIncrociSolved(progress);
  const step = itNextStep({ progress, questions: approved.questions, threshold: settings.masteryThreshold, examQuestionCount: PATENTE_B_RULES_IT.questionCount });
  const needle = search.trim().toLocaleLowerCase();
  const chapters = IT_CHAPTERS.filter((c) => needle === "" || label(c.title).toLocaleLowerCase().includes(needle) || c.title.it.toLocaleLowerCase().includes(needle));
  const counts: Record<string, number | null> = {
    "/practice": approved.questions.length,
    "/practice?mode=wrong": errors,
    "/learn": lessonsDone,
    "/incroci": solvedScenes,
    "/signs": approved.signs.length,
    "/progress": null, "/exam": null, "": null,
  };

  return (
    <section className="stack italy-dashboard" data-testid="italy-home">
      <header className="it-hero">
        <div className="it-hero-copy">
          <span className="it-country"><Bi t={ITU.home.kicker} inline /></span>
          <h1><Bi t={ITU.home.title} /></h1>
          <p className="it-hero-free" data-testid="italy-free"><Bi t={ITU.home.free} /></p>
          <Link href={IT_STEP_LINK[step]} className="btn btn-primary it-hero-cta" data-testid="italy-next-step">
            <Bi t={ITU.guide.heading} inline />
          </Link>
        </div>
        <div className="it-hero-ring">
          <ItRing percent={ready.masteredPct} label={label(ITU.stats.readiness)} />
          <span className="it-hero-ring-label"><Bi t={ITU.stats.readiness} /></span>
        </div>
      </header>

      <section className="it-guide card" aria-labelledby="it-guide-title" data-testid="italy-guide">
        <span className="it-guide-icon" aria-hidden="true"><Icon name="sparkle" /></span>
        <div className="it-guide-copy">
          <h2 id="it-guide-title"><Bi t={ITU.guide.heading} /></h2>
          <p><Bi t={IT_STEP_TEXT[step]} /></p>
        </div>
      </section>

      <h2 className="it-section-title"><Bi t={ITU.home.everything} /></h2>
      <nav className="it-tiles" aria-label={label(ITU.home.everything)} data-testid="italy-tiles">
        {IT_TILES.map((t) => {
          const n = counts[t.href];
          const href = t.href === "" ? IT_STEP_LINK[step] : t.href;
          return (
            <Link key={t.icon} href={href} className={`card card-link it-tile it-tile-${t.tone}`} data-testid={`italy-tile-${t.icon}`}>
              <span className="it-tile-icon" aria-hidden="true"><Icon name={t.icon} /></span>
              <strong><Bi t={t.title} /></strong>
              <span className="it-tile-sub"><Bi t={t.sub} /></span>
              {n !== null && n !== undefined && <span className="it-tile-count" dir="ltr" aria-hidden="true">{n}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="it-metrics" data-testid="italy-metrics">
        <div><strong dir="ltr">{approved.questions.length}</strong><Bi t={T.it.questionsHere} /></div>
        <div><strong dir="ltr">{answered}</strong><Bi t={T.answeredL} /></div>
        <div><strong dir="ltr">{mastered}</strong><Bi t={T.mastered} /></div>
        <div><strong dir="ltr">{lessonsDone}/{IT_CHAPTERS.length}</strong><Bi t={T.it.lessonsDone} /></div>
      </div>

      {approved.questions.length === 0 && <Gate loading={approved.loading} failed={approved.failed} />}

      <div className="it-chapter-heading">
        <h2><Bi t={ITU.home.chaptersHeading} /></h2>
        <input type="search" aria-label={label(ITU.home.searchChapter)} placeholder={label(ITU.home.searchChapter)} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <ul className="it-chapters" data-testid="italy-chapters">
        {chapters.map((c) => {
          const questions = inChapter(approved.questions, c.id);
          const completed = questions.filter((q) => questionStatus(progress.questions[q.id], settings.masteryThreshold) === "mastered").length;
          const done = isItLessonDone(progress, c.id);
          return <li key={c.id}>
            <Link href={`/learn?chapter=${c.id}`} className="card card-link it-chapter" data-testid={`italy-chapter-${c.id}`}>
              <span className="it-chapter-number" dir="ltr">{String(c.id).padStart(2, "0")}</span>
              <div className="it-chapter-body"><strong><Bi t={c.title} /></strong>
                <progress value={completed} max={questions.length || 1} aria-label={label(c.title)} />
                <span className="small muted"><Bi t={T.mastered} inline /> <bdi>{completed} / {questions.length}</bdi></span>
              </div>
              {done && <span className="badge it-chapter-done"><Bi t={T.it.markedDone} inline /></span>}
            </Link>
          </li>;
        })}
      </ul>
      {chapters.length === 0 && <p className="card" role="status"><Bi t={ITU.home.noChapterFound} /></p>}

      <nav className="q-actions" aria-label={label(T.it.lessons)} data-testid="italy-quick">
        <Link href="/learn" className="btn btn-primary" data-testid="italy-go-lessons"><Bi t={T.it.lessons} /></Link>
        <Link href="/progress" className="btn" data-testid="italy-go-progress"><Bi t={T.nav.progress} /></Link>
      </nav>

      <aside className="card it-notice">
        <p className="muted small"><Bi t={T.it.reviewNotice} /></p>
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
  // A resumed run keeps the statements it was drawn with, so its numbering cannot shift under the learner.
  const [resumed, setResumed] = useState<ItQuestion[] | null>(null);
  // True once the learner has answered or moved in this run: what makes the run worth saving, and what
  // stops a stored run from being applied over work already in progress.
  const touched = useRef(false);
  const sessionKey = countryKey(IT_PRACTICE_SESSION_KEY, settings.country);
  // Whether the learner has moved within the run: the card that replaces this one then takes focus.
  const [navigated, setNavigated] = useState(false);
  const go = (i: number) => { touched.current = true; setNavigated(true); setPos(i); };
  // Keep progress fixed for the current run, including when the approved bank loads asynchronously.
  const drawn = useMemo(
    () => itPracticeSet(approved.questions, run.progress, mode, chapter, settings.masteryThreshold),
    [approved.questions, run.progress, mode, chapter, settings.masteryThreshold],
  );
  const restart = () => {
    touched.current = false;
    kv.del(sessionKey).catch(() => undefined);
    setRun({ session: newSession(), progress }); setPos(0); setDone({}); setResumed(null); setNavigated(false);
  };

  /**
   * An unfinished run is picked up where it was left, without a screen in the way: the answers are
   * already scored, so there is nothing to confirm and nothing to lose. Only the run for the mode and
   * chapter the learner opened, and never over work already begun in this visit.
   */
  useEffect(() => {
    if (approved.loading) return;
    let alive = true;
    kv.get<unknown>(sessionKey)
      .then((raw) => {
        if (!alive || touched.current) return;
        const back = restoreItPracticeSession(raw, { mode, chapter }, approved.questions, Date.now());
        if (!back) return;
        setResumed(back.list); setDone(back.session.answers); setPos(back.session.pos);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [sessionKey, approved.loading, approved.questions, mode, chapter]);
  const title = mode === "wrong" ? { title: T.it.reviewWrong }
    : mode === "bookmarks" ? { title: T.it.reviewBookmarks }
    : chapter === null ? null : IT_CHAPTERS.find((c) => c.id === chapter) ?? null;
  const list = resumed ?? drawn;
  const q = list[pos];

  // Every answer and move is saved at once, so a reload continues the run instead of redrawing it.
  useEffect(() => {
    if (!touched.current || list.length === 0) return;
    const open = { ...newItPracticeSession(mode, chapter, list, Date.now()), answers: done, pos };
    kv.set(sessionKey, open).catch(() => undefined);
  }, [list, done, pos, mode, chapter, sessionKey]);

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
    const left = itPracticeLeft(list, done);
    return (
      <section className="stack" data-testid="italy-practice-done">
        <h1><Bi t={T.it.finished} /></h1>
        <div className="grid grid-2 compact-stats">
          <div className="card stat"><span className="num" dir="ltr">{list.length - left} / {list.length}</span><span className="stat-label"><Bi t={ITU.result.score} /></span></div>
          <div className="card stat"><span className="num" dir="ltr">{left}</span><span className="stat-label"><Bi t={ITU.practice.stillWrong} /></span></div>
        </div>
        {left === 0 && <p className="card" role="status" data-testid="italy-practice-allfixed"><Bi t={ITU.practice.allFixed} /></p>}
        <div className="q-actions">
          <button type="button" className="btn btn-primary" onClick={restart} data-testid="italy-again"><Bi t={T.it.again} /></button>
          {left > 0 && <Link href="/practice?mode=wrong" className="btn" data-testid="italy-practice-continue-wrong"><Bi t={ITU.practice.continueWrong} /></Link>}
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
        focusOnMount={navigated}
        onAnswered={(a) => { touched.current = true; setDone((d) => ({ ...d, [q.id]: a })); }}
        onPrev={pos > 0 ? () => go(pos - 1) : undefined}
        onNext={() => go(pos + 1)}
      />
      <ItQuestionNav
        testId="italy-practice-nav"
        current={pos}
        onGo={go}
        cells={itPracticeCells(list, done).map((c): ItNavCell => ({ index: c.index, id: c.id, state: c.state }))}
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
  const { progress, update, settings } = useApp();
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
  // Whether the learner has moved within the paper: the card that replaces this one then takes focus.
  const [navigated, setNavigated] = useState(false);
  const go = (i: number) => { setNavigated(true); setPos(i); };
  // undefined: the stored paper has not been read yet. null: there is none to offer.
  const [paused, setPaused] = useState<{ session: ItExamSession; paper: ItQuestion[] } | null | undefined>(undefined);
  const sessionKey = countryKey(IT_EXAM_SESSION_KEY, settings.country);
  const now = useNowTicking(paper !== null && !handedInByLearner);
  const left = paper === null ? rules.minutes * 60 : itTimeLeft(startedAt, now, rules);
  // Time over ends the exam on its own: derived from the clock, never written into state.
  const handedIn = handedInByLearner || (paper !== null && left === 0);
  const history = progress.examHistory;

  // An unfinished paper is offered again after a reload or a closed tab. Read once, when the approved
  // catalogue is in: a paper can only be rebuilt from the statements that are published now.
  useEffect(() => {
    if (approved.loading) return;
    let alive = true;
    kv.get<unknown>(sessionKey)
      .then((raw) => { if (alive) setPaused(restoreItExamSession(raw, rules.version, approved.questions, Date.now(), rules)); })
      .catch(() => { if (alive) setPaused(null); });
    return () => { alive = false; };
  }, [sessionKey, approved.loading, approved.questions, rules]);

  // Every answer, mark and move is saved at once. A failed write must never interrupt the exam.
  useEffect(() => {
    if (paper === null || handedIn) return;
    const open: ItExamSession = { version: 1, rulesVersion: rules.version, startedAt, questionIds: paper.map((q) => q.id), answers, flagged: Object.keys(flags).filter((id) => flags[id]), pos };
    kv.set(sessionKey, open).catch(() => undefined);
  }, [paper, handedIn, rules.version, startedAt, answers, flags, pos, sessionKey]);

  const begin = (picked: ItQuestion[], at: number, prev?: { answers: Record<string, boolean>; flagged: string[]; pos: number }) => {
    setPaper(picked); setStartedAt(at);
    setAnswers(prev?.answers ?? {});
    setFlags(Object.fromEntries((prev?.flagged ?? []).map((id) => [id, true])));
    setPos(prev?.pos ?? 0);
    setHandedIn(false); setAsking(false); setOnlyErrors(false); recorded.current = 0; setSession(newSession());
    setPaused(null);
  };

  const start = () => {
    const picked = pickItExam(approved.questions, rules);
    if (!picked) return;
    kv.del(sessionKey).catch(() => undefined);
    begin(picked, Date.now());
  };

  const discard = () => { setPaused(null); kv.del(sessionKey).catch(() => undefined); };

  const result = paper === null ? null : scoreItExam(paper.map((q) => ({ questionId: q.id, correct: answers[q.id] === q.answer })), rules);

  /**
   * The attempt is written once, when the paper is handed in. The progress document is already its own
   * per country (progressKey), so an Italian attempt lands in Italy's history and never counts towards
   * the German section. The guard is a ref: writing it must not itself cause a render.
   */
  useEffect(() => {
    if (!handedIn || paper === null || result === null || recorded.current === startedAt) return;
    recorded.current = startedAt;
    const at = Date.now();
    const attempt = { at, passed: result.passed, errorPoints: result.errors, totalPoints: paper.length, rulesVersion: result.rulesVersion };
    const sat = paper;
    // The statements were really answered, so they count towards progress — which is what makes
    // "Ripassa gli errori" find the mistakes of this exam. Scored once, under this paper's own key.
    update((p) => {
      let next = p;
      for (const q of sat) next = recordAnswer(next, `it-exam-${startedAt}`, q.id, answers[q.id] === q.answer, at);
      return { ...next, examHistory: [...next.examHistory, attempt].slice(-50) };
    });
    kv.del(sessionKey).catch(() => undefined);
  }, [handedIn, paper, result, startedAt, answers, update, sessionKey]);

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
        {paused && (
          <section className="card it-resume" aria-labelledby="it-resume-title" data-testid="italy-exam-resume">
            <strong id="it-resume-title"><Bi t={ITU.exam.resumeHeading} inline /></strong>
            <Bi t={ITU.exam.resumeNote} className="small" />
            <p className="small muted">
              <Bi t={T.answeredL} inline /> <bdi dir="ltr">{Object.keys(paused.session.answers).length} / {paused.paper.length}</bdi>
              {" · "}<Bi t={T.it.examTimeLeft} inline /> <bdi dir="ltr">{formatClock(itTimeLeft(paused.session.startedAt, now, rules))}</bdi>
            </p>
            <div className="q-actions">
              <button type="button" className="btn btn-primary" onClick={() => begin(paused.paper, paused.session.startedAt, paused.session)} data-testid="italy-exam-resume-go">
                <Bi t={ITU.exam.resume} />
              </button>
              <button type="button" className="btn" onClick={discard} data-testid="italy-exam-resume-discard"><Bi t={ITU.exam.discard} /></button>
            </div>
          </section>
        )}
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
    const byChapter = itExamErrorsByChapter(paper, answers);
    return (
      <section className="stack" data-testid="italy-exam-result">
        <section className={`card it-verdict ${result.passed ? "is-pass" : "is-fail"}`} aria-labelledby="it-verdict-title">
          <div className="it-verdict-mark" aria-hidden="true"><Icon name={result.passed ? "trophy" : "alert"} /></div>
          <div className="it-verdict-text">
            <h1 id="it-verdict-title"><Bi t={result.passed ? T.it.examPassed : T.it.examFailed} /></h1>
            <Bi t={result.errors === 0 ? ITU.result.perfect : result.passed ? ITU.result.passNote : ITU.result.failNote} className="small" />
          </div>
          <ProgressRing value={(paper.length - result.errors) / paper.length * 100} label={label(ITU.result.score)} />
        </section>
        <div className="grid grid-3 compact-stats">
          <div className="card stat"><span className="num" dir="ltr">{paper.length - result.errors} / {paper.length}</span><span className="stat-label"><Bi t={ITU.result.score} /></span></div>
          <div className="card stat"><span className="num" dir="ltr">{result.errors} / {rules.maxErrors}</span><span className="stat-label"><Bi t={ITU.result.allowed} /></span></div>
          <div className="card stat"><span className="num" dir="ltr">{formatClock(rules.minutes * 60 - left)}</span><span className="stat-label"><Bi t={ITU.result.timeUsed} /></span></div>
        </div>
        {byChapter.length > 0 && (
          <section className="card it-bychapter" aria-labelledby="it-bychapter-title">
            <h2 id="it-bychapter-title" className="small"><Bi t={ITU.result.byChapter} inline /></h2>
            <ul className="it-bychapter-list" data-testid="italy-exam-bychapter">
              {byChapter.map(({ chapter, errors }) => (
                <li key={chapter}>
                  <Link href={`/practice?chapter=${chapter}`} className="it-bychapter-row">
                    <span className="it-bychapter-name"><Bi t={IT_CHAPTERS.find((c) => c.id === chapter)?.title ?? T.it.chapter} inline /></span>
                    <span className="badge" dir="ltr">{errors}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="q-actions">
          <button type="button" className="btn btn-primary" onClick={() => setPaper(null)} data-testid="italy-exam-again"><Bi t={T.it.again} /></button>
          {result.errors > 0 && <Link href="/practice?mode=wrong" className="btn" data-testid="italy-exam-practice-wrong"><Bi t={ITU.tiles.mistakes} /></Link>}
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
        <div
          className="card it-handin-ask"
          role="alertdialog"
          aria-labelledby="it-handin-title"
          aria-describedby="it-handin-open"
          tabIndex={-1}
          ref={(el) => { el?.focus(); }}
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setAsking(false); } }}
          data-testid="italy-exam-confirm"
        >
          <strong id="it-handin-title"><Bi t={T.it.examHandInAsk} inline /></strong>
          <p className="small" id="it-handin-open"><Bi t={T.it.examUnanswered} inline /> <bdi dir="ltr">{open}</bdi></p>
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
        focusOnMount={navigated}
        onPrev={pos > 0 ? () => go(pos - 1) : undefined}
        onNext={() => go(pos + 1 < paper.length ? pos + 1 : nextOpen ?? pos)}
      />

      <ItQuestionNav
        testId="italy-exam-nav"
        current={pos}
        onGo={go}
        cells={cells.map((c): ItNavCell => ({ index: c.index, id: c.id, state: c.answered ? "answered" : "unanswered", flagged: c.flagged }))}
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

/** The wording of each readiness level. */
const IT_READINESS_TEXT = {
  not_started: ITU.stats.readinessNotStarted,
  learning: ITU.stats.readinessLearning,
  almost: ITU.stats.readinessAlmost,
  ready: ITU.stats.readinessReady,
} satisfies Record<ItReadinessLevel, ItText>;

/** Short weekday initials for the activity bars, in the three languages of the Italian section. */
const IT_WEEKDAYS: ItText[] = [
  { it: "D", ckb: "ی", kmrArab: "ی" },
  { it: "L", ckb: "د", kmrArab: "د" },
  { it: "M", ckb: "س", kmrArab: "س" },
  { it: "M", ckb: "چ", kmrArab: "چ" },
  { it: "G", ckb: "پ", kmrArab: "پ" },
  { it: "V", ckb: "ه", kmrArab: "ه" },
  { it: "S", ckb: "ش", kmrArab: "ش" },
];

/**
 * Italy's statistics. Every figure here is the learner's own: answers given on this device, lessons
 * marked done, scenes solved and simulations actually taken. Nothing is estimated, and a figure that
 * has not been earned stays at zero with the screen saying so.
 */
export function ItalyProgress() {
  const { progress, settings } = useApp();
  const label = useBiText();
  const approved = useItApproved();
  const now = useNow();
  const all = itOverall(progress, approved.questions, settings.masteryThreshold);
  const stats = itChapterStats(progress, approved.questions, settings.masteryThreshold);
  const s = itStats(progress, approved.questions, now);
  const ready = itReadiness(progress, approved.questions, settings.masteryThreshold);
  const strong = itStrongChapters(stats);
  const weak = itWeakChapters(stats);
  const peak = Math.max(1, ...s.week.map((d) => d.count));
  const notStarted = stats.filter((c) => c.answered === 0).length;

  return (
    <section className="stack italy-stats" data-testid="italy-progress">
      <h1><Bi t={ITU.stats.title} /></h1>
      {approved.questions.length === 0 && <Gate loading={approved.loading} failed={approved.failed} />}

      <section className="card it-readiness" aria-labelledby="it-readiness-title" data-testid="italy-readiness">
        <ItRing percent={ready.masteredPct} label={label(ITU.stats.readiness)} />
        <div className="it-readiness-copy">
          <h2 id="it-readiness-title"><Bi t={ITU.stats.readiness} /></h2>
          <p className="it-readiness-level"><Bi t={IT_READINESS_TEXT[ready.level]} /></p>
          <p className="small muted"><Bi t={ITU.stats.readinessHow} /></p>
        </div>
      </section>

      <section className="card it-streak" aria-labelledby="it-streak-title" data-testid="italy-streak">
        <div className="it-streak-head">
          <h2 id="it-streak-title"><Bi t={ITU.stats.streak} /></h2>
          <span className="badge" dir="ltr">{s.streak}</span>
        </div>
        {s.streak === 0 && <p className="small muted"><Bi t={ITU.stats.streakNone} /></p>}
        <ul className="it-week" data-testid="italy-week">
          {s.week.map((d, i) => {
            const weekday = IT_WEEKDAYS[new Date(`${d.key}T00:00:00`).getDay()] ?? IT_WEEKDAYS[0]!;
            return (
              <li key={d.key}>
                <span className="it-week-bar" aria-hidden="true"><span style={{ height: `${Math.round((d.count / peak) * 100)}%` }} /></span>
                <span className="it-week-day">
                  <Bi t={weekday} inline />
                  <span className="sr-only">: {d.count} {label(ITU.stats.answers)}</span>
                </span>
                {i === s.week.length - 1 && <span className="sr-only">{label(ITU.stats.today)}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid grid-2 compact-stats">
        <div className="card stat"><span className="num" dir="ltr">{s.correct}</span><span className="stat-label"><Bi t={ITU.stats.correct} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{s.wrong}</span><span className="stat-label"><Bi t={ITU.stats.wrong} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{s.accuracy === null ? "—" : `${s.accuracy}%`}</span><span className="stat-label"><Bi t={ITU.stats.accuracy} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{s.answersThisWeek}</span><span className="stat-label"><Bi t={ITU.stats.thisWeek} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{all.mastered}</span><span className="stat-label"><Bi t={T.it.masteredCount} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{all.bookmarked}</span><span className="stat-label"><Bi t={T.it.reviewBookmarks} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{s.examsTaken}</span><span className="stat-label"><Bi t={ITU.stats.examsDone} /></span></div>
        <div className="card stat"><span className="num" dir="ltr">{s.examsPassed}</span><span className="stat-label"><Bi t={ITU.stats.examsPassed} /></span></div>
      </div>
      {s.attempts === 0 && <p className="card muted small" role="status" data-testid="italy-stats-empty"><Bi t={ITU.stats.noDataYet} /></p>}

      <div className="q-actions">
        <Link href="/practice?mode=wrong" className="btn btn-primary" data-testid="italy-review-wrong"><Bi t={T.it.reviewWrong} /></Link>
        <Link href="/practice?mode=bookmarks" className="btn" data-testid="italy-review-bookmarks"><Bi t={T.it.reviewBookmarks} /></Link>
        <Link href="/incroci" className="btn" data-testid="italy-stats-incroci"><Bi t={ITU.incroci.short} /></Link>
      </div>

      <div className="it-two">
        <section className="card" aria-labelledby="it-strong-title" data-testid="italy-strong">
          <h2 id="it-strong-title" className="section-title"><Bi t={ITU.stats.strong} /></h2>
          {strong.length === 0
            ? <p className="small muted"><Bi t={ITU.stats.strongEmpty} /></p>
            : <ul className="it-chip-list">{strong.map((c) => <li key={c.chapter.id}><Link href={`/practice?chapter=${c.chapter.id}`} className="chip"><Bi t={c.chapter.title} inline /></Link></li>)}</ul>}
        </section>
        <section className="card" aria-labelledby="it-weak-title" data-testid="italy-weak">
          <h2 id="it-weak-title" className="section-title"><Bi t={ITU.stats.weak} /></h2>
          {weak.length === 0
            ? <p className="small muted"><Bi t={ITU.stats.weakEmpty} /></p>
            : <ul className="it-chip-list">{weak.map((c) => <li key={c.chapter.id}><Link href={`/practice?chapter=${c.chapter.id}`} className="chip"><Bi t={c.chapter.title} inline /></Link></li>)}</ul>}
        </section>
      </div>

      <h2 className="section-title"><Bi t={T.it.chapterProgress} /></h2>
      <p className="small muted"><Bi t={ITU.stats.notStartedChapters} inline /> <bdi dir="ltr">{notStarted} / {stats.length}</bdi></p>
      <ul className="stack" data-testid="italy-progress-chapters">
        {stats.map((c) => (
          <li key={c.chapter.id} className="card">
            <div className="q-meta">
              <span className="badge" dir="ltr">{c.chapter.id}</span>
              <strong><Bi t={c.chapter.title} /></strong>
              <span className="spacer" />
              <span className="small muted" dir="ltr">{c.mastered}/{c.total}</span>
            </div>
            <div className="progressbar" role="progressbar" aria-label={label(c.chapter.title)} aria-valuemin={0} aria-valuemax={c.total || 1} aria-valuenow={c.mastered}>
              <span style={{ width: `${c.total === 0 ? 0 : (c.mastered / c.total) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Incroci: right of way, one scene at a time ────────────────────────── */

/** The spoken name of a vehicle: its colour and the arm it arrives from, in each of the three languages. */
const itVehicleText = (v: ItIncrocio["vehicles"][number]): ItText => {
  const c = ITU.colour[v.colour];
  const d = ITU.dir[v.from];
  return { it: `${c.it} ${d.it}`, ckb: `${c.ckb} ${d.ckb}`, kmrArab: `${c.kmrArab} ${d.kmrArab}` };
};

/** One scene as a card in the list: its own drawing, its title and whether it is solved. */
function ItIncrocioCard({ scene, solved }: { scene: ItIncrocio; solved: boolean }) {
  return (
    <Link href={`/incroci?scene=${scene.id}`} className="card card-link it-inc-card" data-testid={`italy-incrocio-${scene.id}`}>
      <ItIncrocioScene scene={scene} />
      <strong><Bi t={scene.title} /></strong>
      {solved && <span className="badge it-inc-solved"><Bi t={ITU.incroci.solvedOne} inline /></span>}
    </Link>
  );
}

/** The scene itself: pick the order, see at once whether it holds, and read why. */
function ItIncrocioDetail({ scene }: { scene: ItIncrocio }) {
  const { progress, update } = useApp();
  const label = useBiText();
  const [chosen, setChosen] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const total = scene.vehicles.length;
  const complete = chosen.length === total;
  const correct = complete && chosen.every((id, i) => scene.order[i] === id);
  const { prev, next } = itIncrocioNeighbours(scene.id);
  const solved = isItIncrocioSolved(progress, scene.id);

  useEffect(() => {
    if (correct) update((p) => markItIncrocioSolved(p, scene.id));
  }, [correct, scene.id, update]);

  const orderedNames = scene.order.map((id) => scene.vehicles.find((v) => v.id === id)!);

  return (
    <section className="stack it-inc" data-testid="italy-incrocio">
      <p className="it-lesson-kicker">
        <Bi t={ITU.incroci.scene} inline /> <span dir="ltr">{IT_INCROCI.indexOf(scene) + 1} / {IT_INCROCI.length}</span>
        {solved && <span className="badge" data-testid="italy-incrocio-solved"><Bi t={ITU.incroci.solvedOne} inline /></span>}
      </p>
      <h1><Bi t={scene.title} /></h1>
      <p className="card muted small"><Bi t={ITU.incroci.intro} /></p>

      <div className="it-inc-stage">
        <ItIncrocioScene scene={scene} chosen={chosen} />
      </div>

      <div className="it-inc-picks" role="group" aria-label={label(ITU.incroci.question)}>
        {scene.vehicles.map((v) => {
          const at = chosen.indexOf(v.id);
          const name = itVehicleText(v);
          return (
            <button
              key={v.id}
              type="button"
              className={`btn it-inc-pick it-inc-${v.colour}${at < 0 ? "" : " is-picked"}`}
              data-testid={`italy-incrocio-pick-${v.id}`}
              aria-pressed={at >= 0}
              onClick={() => setChosen((c) => (c.includes(v.id) ? c : [...c, v.id]))}
            >
              <span className="it-inc-dot" aria-hidden="true" />
              {/* The name the screen reader announces is built from what the button shows, with the
                  spoken context only in front of it. An aria-label would replace the visible wording
                  instead of containing it, which WCAG 2.5.3 (label in name) does not allow. */}
              <span className="sr-only">{`${label(at < 0 ? ITU.incroci.chooseVehicle : ITU.incroci.position)}: `}</span>
              <span><Bi t={name} inline /></span>
              {at >= 0 && <span className="it-inc-num" dir="ltr">{at + 1}</span>}
            </button>
          );
        })}
      </div>

      <div className="q-actions">
        <button type="button" className="btn" disabled={chosen.length === 0} onClick={() => setChosen((c) => c.slice(0, -1))} data-testid="italy-incrocio-undo">
          <Bi t={ITU.incroci.undo} inline />
        </button>
        <button type="button" className="btn" disabled={chosen.length === 0 && !revealed} onClick={() => { setChosen([]); setRevealed(false); }} data-testid="italy-incrocio-reset">
          <Bi t={ITU.incroci.reset} inline />
        </button>
        {!complete && !revealed && (
          <button type="button" className="btn" onClick={() => setRevealed(true)} data-testid="italy-incrocio-reveal">
            <Bi t={ITU.incroci.showAnswer} inline />
          </button>
        )}
      </div>

      {complete && (
        <div className={`card it-inc-feedback ${correct ? "is-right" : "is-wrong"}`} role="status" data-testid="italy-incrocio-feedback">
          <strong><Bi t={correct ? ITU.incroci.right : ITU.incroci.notRight} /></strong>
        </div>
      )}

      {(complete || revealed) && (
        <>
          <div className="card" data-testid="italy-incrocio-answer">
            <h2><Bi t={ITU.incroci.correctOrder} /></h2>
            <ol className="it-inc-answer">
              {orderedNames.map((v) => <li key={v.id}><span className={`it-inc-dot it-inc-${v.colour}`} aria-hidden="true" /><Bi t={itVehicleText(v)} inline /></li>)}
            </ol>
          </div>
          <div className="card">
            <h2><Bi t={ITU.incroci.rule} /></h2>
            <Bi t={scene.rule} />
          </div>
          <div className="card" data-testid="italy-incrocio-why">
            <h2><Bi t={ITU.incroci.why} /></h2>
            <Bi t={scene.why} />
            <p className="it-point-ref" lang="it" dir="ltr">{scene.ref}</p>
          </div>
        </>
      )}

      <div className="it-lesson-nav">
        {prev && <Link href={`/incroci?scene=${prev}`} className="btn" data-testid="italy-incrocio-prev"><Bi t={ITU.incroci.prev} /></Link>}
        {next && <Link href={`/incroci?scene=${next}`} className="btn btn-primary" data-testid="italy-incrocio-next"><Bi t={ITU.incroci.next} /></Link>}
        <Link href="/incroci" className="btn"><Bi t={ITU.incroci.back} /></Link>
      </div>
      <p className="muted small"><Bi t={ITU.incroci.original} /></p>
    </section>
  );
}

/**
 * Italy's intersections. Original RegaDRIVE schematics of the right-of-way rules: the learner puts the
 * vehicles in the order of precedence and reads the rule and the article behind it. Teaching material,
 * separate from the examination bank and from its publication gate.
 */
export function ItalyIncroci() {
  const { progress } = useApp();
  const label = useBiText();
  const scene = useMemo(() => {
    const id = new URLSearchParams(location.search).get("scene");
    return id === null ? null : itIncrocioById(id);
  }, []);
  const solved = itIncrociSolved(progress);
  const start = itNextIncrocio(progress) ?? IT_INCROCI[0]!;

  if (scene) return <ItIncrocioDetail scene={scene} />;

  return (
    <section className="stack" data-testid="italy-incroci">
      <h1><Bi t={ITU.incroci.title} /></h1>
      <section className="it-inc-hero card" aria-labelledby="it-inc-hero-title">
        <div className="stack">
          <h2 id="it-inc-hero-title"><Bi t={ITU.incroci.question} /></h2>
          <p className="small"><Bi t={ITU.incroci.solved} inline /> <bdi dir="ltr">{solved} / {IT_INCROCI.length}</bdi></p>
          <div className="progressbar" role="progressbar" aria-label={label(ITU.incroci.solved)} aria-valuemin={0} aria-valuemax={IT_INCROCI.length} aria-valuenow={solved}>
            <span style={{ width: `${(solved / IT_INCROCI.length) * 100}%` }} />
          </div>
          <Link href={`/incroci?scene=${start.id}`} className="btn btn-primary" data-testid="italy-incroci-start"><Bi t={start.title} /></Link>
        </div>
        <ItIncrocioScene scene={start} />
      </section>

      {IT_INCROCI_GROUPS.map((g) => {
        const scenes = itIncrociOf(g.id);
        const done = scenes.filter((x) => isItIncrocioSolved(progress, x.id)).length;
        return (
          <section key={g.id} className="stack" aria-labelledby={`it-inc-group-${g.id}`} data-testid={`italy-incroci-group-${g.id}`}>
            <div className="it-chapter-heading">
              <h2 id={`it-inc-group-${g.id}`}><Bi t={g.title} /></h2>
              <span className="badge" dir="ltr">{done} / {scenes.length}</span>
            </div>
            <p className="small muted"><Bi t={g.subtitle} /></p>
            <ul className="it-inc-grid">
              {scenes.map((x) => <li key={x.id}><ItIncrocioCard scene={x} solved={isItIncrocioSolved(progress, x.id)} /></li>)}
            </ul>
          </section>
        );
      })}
      <p className="muted small"><Bi t={ITU.incroci.original} /></p>
    </section>
  );
}
