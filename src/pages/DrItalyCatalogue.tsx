import { useCallback, useEffect, useState } from "react";

type Status = "pending" | "needs_revision" | "approved";
interface Row {
  source_id: string; batch: string; question_it: string; correct_answer: number; answer_original: string;
  source_page: number | null; source_group: string | null; image: string | null;
  ckb: string | null; kmr_arab: string | null; translation_notes: string | null;
  ckb_status: Status; kmr_arab_status: Status; reviewer_name: string | null; review_date: string | null;
  chapter_draft: number | null; chapter_confidence: string | null;
}
interface ListReply { ok?: boolean; total?: number; rows?: Row[]; counts?: Record<string, number | null>; pageMax?: number; error?: string; reason?: string }

const PAGE = 25;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Review of the staged Italian catalogue (7,020 true/false questions from the supplied package, with
 * draft Sorani and Badini translations). Each question is shown in all three languages with its answer
 * key, image reference and draft chapter; a reviewer records a decision per language. A decision changes
 * a review status only: staged questions are never published from here, and recording one needs a fresh
 * sign-in code, a named human reviewer, a date and an evidence reference.
 */
export function DrItalyCatalogue() {
  const [offset, setOffset] = useState(0);
  const [chapter, setChapter] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<ListReply | null>(null);
  const [note, setNote] = useState("loading…");
  const [reviewer, setReviewer] = useState({ reviewerName: "", reviewedOn: today(), evidenceRef: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const p = new URLSearchParams({ offset: String(offset), limit: String(PAGE) });
    if (chapter) p.set("chapter", chapter);
    if (status) p.set("status", status);
    if (search.trim()) p.set("q", search.trim());
    fetch(`/api/dr/italy/catalogue?${p}`, { credentials: "same-origin" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({})) as ListReply;
        if (r.ok) { setData(body); setNote(""); }
        else setNote(r.status === 401 ? "Sign in at /dr." : `${body.error ?? "Not available"} (HTTP ${r.status})${body.reason ? `: ${body.reason}` : ""}`);
      })
      .catch(() => setNote("Not available (offline)."));
  }, [offset, chapter, status, search]);
  useEffect(load, [load]);

  const decide = async (row: Row, language: "ckb" | "kmrArab", next: Status) => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/dr/italy/catalogue/review", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: row.source_id, language, status: next, ...reviewer }),
      });
      const body = await r.json().catch(() => ({})) as { ok?: boolean; error?: string };
      setMsg(r.ok ? `${row.source_id} · ${language} → ${next}` : `${row.source_id}: ${body.error ?? `HTTP ${r.status}`}`);
      if (r.ok) load();
    } catch { setMsg("NETWORK"); } finally { setBusy(false); }
  };

  const c = data?.counts ?? {};
  const total = data?.total ?? 0;
  return (
    <section className="card stack" data-testid="italy-catalogue-review">
      <h2 className="section-title">Italy · catalogue review (staged, unpublished)</h2>
      <p className="small">
        Staged: <strong>{c.total ?? 0}</strong> · Sorani approved: <strong>{c.ckbApproved ?? 0}</strong> · Badini approved: <strong>{c.kmrArabApproved ?? 0}</strong>
        {" "}· needs revision: {c.needsRevision ?? 0} · pending: {c.pending ?? 0} · draft chapter to confirm: {c.chapterNeedsReview ?? 0}
      </p>
      <p className="small muted">Nothing here is shown to learners. Rights for the text and images, explanations and legal references are still unverified; a learner sees an Italian question only after the regular import and the three review stages.</p>

      <div className="q-actions small">
        <label>Chapter <select value={chapter} onChange={(e) => { setOffset(0); setChapter(e.target.value); }} data-testid="italy-catalogue-chapter">
          <option value="">all</option>{Array.from({ length: 16 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
        </select></label>
        <label>Status <select value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value); }}>
          <option value="">all</option><option value="pending">pending</option><option value="needs_revision">needs revision</option><option value="approved">approved</option>
        </select></label>
        <label>Search <input value={search} onChange={(e) => { setOffset(0); setSearch(e.target.value); }} placeholder="ID or Italian text" /></label>
      </div>

      <fieldset className="stack small">
        <legend>Reviewer (a named person; required for every decision)</legend>
        <div className="q-actions">
          <input aria-label="Reviewer name" placeholder="Reviewer full name" value={reviewer.reviewerName} onChange={(e) => setReviewer({ ...reviewer, reviewerName: e.target.value })} />
          <input aria-label="Review date" type="date" max={today()} value={reviewer.reviewedOn} onChange={(e) => setReviewer({ ...reviewer, reviewedOn: e.target.value })} />
          <input aria-label="Evidence reference" placeholder="Evidence reference (min. 8 characters)" value={reviewer.evidenceRef} onChange={(e) => setReviewer({ ...reviewer, evidenceRef: e.target.value })} />
        </div>
      </fieldset>

      {note && <p className="small muted">{note}</p>}
      {msg && <p className="small dr-msg" data-testid="italy-catalogue-msg">{msg}</p>}

      {data?.rows && <div className="dr-scroll"><table className="dr-table"><thead><tr>
        <th>ID</th><th>Ch.</th><th>Italiano</th><th>Answer</th><th>Sorani</th><th>Badini</th><th>Image</th>
      </tr></thead><tbody>
        {data.rows.map((r) => <tr key={r.source_id}>
          <td>{r.source_id}<br /><span className="muted">{r.batch}</span></td>
          <td>{r.chapter_draft ?? "—"}{r.chapter_confidence === "needs_review" && <span title="draft chapter needs review"> ⚠</span>}</td>
          <td lang="it" dir="ltr">{r.question_it}</td>
          <td lang="it" dir="ltr">{r.answer_original}</td>
          {(["ckb", "kmrArab"] as const).map((lang) => {
            const text = lang === "ckb" ? r.ckb : r.kmr_arab;
            const st = lang === "ckb" ? r.ckb_status : r.kmr_arab_status;
            return <td key={lang}>
              <span lang={lang === "ckb" ? "ckb" : "kmr-Arab"} dir="rtl">{text ?? "—"}</span><br />
              <span className="muted">{st}</span>{" "}
              <button type="button" className="btn" disabled={busy} onClick={() => void decide(r, lang, "approved")}>approve</button>{" "}
              <button type="button" className="btn" disabled={busy} onClick={() => void decide(r, lang, "needs_revision")}>revise</button>
            </td>;
          })}
          <td>{r.image ?? "—"}</td>
        </tr>)}
      </tbody></table></div>}

      <div className="q-actions small">
        <button type="button" className="btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>‹ previous</button>
        <span>{total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE, total)} of {total}</span>
        <button type="button" className="btn" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>next ›</button>
      </div>
    </section>
  );
}
