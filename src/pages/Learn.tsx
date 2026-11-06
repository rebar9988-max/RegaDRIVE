import { useState } from "react";
import { Link } from "../app/router";
import { useApp } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { Icon } from "../components/Icon";
import { SignIcon } from "../components/SignIcon";
import { questionStatus } from "../lib/progress";
import { CONTENT } from "../app/content";
const LESSONS = CONTENT.lessons;
const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
import { NotFound } from "./Misc";

export function Learn() {
  const { progress, settings } = useApp();
  const label = useBiText();
  const [filter, setFilter] = useState("all");
  const filters = [
    { id: "all", t: T.all },
    { id: "available", t: { ckb: "بەردەست", de: "Verfügbar" } },
    { id: "incomplete", t: { ckb: "ناتەواو", de: "Offen" } },
    { id: "completed", t: { ckb: "تەواو", de: "Erledigt" } },
  ];
  // CONTENT already enforces publication rules. Every listed lesson is available.
  const lessons = LESSONS.filter((l) => {
    const done = progress.completedLessons.includes(l.id);
    return filter === "completed" ? done : filter === "incomplete" ? !done : true;
  });
  return (
    <div className="lesson-page">
      <header className="page-head"><h1><Icon name="book" /><Bi t={T.lessons} /></h1></header>
      <div className="chip-row lesson-filters" role="group" aria-label={label({ ckb: "فلتەری وانەکان", de: "Lektionen filtern" })}>
        {filters.map((f) => <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{label(f.t)}</button>)}
      </div>
      {LESSONS.length === 0 && <p className="notice"><Bi t={T.contentInReview} /></p>}
      {LESSONS.length > 0 && lessons.length === 0 && <p className="notice"><Bi t={T.noResults} /></p>}
      <ul className="list lesson-list">
        {lessons.map((l) => {
          const done = progress.completedLessons.includes(l.id);
          const questions = CONTENT.questions.filter((q) => q.topicId === l.topicId);
          const mastered = questions.filter((q) => questionStatus(progress.questions[q.id], settings.masteryThreshold) === "mastered").length;
          const signId = questions.find((q) => q.signId)?.signId;
          const sign = CONTENT.signs.find((s) => s.id === signId);
          return (
            <li key={l.id}>
              <Link href={`/learn/${l.id}`} className="card card-link list-item lesson-row">
                <span className="lesson-thumbnail">{sign ? <SignIcon sign={sign} /> : <Icon name={l.topicId === "vehicle" || l.topicId === "motorway" ? "car" : "book"} />}</span>
                <span className="lesson-copy">
                  <span className="lesson-title"><span className="num">{LESSONS.indexOf(l) + 1}.</span><Bi t={l.title} /></span>
                  <span className="small muted lesson-description"><Bi t={l.summary} /></span>
                  <span className="row small lesson-progress-label"><Icon name={done ? "check" : "target"} /><span>{label(done ? { ckb: "وانە تەواو کرا", de: "Lektion abgeschlossen" } : { ckb: `${mastered} لە ${questions.length} پرسیار فێربووە`, de: `${mastered} von ${questions.length} Fragen gemeistert` })}</span><span className="spacer" /><span className="muted" dir="ltr">{l.minutes} {label(T.minutes)}</span></span>
                  <span className="progressbar lesson-progress" role="progressbar" aria-label={label(l.title)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={done ? 100 : questions.length ? Math.round(mastered / questions.length * 100) : 0}><span style={{ width: `${done ? 100 : questions.length ? mastered / questions.length * 100 : 0}%` }} /></span>
                </span>
                <Icon name="arrow" className="flip-rtl" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LessonDetail({ id }: { id: string }) {
  const { progress, update } = useApp();
  const label = useBiText();
  const l = lessonById(id);
  if (!l) return <NotFound />;
  const done = progress.completedLessons.includes(l.id);
  const idx = LESSONS.indexOf(l);
  const next = LESSONS[idx + 1];
  return (
    <article>
      <header className="page-head"><h1><Bi t={l.title} /></h1><p className="muted"><Bi t={l.summary} /></p></header>
      <div className="stack" style={{ gap: 16 }}>
        {l.sections.map((s, i) => (
          <section key={i} className="card">
            <h2 className="section-title"><Bi t={s.heading} /></h2>
            <Bi t={s.body} />
          </section>
        ))}
      </div>
      <div className="q-actions">
        <button type="button" className={`btn ${done ? "btn-secondary" : "btn-success"}`} disabled={done}
          onClick={() => update((p) => ({ ...p, completedLessons: [...p.completedLessons, l.id] }))} data-testid="lesson-done">
          {label(done ? { ckb: "تەواو کرا ✓", de: "Abgeschlossen ✓" } : { ckb: "وەک تەواوکراو نیشانی بکە", de: "Als erledigt markieren" })}
        </button>
        <Link href={`/practice?topic=${l.topicId}`} className="btn btn-primary"><Bi t={T.practiceAll} /></Link>
        {next && <Link href={`/learn/${next.id}`} className="btn btn-secondary"><Bi t={T.nextLesson} /></Link>}
      </div>
      <p className="copyright muted"><Bi t={T.copyright} /></p>
    </article>
  );
}
