import { Link } from "../app/router";
import { useApp, useNow } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { Icon, type IconName } from "../components/Icon";
import { CONTENT } from "../app/content";
import { topicById } from "../content/topics";
import { dayKey, questionStatus, streakDays, weakTopics } from "../lib/progress";
import type { Bilingual } from "../content/types";

const TILES: { href: string; icon: IconName; t: Bilingual; sub: Bilingual }[] = [
  { href: "/learn", icon: "book", t: T.lessons, sub: { ckb: "وانەی کورت و ڕوون", de: "Kurze, klare Lektionen" } },
  { href: "/signs", icon: "sign", t: T.nav.signs, sub: { ckb: "نیشانە گرنگەکان", de: "Wichtige Schilder" } },
  { href: "/practice", icon: "check", t: T.practiceAll, sub: { ckb: "پرسیاری دوو زمانە", de: "Zweisprachige Fragen" } },
  { href: "/exam", icon: "exam", t: T.mockExam, sub: { ckb: "٣٠ پرسیار", de: "30 Fragen" } },
];

export function Home() {
  const { progress, settings } = useApp();
  const label = useBiText();
  const qs = CONTENT.questions;
  const LESSONS = CONTENT.lessons;
  const now = useNow();
  const today = progress.days[dayKey(now)] ?? 0;
  const goal = settings.dailyGoal;
  const mastered = qs.filter((q) => questionStatus(progress.questions[q.id], settings.masteryThreshold) === "mastered").length;
  const answered = qs.filter((q) => progress.questions[q.id]).length;
  const streak = streakDays(progress, now);
  const weak = weakTopics(progress, qs);
  const nextLesson = LESSONS.find((l) => !progress.completedLessons.includes(l.id)) ?? LESSONS[0];
  const started = answered > 0 || progress.completedLessons.length > 0;

  return (
    <div data-testid="home">
      <section className="card hero" aria-labelledby="home-title">
        <img className="hero-logo" src="/brand/regadrive-logo.webp" width={120} height={120} alt="RegaDRIVE" fetchPriority="high" />
        <div className="stack" style={{ gap: 4 }}>
          <h1 id="home-title"><Bi t={T.greeting} /></h1>
          <p className="muted small"><Bi t={T.appTagline} /></p>
        </div>
        <div className="hero-actions">
          <Link href={started || !nextLesson ? "/practice" : `/learn/${nextLesson.id}`} className="btn btn-primary btn-block" data-testid="cta-continue">
            <Bi t={started ? T.continueLearning : T.startLearning} />
          </Link>
        </div>
      </section>

      <section className="section" aria-label={label(T.dailyGoal)}>
        <div className="grid grid-3">
          <div className="card stat">
            <span className="stat-icon"><Icon name="target" /></span>
            <span className="stat-value">{Math.min(today, goal)}/{goal}</span>
            <span className="stat-label muted"><Bi t={T.dailyGoal} /></span>
            <div className="progressbar" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(today, goal)} aria-label={label(T.dailyGoal)}>
              <span style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} />
            </div>
          </div>
          <div className="card stat">
            <span className="stat-icon"><Icon name="flame" /></span>
            <span className="stat-value">{streak}</span>
            <span className="stat-label muted"><Bi t={T.streak} /></span>
          </div>
          <div className="card stat">
            <span className="stat-icon"><Icon name="star" /></span>
            <span className="stat-value">{mastered}/{qs.length}</span>
            <span className="stat-label muted"><Bi t={T.mastered} /></span>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="quick-title">
        <h2 id="quick-title" className="section-title"><Bi t={T.quickStart} /></h2>
        <div className="grid grid-tiles">
          {TILES.map((t) => (
            <Link key={t.href} href={t.href} className="card card-link tile" data-testid={`tile-${t.href.slice(1)}`}>
              <span className="tile-icon"><Icon name={t.icon} /></span>
              <Bi t={t.t} />
              <span className="small muted" style={{ marginTop: "auto" }}><Bi t={t.sub} /></span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-2 section">
        <section className="card" aria-labelledby="next-title">
          <h2 id="next-title" className="section-title"><Bi t={T.nextLesson} /></h2>
          {!nextLesson ? <p className="small muted"><Bi t={T.contentInReview} /></p> : (
          <Link href={`/learn/${nextLesson.id}`} className="card-link row" style={{ flexWrap: "nowrap" }}>
            <span className="tile-icon"><Icon name="book" /></span>
            <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
              <Bi t={nextLesson.title} />
              <span className="small muted num-block"><span className="num">{nextLesson.minutes}</span> {label(T.minutes)}</span>
            </span>
            <Icon name="arrow" className="flip-rtl" />
          </Link>)}
        </section>
        <section className="card" aria-labelledby="weak-title">
          <h2 id="weak-title" className="section-title"><Bi t={T.weakTopics} /></h2>
          {weak.length === 0 ? <p className="small muted"><Bi t={T.noWeakTopics} /></p> : (
            <ul className="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {weak.map((id) => (
                <li key={id}><Link href={`/practice?topic=${id}`} className="chip" style={{ width: "100%" }}><Bi t={topicById(id)!.title} inline /></Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="notice small section" role="note"><Bi t={T.notOfficial} /></p>
    </div>
  );
}
