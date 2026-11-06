import { Link } from "../app/router";
import { useApp } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { Icon } from "../components/Icon";
import { CONTENT } from "../app/content";
const LESSONS = CONTENT.lessons;
const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
import { NotFound } from "./Misc";

export function Learn() {
  const { progress } = useApp();
  const label = useBiText();
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.lessons} /></h1></header>
      {LESSONS.length === 0 && <p className="notice"><Bi t={T.contentInReview} /></p>}
      <ul className="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {LESSONS.map((l) => {
          const done = progress.completedLessons.includes(l.id);
          return (
            <li key={l.id}>
              <Link href={`/learn/${l.id}`} className="card card-link list-item">
                <span className="tile-icon"><Icon name={done ? "check" : "book"} /></span>
                <span className="stack" style={{ gap: 2 }}><Bi t={l.title} /><span className="small muted"><Bi t={l.summary} /></span></span>
                <span className="badge" dir="ltr">{l.minutes} {label(T.minutes)}</span>
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
