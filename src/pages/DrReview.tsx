import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { SignIcon } from "../components/SignIcon";
import { SIGNS, signSource } from "../content/signs";
import { SIGN_QUIZ } from "../content/signQuiz";
import { IT_QUESTIONS } from "../content/italy/questions";
import { IT_SIGNS, itSignById, itSignSrc } from "../content/italy/signs";
import type { ItalyTranslations } from "../../worker/dr/italyQuestionReview";
import type { Question, TrafficSign } from "../content/types";
import "./dr.css";

/**
 * /dr → Content Review & Approval for the Verkehrszeichen release (40 signs, 89 quiz questions) and
 * for Italian signs and true/false questions.
 * The screen records decisions of NAMED HUMAN reviewers (Sorani translator → driving instructor → owner).
 * Italian question decisions are recorded separately from eligibility for public release.
 */
type Stage = "TRANSLATION_REVIEW" | "EDUCATIONAL_REVIEW" | "APPROVED";
interface StageInfo { state: "pass" | "fail" | "pending"; reviewer?: string; role?: string; reviewedOn?: string; evidenceRef?: string; note?: string; rowId?: number; rowSource?: "de" | "it" }
type Kind = "sign" | "signQuiz" | "itSign" | "itQuestion";
interface Item {
  id: string; kind: Kind; status: string; publishable: boolean; reasons: string[]; valid: boolean;
  checks: { ok: boolean; label: string }[]; sourceRefs: string[]; stages: Record<Stage, StageInfo>;
}
interface ItalyQuestionItem extends Item { hash: string; translations: ItalyTranslations }
interface TranslationEdit { id: number; at: number; actor: string; reviewerName: string; reviewedOn: string; evidenceRef: string; note: string; before: ItalyTranslations; after: ItalyTranslations }
interface ItalyHistory { decisions: HistoryRow[]; edits: TranslationEdit[] }
interface HistoryRow { id: number; source?: "de" | "it"; content_id: string; stage: Stage; outcome: string; reviewer_name: string; reviewer_role: string; reviewed_on: string; evidence_ref: string; note: string; recorded_by: string; recorded_at: number; revoked_at: number | null; revoke_reason: string | null }
interface KindCount { total: number; published: number }
interface Data { tablesReady?: { de: boolean; it: boolean }; items: Item[]; italyQuestions?: ItalyQuestionItem[]; counts: { total: number; published: number; awaiting: number; inReview: number; rejected: number; signs: KindCount; signQuiz: KindCount; itSigns: KindCount; itQuestions: KindCount }; history: HistoryRow[]; rulesVersion: string; rulesVersionIt?: string }
type ApiResult = { status: number; body: Record<string, unknown> };
interface Props { api: (path: string, body?: unknown) => Promise<ApiResult>; onNeedStepUp: (retry: () => Promise<void>) => void }

const STAGES: Stage[] = ["TRANSLATION_REVIEW", "EDUCATIONAL_REVIEW", "APPROVED"];
const KIND_LABEL: Record<"all" | Kind, string> = {
  all: "هەموو هێما و کویزەکان",
  sign: `هێماکان — ئەڵمانیا (${SIGNS.length})`,
  signQuiz: `کویزی هێما — ئەڵمانیا (${SIGN_QUIZ.length})`,
  itSign: `هێماکان — ئیتاڵیا (${IT_SIGNS.length})`,
  itQuestion: `پرسیار — ئیتاڵیا (${IT_QUESTIONS.length})`,
};
const STAGE_LABEL: Record<Stage, { en: string; ckb: string; who: string }> = {
  TRANSLATION_REVIEW: { en: "پێداچوونەوەی وەرگێڕان", ckb: "", who: "وەرگێڕی سۆرانی" },
  EDUCATIONAL_REVIEW: { en: "پێداچوونەوەی فێرکاری", ckb: "", who: "مامۆستای شۆفێری" },
  APPROVED: { en: "پەسەندکردنی کۆتایی (Super Admin)", ckb: "", who: "خاوەنی ناوەڕۆک" },
};
const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "بڵاوکراوە", APPROVED_WAITING: "پەسەندکراوە، چاوەڕێی دەروازە", EDUCATIONAL_REVIEW_DONE: "پێداچوونەوەی فێرکاری تەواوە", TRANSLATION_REVIEW_DONE: "پێداچوونەوەی وەرگێڕان تەواوە", AWAITING_REVIEW: "چاوەڕێی پێداچوونەوە", REJECTED: "ڕەتکراوەتەوە",
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
  UNKNOWN_ITEM: "بابەتی نەناسراو.", BAD_IDS: "١ تا ٢٠٠ بابەت هەڵبژێرە.", NOTE_TOO_LONG: "تێبینییەکە زۆر درێژە.",
};
const stamp = (ms: number) => new Date(ms).toLocaleString("en-GB", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const ST_LABEL: Record<string, string> = { all: "هەموو دۆخەکان", awaiting: "چاوەڕێ", review: "لە پێداچوونەوەدا", published: "بڵاوکراو", rejected: "ڕەتکراو" };
const today = () => new Date().toISOString().slice(0, 10);

const SIGN_BY_ID = new Map<string, TrafficSign>(SIGNS.map((s) => [s.id, s]));
const IT_QUESTION_BY_ID = new Map(IT_QUESTIONS.map((question) => [question.id, question]));
const QUIZ_BY_ID = new Map<string, Question>(SIGN_QUIZ.map((q) => [q.id, q]));

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
          {it.kind === "itSign" && itSign && <Bi de={itSign.name.it} ckb={itSign.name.ckb} />}
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
      {!it.publishable && it.reasons.length > 0 && <details className="rv-checks"><summary>بۆچی هێشتا بڵاو نەکراوەتەوە ({it.reasons.length})</summary><ul dir="ltr">{it.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul></details>}
    </article>
  );
}

export function DrReview({ api, onNeedStepUp }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [note, setNote] = useState("بارکردن…");
  const [kind, setKind] = useState<"all" | Kind>("all");
  const [status, setStatus] = useState<"all" | "awaiting" | "review" | "published" | "rejected">("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<Stage>("TRANSLATION_REVIEW");
  const [outcome, setOutcome] = useState<"pass" | "fail">("pass");
  const [reviewer, setReviewer] = useState("");
  const [date, setDate] = useState(today());
  const [evidence, setEvidence] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(20);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const apply = useCallback((r: ApiResult) => {
    if (r.status === 200) { setData(r.body as unknown as Data); setNote(""); }
    else setNote(r.status === 401 ? "دووبارە بچۆرە ژوورەوە لە /dr." : `لیستی پێداچوونەوە بار نەبوو (${r.status}). ڕەنگە migration ی 0006 جێبەجێ نەکرابێت.`);
  }, []);
  const load = useCallback(() => api("/api/dr/reviews").then(apply), [api, apply]);
  useEffect(() => {
    let alive = true;
    void api("/api/dr/reviews").then((r) => { if (alive) apply(r); });
    return () => { alive = false; };
  }, [api, apply]);

  const items = useMemo(() => (data?.items ?? []).filter((it) => {
    if (it.kind === "itQuestion" || (kind !== "all" && it.kind !== kind)) return false;
    if (status === "published" && !it.publishable) return false;
    if (status === "rejected" && it.status !== "REJECTED") return false;
    if (status === "awaiting" && it.status !== "AWAITING_REVIEW") return false;
    if (status === "review" && (it.publishable || ["AWAITING_REVIEW", "REJECTED"].includes(it.status))) return false;
    if (q.trim()) {
      const hay = `${it.id} ${it.sourceRefs.join(" ")} ${SIGN_BY_ID.get(it.id)?.name.de ?? ""} ${QUIZ_BY_ID.get(it.id)?.prompt.de ?? ""}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  }), [data, kind, status, q]);

  const eligible = (it: Item) => outcome === "fail" || (it.valid && (stage === "TRANSLATION_REVIEW" || (stage === "EDUCATIONAL_REVIEW" ? it.stages.TRANSLATION_REVIEW.state === "pass" : it.stages.TRANSLATION_REVIEW.state === "pass" && it.stages.EDUCATIONAL_REVIEW.state === "pass")));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectEligible = () => setSel(new Set(items.filter(eligible).map((i) => i.id)));

  const submit = async () => {
    const ids = [...sel];
    setMsg(null);
    const run = async (): Promise<void> => {
      setBusy(true);
      const r = await api("/api/dr/reviews", { stage, outcome, reviewerName: reviewer, reviewedOn: date, evidenceRef: evidence, note: reviewNote, ids, confirm });
      setBusy(false);
      if (r.status === 200) { setMsg({ kind: "ok", text: `${String(r.body.recorded)} بڕیار تۆمارکرا. بابەت تەنها کاتێک خۆکار بڵاو دەبێتەوە کە هەموو پێداچوونەوە پێویستەکان دروست بن.` }); setSel(new Set()); setConfirm(false); await load(); return; }
      if (r.body.error === "STEP_UP_REQUIRED") { onNeedStepUp(run); return; }
      const first = Array.isArray(r.body.errors) ? (r.body.errors as { id: string; error: string }[])[0] : undefined;
      const code = first?.error ?? String(r.body.error ?? r.status);
      setMsg({ kind: "err", text: `${ERR[code] ?? code}${first ? ` (${first.id}${Number(r.body.rejectedCount) > 1 ? ` + ${Number(r.body.rejectedCount) - 1} دیکە` : ""})` : ""} هیچ شتێک پاشەکەوت نەکرا.` });
    };
    await run();
  };
  const revoke = async (rowId: number, source: "de" | "it" = "de") => {
    const reason = window.prompt("هۆکاری هەڵوەشاندنەوەی ئەم بڕیارە (کەمتر نەبێت لە ٥ پیت):") ?? "";
    if (reason.trim().length < 5) return;
    const run = async (): Promise<void> => {
      const r = await api("/api/dr/reviews/revoke", { rowId, source, reason });
      if (r.status === 200) { setMsg({ kind: "ok", text: "بڕیارەکە هەڵوەشێنرایەوە (لە مێژوودا دەمێنێتەوە)." }); await load(); }
      else if (r.body.error === "STEP_UP_REQUIRED") onNeedStepUp(run);
      else setMsg({ kind: "err", text: `هەڵوەشاندنەوە سەرنەکەوت (${r.status}).` });
    };
    await run();
  };

  if (!data) return <p className="small muted" role="status">{note}</p>;
  const c = data.counts;
  const canSubmit = sel.size > 0 && reviewer.trim().length >= 3 && evidence.trim().length >= 8 && (outcome === "fail" ? reviewNote.trim().length >= 5 : confirm) && !busy;

  return (
    <div className="rv" data-testid="dr-review" lang="ckb">
      <div className="rv-filters" role="group" aria-label="جۆری ناوەڕۆک">
        {(["all", "sign", "signQuiz", "itSign", "itQuestion"] as const).map((k) => <button key={k} type="button" className="dr-chip" aria-pressed={kind === k} onClick={() => setKind(k)} data-testid={`rv-kind-${k}`}>{KIND_LABEL[k]}</button>)}
      </div>
      {kind === "itQuestion" ? (
        <ItalyQuestionReview api={api} onNeedStepUp={onNeedStepUp} items={data.italyQuestions ?? []} load={load} ready={data.tablesReady?.it === true} />
      ) : <>
      <div className="dr-grid">
        <div className="dr-tile"><b data-testid="rv-signs">{c.signs.published} / {c.signs.total}</b><span>هێمای بڵاوکراوە</span></div>
        <div className="dr-tile"><b data-testid="rv-quiz">{c.signQuiz.published} / {c.signQuiz.total}</b><span>پرسیاری بڵاوکراوە</span></div>
        <div className="dr-tile"><b>{c.awaiting}</b><span>چاوەڕێی پێداچوونەوە</span></div>
        <div className="dr-tile"><b>{c.inReview}</b><span>لە پێداچوونەوەدایە</span></div>
        <div className="dr-tile"><b>{c.rejected}</b><span>ڕەتکراوە</span></div>
      </div>
      <p className="small muted">ڕیزبەندی: ١) وەرگێڕی سۆرانی ← ٢) مامۆستای شۆفێری (کەسێکی جیاواز) ← ٣) پەسەندکردنی خاوەن. هەر بڕیارێک پێویستی بە پشکنەرێکی مرۆیی بە ناو، بەروار و بەڵگە هەیە. کاتێک دەروازەی بڵاوکردنەوە تێپەڕێت ناوەڕۆک خۆکار بڵاو دەبێتەوە؛ ناوەڕۆکی پەسەندنەکراو شاراوە دەمێنێتەوە. وەشانی یاساکانی تاقیکردنەوە: <code dir="ltr">{data.rulesVersion}</code>.</p>

      {data.tablesReady && !data.tablesReady.it && <p className="dr-msg err" data-testid="rv-it-table-missing">خشتەی پێداچوونەوەی ئیتاڵیا لە داتابەیسدا نییە. تکایە کۆچەکان جێبەجێ بکە (migrations/0007) پێش تۆمارکردنی بڕیار بۆ ئیتاڵیا؛ تا ئەو کاتە هیچ ماددەیەکی ئیتاڵی بڵاو نابێتەوە.</p>}
      <div className="rv-filters" role="group" aria-label="فلتەرەکان">
        {(["all", "awaiting", "review", "published", "rejected"] as const).map((k) => <button key={k} type="button" className="dr-chip" aria-pressed={status === k} onClick={() => setStatus(k)}>{ST_LABEL[k]}</button>)}
        <input type="search" className="rv-search" placeholder="گەڕان: ناسنامە، هێما، دەق…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="گەڕان" />
      </div>

      <section className="card rv-form" aria-labelledby="rv-form-h" data-testid="review-form">
        <h3 id="rv-form-h" className="dr-h">تۆمارکردنی بڕیاری پێداچوونەوە <small>{sel.size} هەڵبژێردراو</small></h3>
        <div className="rv-grid">
          <label>قۆناغ<select value={stage} onChange={(e) => setStage(e.target.value as Stage)}>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s].en} — {STAGE_LABEL[s].who}</option>)}</select></label>
          <label>ئەنجام<select value={outcome} onChange={(e) => setOutcome(e.target.value as "pass" | "fail")}><option value="pass">تێپەڕی</option><option value="fail">ڕەتکردنەوە</option></select></label>
          <label>پشکنەر (ناوی تەواو)<input value={reviewer} onChange={(e) => setReviewer(e.target.value)} autoComplete="off" maxLength={80} /></label>
          <label>بەرواری پێداچوونەوە<input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="wide">بەڵگە (لیستی واژۆکراو، بەڵگەنامە، ئیمەیڵ)<input value={evidence} onChange={(e) => setEvidence(e.target.value)} autoComplete="off" maxLength={300} /></label>
          <label className="wide">تێبینی {outcome === "fail" ? "(پێویستە)" : "(ئارەزوومەندانە)"}<input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} maxLength={500} /></label>
        </div>
        {outcome === "pass" && <label className="rv-confirm"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> دووپاتی دەکەمەوە کە کەسە ناوبراوەکە خۆی هەموو بابەتە هەڵبژێردراوەکانی وەک <b>{STAGE_LABEL[stage].who}</b> پشکنیوە و بەڵگەکە بوونی هەیە.</label>}
        <div className="dr-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={selectEligible}>هەڵبژاردنی گونجاوەکان لە لیستەکە ({items.filter(eligible).length})</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSel(new Set())}>پاککردنەوە</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!canSubmit} onClick={() => void submit()} data-testid="review-submit">تۆمارکردنی بڕیار</button>
        </div>
        {msg && <div className={`dr-msg ${msg.kind}`} role={msg.kind === "err" ? "alert" : "status"}>{msg.text}</div>}
      </section>

      <p className="small muted" role="status">{items.length} بابەت پیشان دراوە</p>
      <div className="rv-list">{items.slice(0, limit).map((it) => <ItemCard key={it.id} it={it} selected={sel.has(it.id)} onToggle={() => toggle(it.id)} />)}</div>
      {items.length > limit && <button type="button" className="btn btn-secondary" data-testid="review-more" onClick={() => setLimit((n) => n + 30)}>پیشاندانی زیاتر ({items.length - limit} ماوە)</button>}

      <section className="card" aria-labelledby="rv-hist-h">
        <h3 id="rv-hist-h" className="dr-h">مێژووی پێداچوونەوە <small>دوایین ٣٠٠</small></h3>
        <div className="dr-scroll" tabIndex={0} role="region" aria-label="خشتەی مێژووی پێداچوونەوە"><table className="dr-table"><thead><tr><th>تۆمارکرا</th><th>بابەت</th><th>قۆناغ</th><th>ئەنجام</th><th>پشکنەر</th><th>بەروار</th><th>بەڵگە</th><th>تۆمارکەر</th><th /></tr></thead><tbody>
          {data.history.length === 0 && <tr><td colSpan={9}>هێشتا هیچ پێداچوونەوەیەکی مرۆیی تۆمار نەکراوە.</td></tr>}
          {data.history.map((h) => <tr key={`${h.source ?? "de"}-${h.id}`} className={h.revoked_at ? "rv-revoked" : ""}><td>{stamp(h.recorded_at)}</td><td>{h.content_id}</td><td>{h.stage}</td><td>{h.outcome}{h.revoked_at ? ` (هەڵوەشێنراوەتەوە: ${h.revoke_reason})` : ""}</td><td>{h.reviewer_name}</td><td>{h.reviewed_on}</td><td>{h.evidence_ref}</td><td>{h.recorded_by}</td><td>{!h.revoked_at && <button type="button" className="btn btn-secondary btn-sm" onClick={() => void revoke(h.id, h.source ?? "de")}>هەڵوەشاندنەوە</button>}</td></tr>)}
        </tbody></table></div>
      </section>
      </>}
    </div>
  );
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

function ItalyQuestionReview({ items, ready, ...props }: Props & {
  items: ItalyQuestionItem[];
  ready: boolean;
  load: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | ItalyStatus>("all");
  const [message, setMessage] = useState("");
  const reviewed = items.filter((item) => italyStatus(item) !== "pending").length;
  const percent = items.length ? Math.round(100 * reviewed / items.length) : 0;
  const search = query.trim().normalize("NFC").toLowerCase();
  const matching = items.filter((item) => {
    if (filter !== "all" && italyStatus(item) !== filter) return false;
    const prompt = IT_QUESTION_BY_ID.get(item.id)?.prompt.it ?? "";
    return [item.id, prompt, item.translations.prompt.ckb, item.translations.prompt.kmrArab]
      .some((value) => value.normalize("NFC").toLowerCase().includes(search));
  });

  if (!ready) return <p className="dr-msg err" role="alert">{ERR.REVIEW_TABLE_MISSING}</p>;
  return (
    <section className="rv-list" data-testid="rv-italy-questions" dir="rtl">
      <h3 className="dr-h">پشکنینی مرۆیی پرسیارەکانی ئیتاڵیا</h3>
      <p role="status">پرسیاری پشکنراو <bdi dir="ltr">{reviewed} / {items.length} ({percent}%)</bdi></p>
      <div className="rv-filters">
        <label>دۆخی پشکنین <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">هەموو دۆخەکان</option>
          {Object.entries(IT_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <input type="search" className="rv-search" dir="auto" value={query} onChange={(e) => setQuery(e.target.value)}
          aria-label="گەڕان بە ناسنامە یان دەقی پرسیار" placeholder="ناسنامە یان دەقی پرسیار" />
      </div>
      {message && <p className="dr-msg ok" role="status">{message}</p>}
      {matching.length === 0 && <p role="status">هیچ پرسیارێک نەدۆزرایەوە.</p>}
      {matching.map((item) => <ItalyQuestionCard key={item.id} item={item} onSaved={setMessage} {...props} />)}
    </section>
  );
}

function ItalyQuestionCard({ item, api, onNeedStepUp, load, onSaved }: Props & {
  item: ItalyQuestionItem;
  load: () => Promise<void>;
  onSaved: (message: string) => void;
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
        <code dir="ltr">{item.id}</code>
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
          <input type="checkbox" name="confirm" required disabled={busy} /> دووپاتی دەکەمەوە کە پشکنەرە ناوبراوەکە خۆی ئەم وەشانەی پرسیارەکەی پشکنیوە.
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
