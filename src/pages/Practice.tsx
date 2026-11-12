import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../app/state";
import { countryKey } from "../app/settings";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { QuestionCard } from "../components/QuestionCard";
import { CONTENT } from "../app/content";
import { TOPICS } from "../content/topics";
import { defaultFilter, filterQuestions, type QuestionFilter, type StatusFilter } from "../lib/search";
import { questionStatus } from "../lib/progress";
import { kv } from "../lib/storage";

/** Where the learner stopped, per filter, so a long question bank can be continued after a reload. */
const RESUME_KEY = "practice-resume";
interface Resume { filter: string; questionId: string }

const newSession = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function Practice() {
  const { progress, settings } = useApp();
  const resumeKey = countryKey(RESUME_KEY, settings.country);
  const label = useBiText();
  const [filter, setFilter] = useState<QuestionFilter>(() => {
    const p = new URLSearchParams(location.search);
    const f = defaultFilter();
    const topic = p.get("topic");
    if (topic && TOPICS.some((t) => t.id === topic)) f.topicId = topic;
    const status = p.get("status");
    if (status === "incorrect" || status === "unanswered" || status === "mastered") f.status = status;
    if (p.get("bookmarks") === "1") f.bookmarkedOnly = true;
    return f;
  });
  // Snapshot the list when the filter changes, so answering does not reshuffle the current set.
  const [session, setSession] = useState(newSession);
  const [pos, setPos] = useState(0);
  const list = useMemo(
    () => filterQuestions(CONTENT.questions, filter, progress, settings.masteryThreshold),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally recomputed only on filter/session change
    [filter, session],
  );
  // Answers already checked in this session, so going back shows the checked question again instead of a blank one.
  const [done, setDone] = useState<Record<string, string[]>>({});
  const set = (patch: Partial<QuestionFilter>) => { setFilter((f) => ({ ...f, ...patch })); setPos(0); setDone({}); setSession(newSession()); };
  const q = list[pos];
  const filterKey = JSON.stringify(filter);
  const resumed = useRef<string | null>(null);

  // Continue at the stored question for this filter (once per filter); afterwards remember every move.
  useEffect(() => {
    if (resumed.current === filterKey) return;
    let alive = true;
    kv.get<Resume>(resumeKey).then((r) => {
      if (!alive) return;
      resumed.current = filterKey;
      const i = r && r.filter === filterKey ? list.findIndex((x) => x.id === r.questionId) : -1;
      if (i > 0) setPos(i);
    }).catch(() => { resumed.current = filterKey; });
    return () => { alive = false; };
  }, [filterKey, list, resumeKey]);
  useEffect(() => {
    if (resumed.current === filterKey && q) kv.set(resumeKey, { filter: filterKey, questionId: q.id } satisfies Resume).catch(() => undefined);
  }, [filterKey, q, resumeKey]);

  const status = (id: string) => questionStatus(progress.questions[id], settings.masteryThreshold);
  const counts = {
    all: CONTENT.questions.length,
    unanswered: CONTENT.questions.filter((x) => status(x.id) === "unanswered").length,
    incorrect: CONTENT.questions.filter((x) => status(x.id) === "incorrect").length,
    bookmarks: CONTENT.questions.filter((x) => progress.bookmarks.includes(x.id)).length,
  };
  const plain = filter.text === "" && filter.points.length === 0 && filter.category === "all" && filter.topicId === "all";
  const modes: { id: keyof typeof counts; t: typeof T.all; on: boolean; patch: Partial<QuestionFilter> }[] = [
    { id: "all", t: T.allQuestions, on: plain && filter.status === "all" && !filter.bookmarkedOnly, patch: { ...defaultFilter() } },
    { id: "unanswered", t: T.unanswered, on: filter.status === "unanswered" && !filter.bookmarkedOnly, patch: { ...defaultFilter(), status: "unanswered" } },
    { id: "incorrect", t: T.incorrectF, on: filter.status === "incorrect" && !filter.bookmarkedOnly, patch: { ...defaultFilter(), status: "incorrect" } },
    { id: "bookmarks", t: T.bookmarked, on: filter.bookmarkedOnly, patch: { ...defaultFilter(), bookmarkedOnly: true } },
  ];
  const jump = (value: string) => { const n = Number(value); if (Number.isInteger(n) && n >= 1 && n <= list.length) setPos(n - 1); };
  const statuses: [StatusFilter, typeof T.all][] = [["all", T.all], ["unanswered", T.unanswered], ["incorrect", T.incorrectF], ["mastered", T.masteredF]];

  if (CONTENT.questions.length === 0) {
    return (
      <div className="practice-page">
        <header className="page-head page-head-center"><h1><Bi t={T.practiceAll} /></h1></header>
        <section className="card stack" data-testid="practice-in-review">
          <p className="notice"><Bi t={T.contentInReview} /></p>
          <p className="small muted"><Bi t={T.notOfficial} /></p>
        </section>
      </div>
    );
  }
  return (
    <div className="practice-page">
      <header className="page-head page-head-center"><h1><Bi t={T.practiceAll} /></h1></header>
      <div className="chip-row practice-modes" role="group" aria-label={label(T.modes)} data-testid="practice-modes">
        {modes.map((m) => (
          <button key={m.id} type="button" className="chip" aria-pressed={m.on} onClick={() => set(m.patch)} data-testid={`mode-${m.id}`}>{label(m.t)} <span className="num" dir="ltr">({counts[m.id]})</span></button>
        ))}
      </div>
      <details className="practice-filters"><summary data-testid="practice-filter-toggle">{label(T.search)} · {label(T.topic)}</summary>
      <section className="stack" aria-label={label(T.search)}>
        <label className="sr-only" htmlFor="q-search">{label(T.search)}</label>
        <input id="q-search" className="input" type="search" placeholder={label(T.search)} value={filter.text}
          onChange={(e) => set({ text: e.target.value })} data-testid="search" />
        <div className="chip-row" role="group" aria-label="Status">
          {statuses.map(([v, t]) => (
            <button key={v} type="button" className="chip" aria-pressed={filter.status === v} onClick={() => set({ status: v })}>{label(t)}</button>
          ))}
          <button type="button" className="chip" aria-pressed={filter.bookmarkedOnly} onClick={() => set({ bookmarkedOnly: !filter.bookmarkedOnly })}>{label(T.bookmarksOnly)}</button>
        </div>
        <div className="chip-row" role="group" aria-label={label(T.points)}>
          {([2, 3, 4, 5] as const).map((p) => (
            <button key={p} type="button" className="chip" aria-pressed={filter.points.includes(p)} dir="ltr"
              onClick={() => set({ points: filter.points.includes(p) ? filter.points.filter((x) => x !== p) : [...filter.points, p] })}>
              {p} {label(T.points)}
            </button>
          ))}
          {(["all", "Grundstoff", "Zusatzstoff"] as const).map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={filter.category === c} onClick={() => set({ category: c })}>{c === "all" ? label(T.all) : c}</button>
          ))}
        </div>
        <label className="stack" style={{ gap: 4 }}>
          <span className="small muted">{label(T.topic)}</span>
          <select className="input" value={filter.topicId} onChange={(e) => set({ topicId: e.target.value })} data-testid="topic-select">
            <option value="all">{label(T.all)}</option>
            {TOPICS.map((t) => <option key={t.id} value={t.id}>{label(t.title)}</option>)}
          </select>
        </label>
        <p className="small muted" role="status" data-testid="result-count"><span dir="ltr">{list.length}</span> {label(T.results)}</p>
      </section></details>

      {q ? (
        <QuestionCard key={`${session}-${q.id}`} question={q} mode="practice" sessionId={session} index={pos} total={list.length}
          checkedAnswer={done[q.id]} onChecked={(ids) => setDone((d) => ({ ...d, [q.id]: ids }))}
          onNext={pos + 1 < list.length ? () => setPos(pos + 1) : undefined} />
      ) : (
        <p className="card muted"><Bi t={CONTENT.questions.length === 0 ? T.contentInReview : T.noResults} /></p>
      )}
      {q && list.length > 1 && (
        <div className="q-actions practice-nav">
          <button type="button" className="btn btn-secondary" disabled={pos === 0} onClick={() => setPos(pos - 1)} data-testid="practice-prev"><Bi t={T.previous} /></button>
          <button type="button" className="btn btn-secondary" disabled={pos + 1 >= list.length} onClick={() => setPos(pos + 1)} data-testid="practice-skip"><Bi t={T.next} /></button>
          <label className="jump"><span className="small muted">{label(T.goToQuestion)}</span>
            <input className="input" type="number" inputMode="numeric" min={1} max={list.length} dir="ltr" key={pos} defaultValue={pos + 1}
              onKeyDown={(e) => { if (e.key === "Enter") jump(e.currentTarget.value); }} onBlur={(e) => jump(e.currentTarget.value)} data-testid="jump" /></label>
        </div>
      )}
    </div>
  );
}
