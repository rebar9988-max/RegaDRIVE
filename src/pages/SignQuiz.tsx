import { useId, useState } from "react";
import { Link } from "../app/router";
import { useApproved } from "../app/approved";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { useApp } from "../app/state";
import { langDir, pick } from "../app/i18n";
import { SignIcon } from "../components/SignIcon";
import { signById, signSource } from "../content/signs";
import { SIGN_KIND_NAMES, SIGN_QUIZ_SIGN_LABEL } from "../content/signQuiz";
import type { Bilingual, Question, SignAnlage } from "../content/types";

/**
 * Verkehrszeichen-Quiz: an educational quiz, separate from the official-style exam. Nothing here is written to
 * the learner's exam progress, bookmarks or account; a round lives only in this page.
 */
const ROUND = 10;
type Kind = 0 | SignAnlage;

const S = {
  title: { ckb: "تاقیکردنەوەی نیشانەکانی هاتووچۆ", de: "Verkehrszeichen-Quiz", kmr: "Ezmûna nîşaneyên trafîkê", ar: "اختبار إشارات المرور" },
  note: { ckb: "ئەمە تاقیکردنەوەی فێرکارییە و جیایە لە تاقیکردنەوەی فەرمی. پرسیارەکان ڕەسەنی RegaDRIVE ـن.", de: "Dies ist ein Lern-Quiz und kein Teil der offiziellen Prüfung. Alle Fragen sind eigene RegaDRIVE-Fragen.", kmr: "Ev ezmûnek fêrkirinê ye û ji ezmûna fermî cuda ye. Hemû pirs yên xweser ên RegaDRIVE ne.", ar: "هذا اختبار تعليمي منفصل عن الامتحان الرسمي. جميع الأسئلة أصلية من RegaDRIVE." },
  all: { ckb: "هەموو جۆرەکان", de: "Alle Arten", kmr: "Hemû cure", ar: "كل الأنواع" },
  filter: { ckb: "جۆری نیشانە", de: "Art des Zeichens", kmr: "Cureya nîşaneyê", ar: "نوع الإشارة" },
  question: { ckb: "پرسیار", de: "Frage", kmr: "Pirs", ar: "سؤال" },
  result: { ckb: "ئەنجامی خولەکە", de: "Ergebnis der Runde", kmr: "Encama dorê", ar: "نتيجة الجولة" },
  of: { ckb: "ڕاست لە", de: "richtig von", kmr: "rast ji", ar: "صحيح من" },
  again: { ckb: "خولێکی نوێ", de: "Neue Runde", kmr: "Dora nû", ar: "جولة جديدة" },
  signsList: { ckb: "هەموو نیشانەکان ببینە", de: "Alle Zeichen ansehen", kmr: "Hemû nîşaneyan bibîne", ar: "عرض كل الإشارات" },
  mistakes: { ckb: "ئەو نیشانانەی هەڵەت تێدا کرد", de: "Diese Zeichen solltest du wiederholen", kmr: "Nîşaneyên ku tu şaş kirî", ar: "إشارات أخطأت فيها" },
  perfect: { ckb: "زۆر باشە! هیچ هەڵەیەکت نەبوو.", de: "Sehr gut! Kein Fehler.", kmr: "Pir baş! Tu şaşî tune.", ar: "ممتاز! لا أخطاء." },
  finish: { ckb: "بینینی ئەنجام", de: "Ergebnis ansehen", kmr: "Encamê bibîne", ar: "عرض النتيجة" },
  source: { ckb: "سەرچاوە", de: "Quelle", kmr: "Çavkanî", ar: "المصدر" },
  pickOne: { ckb: "یەک وەڵام هەڵبژێرە.", de: "Wähle eine Antwort.", kmr: "Yek bersivê hilbijêre.", ar: "اختر إجابة واحدة." },
} satisfies Record<string, Bilingual>;

/**
 * Quiz-only text order (owner request): German first, the learner's language directly below it.
 * Each line keeps its own lang/dir, so the page layout never mirrors. German as main language shows one line.
 */
function DeFirst({ t }: { t: Bilingual }) {
  const { settings } = useApp();
  const p = pick(t, settings.lang);
  return (
    <div className="bi">
      <span className="pri" lang="de" dir="ltr">{t.de}</span>
      {p.lang !== "de" && <span className="pri" lang={p.lang} dir={langDir(p.lang)}>{p.text}</span>}
    </div>
  );
}

/** Fisher–Yates with a small seeded generator, so a round is reproducible from its seed. */
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!]; }
  return out;
}

const poolFor = (pool: Question[], kind: Kind): Question[] => pool.filter((q) => kind === 0 || signById(q.signId ?? "")?.anlage === kind);
const newRound = (pool: Question[], kind: Kind): string[] => shuffled(poolFor(pool, kind), Date.now() ^ Math.floor(Math.random() * 1e9)).slice(0, ROUND).map((q) => q.id);

export function SignQuiz() {
  const { signQuiz, loading } = useApproved();
  if (loading) return <div className="sign-quiz" aria-busy="true" />;
  return <SignQuizRound pool={signQuiz} />;
}

function SignQuizRound({ pool }: { pool: Question[] }) {
  const label = useBiText();
  const [kind, setKind] = useState<Kind>(0);
  const [ids, setIds] = useState<string[]>(() => newRound(pool, 0));
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [wrong, setWrong] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [lost, setLost] = useState(0);
  const [done, setDone] = useState(false);
  const legendId = useId();

  const start = (k: Kind) => { setKind(k); setIds(newRound(pool, k)); setPos(0); setPicked(null); setChecked(false); setWrong([]); setScore(0); setLost(0); setDone(false); };
  const byId = (id: string) => pool.find((q) => q.id === id);
  const q = byId(ids[pos] ?? "");
  const sign = q?.signId ? signById(q.signId) : undefined;
  const kinds: [Kind, Bilingual][] = [[0, S.all], [1, SIGN_KIND_NAMES[1]], [2, SIGN_KIND_NAMES[2]], [3, SIGN_KIND_NAMES[3]]];

  const check = () => {
    if (!q || picked === null || checked) return;
    setChecked(true);
    if (q.correct.includes(picked)) setScore((s) => s + 1);
    else { setWrong((w) => [...w, q.id]); setLost((l) => l + (q.points ?? 0)); }
  };
  const next = () => {
    if (pos + 1 >= ids.length) { setDone(true); return; }
    setPos(pos + 1); setPicked(null); setChecked(false);
  };

  return (
    <div className="sign-quiz">
      <header className="page-head">
        <h1><Bi t={S.title} /></h1>
        <p className="notice small"><Bi t={S.note} /></p>
      </header>

      {pool.length === 0 && <p className="notice"><Bi t={T.contentInReview} /></p>}

      {pool.length > 0 && (
        <>
          <div className="chip-row" role="group" aria-label={label(S.filter)}>
            {kinds.map(([k, t]) => <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => start(k)}>{label(t)}</button>)}
          </div>

          {!done && q && (
            <article className="card question-card" aria-labelledby={legendId} data-testid="sq-card" data-qid={q.id} style={{ marginTop: 16 }}>
              <div className="q-meta">
                <span className="badge" dir="ltr">{pos + 1} / {ids.length}</span>
                {q.points !== null && <span className="badge"><Bi t={{ ckb: `${q.points} ${T.points.ckb}`, de: `${q.points} ${T.points.de}`, kmr: `${q.points} ${T.points.kmr}`, ar: `${q.points} ${T.points.ar}` }} inline /></span>}
              </div>
              <div className="progressbar question-progress" role="progressbar" aria-label={label(S.question)} aria-valuemin={0} aria-valuemax={ids.length} aria-valuenow={pos + 1}><span style={{ width: `${((pos + 1) / ids.length) * 100}%` }} /></div>
              <fieldset className="options">
                <legend id={legendId} className="q-prompt"><DeFirst t={q.prompt} /></legend>
                {sign && <SignIcon sign={sign} className="q-sign" label={label(SIGN_QUIZ_SIGN_LABEL)} />}
                <p className="muted small q-hint"><Bi t={S.pickOne} inline /></p>
                {q.options.map((o) => {
                  const isSel = picked === o.id;
                  const isRight = q.correct.includes(o.id);
                  const cls = ["option", isSel && "is-selected", checked && isRight && "is-correct", checked && isSel && !isRight && "is-wrong", checked && "is-disabled"].filter(Boolean).join(" ");
                  return (
                    <label key={o.id} className={cls} data-testid={`sq-option-${o.id}`}>
                      <input type="radio" className="q-check" name={`sq-${q.id}`} checked={isSel} disabled={checked} onChange={() => setPicked(o.id)} />
                      <span className="option-body">
                        <DeFirst t={o.text} />
                        {checked && isRight && <span className="option-tag ok" data-testid="sq-correct"><Bi t={T.correctAnswers} inline /></span>}
                        {checked && isSel && !isRight && <span className="option-tag bad" data-testid="sq-wrong"><Bi t={T.wrongChoice} inline /></span>}
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              {checked && picked !== null && (
                <div className={`feedback ${q.correct.includes(picked) ? "ok" : "bad"}`} role="status" data-testid="sq-feedback">
                  <div className="feedback-title"><Bi t={q.correct.includes(picked) ? T.correct : T.incorrect} inline /></div>
                  <DeFirst t={q.explanation} />
                  {sign && <p className="small muted" dir="ltr"><Bi t={S.source} inline />: {signSource(sign)}</p>}
                </div>
              )}

              <div className="q-actions">
                {!checked
                  ? <button type="button" className="btn btn-primary" disabled={picked === null} onClick={check} data-testid="sq-check"><Bi t={T.checkAnswer} /></button>
                  : <button type="button" className="btn btn-primary" onClick={next} data-testid="sq-next"><Bi t={pos + 1 >= ids.length ? S.finish : T.next} /></button>}
              </div>
              <div className="row small muted" style={{ marginTop: 16 }}>
                <span className="badge badge-outline"><Bi t={T.originalQ} inline /></span>
                {q.reviewStatus !== "approved" && <span className="badge badge-outline"><Bi t={T.pendingReview} inline /></span>}
              </div>
              <p className="copyright muted"><Bi t={T.copyright} /></p>
            </article>
          )}

          {done && (
            <section className="card" data-testid="sq-result" style={{ marginTop: 16 }}>
              <h2><Bi t={S.result} /></h2>
              <p className="num" dir="ltr" style={{ fontSize: "2rem", fontWeight: 800 }}>{score} / {ids.length}</p>
              <p className="small muted"><Bi t={{ ckb: `${S.of.ckb} ${ids.length}`, de: `${S.of.de} ${ids.length}`, kmr: `${S.of.kmr} ${ids.length}`, ar: `${S.of.ar} ${ids.length}` }} inline /> · <Bi t={T.errorPointsLost} inline />: <span dir="ltr">{lost}</span></p>
              {wrong.length === 0
                ? <p className="notice"><Bi t={S.perfect} /></p>
                : (
                  <div>
                    <h3><Bi t={S.mistakes} /></h3>
                    <div className="signs-grid">
                      {wrong.map((id) => { const w = byId(id); const s = w?.signId ? signById(w.signId) : undefined; return s ? (
                        <article key={id} className="card sign-tile"><SignIcon sign={s} label={label(s.name)} /><DeFirst t={s.name} /><span className="badge badge-outline" dir="ltr">Zeichen {s.stvoNumber}</span></article>
                      ) : null; })}
                    </div>
                  </div>
                )}
              <div className="q-actions" style={{ marginTop: 16 }}>
                <button type="button" className="btn btn-primary" onClick={() => start(kind)} data-testid="sq-again"><Bi t={S.again} /></button>
                <Link className="btn btn-secondary" href="/signs"><Bi t={S.signsList} /></Link>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

