import { useCallback, useEffect, useState } from "react";

type Status = "pending" | "needs_revision" | "approved";
type Lang = "ckb" | "kmrArab";
interface Issue { code: string; severity: "error" | "warning" }
interface Row {
  source_id: string; batch: string; question_it: string; correct_answer: number; answer_original: string;
  source_page: number | null; source_group: string | null; image: string | null;
  ckb: string | null; kmr_arab: string | null; translation_notes: string | null;
  ckb_status: Status; kmr_arab_status: Status; reviewer_name: string | null; review_date: string | null;
  chapter_draft: number | null; chapter_confidence: string | null;
  checks?: { ckb: Issue[]; kmrArab: Issue[]; errors: number; warnings: number };
  blockers?: string[];
}
interface ListReply { ok?: boolean; total?: number; rows?: Row[]; counts?: Record<string, number | null>; pageMax?: number; error?: string; reason?: string }
interface Summary {
  ok?: boolean; total?: number; readyForHumanReview?: number; publishable?: number;
  checks?: { rowsWithErrors: number; rowsWithWarnings: number; rowsClean: number; byCode: Record<string, { ckb: number; kmrArab: number }> };
  rowBlockers?: Record<string, number>; catalogueBlockers?: string[];
}

const PAGE = 25;
const today = () => new Date().toISOString().slice(0, 10);
const REVIEWER_KEY = "rd.dr.italyReviewer";

/** What each machine finding means, Sorani first. */
const CHECK_LABEL: Record<string, string> = {
  MISSING: "وەرگێڕان نییە",
  NOT_ARABIC_SCRIPT: "بە پیتی عەرەبی نییە",
  NUMBERS_DIFFER: "ژمارەکان لەگەڵ ئیتاڵی ناگونجێن",
  SORANI_LETTER_IN_BADINI: "پیتی «ڵ»ی سۆرانی لە بادینیدا",
  LATIN_KURMANJI_IN_BADINI: "کورمانجیی لاتینی لە بادینیدا",
  SORANI_FORM_IN_BADINI: "شێوەی سۆرانی لە بادینیدا (هۆشداری)",
  BADINI_FORM_IN_SORANI: "شێوەی بادینی لە سۆرانیدا (هۆشداری)",
  UNKNOWN_LATIN_WORD: "وشەی لاتینی کە لە ئیتاڵیدا نییە (هۆشداری)",
  NEGATION_NOT_FOUND: "نەفی لە ئیتاڵیدا هەیە، لە وەرگێڕاندا نەدۆزرایەوە (هۆشداری)",
};

/** Why a staged question is not published, and what clears it. Nothing here can be cleared by software. */
const BLOCKER_LABEL: Record<string, { ckb: string; clears: string }> = {
  CKB_NOT_APPROVED: { ckb: "سۆرانی پەسەند نەکراوە", clears: "بڕیاری وەرگێڕێکی سۆرانیی ناودار لەم پانێڵەدا" },
  KMR_ARAB_NOT_APPROVED: { ckb: "بادینی پەسەند نەکراوە", clears: "بڕیاری وەرگێڕێکی بادینیی ناودار لەم پانێڵەدا" },
  NEEDS_REVISION: { ckb: "پێویستی بە چاککردنەوەیە", clears: "چاککردنی وەرگێڕان و بڕیاری نوێ" },
  AUTOMATIC_CHECK_ERROR: { ckb: "هەڵەی پشکنینی ئۆتۆماتیکی", clears: "چاککردنی دەق؛ تا ئەوکاتە پەسەندکردن داخراوە" },
  AUTOMATIC_CHECK_WARNING: { ckb: "هۆشداریی پشکنینی ئۆتۆماتیکی", clears: "سەیرکردن لەلایەن پێداچووەرەوە (لەوانەیە هۆشداریی هەڵە بێت)" },
  CHAPTER_UNCONFIRMED: { ckb: "بەشی پێشنیارکراو پشتڕاست نەکراوەتەوە", clears: "پشتڕاستکردنەوەی بەش لەلایەن مامۆستای شۆفێری" },
  IMAGE_RIGHTS_UNVERIFIED: { ckb: "مافی وێنە پشتڕاست نەکراوەتەوە", clears: "بەڵگەی مۆڵەت یان وێنەیەکی ڕەسەن" },
  TEXT_RIGHTS_UNVERIFIED: { ckb: "مافی بڵاوکردنەوەی دەقی ئیتاڵی پشتڕاست نەکراوەتەوە", clears: "بەڵگەی مۆڵەت لە خاوەنی سەرچاوە و بڕیاری خاوەنی پڕۆژە" },
  NO_EXPLANATION: { ckb: "ڕوونکردنەوە نییە", clears: "نووسینی ڕوونکردنەوە بە هەموو زمانەکان و پێداچوونەوەی" },
  NO_LEGAL_REFERENCE: { ckb: "سەرچاوەی یاسایی (Codice della Strada) نییە", clears: "زیادکردنی ماددەی یاسایی لەلایەن مامۆستای ئیتاڵی" },
  NOT_IN_REVIEW_PIPELINE: { ckb: "هێشتا نەچووەتە ناو سێ قۆناغی پێداچوونەوە", clears: "هاوردەی ئاسایی بۆ italy_content، پاشان TRANSLATION_REVIEW ← EDUCATIONAL_REVIEW ← APPROVED" },
  IMAGES_NOT_HOSTED: { ckb: "وێنەکان بار نەکراون", clears: "تەنها دوای پشتڕاستکردنەوەی مافی وێنە" },
};

const STATUS_LABEL: Record<Status, string> = { pending: "چاوەڕوان", needs_revision: "پێویستی بە چاککردنە", approved: "پەسەندکراو" };
const LANG_LABEL: Record<Lang, string> = { ckb: "سۆرانی", kmrArab: "بادینی" };

function loadReviewer() {
  try {
    const saved = JSON.parse(localStorage.getItem(REVIEWER_KEY) ?? "{}") as { reviewerName?: string; evidenceRef?: string };
    return { reviewerName: saved.reviewerName ?? "", reviewedOn: today(), evidenceRef: saved.evidenceRef ?? "" };
  } catch { return { reviewerName: "", reviewedOn: today(), evidenceRef: "" }; }
}

/**
 * Review of the staged Italian catalogue (7,020 true/false questions from the supplied package, with
 * draft Sorani and Badini translations). Each question is shown in all three languages with its answer
 * key, image reference, draft chapter, automatic checks and the reasons it is not published. A reviewer
 * records a decision per language. A decision changes a review status only: staged questions are never
 * published from here, and recording one needs a fresh sign-in code, a named human reviewer, a date and
 * an evidence reference. Machine checks never count as a review.
 */
export function DrItalyCatalogue() {
  const [offset, setOffset] = useState(0);
  const [chapter, setChapter] = useState("");
  const [status, setStatus] = useState("");
  const [checks, setChecks] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<ListReply | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [note, setNote] = useState("loading…");
  const [reviewer, setReviewer] = useState(loadReviewer);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    const p = new URLSearchParams({ offset: String(offset), limit: String(PAGE) });
    if (chapter) p.set("chapter", chapter);
    if (status) p.set("status", status);
    if (checks) p.set("checks", checks);
    if (search.trim()) p.set("q", search.trim());
    fetch(`/api/dr/italy/catalogue?${p}`, { credentials: "same-origin" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({})) as ListReply;
        if (r.ok) { setData(body); setNote(""); setSelected(new Set()); }
        else setNote(r.status === 401 ? "Sign in at /dr." : `${body.error ?? "Not available"} (HTTP ${r.status})${body.reason ? `: ${body.reason}` : ""}`);
      })
      .catch(() => setNote("Not available (offline)."));
  }, [offset, chapter, status, checks, search]);
  useEffect(load, [load]);

  const loadSummary = useCallback(() => {
    fetch("/api/dr/italy/catalogue/summary", { credentials: "same-origin" })
      .then(async (r) => { if (r.ok) setSummary(await r.json() as Summary); })
      .catch(() => undefined);
  }, []);
  useEffect(loadSummary, [loadSummary]);

  const setReviewerField = (field: "reviewerName" | "reviewedOn" | "evidenceRef", value: string) => {
    const next = { ...reviewer, [field]: value };
    setReviewer(next);
    // Remembered on this device only, to save retyping; every decision still sends and the server checks it.
    try { localStorage.setItem(REVIEWER_KEY, JSON.stringify({ reviewerName: next.reviewerName, evidenceRef: next.evidenceRef })); } catch { /* storage off */ }
  };
  const reviewerReady = reviewer.reviewerName.trim().length > 1 && reviewer.evidenceRef.trim().length >= 8 && Boolean(reviewer.reviewedOn);

  const decide = async (ids: string[], languages: Lang[], next: Status) => {
    if (ids.length === 0 || languages.length === 0) return;
    setBusy(true); setMsg(null);
    const parts: string[] = [];
    let ok = true;
    try {
      for (const language of languages) {
        const r = await fetch("/api/dr/italy/catalogue/review", {
          method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceIds: ids, language, status: next, ...reviewer }),
        });
        const body = await r.json().catch(() => ({})) as { ok?: boolean; error?: string; recorded?: number; unknown?: string[] };
        if (!r.ok) { ok = false; parts.push(`${LANG_LABEL[language]}: ${body.error ?? `HTTP ${r.status}`}`); break; }
        parts.push(`${LANG_LABEL[language]}: ${body.recorded ?? ids.length} → ${STATUS_LABEL[next]}${body.unknown?.length ? ` (not found: ${body.unknown.join(", ")})` : ""}`);
      }
    } catch { ok = false; parts.push("NETWORK"); } finally { setBusy(false); }
    setMsg({ ok, text: parts.join(" · ") });
    load(); loadSummary();
  };
  const toggle = (id: string) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const rows = data?.rows ?? [];
  // A row with an automatic-check error cannot be approved until its text is fixed.
  const approvable = (r: Row) => (r.checks?.errors ?? 0) === 0;
  const pageIds = rows.map((r) => r.source_id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const selectedBlocked = rows.filter((r) => selected.has(r.source_id) && !approvable(r)).length;
  const approveDisabled = busy || !reviewerReady || selected.size === 0 || selectedBlocked > 0;

  const c = data?.counts ?? {};
  const total = data?.total ?? 0;
  const resetTo = (fn: () => void) => { setOffset(0); fn(); };
  return (
    <section className="card stack it-cat" data-testid="italy-catalogue-review" dir="rtl" lang="ckb">
      <h2 className="section-title">ئیتاڵیا · پێداچوونەوەی کەتەلۆگ <small lang="en" dir="ltr">Italy · catalogue review (staged, unpublished)</small></h2>
      <div className="it-cat-stats" data-testid="italy-catalogue-counts">
        <span><b>{c.total ?? 0}</b> هاوردەکراو</span>
        <span><b>{c.ckbApproved ?? 0}</b> سۆرانی پەسەندکراو</span>
        <span><b>{c.kmrArabApproved ?? 0}</b> بادینی پەسەندکراو</span>
        <span><b>{c.needsRevision ?? 0}</b> پێویستی بە چاککردنە</span>
        <span><b>{c.pending ?? 0}</b> چاوەڕوان</span>
        <span><b>{c.chapterNeedsReview ?? 0}</b> بەش بۆ پشتڕاستکردنەوە</span>
      </div>

      {summary?.checks && <details className="it-cat-panel" open data-testid="italy-catalogue-summary">
        <summary><strong>پشکنینی ئۆتۆماتیکی و هۆکارەکانی ڕێگری لە بڵاوکردنەوە</strong></summary>
        <p className="small">
          پشکنینی ئۆتۆماتیکی (هەموو {summary.total} پرسیار): <b>{summary.checks.rowsWithErrors}</b> هەڵە ·{" "}
          <b>{summary.checks.rowsWithWarnings}</b> تەنها هۆشداری · <b>{summary.checks.rowsClean}</b> پاک.
          {" "}پشکنینی ئۆتۆماتیکی پێداچوونەوە نییە: پاکبوون تەنها واتای ئەوەیە کە مرۆڤ دەتوانێت دەست پێبکات.
        </p>
        <ul className="it-cat-codes small">
          {Object.entries(summary.checks.byCode).filter(([, n]) => n.ckb + n.kmrArab > 0).map(([code, n]) => <li key={code}>
            <span>{CHECK_LABEL[code] ?? code}</span> <bdi dir="ltr">ckb {n.ckb} · kmr-Arab {n.kmrArab}</bdi>
          </li>)}
        </ul>
        <p className="small" data-testid="italy-catalogue-publishable"><strong>بڵاوکراوە بۆ فێرخوازان: {summary.publishable ?? 0}</strong> — هیچ پرسیارێکی ئەم کەتەلۆگە ناگاتە فێرخواز تا ئەم ڕێگرییانە هەبن:</p>
        <table className="dr-table it-cat-blockers"><thead><tr><th>ڕێگری</th><th>ژمارە</th><th>چی لای دەبات</th></tr></thead><tbody>
          {(summary.catalogueBlockers ?? []).map((b) => <tr key={b} data-testid="italy-catalogue-blocker">
            <td data-label="ڕێگری">{BLOCKER_LABEL[b]?.ckb ?? b} <code dir="ltr">{b}</code></td>
            <td data-label="ژمارە">هەموو ({summary.total})</td>
            <td data-label="چی لای دەبات">{BLOCKER_LABEL[b]?.clears ?? "—"}</td>
          </tr>)}
          {Object.entries(summary.rowBlockers ?? {}).filter(([, n]) => n > 0).map(([b, n]) => <tr key={b} data-testid="italy-catalogue-blocker">
            <td data-label="ڕێگری">{BLOCKER_LABEL[b]?.ckb ?? b} <code dir="ltr">{b}</code></td>
            <td data-label="ژمارە">{n}</td>
            <td data-label="چی لای دەبات">{BLOCKER_LABEL[b]?.clears ?? "—"}</td>
          </tr>)}
        </tbody></table>
      </details>}

      <div className="it-cat-filters small">
        <label>بەش <select value={chapter} onChange={(e) => resetTo(() => setChapter(e.target.value))} data-testid="italy-catalogue-chapter">
          <option value="">هەموو</option>{Array.from({ length: 16 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
        </select></label>
        <label>دۆخ <select value={status} onChange={(e) => resetTo(() => setStatus(e.target.value))}>
          <option value="">هەموو</option><option value="pending">{STATUS_LABEL.pending}</option><option value="needs_revision">{STATUS_LABEL.needs_revision}</option><option value="approved">{STATUS_LABEL.approved}</option>
        </select></label>
        <label>پشکنین <select value={checks} onChange={(e) => resetTo(() => setChecks(e.target.value))} data-testid="italy-catalogue-checks">
          <option value="">هەموو</option><option value="clean">پاک (ئامادە بۆ پێداچوونەوە)</option><option value="warnings">هۆشداری</option><option value="errors">هەڵە</option>
        </select></label>
        <label className="grow">گەڕان <input value={search} onChange={(e) => resetTo(() => setSearch(e.target.value))} placeholder="ID یان دەقی ئیتاڵی" /></label>
      </div>

      <fieldset className="it-cat-reviewer small">
        <legend>پێداچووەر — کەسێکی ناودار، بۆ هەموو بڕیارێک پێویستە</legend>
        <input aria-label="Reviewer name" placeholder="ناوی تەواوی پێداچووەر" value={reviewer.reviewerName} onChange={(e) => setReviewerField("reviewerName", e.target.value)} />
        <input aria-label="Review date" type="date" max={today()} value={reviewer.reviewedOn} onChange={(e) => setReviewerField("reviewedOn", e.target.value)} />
        <input aria-label="Evidence reference" placeholder="سەرچاوەی بەڵگە (لانیکەم ٨ پیت)" value={reviewer.evidenceRef} onChange={(e) => setReviewerField("evidenceRef", e.target.value)} />
        {!reviewerReady && <p className="muted" data-testid="italy-catalogue-reviewer-needed">بۆ تۆمارکردنی بڕیار ناو، بەروار و سەرچاوەی بەڵگە پڕ بکەرەوە.</p>}
      </fieldset>

      {note && <p className="small muted">{note}</p>}
      {msg && <p className={`small dr-msg ${msg.ok ? "ok" : "err"}`} data-testid="italy-catalogue-msg">{msg.text}</p>}

      <div className="it-cat-bulk small" data-testid="italy-catalogue-bulk">
        <label className="it-cat-pick"><input type="checkbox" aria-label="Select all on this page" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(pageIds))} /> هەمووی ئەم لاپەڕەیە</label>
        <span>هەڵبژێردراو: <strong>{selected.size}</strong>{selectedBlocked > 0 && <span className="dr-badge bad">{selectedBlocked} هەڵەی پشکنین</span>}</span>
        <button type="button" className="btn btn-primary" disabled={approveDisabled} onClick={() => void decide([...selected], ["ckb", "kmrArab"], "approved")}>پەسەندکردنی هەردوو زمان</button>
        {(["ckb", "kmrArab"] as const).map((lang) => <span key={lang} className="it-cat-pair">
          <button type="button" className="btn" disabled={approveDisabled} onClick={() => void decide([...selected], [lang], "approved")}>پەسەند · {LANG_LABEL[lang]}</button>
          <button type="button" className="btn" disabled={busy || !reviewerReady || selected.size === 0} onClick={() => void decide([...selected], [lang], "needs_revision")}>چاککردنەوە · {LANG_LABEL[lang]}</button>
        </span>)}
      </div>

      {rows.length > 0 && <table className="dr-table it-cat-table"><thead><tr>
        <th aria-label="Select" /><th>ID</th><th>بەش</th><th>Italiano</th><th>وەڵام</th><th>سۆرانی</th><th>بادینی</th><th>وێنە</th>
      </tr></thead><tbody>
        {rows.map((r) => <tr key={r.source_id} data-testid="italy-catalogue-row">
          <td data-label="هەڵبژاردن"><input type="checkbox" aria-label={`Select ${r.source_id}`} checked={selected.has(r.source_id)} onChange={() => toggle(r.source_id)} /></td>
          <td data-label="ID"><bdi dir="ltr">{r.source_id}</bdi> <span className="muted"><bdi dir="ltr">{r.batch}</bdi></span></td>
          <td data-label="بەش">{r.chapter_draft ?? "—"}{r.chapter_confidence === "needs_review" && <span className="dr-badge warn" title="draft chapter needs review">پشتڕاست بکەرەوە</span>}</td>
          <td data-label="Italiano" lang="it" dir="ltr" className="it-cat-it">{r.question_it}</td>
          <td data-label="وەڵام" lang="it" dir="ltr"><span className={`dr-badge ${r.correct_answer ? "ok" : "bad"}`}>{r.answer_original}</span></td>
          {(["ckb", "kmrArab"] as const).map((lang) => {
            const text = lang === "ckb" ? r.ckb : r.kmr_arab;
            const st = lang === "ckb" ? r.ckb_status : r.kmr_arab_status;
            const issues = r.checks?.[lang] ?? [];
            return <td key={lang} data-label={LANG_LABEL[lang]}>
              <p className="it-cat-text" lang={lang === "ckb" ? "ckb" : "kmr-Arab"} dir="rtl">{text ?? "—"}</p>
              <span className={`dr-badge ${st === "approved" ? "ok" : st === "needs_revision" ? "bad" : "info"}`}>{STATUS_LABEL[st]}</span>
              {issues.map((i) => <span key={i.code} className={`dr-badge ${i.severity === "error" ? "bad" : "warn"}`} title={i.code}>{CHECK_LABEL[i.code] ?? i.code}</span>)}
              <span className="it-cat-pair">
                <button type="button" className="btn" disabled={busy || !reviewerReady || !approvable(r)} onClick={() => void decide([r.source_id], [lang], "approved")}>پەسەند</button>
                <button type="button" className="btn" disabled={busy || !reviewerReady} onClick={() => void decide([r.source_id], [lang], "needs_revision")}>چاککردنەوە</button>
              </span>
            </td>;
          })}
          <td data-label="وێنە"><bdi dir="ltr">{r.image ?? "—"}</bdi>{r.image && <span className="dr-badge warn">مافی وێنە پشتڕاست نەکراوە</span>}</td>
        </tr>)}
      </tbody></table>}

      <div className="it-cat-pager small">
        <button type="button" className="btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>‹ پێشوو</button>
        <span><bdi dir="ltr">{total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE, total)} / {total}</bdi></span>
        <button type="button" className="btn" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>دواتر ›</button>
      </div>
    </section>
  );
}
