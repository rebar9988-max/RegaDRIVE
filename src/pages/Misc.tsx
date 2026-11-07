import { useEffect, useState, type KeyboardEvent } from "react";
import { Link } from "../app/router";
import { MORE_LINKS } from "../app/Shell";
import { useApp, useNow } from "../app/state";
import { LANGS, langDir, vocabMeaning } from "../app/i18n";
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
        <p className="small muted"><Bi t={{ ckb: "پێشکەوتن تەنها لەسەر ئەم ئامێرە پاشەکەوت دەکرێت.", de: "Der Fortschritt wird nur auf diesem Gerät gespeichert.", kmr: "Pêşketin tenê li ser vê amûrê tê tomarkirin.", ar: "يُحفظ التقدّم على هذا الجهاز فقط." }} /></p></header>
      <section className="card progress-summary">
        <div className="progress-summary-copy"><h2><Bi t={{ ckb: "پێشکەوتنی گشتی", de: "Dein Lernfortschritt", kmr: "Pêşketina giştî", ar: "تقدّمك في التعلّم" }} /></h2><p className="small muted"><Bi t={{ ckb: `${mastered} لە ${qs.length} پرسیار فێربووە`, de: `${mastered} von ${qs.length} Fragen gemeistert`, kmr: `${mastered} ji ${qs.length} pirsan hatin fêrbûn`, ar: `الأسئلة المتقنة: ${mastered} من ${qs.length}` }} /></p></div>
        <ProgressRing value={percent} label={label(T.mastered)} />
      </section>
      <div className="grid grid-3 progress-stats">
        <div className="card stat stat-success"><span className="stat-icon"><Icon name="check" /></span><span className="stat-value">{correctCount}</span><span className="stat-label"><Bi t={T.correct} /></span></div>
        <div className="card stat stat-danger"><span className="stat-icon"><Icon name="sign" /></span><span className="stat-value">{wrongIds.length}</span><span className="stat-label"><Bi t={T.incorrectF} /></span></div>
        <div className="card stat stat-warning"><span className="stat-icon"><Icon name="trophy" /></span><span className="stat-value">{progress.examHistory.length}</span><span className="stat-label"><Bi t={T.mockExam} /></span></div>
      </div>
      <section className="card readiness-card"><h2 className="section-title"><Bi t={{ ckb: "ئاستی فێربوونی پرسیارەکان", de: "Stand deines Fragentrainings", kmr: "Asta fêrbûna pirsan", ar: "مستوى تدريبك على الأسئلة" }} /><span className="badge" dir="ltr">{percent}%</span></h2><div className="progressbar" role="progressbar" aria-label={label(T.mastered)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div></section>
      <div className="row small muted progress-secondary"><Icon name="flame" /><span>{streakDays(progress, now)} {label(T.streak)}</span><span className="spacer" /><Icon name="bookmark" /><span>{progress.bookmarks.length} {label(T.bookmarked)}</span></div>
      <div className="q-actions progress-actions">
        <Link href="/practice?status=incorrect" className="btn btn-primary"><Bi t={T.reviewMistakes} /></Link>
        <Link href="/practice?bookmarks=1" className="btn btn-secondary">{label(T.bookmarksOnly)}</Link>
      </div>
      <div className="topic-insights">
        {[{ weak: false, title: { ckb: "بابەتە بەهێزەکان", de: "Deine Stärken", kmr: "Mijarên bihêz", ar: "نقاط قوتك" } }, { weak: true, title: T.weakTopics }].map(({ weak, title }) => {
          const topics = TOPICS.filter((t) => { const stat = stats.get(t.id); return stat && (weak ? wrongIds.some((q) => q.topicId === t.id) : stat.total > 0 && stat.mastered === stat.total); });
          return <section className="card topic-insight" key={String(weak)}><span className={`insight-icon ${weak ? "warning" : "success"}`}><Icon name={weak ? "sign" : "check"} /></span><div><h2 className="section-title"><Bi t={title} /></h2>{topics.length ? <div className="chip-row">{topics.map((t) => <Link key={t.id} href={`/practice?topic=${t.id}`} className="chip"><Bi t={t.title} /></Link>)}</div> : <p className="small muted"><Bi t={{ ckb: "دوای ڕاهێنان ئەنجامەکان لێرە دەبینیت.", de: "Nach dem Üben siehst du hier deine Ergebnisse.", kmr: "Piştî rahênanê tu encamên xwe li vir dibînî.", ar: "بعد التدريب سترى نتائجك هنا." }} /></p>}</div></section>;
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
  const { settings } = useApp();
  const [text, setText] = useState("");
  const n = normalize(text);
  const list = CONTENT.vocabulary.filter((v) => !n || normalize(`${v.de} ${v.ckb} ${v.kmr ?? ""} ${v.ar ?? ""} ${v.article ?? ""}`).includes(n));
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.nav.vocab} /></h1></header>
      <label className="sr-only" htmlFor="v-search">{label(T.search)}</label>
      <input id="v-search" className="input" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={label(T.search)} style={{ marginBottom: 16 }} />
      <div className="card" style={{ padding: 0 }}>
        {list.map((v) => {
          const m = vocabMeaning(v, settings.lang);
          return (
          <div key={v.id} className="vocab-row">
            <span lang={m.lang} dir={langDir(m.lang)}>{m.text}</span>
            <span className="vocab-de" lang="de">{v.article && <small>{v.article} </small>}<strong>{v.de}</strong></span>
          </div>
          );
        })}
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
        <p className="small muted"><Bi t={{ ckb: "خولی یارمەتی یەکەم، پشکنینی چاو و قوتابخانەی شۆفێری.", de: "Erste-Hilfe-Kurs, Sehtest und Fahrschulen.", kmr: "Kursa alîkariya yekem, testa çavan û dibistanên ajotinê.", ar: "دورة الإسعافات الأولية وفحص النظر ومدارس تعليم القيادة." }} /></p></header>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); setSearched(true); }}>
        <label className="stack" style={{ gap: 4 }}>
          <span className="small muted">{label({ ckb: "جۆری خزمەتگوزاری", de: "Kategorie", kmr: "Cureyê xizmetê", ar: "الفئة" })}</span>
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="erste-hilfe">{label({ ckb: "خولی یارمەتی یەکەم", de: "Erste-Hilfe-Kurs", kmr: "Kursa alîkariya yekem", ar: "دورة الإسعافات الأولية" })}</option>
            <option value="sehtest">{label({ ckb: "پشکنینی چاو", de: "Sehtest", kmr: "Testa çavan", ar: "فحص النظر" })}</option>
            <option value="fahrschule">{label({ ckb: "قوتابخانەی شۆفێری", de: "Fahrschule", kmr: "Dibistana ajotinê", ar: "مدرسة تعليم القيادة" })}</option>
          </select>
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="small muted">{label({ ckb: "شار یان کۆدی پۆستە (PLZ)", de: "Stadt oder PLZ", kmr: "Bajar an koda postê (PLZ)", ar: "المدينة أو الرمز البريدي (PLZ)" })}</span>
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="postal-code" />
        </label>
        <button className="btn btn-primary" type="submit">{label({ ckb: "گەڕان", de: "Suchen", kmr: "Lê bigere", ar: "بحث" })}</button>
      </form>
      {searched && (
        <div className="notice section" role="status" data-testid="services-unavailable">
          <Bi t={{ ckb: "زانیاری پشتڕاستکراوی ڕاستەوخۆ بۆ ئەم ناوچەیە لە ئێستادا بەردەست نییە. RegaDRIVE هیچ ناو، نرخ یان کاتێکی دروستکراو پیشان نادات. تکایە ڕاستەوخۆ لەگەڵ شارەوانی، قوتابخانەی شۆفێری یان دابینکەرانی خولی یارمەتی یەکەم پەیوەندی بکە.",
            de: "Für diese Suche liegen derzeit keine verifizierten Live-Daten vor. RegaDRIVE zeigt keine erfundenen Anbieter, Preise oder Termine. Bitte wende dich direkt an Fahrschulen, Optiker oder Erste-Hilfe-Anbieter vor Ort.", kmr: "Ji bo vê lêgerînê niha agahiyên rasterast ên piştrastkirî tune ne. RegaDRIVE tu navên pêşkêşkaran, biha an demên çêkirî nîşan nade. Ji kerema xwe rasterast bi dibistanên ajotinê, optîkeran an pêşkêşkarên kursa alîkariya yekem ên herêmî re têkilî dayne.", ar: "لا تتوفر حاليًا بيانات مباشرة موثّقة لهذا البحث. لا يعرض RegaDRIVE مزوّدين أو أسعارًا أو مواعيد مختلَقة. يرجى التواصل مباشرة مع مدارس القيادة أو محلات النظارات أو مزوّدي دورات الإسعافات الأولية في منطقتك." }} />
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
          de: "Schülerkonten (Registrierung, Anmeldung, E-Mail-Bestätigung) sind vorbereitet, aber noch nicht aktiv, weil die Produktionsdatenbank bewusst ausgeschaltet ist.", kmr: "Hesabên xwendekaran (tomarbûn, têketin, piştrastkirina e-nameyê) amade ne, lê hê ne çalak in, ji ber ku databasa hilberînê bi qestî girtî ye.", ar: "حسابات الطلاب (التسجيل وتسجيل الدخول وتأكيد البريد الإلكتروني) جاهزة، لكنها غير مفعّلة بعد لأن قاعدة بيانات الإنتاج متوقفة عمدًا." }} />
        <Bi t={{ ckb: "هەموو پێشکەوتنەکەت بە سەلامەتی لەسەر ئەم ئامێرە پاشەکەوت دەکرێت.", de: "Dein gesamter Lernfortschritt wird sicher auf diesem Gerät gespeichert.", kmr: "Hemû pêşketina te bi ewlehî li ser vê amûrê tê tomarkirin.", ar: "يُحفظ كل تقدّمك في التعلّم بأمان على هذا الجهاز." }} />
        <button className="btn btn-primary" disabled aria-disabled="true">{label({ ckb: "تۆمارکردن (بەم زووانە)", de: "Registrieren (bald verfügbar)", kmr: "Tomar bibe (di demeke nêzîk de)", ar: "التسجيل (قريبًا)" })}</button>
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
        <h2><Bi t={{ ckb: "ئێستا بەخۆڕاییە", de: "Derzeit kostenlos", kmr: "Niha belaş e", ar: "مجاني حاليًا" }} /></h2>
        <Bi t={{ ckb: "پارەدان و کڕین ناچالاکن؛ هیچ کڕینێک لەم ماڵپەڕەدا ناکرێت. هەر نرخێکی داهاتوو تەنها پلانە و تا چالاککردنی فەرمی پابەندکەر نییە.", de: "Zahlungen und Käufe sind deaktiviert. Auf dieser Website kann derzeit nichts gekauft werden. Ein möglicher künftiger Preis ist nur geplant und nicht verbindlich.", kmr: "Dravdan û kirîn neçalak in. Niha li ser vê malperê tiştek nayê kirîn. Bihayekî muhtemel ê pêşerojê tenê plan e û ne girêdayî ye.", ar: "المدفوعات والمشتريات معطّلة. لا يمكن حاليًا شراء أي شيء على هذا الموقع. أي سعر مستقبلي محتمل هو مجرد خطة وغير ملزم." }} />
        <p className="notice" role="note"><Bi t={{ ckb: "هیچ زانیارییەکی کارتی بانکی لەم ماڵپەڕەدا کۆ ناکرێتەوە.", de: "Auf dieser Website werden keine Kartendaten erhoben.", kmr: "Li ser vê malperê tu agahiyên kartê nayên berhevkirin.", ar: "لا تُجمع أي بيانات بطاقات على هذا الموقع." }} /></p>
      </section>
    </div>
  );
}

export function Settings() {
  const { settings, setSettings, resetProgress, progress } = useApp();
  const label = useBiText();
  const [confirm, setConfirm] = useState(false);
  const moveRadio = (event: KeyboardEvent<HTMLDivElement>) => {
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]:not(:disabled)'));
    const current = radios.indexOf(event.target as HTMLButtonElement);
    if (current < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown": next = (current + 1) % radios.length; break;
      case "ArrowLeft":
      case "ArrowUp": next = (current + radios.length - 1) % radios.length; break;
      case "Home": next = 0; break;
      case "End": next = radios.length - 1; break;
      default: return;
    }
    event.preventDefault();
    const radio = radios[next];
    if (radio) {
      radio.focus();
      radio.click();
    }
  };
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.nav.settings} /></h1></header>
      <section className="card stack">
        <h2 className="section-title"><Bi t={{ ckb: "زمان", de: "Sprache", kmr: "Ziman", ar: "اللغة" }} /></h2>
        <div className="chip-row lang-grid" role="radiogroup" onKeyDown={moveRadio} aria-label={label({ ckb: "زمان", de: "Sprache", kmr: "Ziman", ar: "اللغة" })}>
          {LANGS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={settings.lang === l.id} lang={l.id} dir={langDir(l.id)}
              className="chip" tabIndex={settings.lang === l.id ? 0 : -1} onClick={() => setSettings({ lang: l.id })} data-testid={`lang-${l.id}`}>{l.native}</button>
          ))}
        </div>
        <h3 className="section-title"><Bi t={{ ckb: "دەقی ئەڵمانی لە ژێرەوە", de: "Deutsch darunter zeigen", kmr: "Nivîsa almanî ya orîjînal li jêr", ar: "إظهار النص الألماني الأصلي أسفله" }} /></h3>
        <div className="chip-row" role="radiogroup" onKeyDown={moveRadio} aria-label={label({ ckb: "دەقی ئەڵمانی", de: "Deutscher Text", kmr: "Nivîsa almanî", ar: "النص الألماني" })}>
          {([true, false] as const).map((on) => (
            <button key={String(on)} type="button" role="radio" className="chip" disabled={settings.lang === "de"}
              tabIndex={settings.lang !== "de" && settings.withGerman === on ? 0 : -1} aria-checked={settings.lang !== "de" && settings.withGerman === on} onClick={() => setSettings({ withGerman: on })} data-testid={`with-german-${on ? "on" : "off"}`}>
              {label(on ? { ckb: "پیشان بدە", de: "Anzeigen", kmr: "Nîşan bide", ar: "إظهار" } : { ckb: "پیشان مەدە", de: "Ausblenden", kmr: "Veşêre", ar: "إخفاء" })}
            </button>
          ))}
        </div>
      </section>
      <section className="card stack section">
        <h2 className="section-title"><Bi t={T.dailyGoal} /></h2>
        <div className="chip-row">
          {[5, 10, 20, 30].map((n) => <button key={n} type="button" className="chip" aria-pressed={settings.dailyGoal === n} dir="ltr" onClick={() => setSettings({ dailyGoal: n })}>{n}</button>)}
        </div>
        <h2 className="section-title"><Bi t={{ ckb: "پێوەری فێربوون (وەڵامی ڕاستی بەدوایەک)", de: "Meisterschwelle (Treffer in Folge)", kmr: "Pîvana fêrbûnê (rast li pey hev)", ar: "عتبة الإتقان (إجابات صحيحة متتالية)" }} /></h2>
        <div className="chip-row">
          {[2, 3, 4, 5].map((n) => <button key={n} type="button" className="chip" aria-pressed={settings.masteryThreshold === n} dir="ltr" onClick={() => setSettings({ masteryThreshold: n })}>{n}</button>)}
        </div>
      </section>
      <section className="card stack section">
        <h2 className="section-title"><Bi t={{ ckb: "تایبەتمەندی و داتا", de: "Datenschutz und Daten", kmr: "Nepenî û dane", ar: "الخصوصية والبيانات" }} /></h2>
        <Bi t={{ ckb: "داتای فێربوونت تەنها لە وێبگەڕەکەت (IndexedDB) دایە. هیچ شتێک بۆ ڕاژەکار نانێردرێت.", de: "Deine Lerndaten liegen nur in deinem Browser (IndexedDB). Nichts wird an einen Server gesendet.", kmr: "Daneyên fêrbûna te tenê di gerokê te de ne (IndexedDB). Tiştek ji serverê re nayê şandin.", ar: "بيانات تعلّمك موجودة في متصفحك فقط (IndexedDB). لا يُرسل أي شيء إلى الخادم." }} />
        <button type="button" className="btn btn-secondary" onClick={() => {
          const blob = new Blob([JSON.stringify({ settings, exportedAt: new Date().toISOString(), progress }, null, 2)], { type: "application/json" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "regadrive-export.json"; a.click(); URL.revokeObjectURL(a.href);
        }}>{label({ ckb: "هەناردەکردنی داتا", de: "Daten exportieren", kmr: "Daneyan derxîne", ar: "تصدير البيانات" })}</button>
        {!confirm
          ? <button type="button" className="btn btn-secondary" onClick={() => setConfirm(true)}>{label({ ckb: "سڕینەوەی هەموو پێشکەوتن", de: "Gesamten Fortschritt löschen", kmr: "Hemû pêşketinê jê bibe", ar: "حذف كل التقدّم" })}</button>
          : <div className="row"><button type="button" className="btn btn-primary" onClick={() => { resetProgress(); setConfirm(false); }}>{label({ ckb: "بەڵێ، بیسڕەوە", de: "Ja, löschen", kmr: "Erê, jê bibe", ar: "نعم، احذف" })}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirm(false)}>{label({ ckb: "پاشگەزبوونەوە", de: "Abbrechen", kmr: "Betal bike", ar: "إلغاء" })}</button></div>}
      </section>
    </div>
  );
}

export function About() {
  return (
    <div>
      <header className="page-head"><h1><Bi t={T.nav.about} /></h1></header>
      <div className="stack" style={{ gap: 16 }}>
        <section className="card stack"><h2 className="section-title"><Bi t={{ ckb: "دەربارە", de: "Über RegaDRIVE", kmr: "Derbarê RegaDRIVE", ar: "حول RegaDRIVE" }} /></h2><Bi t={T.notOfficial} /></section>
        <section className="card stack" id="impressum">
          <h2 className="section-title"><Bi t={{ ckb: "زانیاری دابینکەر · Impressum", de: "Anbieterinformationen · Impressum", kmr: "Agahiyên pêşkêşkar · Impressum", ar: "بيانات مقدّم الخدمة · Impressum" }} /></h2>
          <Bi t={{ ckb: "زانیاریی ناساندنی دابینکەر و ناونیشانی پەیوەندی لەم وەشانەدا پشتڕاست نەکراونەتەوە. زانیارییە ناتەواوەکان پڕ ناکرێنەوە بە گومان یان داهێنان.", de: "Anbieteridentität und ladungsfähige Kontaktanschrift sind für diese Fassung noch nicht verifiziert. Fehlende Angaben werden nicht vermutet oder erfunden.", kmr: "Nasnameya pêşkêşkar û navnîşana têkiliyê ya qanûnî ji bo vê guhertoyê hê nehatine piştrastkirin. Agahiyên kêm nayên texmînkirin an çêkirin.", ar: "لم يتم بعد التحقق من هوية مقدّم الخدمة وعنوان المراسلة القانوني لهذه النسخة. لا يتم تخمين البيانات الناقصة أو اختلاقها." }} />
          <p className="notice" role="note"><Bi t={{ ckb: "ئەم بەشە ئاگادارکردنەوەیە و جێگرەوەی Impressum ـی تەواو نییە. ماڵپەڕ پێویستی بە ناوی یاسایی دابینکەر، ناونیشانی تەواو و ڕێگای پەیوەندیی پشتڕاستکراوە هەیە.", de: "Dieser Hinweis ist kein vollständiges Impressum. Erforderlich sind die verifizierte Anbieterbezeichnung, eine vollständige Anschrift und ein bestätigter direkter Kontaktweg.", kmr: "Ev têbînî ne Impressumeke temam e. Navê pêşkêşkar ê piştrastkirî, navnîşaneke temam û rêyeke têkiliyê ya rasterast a piştrastkirî pêwîst in.", ar: "هذا التنبيه ليس بيانات ناشر (Impressum) كاملة. يلزم اسم مقدّم الخدمة الموثّق وعنوان كامل ووسيلة اتصال مباشرة مؤكدة." }} /></p>
        </section>
        <section className="card stack" id="privacy">
          <h2 className="section-title"><Bi t={{ ckb: "تایبەتمەندی و داتا", de: "Datenschutz und Daten", kmr: "Nepenî û dane", ar: "الخصوصية والبيانات" }} /></h2>
          <Bi t={{ ckb: "پێشکەوتنی فێربوون و ڕێکخستنەکان لە بیرگەی ناوخۆی وێبگەڕەکەت (IndexedDB) پاشەکەوت دەکرێن؛ ئەم پێشکەوتنە بۆ ڕاژەکار نانێردرێت. بۆ پێشاندانی ماڵپەڕ و API، داواکارییە تەکنیکییەکان لە Cloudflare تێدەپەڕن و دەتوانن داتای پەیوەندیی پێویست لەگەڵ خۆیان هەڵبگرن.", de: "Lernfortschritt und Einstellungen werden lokal im Browser (IndexedDB) gespeichert und nicht an den Server synchronisiert. Für Website und API laufen technische Anfragen über Cloudflare und können erforderliche Verbindungsdaten verarbeiten.", kmr: "Pêşketina fêrbûnê û mîheng bi herêmî di gerokê de (IndexedDB) tên tomarkirin û bi serverê re nayên hevdemkirin. Ji bo malper û API, daxwazên teknîkî di ser Cloudflare re derbas dibin û dikarin daneyên girêdanê yên pêwîst pêvajo bikin.", ar: "يُحفظ تقدّم التعلّم والإعدادات محليًا في المتصفح (IndexedDB) ولا تُزامَن مع الخادم. ولتشغيل الموقع وواجهة API تمر الطلبات التقنية عبر Cloudflare وقد تُعالَج بيانات الاتصال اللازمة." }} />
          <Bi t={{ ckb: "ئەگەر ڕوونکردنەوەی AI چالاک بێت، داواکارییەکە تەنها ناسنامەی پرسیارێکی پەسەندکراوی RegaDRIVE و زمانی هەڵبژێردراو دەگرێت؛ دەقی ئازادی بەکارهێنەر و زانیاریی پرۆفایل نانێردرێت. دابینکەری AI دەتوانێت ناوەڕۆکی ئەو پرسیارە بۆ وەڵامدانەوە وەربگرێت.", de: "Wenn die KI-Erklärung aktiviert ist, enthält die Anfrage nur die ID einer freigegebenen RegaDRIVE-Frage und die gewählte Anzeigesprache; freier Nutzereingabetext und Profildaten werden nicht gesendet. Der KI-Anbieter kann den Inhalt dieser Frage zur Antwortverarbeitung erhalten.", kmr: "Heke şiroveya AI çalak be, daxwaz tenê nasnameya pirseke pejirandî ya RegaDRIVE û zimanê hilbijartî dihewîne; nivîsa azad a bikarhêner û daneyên profîlê nayên şandin. Pêşkêşkarê AI dikare naveroka vê pirsê ji bo bersivdanê bistîne.", ar: "عند تفعيل شرح الذكاء الاصطناعي، يحتوي الطلب فقط على معرّف سؤال معتمد من RegaDRIVE واللغة المختارة؛ ولا يُرسل أي نص حر من المستخدم ولا بيانات الملف الشخصي. وقد يتلقى مزوّد الذكاء الاصطناعي محتوى هذا السؤال لمعالجة الإجابة." }} />
          <p className="small muted"><Bi t={{ ckb: "ئەم زانیارییە لە پشکنینی کۆدەوە کورتکراوەتەوە و هێشتا پێداچوونەوەی یاسایی و پشتڕاستکردنەوەی دابینکەر، بنەمای یاسایی و ماوەی پاراستنی داتا پێویستە؛ بەمەش بە تەنها ئاگادارکردنەوەی یاسایی تەواو نابێت.", de: "Diese Zusammenfassung beruht auf einer Codeprüfung. Eine rechtliche Prüfung sowie die Verifizierung der Anbieter, Rechtsgrundlagen und Speicherfristen stehen noch aus; sie ist allein keine vollständige Datenschutzerklärung.", kmr: "Ev kurte li ser kontrola kodê ava bûye. Kontrola qanûnî û piştrastkirina pêşkêşkaran, bingehên qanûnî û demên tomarkirinê hê mane; ev bi tena serê xwe ne daxuyaniyeke nepeniyê ya temam e.", ar: "يستند هذا الملخص إلى فحص الشيفرة البرمجية. ولا تزال المراجعة القانونية والتحقق من مقدّمي الخدمات والأسس القانونية ومدد التخزين معلّقة؛ ولا يُعد وحده إشعار خصوصية كاملًا." }} /></p>
        </section>
        <section className="card stack"><h2 className="section-title"><Bi t={{ ckb: "مافی بڵاوکردنەوە", de: "Urheberrecht", kmr: "Mafê nivîskariyê", ar: "حقوق النشر" }} /></h2><Bi t={T.copyright} />
          <Bi t={{ ckb: "پرسیارەکان و وانەکان ناوەڕۆکی ڕەسەنی RegaDRIVE ـن. نیشانەکانی هاتووچۆ شێوەی سادەکراوی نیشانە فەرمییەکانی StVO ـن.", de: "Fragen und Lektionen sind eigene RegaDRIVE-Inhalte. Verkehrszeichen sind vereinfachte Darstellungen amtlicher StVO-Zeichen.", kmr: "Pirs û ders naveroka xweser a RegaDRIVE ne. Nîşaneyên trafîkê şiklên sadekirî yên nîşaneyên fermî yên StVO ne.", ar: "الأسئلة والدروس محتوى أصلي من RegaDRIVE. إشارات المرور رسوم مبسّطة لإشارات StVO الرسمية." }} /></section>
      </div>
    </div>
  );
}

export function NotFound() {
  const label = useBiText();
  return (
    <div className="card stack">
      <h1><Bi t={{ ckb: "ئەم پەڕەیە نەدۆزرایەوە", de: "Seite nicht gefunden", kmr: "Rûpel nehat dîtin", ar: "الصفحة غير موجودة" }} /></h1>
      <Link href="/" className="btn btn-primary">{label(T.nav.home)}</Link>
    </div>
  );
}

