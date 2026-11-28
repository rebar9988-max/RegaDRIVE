import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { SignIcon } from "../components/SignIcon";
import { SIGNS, signSource } from "../content/signs";
import { SIGN_QUIZ } from "../content/signQuiz";
import { IT_QUESTIONS } from "../content/italy/questions";
import { IT_SIGNS, itSignById, itSignSrc } from "../content/italy/signs";
import type { ItalyTranslations } from "../../worker/dr/italyQuestionReview";
import type { Question, TrafficSign } from "../content/types";
import { EDITORIAL_ONLY_CKB, reasonCkb } from "./drReasons";
import "./dr.css";

const DrItalyCatalogue = lazy(() => import("./DrItalyCatalogue").then((m) => ({ default: m.DrItalyCatalogue })));

/**
 * /dr → Content Review & Approval. Germany and Italy are reviewed apart:
 *  - Germany: the Verkehrszeichen release (40 signs, 89 sign-quiz questions);
 *  - Italy: the Italian signs, the bundled Italian true/false questions (editorial review of their wording)
 *    and the staged 7,020-question catalogue (per-language draft review; it cannot publish).
 * Every decision is a NAMED HUMAN reviewer's, with a date and evidence; the server refuses anything else,
 * needs a fresh sign-in code and writes the audit log. Nothing here approves anything by itself.
 */
type Stage = "TRANSLATION_REVIEW" | "EDUCATIONAL_REVIEW" | "APPROVED";
interface StageInfo { state: "pass" | "fail" | "pending"; reviewer?: string; role?: string; reviewedOn?: string; evidenceRef?: string; note?: string; rowId?: number; rowSource?: "de" | "it" }
type Kind = "sign" | "signQuiz" | "itSign" | "itQuestion";
type Country = "de" | "it";
interface Item {
  id: string; kind: Kind; status: string; publishable: boolean; reasons: string[]; valid: boolean;
  checks: { ok: boolean; label: string }[]; sourceRefs: string[]; stages: Record<Stage, StageInfo>;
}
interface ItalyQuestionItem extends Item { hash: string; translations: ItalyTranslations }
interface TranslationEdit { id: number; at: number; actor: string; reviewerName: string; reviewedOn: string; evidenceRef: string; note: string; before: ItalyTranslations; after: ItalyTranslations }
interface ItalyHistory { decisions: HistoryRow[]; edits: TranslationEdit[] }
interface HistoryRow { id: number; source?: "de" | "it"; content_id: string; stage: Stage; outcome: string; reviewer_name: string; reviewer_role: string; reviewed_on: string; evidence_ref: string; note: string; recorded_by: string; recorded_at: number; revoked_at: number | null; revoke_reason: string | null }
interface KindCount { total: number; published: number }
interface CountryCount { total: number; published: number; awaiting: number; inReview: number; rejected: number }
interface Counts { total: number; published: number; awaiting: number; inReview: number; rejected: number; signs: KindCount; signQuiz: KindCount; itSigns?: KindCount; itQuestions?: KindCount; byCountry?: Record<Country, CountryCount> }
interface Data { tablesReady?: { de: boolean; it: boolean }; items: Item[]; italyQuestions?: ItalyQuestionItem[]; counts: Counts; history: HistoryRow[]; rulesVersion: string; rulesVersionIt?: string }
type ApiResult = { status: number; body: Record<string, unknown> };
interface Props { api: (path: string, body?: unknown) => Promise<ApiResult>; onNeedStepUp: (retry: () => Promise<void>) => void }

const STAGES: Stage[] = ["TRANSLATION_REVIEW", "EDUCATIONAL_REVIEW", "APPROVED"];
const COUNTRY_OF: Record<Kind, Country> = { sign: "de", signQuiz: "de", itSign: "it", itQuestion: "it" };
const KIND_LABEL: Record<"all" | Kind, string> = {
  all: "هەموو بابەتەکانی ئەڵمانیا",
  sign: `هێماکان — ئەڵمانیا (${SIGNS.length})`,
  signQuiz: `کویزی هێما — ئەڵمانیا (${SIGN_QUIZ.length})`,
  itSign: `هێماکان — ئیتاڵیا (${IT_SIGNS.length})`,
  itQuestion: `پرسیار — ئیتاڵیا (${IT_QUESTIONS.length})`,
};
const STAGE_LABEL: Record<Stage, { en: string; who: string }> = {
  TRANSLATION_REVIEW: { en: "پێداچوونەوەی وەرگێڕان", who: "وەرگێڕی سۆرانی" },
  EDUCATIONAL_REVIEW: { en: "پێداچوونەوەی فێرکاری", who: "مامۆستای شۆفێری" },
  APPROVED: { en: "پەسەندکردنی کۆتایی (Super Admin)", who: "خاوەنی ناوەڕۆک" },
};
const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "بڵاوکراوە", APPROVED: "پەسەندکراو", APPROVED_WAITING: "پەسەندکراوە، چاوەڕێی دەروازە", EDUCATIONAL_REVIEW_DONE: "پێداچوونەوەی فێرکاری تەواوە", TRANSLATION_REVIEW_DONE: "پێداچوونەوەی وەرگێڕان تەواوە", AWAITING_REVIEW: "چاوەڕێی پێداچوونەوە", REJECTED: "ڕەتکراوەتەوە",
};
const ERR: Record<string, string> = {
  REVIEWER_NAME_INVALID: "پشکنەر دەبێت کەسێکی ڕاستەقینە و بە ناو بێت (نەک AI یان خۆکار).",
  REVIEW_DATE_INVALID: "بەرواری پێداچوونەوە دەبێت ڕاستەقینە بێت و نەکەوێتە داهاتوو.",
  EVIDENCE_REQUIRED: "بەڵگە پێویستە (بەڵگەنامە، لیستی واژۆکراو، ئیمەیڵ…؛ کەمتر نەبێت لە ٨ پیت).",
  NOTE_REQUIRED_FOR_FAIL: "ڕەتکردنەوە پێویستی بە تێبینییەکە کە هەڵەکە ڕوون بکاتەوە.",
  CONFIRMATION_REQUIRED: "دووپاتکردنەوەکە نیشان بکە.",
  VALIDATION_FAILED: "پشکنینی خۆکاری ئەم بابەتە سەرنەکەوت.",
  TRANSLATION_REVIEW_FIRST: "سەرەتا پێداچوونەوەی وەرگێڕان دەبێت تێپەڕێت.",
  REVIEWERS_MUST_DIFFER: "پشکنەری فێرکاری دەبێت کەسێکی جیاواز بێت لە پشکنەری وەرگێڕان.",
  BOTH_REVIEWS_FIRST: "پێش پەسەندکردن هەردوو پێداچوونەوەکە دەبێت تێپەڕن.",
  STALE_TRANSLATION: "وەشانی پرسیارەکە گۆڕاوە. دەقە نوێیەکە بپشکنە و دووبارە هەوڵ بدەوە.",
  INVALID_TRANSLATIONS: "دەقی سۆرانی و بادینی بۆ پرسیار و ڕوونکردنەوە بنووسە. هەر خانەیەک تا ٢٠٠٠ پیت.",
  NO_TRANSLATION_CHANGES: "دەقی وەرگێڕانەکان وەک خۆیانن.",
  REVIEW_TABLE_MISSING: "خشتەی پشکنینی ئیتاڵیا ئامادە نییە.",
  ITALY_REVIEW_MIXED: "پرسیاری ئیتاڵی و بابەتی تر پێکەوە هەڵمەبژێرە.",
  UNKNOWN_ITEM: "بابەتی نەناسراو.", BAD_IDS: "١ تا ٢٠٠ بابەت هەڵبژێرە.", NOTE_TOO_LONG: "تێبینییەکە زۆر درێژە.",
  NETWORK: "پەیوەندی بە سێرڤەرەوە نییە.",
};
const stamp = (ms: number) => new Date(ms).toLocaleString("en-GB", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const ST_LABEL: Record<string, string> = { all: "هەموو دۆخەکان", awaiting: "چاوەڕێ", review: "لە پێداچوونەوەدا", published: "بڵاوکراو", rejected: "ڕەتکراو" };
const today = () => new Date().toISOString().slice(0, 10);

const SIGN_BY_ID = new Map<string, TrafficSign>(SIGNS.map((s) => [s.id, s]));
const IT_QUESTION_BY_ID = new Map(IT_QUESTIONS.map((question) => [question.id, question]));
const QUIZ_BY_ID = new Map<string, Question>(SIGN_QUIZ.map((q) => [q.id, q]));

/** Turn a refused submission into one Sorani sentence. */
function refusal(r: ApiResult): string {
  const first = Array.isArray(r.body.errors) ? (r.body.errors as { id: string; error: string }[])[0] : undefined;
  const code = first?.error ?? String(r.body.error ?? r.status);
  const more = Number(r.body.rejectedCount) > 1 ? ` + ${Number(r.body.rejectedCount) - 1} دیکە` : "";
  return `${ERR[code] ?? code}${first ? ` (${first.id}${more})` : ""} هیچ شتێک پاشەکەوت نەکرا.`;
}

/** Country totals; the server sends them, an older server is counted here from the same items. */
function countryCounts(data: Data): Record<Country, CountryCount> {
  if (data.counts.byCountry) return data.counts.byCountry;
  const out: Record<Country, CountryCount> = { de: { total: 0, published: 0, awaiting: 0, inReview: 0, rejected: 0 }, it: { total: 0, published: 0, awaiting: 0, inReview: 0, rejected: 0 } };
  for (const it of data.items) {
    const c = out[COUNTRY_OF[it.kind]];
    c.total++;
    if (it.publishable) c.published++;
    else if (it.status === "REJECTED") c.rejected++;
    else if (it.status === "AWAITING_REVIEW") c.awaiting++;
    else c.inReview++;
  }
  return out;
}

function Bi({ de, ckb }: { de: string; ckb: string }) {
  return <>
    <span className="rv-de" lang="de" dir="ltr">{de}</span>
    <span className="rv-ckb" lang="ckb" dir="rtl">{ckb}</span>
  </>;
}

function Stages({ it }: { it: Item }) {
  return (
    <ol className="rv-stages" aria-label="قۆناغەکانی پێداچوونەوە">
      {STAGES.map((s) => {
        const x = it.stages[s];
        return (
          <li key={s} className={`rv-stage ${x.state}`} data-testid={`stage-${s}`}>
            <b>{STAGE_LABEL[s].en}</b>
            <span>{x.state === "pass" ? "✔ تێپەڕی" : x.state === "fail" ? "✘ ڕەتکرایەوە" : "○ چاوەڕێ"}</span>
            {x.reviewer && <small>{x.reviewer} · {it.kind === "itQuestion" && s === "TRANSLATION_REVIEW" ? "پشکنەری سۆرانی و بادینی" : STAGE_LABEL[s].who} · <bdi dir="ltr">{x.reviewedOn}</bdi><br />بەڵگە: <bdi dir="ltr">{x.evidenceRef}</bdi>{x.note ? ` · ${x.note}` : ""}</small>}
          </li>
        );
      })}
    </ol>
  );
}

/** The reasons an item is not live, in Sorani with the gate's own code beside each one. */
function Reasons({ reasons, extra }: { reasons: string[]; extra?: string }) {
  const all = [...(extra ? [extra] : []), ...reasons];
  if (all.length === 0) return null;
  return (
    <details className="rv-checks rv-reasons" open data-testid="rv-reasons">
      <summary>بۆچی بڵاو نەکراوەتەوە ({all.length})</summary>
      <ul>{all.map((r, i) => <li key={i}>{reasonCkb(r)}{reasonCkb(r) !== r && <> <code dir="ltr">{r}</code></>}</li>)}</ul>
    </details>
  );
}

function ItemCard({ it, selected, onToggle }: { it: Item; selected: boolean; onToggle: () => void }) {
  const italian = it.kind === "itSign";
  const sign = italian ? undefined : it.kind === "sign" ? SIGN_BY_ID.get(it.id) : SIGN_BY_ID.get(QUIZ_BY_ID.get(it.id)?.signId ?? "");
  const q = it.kind === "signQuiz" ? QUIZ_BY_ID.get(it.id) : undefined;
  const itSign = italian ? itSignById(it.id) : undefined;
  const failing = it.checks.filter((c) => !c.ok);
  return (
    <article className="card rv-item" data-testid="review-item" data-id={it.id} data-status={it.status}>
      <header className="rv-head">
        <label className="rv-pick"><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`هەڵبژاردنی ${it.id}`} /> <code dir="ltr">{it.id}</code></label>
        <span className={`dr-badge ${it.publishable ? "ok" : it.status === "REJECTED" ? "bad" : "warn"}`} >{it.publishable ? "بڵاوکراوە (زیندوو)" : STATUS_LABEL[it.status] ?? it.status}</span>
      </header>
      <div className="rv-body">
        {sign && <SignIcon sign={sign} className="rv-sign" label={sign.name.de} />}
        {itSign && <img className="rv-sign" src={itSignSrc(itSign)} width={72} height={72} alt={itSign.name.it} />}
        <div className="rv-text">
          {it.kind === "sign" && sign && <>
            <Bi de={sign.name.de} ckb={sign.name.ckb} />
            <Bi de={sign.meaning.de} ckb={sign.meaning.ckb} />
          </>}
          {it.kind === "itSign" && itSign && <>
            <span className="rv-de" lang="it" dir="ltr">{itSign.name.it}</span>
            <span className="rv-ckb" lang="ckb" dir="rtl">{itSign.name.ckb}</span>
            {itSign.name.kmrArab && <span className="rv-ckb" lang="kmr-Arab" dir="rtl">{itSign.name.kmrArab}</span>}
          </>}
          {q && <>
            <Bi de={q.prompt.de} ckb={q.prompt.ckb} />
            <ul className="rv-options">{q.options.map((o) => (
              <li key={o.id} className={q.correct.includes(o.id) ? "right" : ""}><span dir="ltr">{o.id.toUpperCase()}{q.correct.includes(o.id) ? " ✔" : ""}</span><Bi de={o.text.de} ckb={o.text.ckb} /></li>
            ))}</ul>
            <Bi de={q.explanation.de} ckb={q.explanation.ckb} />
          </>}
        </div>
      </div>
      <p className="rv-refs">سەرچاوەی فەرمی: <bdi dir="ltr">{it.sourceRefs.join(" · ") || "—"}{sign && it.kind === "sign" ? ` · ${signSource(sign)}` : ""}</bdi></p>
      <details className="rv-checks">
        <summary>پشکنینی خۆکار: {it.valid ? `هەموو ${it.checks.length} پشکنین تێپەڕین` : `${failing.length} سەرنەکەوتوو`}</summary>
        <ul dir="ltr">{it.checks.map((c, i) => <li key={i} className={c.ok ? "ok" : "bad"}>{c.ok ? "✔" : "✘"} {c.label}</li>)}</ul>
      </details>
      <Stages it={it} />
      {!it.publishable && <Reasons reasons={it.reasons} />}
    </article>
  );
}

interface Decision { stage: Stage; outcome: "pass" | "fail"; reviewerName: string; reviewedOn: string; evidenceRef: string; note: string; confirm: boolean }

/**
 * One decision for every selected item: stage, outcome, the named human reviewer, the date and the evidence.
 * The server checks all of it again and records nothing if any selected item is refused.
 */
function BulkForm({ selected, eligibleCount, onSelectEligible, onClear, onSubmit, testId = "review-form" }: {
  selected: number;
  eligibleCount: (stage: Stage, outcome: "pass" | "fail") => number;
  onSelectEligible: (stage: Stage, outcome: "pass" | "fail") => void;
  onClear: () => void;
  onSubmit: (d: Decision) => Promise<{ ok: boolean; text: string }>;
  testId?: string;
}) {
  const [stage, setStage] = useState<Stage>("TRANSLATION_REVIEW");
  const [outcome, setOutcome] = useState<"pass" | "fail">("pass");
  const [reviewer, setReviewer] = useState("");
  const [date, setDate] = useState(today());
  const [evidence, setEvidence] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const canSubmit = selected > 0 && reviewer.trim().length >= 3 && evidence.trim().length >= 8 && (outcome === "fail" ? note.trim().length >= 5 : confirm) && !busy;
  const submit = async () => {
    setMsg(null); setBusy(true);
    const r = await onSubmit({ stage, outcome, reviewerName: reviewer, reviewedOn: date, evidenceRef: evidence, note, confirm });
    setBusy(false);
    setMsg({ kind: r.ok ? "ok" : "err", text: r.text });
    if (r.ok) setConfirm(false);
  };
  const id = `${testId}-h`;
  return (
    <section className="card rv-form" aria-labelledby={id} data-testid={testId}>
      <h3 id={id} className="dr-h">تۆمارکردنی بڕیاری پێداچوونەوە <small data-testid={`${testId}-selected`}>{selected} هەڵبژێردراو</small></h3>
      <div className="rv-grid">
        <label>قۆناغ<select value={stage} onChange={(e) => setStage(e.target.value as Stage)}>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s].en} — {STAGE_LABEL[s].who}</option>)}</select></label>
        <label>ئەنجام<select value={outcome} onChange={(e) => setOutcome(e.target.value as "pass" | "fail")}><option value="pass">تێپەڕی</option><option value="fail">ڕەتکردنەوە</option></select></label>
        <label>پشکنەر (ناوی تەواو)<input value={reviewer} onChange={(e) => setReviewer(e.target.value)} autoComplete="off" maxLength={80} dir="auto" /></label>
        <label>بەرواری پێداچوونەوە<input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="wide">بەڵگە (لیستی واژۆکراو، بەڵگەنامە، ئیمەیڵ)<input value={evidence} onChange={(e) => setEvidence(e.target.value)} autoComplete="off" maxLength={300} dir="auto" /></label>
        <label className="wide">تێبینی {outcome === "fail" ? "(پێویستە)" : "(ئارەزوومەندانە)"}<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} dir="auto" /></label>
      </div>
      {outcome === "pass" && <label className="rv-confirm"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> <span>دووپاتی دەکەمەوە کە کەسە ناوبراوەکە خۆی هەموو بابەتە هەڵبژێردراوەکانی وەک <b>{STAGE_LABEL[stage].who}</b> پشکنیوە و بەڵگەکە بوونی هەیە.</span></label>}
      <div className="dr-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSelectEligible(stage, outcome)}>هەڵبژاردنی گونجاوەکان لە لیستەکە ({eligibleCount(stage, outcome)})</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClear}>پاککردنەوە</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!canSubmit} onClick={() => void submit()} data-testid={`${testId === "review-form" ? "review" : testId}-submit`}>تۆمارکردنی بڕیار</button>
      </div>
      {msg && <div className={`dr-msg ${msg.kind}`} role={msg.kind === "err" ? "alert" : "status"}>{msg.text}</div>}
    </section>
  );
}

/** Whether an item may take this decision now (the server checks the same and more). */
const eligibleFor = (it: Item, stage: Stage, outcome: "pass" | "fail") => outcome === "fail" || (it.valid && (stage === "TRANSLATION_REVIEW"
  || (stage === "EDUCATIONAL_REVIEW" ? it.stages.TRANSLATION_REVIEW.state === "pass" : it.stages.TRANSLATION_REVIEW.state === "pass" && it.stages.EDUCATIONAL_REVIEW.state === "pass")));

export function DrReview({ api, onNeedStepUp }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [note, setNote] = useState("بارکردن…");
  const [country, setCountry] = useState<Country>("de");
  const [kind, setKind] = useState<"all" | Kind>("all");
  const [itView, setItView] = useState<"catalogue" | null>(null);
  const [catalogueTotal, setCatalogueTotal] = useState<number | null>(null);

  const apply = useCallback((r: ApiResult) => {
    if (r.status === 200) { setData(r.body as unknown as Data); setNote(""); }
    else setNote(r.status === 401 ? "دووبارە بچۆرە ژوورەوە لە /dr." : `لیستی پێداچوونەوە بار نەبوو (${r.status}). ڕەنگە migration ی 0006 جێبەجێ نەکرابێت.`);
  }, []);
  const load = useCallback(() => api("/api/dr/reviews").then(apply), [api, apply]);
  useEffect(() => {
    let alive = true;
    void api("/api/dr/reviews").then((r) => { if (alive) apply(r); });
    // The staged catalogue's size, read from the content database (one row is enough for the total).
    void api("/api/dr/italy/catalogue?limit=1").then((r) => {
      const counts = r.body.counts as { total?: number } | undefined;
      if (alive && r.status === 200) setCatalogueTotal(Number(counts?.total ?? r.body.total ?? 0));
    });
    return () => { alive = false; };
  }, [api, apply]);

  const go = (next: Country, k: "all" | Kind | "catalogue") => { setCountry(next); setKind(k === "catalogue" ? "all" : k); setItView(k === "catalogue" ? "catalogue" : null); };

  if (!data) return <p className="small muted" role="status">{note}</p>;
  const c = data.counts;
  const byCountry = countryCounts(data);
  const itSignsTotal = c.itSigns?.total ?? data.items.filter((i) => i.kind === "itSign").length;
  const itQuestionsTotal = c.itQuestions?.total ?? data.items.filter((i) => i.kind === "itQuestion").length;
  const pubReasons = new Map(data.items.filter((i) => i.kind === "itQuestion").map((i) => [i.id, i.reasons]));

  return (
    <div className="rv" data-testid="dr-review" lang="ckb" dir="rtl">
      <section className="card rv-reconcile" data-testid="rv-reconcile" aria-label="کۆی ژمارەکان">
        <p>کۆی بابەتەکانی پێداچوونەوە: <b data-testid="rv-total"><bdi dir="ltr">{c.total}</bdi></b> = ئەڵمانیا <b data-testid="rv-total-de"><bdi dir="ltr">{byCountry.de.total}</bdi></b> (<bdi dir="ltr">{c.signs.total}</bdi> هێما + <bdi dir="ltr">{c.signQuiz.total}</bdi> کویز) + ئیتاڵیا <b data-testid="rv-total-it"><bdi dir="ltr">{byCountry.it.total}</bdi></b> (<bdi dir="ltr">{itSignsTotal}</bdi> هێما + <bdi dir="ltr">{itQuestionsTotal}</bdi> پرسیار). بڵاوکراوە: <b data-testid="rv-total-published"><bdi dir="ltr">{c.published}</bdi></b>.</p>
        <p>کەتەلۆگی ئیتاڵیا: <b data-testid="rv-catalogue-total"><bdi dir="ltr">{catalogueTotal ?? "…"}</bdi></b> پرسیاری ڕەشنووس لە داتابەیسی ناوەڕۆک. ئەمانە لەم ژمارەیەی سەرەوەدا نین و هیچیان بۆ فێرخواز بڵاو ناکرێنەوە.</p>
      </section>

      <div className="rv-filters rv-country" role="group" aria-label="وڵات">
        <button type="button" className="dr-chip" aria-pressed={country === "de"} onClick={() => go("de", "all")} data-testid="rv-country-de">ئەڵمانیا · <bdi dir="ltr">{byCountry.de.total}</bdi></button>
        <button type="button" className="dr-chip" aria-pressed={country === "it"} onClick={() => go("it", "itSign")} data-testid="rv-country-it">ئیتاڵیا · <bdi dir="ltr">{byCountry.it.total}</bdi> + <bdi dir="ltr">{catalogueTotal ?? "…"}</bdi></button>
      </div>
      <div className="rv-filters" role="group" aria-label="جۆری ناوەڕۆک">
        {country === "de"
          ? (["all", "sign", "signQuiz"] as const).map((k) => <button key={k} type="button" className="dr-chip" aria-pressed={kind === k} onClick={() => go("de", k)} data-testid={`rv-kind-${k}`}>{KIND_LABEL[k]}</button>)
          : <>
            {(["itSign", "itQuestion"] as const).map((k) => <button key={k} type="button" className="dr-chip" aria-pressed={itView === null && kind === k} onClick={() => go("it", k)} data-testid={`rv-kind-${k}`}>{KIND_LABEL[k]}</button>)}
            <button type="button" className="dr-chip" aria-pressed={itView === "catalogue"} onClick={() => go("it", "catalogue")} data-testid="rv-kind-catalogue">کەتەلۆگی ڕەشنووس — ئیتاڵیا (<bdi dir="ltr">{catalogueTotal ?? "…"}</bdi>)</button>
          </>}
      </div>
      {/* Germany's kinds are reachable from Italy only through the country switch, and the other way round. */}
      {country === "it" && kind === "all" && itView === null && <p className="small muted">بەشێک هەڵبژێرە.</p>}

      {country === "de" && <ItemReview key="de" api={api} onNeedStepUp={onNeedStepUp} data={data} load={load}
        kinds={kind === "all" ? ["sign", "signQuiz"] : [kind]} source="de" tiles={<>
          <div className="dr-tile"><b data-testid="rv-signs">{c.signs.published} / {c.signs.total}</b><span>هێمای بڵاوکراوە</span></div>
          <div className="dr-tile"><b data-testid="rv-quiz">{c.signQuiz.published} / {c.signQuiz.total}</b><span>پرسیاری بڵاوکراوە</span></div>
          <div className="dr-tile"><b>{byCountry.de.awaiting}</b><span>چاوەڕێی پێداچوونەوە</span></div>
          <div className="dr-tile"><b>{byCountry.de.inReview}</b><span>لە پێداچوونەوەدایە</span></div>
          <div className="dr-tile"><b>{byCountry.de.rejected}</b><span>ڕەتکراوە</span></div>
        </>} rulesVersion={data.rulesVersion} />}

      {country === "it" && itView === null && kind === "itSign" && <ItemReview key="it" api={api} onNeedStepUp={onNeedStepUp} data={data} load={load}
        kinds={["itSign"]} source="it" tiles={<>
          <div className="dr-tile"><b data-testid="rv-it-signs">{c.itSigns?.published ?? 0} / {itSignsTotal}</b><span>هێمای ئیتاڵی بڵاوکراوە</span></div>
          <div className="dr-tile"><b data-testid="rv-it-questions">{c.itQuestions?.published ?? 0} / {itQuestionsTotal}</b><span>پرسیاری ئیتاڵی بڵاوکراوە</span></div>
          <div className="dr-tile"><b>{byCountry.it.awaiting}</b><span>چاوەڕێی پێداچوونەوە</span></div>
          <div className="dr-tile"><b>{byCountry.it.inReview}</b><span>لە پێداچوونەوەدایە</span></div>
          <div className="dr-tile"><b>{byCountry.it.rejected}</b><span>ڕەتکراوە</span></div>
        </>} rulesVersion={data.rulesVersionIt ?? data.rulesVersion} />}

      {country === "it" && itView === null && kind === "itQuestion" &&
        <ItalyQuestionReview api={api} onNeedStepUp={onNeedStepUp} items={data.italyQuestions ?? []} pubReasons={pubReasons} load={load} ready={data.tablesReady?.it === true} />}

      {country === "it" && itView === "catalogue" &&
        <Suspense fallback={<div aria-busy="true" />}><DrItalyCatalogue api={api} onNeedStepUp={onNeedStepUp} /></Suspense>}
    </div>
  );
}

/** The sign / sign-quiz list of one country, with its own tiles, filters, decision form and history. */
function ItemReview({ api, onNeedStepUp, data, load, kinds, source, tiles, rulesVersion }: Props & {
  data: Data; load: () => Promise<void>; kinds: Kind[]; source: Country; tiles: ReactNode; rulesVersion: string;
}) {
  const [status, setStatus] = useState<"all" | "awaiting" | "review" | "published" | "rejected">("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(20);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const ofKinds = useMemo(() => data.items.filter((it) => kinds.includes(it.kind)), [data, kinds]);
  const items = useMemo(() => ofKinds.filter((it) => {
    if (status === "published" && !it.publishable) return false;
    if (status === "rejected" && it.status !== "REJECTED") return false;
    if (status === "awaiting" && it.status !== "AWAITING_REVIEW") return false;
    if (status === "review" && (it.publishable || ["AWAITING_REVIEW", "REJECTED"].includes(it.status))) return false;
    if (q.trim()) {
      const itSign = it.kind === "itSign" ? itSignById(it.id) : undefined;
      const hay = `${it.id} ${it.sourceRefs.join(" ")} ${SIGN_BY_ID.get(it.id)?.name.de ?? ""} ${SIGN_BY_ID.get(it.id)?.name.ckb ?? ""} ${QUIZ_BY_ID.get(it.id)?.prompt.de ?? ""} ${QUIZ_BY_ID.get(it.id)?.prompt.ckb ?? ""} ${itSign?.name.it ?? ""} ${itSign?.name.ckb ?? ""}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  }), [ofKinds, status, q]);
  const ids = new Set(ofKinds.map((i) => i.id));
  const history = data.history.filter((h) => (h.source ?? "de") === source && ids.has(h.content_id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const submit = async (d: Decision): Promise<{ ok: boolean; text: string }> => {
    const run = async (): Promise<{ ok: boolean; text: string }> => {
      const r = await api("/api/dr/reviews", { ...d, ids: [...sel] });
      if (r.status === 200) { setSel(new Set()); await load(); return { ok: true, text: `${String(r.body.recorded)} بڕیار تۆمارکرا. بابەت تەنها کاتێک خۆکار بڵاو دەبێتەوە کە هەموو پێداچوونەوە پێویستەکان دروست بن.` }; }
      if (r.body.error === "STEP_UP_REQUIRED") { onNeedStepUp(async () => { await run(); }); return { ok: false, text: "کۆدی پشتڕاستکردنەوە پێویستە؛ دوای نووسینی کۆدەکە بڕیارەکە دەنێردرێت." }; }
      return { ok: false, text: refusal(r) };
    };
    return run();
  };
  const revoke = async (rowId: number, rowSource: "de" | "it" = "de") => {
    const reason = window.prompt("هۆکاری هەڵوەشاندنەوەی ئەم بڕیارە (کەمتر نەبێت لە ٥ پیت):") ?? "";
    if (reason.trim().length < 5) return;
    const run = async (): Promise<void> => {
      const r = await api("/api/dr/reviews/revoke", { rowId, source: rowSource, reason });
      if (r.status === 200) { setMsg({ kind: "ok", text: "بڕیارەکە هەڵوەشێنرایەوە (لە مێژوودا دەمێنێتەوە)." }); await load(); }
      else if (r.body.error === "STEP_UP_REQUIRED") onNeedStepUp(run);
      else setMsg({ kind: "err", text: `هەڵوەشاندنەوە سەرنەکەوت (${r.status}).` });
    };
    await run();
  };

  return <>
    <div className="dr-grid">{tiles}</div>
    <p className="small muted">ڕیزبەندی: ١) وەرگێڕی سۆرانی ← ٢) مامۆستای شۆفێری (کەسێکی جیاواز) ← ٣) پەسەندکردنی خاوەن. هەر بڕیارێک پێویستی بە پشکنەرێکی مرۆیی بە ناو، بەروار و بەڵگە هەیە. کاتێک دەروازەی بڵاوکردنەوە تێپەڕێت ناوەڕۆک خۆکار بڵاو دەبێتەوە؛ ناوەڕۆکی پەسەندنەکراو شاراوە دەمێنێتەوە. وەشانی یاساکانی تاقیکردنەوە: <code dir="ltr">{rulesVersion}</code>.</p>
    {data.tablesReady && !data.tablesReady[source] && <p className="dr-msg err" data-testid={`rv-${source}-table-missing`}>خشتەی پێداچوونەوەی {source === "it" ? "ئیتاڵیا" : "ئەڵمانیا"} لە داتابەیسدا نییە. تکایە کۆچەکان جێبەجێ بکە پێش تۆمارکردنی بڕیار؛ تا ئەو کاتە هیچ ماددەیەکی ئەم وڵاتە بڵاو نابێتەوە.</p>}
    <div className="rv-filters" role="group" aria-label="فلتەرەکان">
      {(["all", "awaiting", "review", "published", "rejected"] as const).map((k) => <button key={k} type="button" className="dr-chip" aria-pressed={status === k} onClick={() => setStatus(k)}>{ST_LABEL[k]}</button>)}
      <input type="search" className="rv-search" placeholder="گەڕان: ناسنامە، هێما، دەق…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="گەڕان" dir="auto" />
    </div>

    <BulkForm selected={sel.size}
      eligibleCount={(stage, outcome) => items.filter((i) => eligibleFor(i, stage, outcome)).length}
      onSelectEligible={(stage, outcome) => setSel(new Set(items.filter((i) => eligibleFor(i, stage, outcome)).map((i) => i.id)))}
      onClear={() => setSel(new Set())} onSubmit={submit} />
    {msg && <div className={`dr-msg ${msg.kind}`} role={msg.kind === "err" ? "alert" : "status"}>{msg.text}</div>}

    <p className="small muted" role="status" data-testid="rv-shown">{items.length} بابەت پیشان دراوە لە <bdi dir="ltr">{ofKinds.length}</bdi></p>
    <div className="rv-list">{items.slice(0, limit).map((it) => <ItemCard key={it.id} it={it} selected={sel.has(it.id)} onToggle={() => toggle(it.id)} />)}</div>
    {items.length > limit && <button type="button" className="btn btn-secondary" data-testid="review-more" onClick={() => setLimit((n) => n + 30)}>پیشاندانی زیاتر ({items.length - limit} ماوە)</button>}

    <section className="card" aria-labelledby={`rv-hist-${source}`}>
      <h3 id={`rv-hist-${source}`} className="dr-h">مێژووی پێداچوونەوە <small>دوایین ٣٠٠</small></h3>
      <div className="dr-scroll" tabIndex={0} role="region" aria-label="خشتەی مێژووی پێداچوونەوە"><table className="dr-table"><thead><tr><th>تۆمارکرا</th><th>بابەت</th><th>قۆناغ</th><th>ئەنجام</th><th>پشکنەر</th><th>بەروار</th><th>بەڵگە</th><th>تۆمارکەر</th><th /></tr></thead><tbody>
        {history.length === 0 && <tr><td colSpan={9}>هێشتا هیچ پێداچوونەوەیەکی مرۆیی تۆمار نەکراوە.</td></tr>}
        {history.map((h) => <tr key={`${h.source ?? "de"}-${h.id}`} className={h.revoked_at ? "rv-revoked" : ""}><td>{stamp(h.recorded_at)}</td><td>{h.content_id}</td><td>{h.stage}</td><td>{h.outcome}{h.revoked_at ? ` (هەڵوەشێنراوەتەوە: ${h.revoke_reason})` : ""}</td><td>{h.reviewer_name}</td><td>{h.reviewed_on}</td><td>{h.evidence_ref}</td><td>{h.recorded_by}</td><td>{!h.revoked_at && <button type="button" className="btn btn-secondary btn-sm" onClick={() => void revoke(h.id, h.source ?? "de")}>هەڵوەشاندنەوە</button>}</td></tr>)}
      </tbody></table></div>
    </section>
  </>;
}

const IT_STATUS = {
  approved: "پەسەندکراو",
  rejected: "ڕەتکراوە",
  pending: "چاوەڕێی پشکنین",
} as const;
const TRANSLATION_FIELDS = [["ckb", "سۆرانی", "ckb"], ["kmrArab", "بادینی", "kmr-Arab"]] as const;
const TEXT_FIELDS = [["prompt", "پرسیار"], ["explanation", "ڕوونکردنەوە"]] as const;
type ItalyStatus = keyof typeof IT_STATUS;
type ItalyAction = "approve" | "reject" | "edit";

function italyStatus(item: ItalyQuestionItem): ItalyStatus {
  if (item.status === "REJECTED") return "rejected";
  if (item.status === "APPROVED") return "approved";
  return "pending";
}

function ItalyQuestionReview({ items, ready, pubReasons, ...props }: Props & {
  items: ItalyQuestionItem[];
  ready: boolean;
  pubReasons: Map<string, string[]>;
  load: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | ItalyStatus>("all");
  const [message, setMessage] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const reviewed = items.filter((item) => italyStatus(item) !== "pending").length;
  const percent = items.length ? Math.round(100 * reviewed / items.length) : 0;
  const search = query.trim().normalize("NFC").toLowerCase();
  const matching = items.filter((item) => {
    if (filter !== "all" && italyStatus(item) !== filter) return false;
    const prompt = IT_QUESTION_BY_ID.get(item.id)?.prompt.it ?? "";
    return [item.id, prompt, item.translations.prompt.ckb, item.translations.prompt.kmrArab]
      .some((value) => value.normalize("NFC").toLowerCase().includes(search));
  });
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const submit = async (d: Decision): Promise<{ ok: boolean; text: string }> => {
    const chosen = items.filter((i) => sel.has(i.id));
    // Each question carries the fingerprint of the wording the reviewer saw on this screen.
    const body = { ...d, ids: chosen.map((i) => i.id), questionHashes: Object.fromEntries(chosen.map((i) => [i.id, i.hash])) };
    const run = async (): Promise<{ ok: boolean; text: string }> => {
      const r = await props.api("/api/dr/reviews", body);
      if (r.status === 200) { setSel(new Set()); await props.load(); return { ok: true, text: `${String(r.body.recorded)} بڕیار تۆمارکرا. ئەمە بڕیاری دەقەکەیە و پرسیار بڵاو ناکاتەوە.` }; }
      if (r.body.error === "STEP_UP_REQUIRED") { props.onNeedStepUp(async () => { await run(); }); return { ok: false, text: "کۆدی پشتڕاستکردنەوە پێویستە؛ دوای نووسینی کۆدەکە بڕیارەکە دەنێردرێت." }; }
      if (r.body.error === "STALE_TRANSLATION") await props.load();
      return { ok: false, text: refusal(r) };
    };
    return run();
  };

  if (!ready) return <p className="dr-msg err" role="alert">{ERR.REVIEW_TABLE_MISSING}</p>;
  return (
    <section className="rv-list" data-testid="rv-italy-questions" dir="rtl">
      <h3 className="dr-h">پشکنینی مرۆیی پرسیارەکانی ئیتاڵیا</h3>
      <p role="status">پرسیاری پشکنراو <bdi dir="ltr">{reviewed} / {items.length} ({percent}%)</bdi></p>
      <p className="small muted">{EDITORIAL_ONLY_CKB}</p>
      <div className="rv-filters">
        <label>دۆخی پشکنین <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} data-testid="rv-italy-filter">
          <option value="all">هەموو دۆخەکان</option>
          {Object.entries(IT_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <input type="search" className="rv-search" dir="auto" value={query} onChange={(e) => setQuery(e.target.value)}
          aria-label="گەڕان بە ناسنامە یان دەقی پرسیار" placeholder="ناسنامە یان دەقی پرسیار" />
      </div>
      <BulkForm testId="rv-italy-bulk" selected={sel.size}
        eligibleCount={(stage, outcome) => matching.filter((i) => eligibleFor(i, stage, outcome)).length}
        onSelectEligible={(stage, outcome) => setSel(new Set(matching.filter((i) => eligibleFor(i, stage, outcome)).map((i) => i.id)))}
        onClear={() => setSel(new Set())} onSubmit={submit} />
      {message && <p className="dr-msg ok" role="status">{message}</p>}
      {matching.length === 0 && <p role="status">هیچ پرسیارێک نەدۆزرایەوە.</p>}
      {matching.map((item) => <ItalyQuestionCard key={item.id} item={item} onSaved={setMessage} selected={sel.has(item.id)} onToggle={() => toggle(item.id)}
        reasons={pubReasons.get(item.id) ?? []} {...props} />)}
    </section>
  );
}

function ItalyQuestionCard({ item, api, onNeedStepUp, load, onSaved, selected, onToggle, reasons }: Props & {
  item: ItalyQuestionItem;
  load: () => Promise<void>;
  onSaved: (message: string) => void;
  selected: boolean;
  onToggle: () => void;
  reasons: string[];
}) {
  const [action, setAction] = useState<ItalyAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ItalyHistory | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const question = IT_QUESTION_BY_ID.get(item.id);
  if (!question) return null;
  const sign = question.signId ? itSignById(question.signId) : undefined;
  const status = italyStatus(item);
  const historyPath = `/api/dr/reviews/translation?id=${encodeURIComponent(item.id)}`;
  const readHistory = async () => {
    setHistoryError(false);
    const result = await api(historyPath);
    if (result.status === 200) setHistory(result.body as unknown as ItalyHistory);
    else setHistoryError(true);
  };
  const open = (next: ItalyAction) => {
    setError("");
    onSaved("");
    setAction(next);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const value = (name: string) => String(fields.get(name) ?? "");
    const common = {
      questionHash: item.hash,
      reviewerName: value("reviewer"),
      reviewedOn: value("date"),
      evidenceRef: value("evidence"),
      note: value("note"),
    };
    const editing = action === "edit";
    const path = editing ? "/api/dr/reviews/translation" : "/api/dr/reviews";
    const body = editing ? {
      ...common, id: item.id,
      translations: {
        prompt: { ckb: value("prompt-ckb"), kmrArab: value("prompt-kmrArab") },
        explanation: { ckb: value("explanation-ckb"), kmrArab: value("explanation-kmrArab") },
      },
    } : {
      ...common, ids: [item.id], stage: value("stage"), outcome: action === "approve" ? "pass" : "fail", confirm: fields.has("confirm"),
    };
    const run = async () => {
      setBusy(true);
      setError("");
      const result = await api(path, body);
      setBusy(false);
      if (result.body.error === "STEP_UP_REQUIRED") {
        onNeedStepUp(run);
      } else if (result.status === 200) {
        setAction(null);
        onSaved(editing ? "وەرگێڕانەکە پاشەکەوت کرا و پرسیارەکە چاوەڕێی پشکنینە." : "بڕیارەکە تۆمار کرا.");
        await load();
        if (history) await readHistory();
      } else {
        const code = String(result.body.error ?? result.status);
        setError(ERR[code] ?? code);
        if (code === "STALE_TRANSLATION") {
          setAction(null);
          await load();
        }
      }
    };
    await run();
  };

  return (
    <article className="card rv-item rv-italy-item" data-testid="review-item" data-id={item.id} data-status={status}>
      <header className="rv-head">
        <label className="rv-pick"><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`هەڵبژاردنی ${item.id}`} /> <code dir="ltr">{item.id}</code></label>
        <span className={`dr-badge ${status === "approved" ? "ok" : status === "rejected" ? "bad" : "warn"}`}>{IT_STATUS[status]}</span>
      </header>
      <div className="rv-body">
        {sign && <img className="rv-sign" src={itSignSrc(sign)} width={96} height={96} lang="it" alt={sign.name.it} />}
        <div className="rv-text">
          {TEXT_FIELDS.map(([field, label]) => <div key={field} className="rv-text">
            <strong>{label}</strong>
            <span className="rv-de" lang="it" dir="ltr">{question[field].it}</span>
            {TRANSLATION_FIELDS.map(([language, name, lang]) => <span key={language} dir="rtl" lang={lang}>
              <b>{name}</b> {item.translations[field][language] || "—"}
            </span>)}
          </div>)}
          <p>وەڵامی دروست <strong lang="it" dir="ltr">{question.answer ? "VERO" : "FALSO"}</strong></p>
        </div>
      </div>
      <p className="rv-refs">سەرچاوە <bdi dir="ltr">{item.sourceRefs.join(" · ")}</bdi></p>
      <Stages it={item} />
      <Reasons reasons={reasons} extra={EDITORIAL_ONLY_CKB} />
      <div className="dr-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} aria-expanded={action === "approve"} onClick={() => open("approve")}>پەسەندکردن</button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} aria-expanded={action === "edit"} onClick={() => open("edit")}>دەستکاریکردنی وەرگێڕان</button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} aria-expanded={action === "reject"} onClick={() => open("reject")}>ڕەتکردنەوە</button>
      </div>
      {action && <form key={`${action}-${item.hash}`} className="rv-form" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy} className="rv-grid rv-italy-fields">
          <legend>{action === "edit" ? "دەستکاریکردنی وەرگێڕان" : action === "approve" ? "پەسەندکردنی قۆناغ" : "ڕەتکردنەوەی قۆناغ"}</legend>
          {action === "edit" ? TEXT_FIELDS.flatMap(([field, label]) => TRANSLATION_FIELDS.map(([language, name, lang]) =>
            <label key={`${field}-${language}`} className="wide">{label} بە {name}
              <textarea name={`${field}-${language}`} defaultValue={item.translations[field][language]} dir="rtl" lang={lang} required maxLength={2000} rows={2} />
            </label>,
          )) : <label>قۆناغ<select name="stage" defaultValue={STAGES.find((stage) => item.stages[stage].state !== "pass") ?? "APPROVED"}>
            {STAGES.map((stage) => <option key={stage} value={stage}>{STAGE_LABEL[stage].en}</option>)}
          </select></label>}
          <label>ناوی تەواوی پشکنەر<input name="reviewer" dir="auto" required minLength={3} maxLength={80} /></label>
          <label>بەرواری پشکنین<input name="date" type="date" defaultValue={today()} max={today()} required /></label>
          <label className="wide">بەڵگە<input name="evidence" dir="auto" required minLength={8} maxLength={300} /></label>
          <label className="wide">تێبینی<input name="note" dir="auto" required={action === "reject"} minLength={action === "reject" ? 5 : undefined} maxLength={500} /></label>
        </fieldset>
        {action === "approve" && <label className="rv-confirm">
          <input type="checkbox" name="confirm" required disabled={busy} /> <span>دووپاتی دەکەمەوە کە پشکنەرە ناوبراوەکە خۆی ئەم وەشانەی پرسیارەکەی پشکنیوە.</span>
        </label>}
        <div className="dr-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{action === "edit" ? "پاشەکەوتکردن" : "تۆمارکردنی بڕیار"}</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { setAction(null); setError(""); }}>پاشگەزبوونەوە</button>
        </div>
      </form>}
      {error && <p className="dr-msg err" role="alert">{error}</p>}
      <details className="rv-checks" onToggle={(event) => { if (event.currentTarget.open) void readHistory(); }}>
        <summary>مێژووی پشکنین و گۆڕانکارییەکان</summary>
        {historyError && <p role="alert">مێژوو بار نەبوو. دووبارە هەوڵ بدەوە.</p>}
        {!history && !historyError && <p role="status">بارکردن…</p>}
        {history && <ItalyQuestionHistory history={history} />}
      </details>
    </article>
  );
}

function ItalyQuestionHistory({ history }: { history: ItalyHistory }) {
  const timeline = [
    ...history.decisions.map((decision) => ({ at: decision.recorded_at, decision })),
    ...history.edits.map((edit) => ({ at: edit.at, edit })),
  ].sort((a, b) => b.at - a.at);
  if (!timeline.length) return <p>هێشتا مێژوویەک تۆمار نەکراوە.</p>;
  return <ul>
    {timeline.map((entry) => {
      if ("decision" in entry) {
        const row = entry.decision;
        return <li key={`decision-${row.id}`}>
          {STAGE_LABEL[row.stage].en} · {row.outcome === "pass" ? "تێپەڕی" : "ڕەتکرایەوە"} · <bdi>{row.reviewer_name}</bdi> · <bdi>{row.reviewed_on}</bdi> · <bdi>{row.evidence_ref}</bdi>
          {row.note && <> · <bdi>{row.note}</bdi></>}
          {row.revoked_at && <> · هەڵوەشێنراوەتەوە · <bdi>{row.revoke_reason}</bdi></>}
          {" · "}<bdi>{stamp(row.recorded_at)}</bdi> · <bdi>{row.recorded_by}</bdi>
        </li>;
      }
      const { edit } = entry;
      return <li key={`edit-${edit.id}`}>
        <details>
          <summary>دەستکاریی وەرگێڕان · <bdi>{edit.reviewerName}</bdi> · <bdi>{edit.reviewedOn}</bdi> · <bdi>{stamp(edit.at)}</bdi></summary>
          <p><bdi>{edit.evidenceRef}</bdi> · <bdi>{edit.actor}</bdi>{edit.note && <> · <bdi>{edit.note}</bdi></>}</p>
          {TEXT_FIELDS.map(([field, label]) => TRANSLATION_FIELDS.map(([language, name, lang]) =>
            edit.before[field][language] !== edit.after[field][language] && <div key={`${field}-${language}`}>
              <strong>{label} بە {name}</strong>
              <p>پێشوو <bdi lang={lang} dir="rtl">{edit.before[field][language] || "—"}</bdi></p>
              <p>نوێ <bdi lang={lang} dir="rtl">{edit.after[field][language]}</bdi></p>
            </div>,
          ))}
        </details>
      </li>;
    })}
  </ul>;
}
