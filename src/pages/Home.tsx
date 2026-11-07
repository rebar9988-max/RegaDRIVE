import { Link } from "../app/router";
import { LANGS, langDir } from "../app/i18n";
import { useApp, useNow } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { Icon, type IconName } from "../components/Icon";
import { ProgressRing } from "../components/ProgressRing";
import { CONTENT } from "../app/content";
import { topicById } from "../content/topics";
import { dayKey, questionStatus, streakDays, weakTopics } from "../lib/progress";
import type { Bilingual } from "../content/types";

const TILES: { href: string; icon: IconName; t: Bilingual; sub: Bilingual }[] = [
  { href: "/learn", icon: "book", t: T.lessons, sub: { ckb: "هەنگاو بە هەنگاو فێربە", de: "Schritt für Schritt lernen", kmr: "Gav bi gav fêr bibe", ar: "تعلّم خطوة بخطوة" } },
  { href: "/signs", icon: "sign", t: { ckb: "نیشانەکانی هاتوچۆ", de: "Verkehrszeichen", kmr: "Nîşaneyên trafîkê", ar: "إشارات المرور" }, sub: { ckb: "هێماکان بناسە", de: "Schilder verstehen", kmr: "Nîşaneyan nas bike", ar: "افهم الإشارات" } },
  { href: "/practice", icon: "check", t: { ckb: "پرسیارەکان", de: "Fragen üben", kmr: "Pirsan biceribîne", ar: "تدرّب على الأسئلة" }, sub: { ckb: "زانیارییەکانت تاقی بکەرەوە", de: "Dein Wissen anwenden", kmr: "Zanîna xwe biceribîne", ar: "طبّق معرفتك" } },
  { href: "/exam", icon: "trophy", t: T.mockExam, sub: { ckb: "ئامادەکاری بە ڕاهێنان", de: "Mit Simulationen vorbereiten", kmr: "Bi simulasyonan amade bibe", ar: "استعد بالمحاكاة" } },
];
const OVERALL = { ckb: "پێشکەوتنی گشتی", de: "Dein Lernfortschritt", kmr: "Pêşketina giştî", ar: "تقدّمك في التعلّم" };

export function Home() {
  const { progress, settings, setSettings } = useApp();
  const label = useBiText();
  const qs = CONTENT.questions;
  const lessons = CONTENT.lessons;
  const now = useNow();
  const today = progress.days[dayKey(now)] ?? 0;
  const goal = settings.dailyGoal;
  const mastered = qs.filter((q) => questionStatus(progress.questions[q.id], settings.masteryThreshold) === "mastered").length;
  const answered = qs.filter((q) => progress.questions[q.id]).length;
  const streak = streakDays(progress, now);
  const weak = weakTopics(progress, qs);
  const completed = lessons.filter((l) => progress.completedLessons.includes(l.id)).length;
  const percent = lessons.length ? (completed / lessons.length) * 100 : 0;
  const nextLesson = lessons.find((l) => !progress.completedLessons.includes(l.id)) ?? lessons[0];
  const started = answered > 0 || progress.completedLessons.length > 0;

  return (
    <div className="dashboard" data-testid="home">
      <div className="dashboard-main">
        <div className="language-switch" role="group" aria-label={label({ ckb: "زمان", de: "Sprache", kmr: "Ziman", ar: "اللغة" })}>
          {LANGS.map((l) => (
            <button key={l.id} type="button" lang={l.id} dir={langDir(l.id)} aria-pressed={settings.lang === l.id} onClick={() => setSettings({ lang: l.id })} data-testid={`switch-${l.id}`}>
              {l.flag ? <img src={l.flag} width={23} height={16} alt="" /> : null}{l.native}
            </button>
          ))}
        </div>

        <section className="welcome" aria-labelledby="home-title">
          <div>
            <span className="eyebrow" lang="de" dir="ltr">Führerschein · Klasse B</span>
            <h1 id="home-title"><Bi t={T.greeting} /></h1>
            <p className="muted small"><Bi t={{ ckb: "فێربوونی تیۆری شۆفێری – کلاسی B", de: "Dein Weg zur sicheren Theorie", kmr: "Teoriya ajotinê – pola B", ar: "نظرية القيادة – الفئة B" }} /></p>
          </div>
          <img className="hero-logo" src="/brand/regadrive-logo.webp" width={120} height={120} alt="RegaDRIVE" fetchPriority="high" />
        </section>

        <Link href="/progress" className="card card-link overview-card">
          <div className="overview-copy">
            <h2><Bi t={OVERALL} /></h2>
            <p className="small muted"><Bi t={lessons.length ? {
              ckb: `${completed} لە ${lessons.length} وانە تەواو بووە`,
              de: `${completed} von ${lessons.length} Lektionen abgeschlossen`,
              kmr: `${completed} ji ${lessons.length} dersan temam bûn`,
              ar: `الدروس المكتملة: ${completed} من ${lessons.length}`,
            } : { ckb: "وانەکان لە پێداچوونەوەدان", de: "Lektionen werden fachlich geprüft", kmr: "Ders ji aliyê pisporan ve tên kontrolkirin", ar: "الدروس قيد مراجعة المختصين" }} /></p>
          </div>
          <ProgressRing value={percent} label={label(OVERALL)} />
          <Icon name="arrow" className="flip-rtl overview-arrow" />
        </Link>

        <Link href={started || !nextLesson ? "/practice" : `/learn/${nextLesson.id}`} className="learning-cta" data-testid="cta-continue">
          <span className="cta-icon"><Icon name="car" /></span>
          <span className="cta-copy">
            <strong><Bi t={started ? { ckb: "درێژە بە فێربوون", de: "Weiterlernen", kmr: "Fêrbûnê bidomîne", ar: "تابع التعلّم" } : T.startLearning} /></strong>
            <span className="small"><Bi t={nextLesson ? nextLesson.title : { ckb: "ڕاهێنان بە هەنگاوی خۆت", de: "Lerne in deinem Tempo", kmr: "Bi leza xwe fêr bibe", ar: "تعلّم بالسرعة التي تناسبك" }} /></span>
          </span>
          <span className="cta-play"><Icon name="play" /></span>
        </Link>

        <section className="home-menu" aria-labelledby="quick-title">
          <h2 id="quick-title" className="sr-only"><Bi t={T.quickStart} /></h2>
          <div className="grid grid-tiles home-tiles">
            {TILES.map((t) => (
              <Link key={t.href} href={t.href} className={`card card-link tile tile-${t.icon}`} data-testid={`tile-${t.href.slice(1)}`}>
                <span className="tile-icon"><Icon name={t.icon} /></span>
                <strong><Bi t={t.t} /></strong>
                <span className="tile-subtitle small muted"><Bi t={t.sub} /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="daily-goal" aria-label={label(T.dailyGoal)}>
          <span className="daily-goal-icon"><Icon name="calendar" /></span>
          <div className="daily-goal-copy">
            <h2><Bi t={{ ckb: "ئامانجی ئەمڕۆ", de: "Dein Tagesziel", kmr: "Armanca te ya îro", ar: "هدفك اليوم" }} /></h2>
            <p className="small"><Bi t={{ ckb: `${Math.min(today, goal)} لە ${goal} پرسیار وەڵام دراوەتەوە`, de: `${Math.min(today, goal)} von ${goal} Fragen beantwortet`, kmr: `${Math.min(today, goal)} ji ${goal} pirsan hatin bersivandin`, ar: `الأسئلة المُجاب عنها: ${Math.min(today, goal)} من ${goal}` }} /></p>
            <div className="progressbar" role="progressbar" aria-label={label(T.dailyGoal)} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(today, goal)}>
              <span style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} />
            </div>
          </div>
          <span className="daily-goal-status"><Icon name={today >= goal ? "check" : "target"} /></span>
        </section>
      </div>

      <aside className="dashboard-aside" aria-label={label({ ckb: "ڕێڕەوی فێربوونت", de: "Dein Lernweg", kmr: "Rêya fêrbûna te", ar: "مسار تعلّمك" })}>
        <div className="grid grid-2 compact-stats">
          <div className="card stat"><span className="stat-icon"><Icon name="flame" /></span><span className="stat-value">{streak}</span><span className="stat-label muted"><Bi t={T.streak} /></span></div>
          <div className="card stat"><span className="stat-icon"><Icon name="star" /></span><span className="stat-value">{mastered}/{qs.length}</span><span className="stat-label muted"><Bi t={T.mastered} /></span></div>
        </div>
        <section className="card" aria-labelledby="next-title">
          <h2 id="next-title" className="section-title"><Bi t={T.nextLesson} /></h2>
          {!nextLesson ? <p className="small muted"><Bi t={T.contentInReview} /></p> : (
            <Link href={`/learn/${nextLesson.id}`} className="card-link next-lesson-link">
              <span className="tile-icon"><Icon name="book" /></span>
              <span className="stack"><Bi t={nextLesson.title} /><span className="small muted"><span className="num">{nextLesson.minutes}</span> {label(T.minutes)}</span></span>
              <Icon name="arrow" className="flip-rtl" />
            </Link>
          )}
        </section>
        <section className="card" aria-labelledby="weak-title">
          <h2 id="weak-title" className="section-title"><Bi t={T.weakTopics} /></h2>
          {weak.length === 0 ? <p className="small muted"><Bi t={T.noWeakTopics} /></p> : (
            <ul className="list unstyled-list">
              {weak.map((id) => <li key={id}><Link href={`/practice?topic=${id}`} className="chip"><Bi t={topicById(id)!.title} inline /></Link></li>)}
            </ul>
          )}
        </section>
      </aside>
      <p className="notice small dashboard-disclaimer" role="note"><Bi t={T.notOfficial} /></p>
    </div>
  );
}
