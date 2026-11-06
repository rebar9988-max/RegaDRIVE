import { useEffect, useState } from "react";
import { Link } from "../app/router";
import { MORE_LINKS } from "../app/Shell";
import { useApp, useNow, type LangMode } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { Icon } from "../components/Icon";
import { ContentStatus } from "../components/ContentStatus";
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
  const lastExams = [...progress.examHistory].reverse().slice(0, 5);
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.nav.progress} /></h1>
        <p className="small muted"><Bi t={{ ckb: "پێشکەوتن تەنها لەسەر ئەم ئامێرە پاشەکەوت دەکرێت.", de: "Der Fortschritt wird nur auf diesem Gerät gespeichert." }} /></p></header>
      {qs.length === 0 && <ContentStatus testId="progress-status" />}
      {qs.length > 0 && Object.keys(progress.questions).length === 0 && (
        <div className="card stack" data-testid="progress-empty" style={{ marginBottom: 16 }}>
          <Bi t={T.noProgressYet} />
          <Link href="/practice" className="btn btn-primary"><Bi t={T.startPractice} /></Link>
        </div>
      )}
      {qs.length > 0 && <>
      <div className="grid grid-3">
        <div className="card stat"><span className="stat-value">{streakDays(progress, now)}</span><span className="stat-label muted"><Bi t={T.streak} /></span></div>
        <div className="card stat"><span className="stat-value">{progress.bookmarks.length}</span><span className="stat-label muted"><Bi t={T.bookmarked} /></span></div>
        <div className="card stat"><span className="stat-value">{wrongIds.length}</span><span className="stat-label muted"><Bi t={T.incorrectF} /></span></div>
      </div>
      <div className="q-actions">
        <Link href="/practice?status=incorrect" className="btn btn-primary"><Bi t={T.reviewMistakes} /></Link>
        <Link href="/practice?bookmarks=1" className="btn btn-secondary">{label(T.bookmarksOnly)}</Link>
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
      </>}
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
      {CONTENT.vocabulary.length === 0 ? <ContentStatus testId="vocab-status" /> : <>
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
      </>}
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
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.nav.account} /></h1></header>
      <section className="card stack" data-testid="account-unavailable">
        <Bi t={{ ckb: "هەژماری قوتابی (تۆمارکردن، چوونەژوورەوە، پشتڕاستکردنەوەی ئیمەیڵ) ئامادەکراوە، بەڵام هێشتا چالاک نییە، چونکە داتابەیسی بەرهەمهێنان بە ئەنقەست کوژاوەتەوە.",
          de: "Schülerkonten (Registrierung, Anmeldung, E-Mail-Bestätigung) sind vorbereitet, aber noch nicht aktiv, weil die Produktionsdatenbank bewusst ausgeschaltet ist." }} />
        <Bi t={{ ckb: "هەموو پێشکەوتنەکەت بە سەلامەتی لەسەر ئەم ئامێرە پاشەکەوت دەکرێت.", de: "Dein gesamter Lernfortschritt wird sicher auf diesem Gerät gespeichert." }} />
        <p className="small muted" dir="ltr" style={{ textAlign: "start" }}>DATABASE_PRODUCTION_ENABLED = {String(flags?.databaseProductionEnabled ?? false)}</p>
      </section>
    </div>
  );
}

export function Access() {
  const flags = useFlags();
  const price = flags?.lifetimePriceEur ?? 20;
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.nav.access} /></h1></header>
      <section className="card stack" data-testid="purchase">
        <h2 className="section-title"><Bi t={{ ckb: "ئێستا بەخۆڕاییە", de: "Derzeit kostenlos" }} /></h2>
        <Bi t={{ ckb: "RegaDRIVE لە ئێستادا بەخۆڕاییە. هیچ پارەدانێک وەرناگیرێت و هیچ زانیارییەکی کارتی بانکی کۆ ناکرێتەوە.", de: "RegaDRIVE ist derzeit kostenlos. Es werden keine Zahlungen angenommen und keine Kartendaten erfasst." }} />
      </section>
      <section className="card stack section" data-testid="planned-plan" aria-labelledby="planned-title">
        <div className="row">
          <h2 id="planned-title" className="section-title" style={{ margin: 0 }}><Bi t={{ ckb: "پلانی داهاتوو", de: "Geplantes Angebot" }} /></h2>
          <span className="badge badge-outline"><Bi t={{ ckb: "ناچالاکە، ناتوانرێت بکڕدرێت", de: "Nicht aktiv, nicht kaufbar" }} inline /></span>
        </div>
        <p className="muted"><Bi t={{ ckb: `بۆ داهاتوو پلانێکی یەکجاری بۆ هەمیشە بە نزیکەی ${price} یۆرۆ لە بەرچاوە. ئەم پلانە هێشتا چالاک نییە، نرخەکە کۆتایی نییە، و ئێستا هیچ ڕێگایەک بۆ کڕین نییە.`,
          de: `Für später ist ein einmaliger Lebenszeit-Zugang für voraussichtlich ${price} € geplant. Dieses Angebot ist noch nicht aktiv, der Preis ist nicht endgültig und ein Kauf ist derzeit nicht möglich.` }} /></p>
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
        <section className="card stack" id="about"><h2 className="section-title"><Bi t={{ ckb: "دەربارە", de: "Über RegaDRIVE" }} /></h2><Bi t={T.notOfficial} /></section>
        <section className="card stack" id="impressum" aria-labelledby="impressum-title">
          <h2 id="impressum-title" className="section-title"><Bi t={T.impressum} /></h2>
          <Bi t={{ ckb: "زانیارییە یاسایییەکانی دابینکەر (Impressum) هێشتا لەلایەن بەڕێوەبەرەوە بڵاو نەکراوەتەوە. تا ئەو کاتە، ئەم ماڵپەڕە بە تەواوی ئامادەی یاسایی نییە.",
            de: "Die gesetzlich vorgeschriebenen Anbieterangaben (Impressum) wurden vom Betreiber noch nicht veröffentlicht. Bis dahin ist diese Website rechtlich noch nicht vollständig startbereit." }} />
        </section>
        <section className="card stack" id="privacy" aria-labelledby="privacy-title">
          <h2 id="privacy-title" className="section-title"><Bi t={T.privacy} /></h2>
          <Bi t={{ ckb: "پێشکەوتنی فێربوونت تەنها لە وێبگەڕەکەتدا (IndexedDB) پاشەکەوت دەکرێت. هیچ هەژمار، ڕیکلام، شوێنپێهەڵگرتن یان فرۆشتنی داتا نییە.", de: "Dein Lernfortschritt wird nur in deinem Browser (IndexedDB) gespeichert. Es gibt keine Konten, keine Werbung, kein Tracking und keinen Datenverkauf." }} />
          <Bi t={{ ckb: "ماڵپەڕەکە لەسەر Cloudflare هۆست کراوە. بۆ گەیاندنی پەڕەکان، Cloudflare زانیاری تەکنیکیی پەیوەندی (وەک ناونیشانی IP) پرۆسێس دەکات.", de: "Die Website wird bei Cloudflare gehostet. Zur Auslieferung der Seiten verarbeitet Cloudflare technische Verbindungsdaten (z. B. die IP-Adresse)." }} />
          <p className="small muted"><Bi t={{ ckb: "تێبینی: ئەم دەقە هێشتا پێداچوونەوەی یاسایی بۆ نەکراوە و جێگەی ڕاگەیەندراوێکی تەواوی تایبەتمەندی ناگرێتەوە.", de: "Hinweis: Dieser Text wurde noch nicht rechtlich geprüft und ersetzt keine vollständige Datenschutzerklärung." }} /></p>
        </section>
        <section className="card stack" id="copyright"><h2 className="section-title"><Bi t={{ ckb: "مافی بڵاوکردنەوە", de: "Urheberrecht" }} /></h2><Bi t={T.copyright} />
          <Bi t={{ ckb: "پرسیارەکان، وانەکان و وەرگێڕانەکان ناوەڕۆکی ڕەسەنی RegaDRIVE ـن. نیشانەکانی هاتووچۆ شێوەی سادەکراوی نیشانە فەرمییەکانی StVO ـن.", de: "Fragen, Lektionen und Übersetzungen sind eigene Inhalte von RegaDRIVE. Verkehrszeichen sind vereinfachte Darstellungen der amtlichen StVO-Zeichen." }} /></section>
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

