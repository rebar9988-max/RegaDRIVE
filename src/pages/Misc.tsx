import { useEffect, useState } from "react";
import { Link } from "../app/router";
import { MORE_LINKS } from "../app/Shell";
import { useApp, useNow, type LangMode } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { ProgressRing } from "../components/ProgressRing";
import { Icon } from "../components/Icon";
import { CONTENT } from "../app/content";
import { TOPICS } from "../content/topics";
import { normalize } from "../lib/search";
import { questionStatus, streakDays, topicStats } from "../lib/progress";

export function More() {
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.nav.more} /></h1></header>
      <ul className="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {MORE_LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="card card-link list-item">
              <span className="tile-icon"><Icon name={l.icon} /></span><Bi t={l.t} /><Icon name="arrow" className="flip-rtl" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProgressPage() {
  const { progress, settings } = useApp();
  const now = useNow();
  const label = useBiText();
  const qs = CONTENT.questions;
  const stats = topicStats(progress, qs, settings.masteryThreshold);
  const wrongIds = qs.filter((q) => questionStatus(progress.questions[q.id], settings.masteryThreshold) === "incorrect");
  const correctCount = qs.filter((q) => progress.questions[q.id]?.lastCorrect === true).length;
  const mastered = qs.filter((q) => questionStatus(progress.questions[q.id], settings.masteryThreshold) === "mastered").length;
  const percent = qs.length ? Math.round(mastered / qs.length * 100) : 0;
  const lastExams = [...progress.examHistory].reverse().slice(0, 5);
  return (
    <div>
      <header className="page-head page-head-center"><h1><Bi t={T.nav.progress} /></h1>
        <p className="small muted"><Bi t={{ ckb: "پێشکەوتن تەنها لەسەر ئەم ئامێرە پاشەکەوت دەکرێت.", de: "Der Fortschritt wird nur auf diesem Gerät gespeichert." }} /></p></header>
      <section className="card progress-summary">
        <div className="progress-summary-copy"><h2><Bi t={{ ckb: "پێشکەوتنی گشتی", de: "Dein Lernfortschritt" }} /></h2><p className="small muted"><Bi t={{ ckb: `${mastered} لە ${qs.length} پرسیار فێربووە`, de: `${mastered} von ${qs.length} Fragen gemeistert` }} /></p></div>
        <ProgressRing value={percent} label={label(T.mastered)} />
      </section>
      <div className="grid grid-3 progress-stats">
        <div className="card stat stat-success"><span className="stat-icon"><Icon name="check" /></span><span className="stat-value">{correctCount}</span><span className="stat-label"><Bi t={T.correct} /></span></div>
        <div className="card stat stat-danger"><span className="stat-icon"><Icon name="sign" /></span><span className="stat-value">{wrongIds.length}</span><span className="stat-label"><Bi t={T.incorrectF} /></span></div>
        <div className="card stat stat-warning"><span className="stat-icon"><Icon name="trophy" /></span><span className="stat-value">{progress.examHistory.length}</span><span className="stat-label"><Bi t={T.mockExam} /></span></div>
      </div>
      <section className="card readiness-card"><h2 className="section-title"><Bi t={{ ckb: "ئاستی فێربوونی پرسیارەکان", de: "Stand deines Fragentrainings" }} /><span className="badge" dir="ltr">{percent}%</span></h2><div className="progressbar" role="progressbar" aria-label={label(T.mastered)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div></section>
      <div className="row small muted progress-secondary"><Icon name="flame" /><span>{streakDays(progress, now)} {label(T.streak)}</span><span className="spacer" /><Icon name="bookmark" /><span>{progress.bookmarks.length} {label(T.bookmarked)}</span></div>
      <div className="q-actions">
        <Link href="/practice?status=incorrect" className="btn btn-primary"><Bi t={T.reviewMistakes} /></Link>
        <Link href="/practice?bookmarks=1" className="btn btn-secondary">{label(T.bookmarksOnly)}</Link>
      </div>
      <div className="topic-insights">
        {[{ weak: false, title: { ckb: "بابەتە بەهێزەکان", de: "Deine Stärken" } }, { weak: true, title: T.weakTopics }].map(({ weak, title }) => {
          const topics = TOPICS.filter((t) => { const stat = stats.get(t.id); return stat && (weak ? wrongIds.some((q) => q.topicId === t.id) : stat.total > 0 && stat.mastered === stat.total); });
          return <section className="card topic-insight" key={String(weak)}><span className={`insight-icon ${weak ? "warning" : "success"}`}><Icon name={weak ? "sign" : "check"} /></span><div><h2 className="section-title"><Bi t={title} /></h2>{topics.length ? <div className="chip-row">{topics.map((t) => <Link key={t.id} href={`/practice?topic=${t.id}`} className="chip"><Bi t={t.title} /></Link>)}</div> : <p className="small muted"><Bi t={{ ckb: "دوای ڕاهێنان ئەنجامەکان لێرە دەبینیت.", de: "Nach dem Üben siehst du hier deine Ergebnisse." }} /></p>}</div></section>;
        })}
      </div>
      <section className="section">
        <h2 className="section-title"><Bi t={T.topic} /></h2>
        <div className="grid grid-2">
          {TOPICS.map((t) => {
            const s = stats.get(t.id);
            if (!s) return null;
            return (
              <div key={t.id} className="card stack" style={{ gap: 8 }}>
                <div className="row"><Bi t={t.title} /><span className="spacer" /><span className="badge" dir="ltr">{s.mastered}/{s.total}</span></div>
                <div className="progressbar" role="progressbar" aria-label={label(t.title)} aria-valuemin={0} aria-valuemax={s.total} aria-valuenow={s.mastered}><span style={{ width: `${(s.mastered / s.total) * 100}%` }} /></div>
              </div>
            );
          })}
        </div>
      </section>
      {lastExams.length > 0 && (
        <section className="section">
          <h2 className="section-title"><Bi t={T.mockExam} /></h2>
          <ul className="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {lastExams.map((e) => (
              <li key={e.at} className="card row">
                <Bi t={e.passed ? T.passed : T.failed} inline />
                <span className="spacer" />
                <span className="small muted" dir="ltr">{new Date(e.at).toLocaleDateString("de-DE")} · {e.errorPoints} FP</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function Vocabulary() {
  const label = useBiText();
  const [text, setText] = useState("");
  const n = normalize(text);
  const list = CONTENT.vocabulary.filter((v) => !n || normalize(`${v.de} ${v.ckb} ${v.article ?? ""}`).includes(n));
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.nav.vocab} /></h1></header>
      <label className="sr-only" htmlFor="v-search">{label(T.search)}</label>
      <input id="v-search" className="input" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={label(T.search)} style={{ marginBottom: 16 }} />
      <div className="card" style={{ padding: 0 }}>
        {list.map((v) => (
          <div key={v.id} className="vocab-row">
            <span lang="ckb" dir="rtl">{v.ckb}</span>
            <span className="vocab-de" lang="de">{v.article && <small>{v.article} </small>}<strong>{v.de}</strong></span>
          </div>
        ))}
        {list.length === 0 && <p className="muted" style={{ padding: 16 }}><Bi t={T.noResults} /></p>}
      </div>
    </div>
  );
}

export function Services() {
  const label = useBiText();
  const [city, setCity] = useState("");
  const [cat, setCat] = useState("fahrschule");
  const [searched, setSearched] = useState(false);
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.nav.services} /></h1>
        <p className="small muted"><Bi t={{ ckb: "خولی یارمەتی یەکەم، پشکنینی چاو و قوتابخانەی شۆفێری.", de: "Erste-Hilfe-Kurs, Sehtest und Fahrschulen." }} /></p></header>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); setSearched(true); }}>
        <label className="stack" style={{ gap: 4 }}>
          <span className="small muted">{label({ ckb: "جۆری خزمەتگوزاری", de: "Kategorie" })}</span>
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="erste-hilfe">{label({ ckb: "خولی یارمەتی یەکەم", de: "Erste-Hilfe-Kurs" })}</option>
            <option value="sehtest">{label({ ckb: "پشکنینی چاو", de: "Sehtest" })}</option>
            <option value="fahrschule">{label({ ckb: "قوتابخانەی شۆفێری", de: "Fahrschule" })}</option>
          </select>
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="small muted">{label({ ckb: "شار یان کۆدی پۆستە (PLZ)", de: "Stadt oder PLZ" })}</span>
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="postal-code" />
        </label>
        <button className="btn btn-primary" type="submit">{label({ ckb: "گەڕان", de: "Suchen" })}</button>
      </form>
      {searched && (
        <div className="notice section" role="status" data-testid="services-unavailable">
          <Bi t={{ ckb: "زانیاری پشتڕاستکراوی ڕاستەوخۆ بۆ ئەم ناوچەیە لە ئێستادا بەردەست نییە. RegaDRIVE هیچ ناو، نرخ یان کاتێکی دروستکراو پیشان نادات. تکایە ڕاستەوخۆ لەگەڵ شارەوانی، قوتابخانەی شۆفێری یان دابینکەرانی خولی یارمەتی یەکەم پەیوەندی بکە.",
            de: "Für diese Suche liegen derzeit keine verifizierten Live-Daten vor. RegaDRIVE zeigt keine erfundenen Anbieter, Preise oder Termine. Bitte wende dich direkt an Fahrschulen, Optiker oder Erste-Hilfe-Anbieter vor Ort." }} />
        </div>
      )}
    </div>
  );
}

interface PublicFlags { paymentsEnabled: boolean; checkoutEnabled: boolean; databaseProductionEnabled: boolean; lifetimePriceEur: number }
function useFlags() {
  const [f, setF] = useState<PublicFlags | null>(null);
  useEffect(() => { fetch("/api/flags").then((r) => (r.ok ? r.json() : null)).then(setF, () => setF(null)); }, []);
  return f;
}

export function Account() {
  const flags = useFlags();
  const label = useBiText();
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.nav.account} /></h1></header>
      <section className="card stack" data-testid="account-unavailable">
        <img className="account-logo" src="/brand/regadrive-logo.webp" alt="RegaDRIVE" width={112} height={112} />
        <Bi t={{ ckb: "هەژماری قوتابی (تۆمارکردن، چوونەژوورەوە، پشتڕاستکردنەوەی ئیمەیڵ) ئامادەکراوە، بەڵام هێشتا چالاک نییە، چونکە داتابەیسی بەرهەمهێنان بە ئەنقەست کوژاوەتەوە.",
          de: "Schülerkonten (Registrierung, Anmeldung, E-Mail-Bestätigung) sind vorbereitet, aber noch nicht aktiv, weil die Produktionsdatenbank bewusst ausgeschaltet ist." }} />
        <Bi t={{ ckb: "هەموو پێشکەوتنەکەت بە سەلامەتی لەسەر ئەم ئامێرە پاشەکەوت دەکرێت.", de: "Dein gesamter Lernfortschritt wird sicher auf diesem Gerät gespeichert." }} />
        <button className="btn btn-primary" disabled aria-disabled="true">{label({ ckb: "تۆمارکردن (بەم زووانە)", de: "Registrieren (bald verfügbar)" })}</button>
        <p className="small muted" dir="ltr" style={{ textAlign: "start" }}>DATABASE_PRODUCTION_ENABLED = {String(flags?.databaseProductionEnabled ?? false)}</p>
      </section>
    </div>
  );
}

export function Access() {
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.nav.access} /></h1></header>
      <section className="card stack" data-testid="purchase">
        <h2><Bi t={{ ckb: "ئێستا بەخۆڕاییە", de: "Derzeit kostenlos" }} /></h2>
        <Bi t={{ ckb: "پارەدان و کڕین ناچالاکن؛ هیچ کڕینێک لەم ماڵپەڕەدا ناکرێت. هەر نرخێکی داهاتوو تەنها پلانە و تا چالاککردنی فەرمی پابەندکەر نییە.", de: "Zahlungen und Käufe sind deaktiviert. Auf dieser Website kann derzeit nichts gekauft werden. Ein möglicher künftiger Preis ist nur geplant und nicht verbindlich." }} />
        <p className="notice" role="note"><Bi t={{ ckb: "هیچ زانیارییەکی کارتی بانکی لەم ماڵپەڕەدا کۆ ناکرێتەوە.", de: "Auf dieser Website werden keine Kartendaten erhoben." }} /></p>
      </section>
    </div>
  );
}

export function Settings() {
  const { settings, setSettings, resetProgress, progress } = useApp();
  const label = useBiText();
  const [confirm, setConfirm] = useState(false);
  const modes: [LangMode, { ckb: string; de: string }][] = [
    ["bi", { ckb: "دوو زمانە (کوردی + ئەڵمانی)", de: "Zweisprachig (Kurdisch + Deutsch)" }],
    ["ckb", { ckb: "تەنها کوردی", de: "Nur Kurdisch" }],
    ["de", { ckb: "تەنها ئەڵمانی", de: "Nur Deutsch" }],
  ];
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.nav.settings} /></h1></header>
      <section className="card stack">
        <h2 className="section-title"><Bi t={{ ckb: "زمان", de: "Sprache" }} /></h2>
        <div className="chip-row" role="radiogroup" aria-label="Language mode">
          {modes.map(([m, t]) => (
            <button key={m} type="button" role="radio" aria-checked={settings.langMode === m}
              className="chip" onClick={() => setSettings({ langMode: m })} data-testid={`mode-${m}`}>{label(t)}</button>
          ))}
        </div>
      </section>
      <section className="card stack section">
        <h2 className="section-title"><Bi t={T.dailyGoal} /></h2>
        <div className="chip-row">
          {[5, 10, 20, 30].map((n) => <button key={n} type="button" className="chip" aria-pressed={settings.dailyGoal === n} dir="ltr" onClick={() => setSettings({ dailyGoal: n })}>{n}</button>)}
        </div>
        <h2 className="section-title"><Bi t={{ ckb: "پێوەری فێربوون (وەڵامی ڕاستی بەدوایەک)", de: "Meisterschwelle (richtige Antworten in Folge)" }} /></h2>
        <div className="chip-row">
          {[2, 3, 4, 5].map((n) => <button key={n} type="button" className="chip" aria-pressed={settings.masteryThreshold === n} dir="ltr" onClick={() => setSettings({ masteryThreshold: n })}>{n}</button>)}
        </div>
      </section>
      <section className="card stack section">
        <h2 className="section-title"><Bi t={{ ckb: "تایبەتمەندی و داتا", de: "Datenschutz und Daten" }} /></h2>
        <Bi t={{ ckb: "داتای فێربوونت تەنها لە وێبگەڕەکەت (IndexedDB) دایە. هیچ شتێک بۆ ڕاژەکار نانێردرێت.", de: "Deine Lerndaten liegen nur in deinem Browser (IndexedDB). Nichts wird an einen Server gesendet." }} />
        <button type="button" className="btn btn-secondary" onClick={() => {
          const blob = new Blob([JSON.stringify({ settings, exportedAt: new Date().toISOString(), progress }, null, 2)], { type: "application/json" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "regadrive-export.json"; a.click(); URL.revokeObjectURL(a.href);
        }}>{label({ ckb: "هەناردەکردنی داتا", de: "Daten exportieren" })}</button>
        {!confirm
          ? <button type="button" className="btn btn-secondary" onClick={() => setConfirm(true)}>{label({ ckb: "سڕینەوەی هەموو پێشکەوتن", de: "Gesamten Fortschritt löschen" })}</button>
          : <div className="row"><button type="button" className="btn btn-primary" onClick={() => { resetProgress(); setConfirm(false); }}>{label({ ckb: "بەڵێ، بیسڕەوە", de: "Ja, löschen" })}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirm(false)}>{label({ ckb: "پاشگەزبوونەوە", de: "Abbrechen" })}</button></div>}
      </section>
    </div>
  );
}

export function About() {
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.nav.about} /></h1></header>
      <div className="stack" style={{ gap: 16 }}>
        <section className="card stack"><h2 className="section-title"><Bi t={{ ckb: "دەربارە", de: "Über RegaDRIVE" }} /></h2><Bi t={T.notOfficial} /></section>
        <section className="card stack" id="impressum">
          <h2 className="section-title"><Bi t={{ ckb: "زانیاری دابینکەر · Impressum", de: "Anbieterinformationen · Impressum" }} /></h2>
          <Bi t={{ ckb: "زانیاریی ناساندنی دابینکەر و ناونیشانی پەیوەندی لەم وەشانەدا پشتڕاست نەکراونەتەوە. زانیارییە ناتەواوەکان پڕ ناکرێنەوە بە گومان یان داهێنان.", de: "Anbieteridentität und ladungsfähige Kontaktanschrift sind für diese Fassung noch nicht verifiziert. Fehlende Angaben werden nicht vermutet oder erfunden." }} />
          <p className="notice" role="note"><Bi t={{ ckb: "ئەم بەشە ئاگادارکردنەوەیە و جێگرەوەی Impressum ـی تەواو نییە. ماڵپەڕ پێویستی بە ناوی یاسایی دابینکەر، ناونیشانی تەواو و ڕێگای پەیوەندیی پشتڕاستکراوە هەیە.", de: "Dieser Hinweis ist kein vollständiges Impressum. Erforderlich sind die verifizierte Anbieterbezeichnung, eine vollständige Anschrift und ein bestätigter direkter Kontaktweg." }} /></p>
        </section>
        <section className="card stack" id="privacy">
          <h2 className="section-title"><Bi t={{ ckb: "تایبەتمەندی و داتا", de: "Datenschutz und Daten" }} /></h2>
          <Bi t={{ ckb: "پێشکەوتنی فێربوون و ڕێکخستنەکان لە بیرگەی ناوخۆی وێبگەڕەکەت (IndexedDB) پاشەکەوت دەکرێن؛ ئەم پێشکەوتنە بۆ ڕاژەکار نانێردرێت. بۆ پێشاندانی ماڵپەڕ و API، داواکارییە تەکنیکییەکان لە Cloudflare تێدەپەڕن و دەتوانن داتای پەیوەندیی پێویست لەگەڵ خۆیان هەڵبگرن.", de: "Lernfortschritt und Einstellungen werden lokal im Browser (IndexedDB) gespeichert und nicht an den Server synchronisiert. Für Website und API laufen technische Anfragen über Cloudflare und können erforderliche Verbindungsdaten verarbeiten." }} />
          <Bi t={{ ckb: "ئەگەر ڕوونکردنەوەی AI چالاک بێت، داواکارییەکە تەنها ناسنامەی پرسیارێکی پەسەندکراوی RegaDRIVE دەگرێت؛ دەقی ئازادی بەکارهێنەر و زانیاریی پرۆفایل نانێردرێت. دابینکەری AI دەتوانێت ناوەڕۆکی ئەو پرسیارە بۆ وەڵامدانەوە وەربگرێت.", de: "Wenn die KI-Erklärung aktiviert ist, enthält die Anfrage nur die ID einer freigegebenen RegaDRIVE-Frage; freier Nutzereingabetext und Profildaten werden nicht gesendet. Der KI-Anbieter kann den Inhalt dieser Frage zur Antwortverarbeitung erhalten." }} />
          <p className="small muted"><Bi t={{ ckb: "ئەم زانیارییە لە پشکنینی کۆدەوە کورتکراوەتەوە و هێشتا پێداچوونەوەی یاسایی و پشتڕاستکردنەوەی دابینکەر، بنەمای یاسایی و ماوەی پاراستنی داتا پێویستە؛ بەمەش بە تەنها ئاگادارکردنەوەی یاسایی تەواو نابێت.", de: "Diese Zusammenfassung beruht auf einer Codeprüfung. Eine rechtliche Prüfung sowie die Verifizierung der Anbieter, Rechtsgrundlagen und Speicherfristen stehen noch aus; sie ist allein keine vollständige Datenschutzerklärung." }} /></p>
        </section>
        <section className="card stack"><h2 className="section-title"><Bi t={{ ckb: "مافی بڵاوکردنەوە", de: "Urheberrecht" }} /></h2><Bi t={T.copyright} />
          <Bi t={{ ckb: "پرسیارەکان و وانەکان ناوەڕۆکی ڕەسەنی RegaDRIVE ـن. نیشانەکانی هاتووچۆ شێوەی سادەکراوی نیشانە فەرمییەکانی StVO ـن.", de: "Fragen und Lektionen sind eigene RegaDRIVE-Inhalte. Verkehrszeichen sind vereinfachte Darstellungen amtlicher StVO-Zeichen." }} /></section>
      </div>
    </div>
  );
}

export function NotFound() {
  const label = useBiText();
  return (
    <div className="card stack">
      <h1><Bi t={{ ckb: "ئەم پەڕەیە نەدۆزرایەوە", de: "Seite nicht gefunden" }} /></h1>
      <Link href="/" className="btn btn-primary">{label(T.nav.home)}</Link>
    </div>
  );
}

