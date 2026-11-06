import { useMemo, useState } from "react";
import { useApp } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { QuestionCard } from "../components/QuestionCard";
import { ContentStatus } from "../components/ContentStatus";
import { CONTENT } from "../app/content";
import { TOPICS } from "../content/topics";
import { defaultFilter, filterQuestions, type QuestionFilter, type StatusFilter } from "../lib/search";

const newSession = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function Practice() {
  const { progress, settings } = useApp();
  const label = useBiText();
  const [filter, setFilter] = useState<QuestionFilter>(() => {
    const p = new URLSearchParams(location.search);
    const f = defaultFilter();
    const topic = p.get("topic");
    if (topic && TOPICS.some((t) => t.id === topic)) f.topicId = topic;
    if (p.get("status") === "incorrect") f.status = "incorrect";
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
  const set = (patch: Partial<QuestionFilter>) => { setFilter((f) => ({ ...f, ...patch })); setPos(0); setSession(newSession()); };
  const q = list[pos];
  const statuses: [StatusFilter, typeof T.all][] = [["all", T.all], ["unanswered", T.unanswered], ["incorrect", T.incorrectF], ["mastered", T.masteredF]];

  if (CONTENT.questions.length === 0) {
    return (
      <div>
        <header className="page-head"><h1><Bi t={T.practiceAll} /></h1></header>
        <ContentStatus testId="practice-in-review" />
        <p className="notice small section" role="note"><Bi t={T.notOfficial} /></p>
      </div>
    );
  }
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.practiceAll} /></h1></header>
      <section className="card stack" aria-label={label(T.search)} style={{ marginBottom: 16 }}>
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
      </section>

      {q ? (
        <QuestionCard key={`${session}-${q.id}`} question={q} mode="practice" sessionId={session} index={pos} total={list.length}
          onNext={pos + 1 < list.length ? () => setPos(pos + 1) : undefined} />
      ) : (
        <p className="card muted"><Bi t={CONTENT.questions.length === 0 ? T.contentInReview : T.noResults} /></p>
      )}
      {q && pos > 0 && (
        <div className="q-actions"><button type="button" className="btn btn-secondary" onClick={() => setPos(pos - 1)}><Bi t={T.previous} /></button></div>
      )}
    </div>
  );
}
