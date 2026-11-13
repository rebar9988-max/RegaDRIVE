import { useCallback, useEffect, useMemo, useState } from "react";
import { SignIcon } from "../components/SignIcon";
import { SIGNS, signSource } from "../content/signs";
import { SIGN_QUIZ } from "../content/signQuiz";
import type { Question, TrafficSign } from "../content/types";
import "./dr.css";

/**
 * /dr → Content Review & Approval for the Verkehrszeichen release (40 signs, 89 quiz questions).
 * The screen records decisions of NAMED HUMAN reviewers (Sorani translator → driving instructor → owner).
 * It never fills a reviewer, date or evidence in by itself, and publication stays with the server-side
 * publicationGate: an item goes live automatically once the gate passes, and not before.
 */
type Stage = "TRANSLATION_REVIEW" | "EDUCATIONAL_REVIEW" | "APPROVED";
interface StageInfo { state: "pass" | "fail" | "pending"; reviewer?: string; role?: string; reviewedOn?: string; evidenceRef?: string; note?: string; rowId?: number }
interface Item {
  id: string; kind: "sign" | "signQuiz"; status: string; publishable: boolean; reasons: string[]; valid: boolean;
  checks: { ok: boolean; label: string }[]; sourceRefs: string[]; stages: Record<Stage, StageInfo>;
}
interface HistoryRow { id: number; content_id: string; stage: Stage; outcome: string; reviewer_name: string; reviewer_role: string; reviewed_on: string; evidence_ref: string; note: string; recorded_by: string; recorded_at: number; revoked_at: number | null; revoke_reason: string | null }
interface Data { items: Item[]; counts: { total: number; published: number; awaiting: number; inReview: number; rejected: number; signs: { total: number; published: number }; signQuiz: { total: number; published: number } }; history: HistoryRow[]; rulesVersion: string }
type ApiResult = { status: number; body: Record<string, unknown> };
interface Props { api: (path: string, body?: unknown) => Promise<ApiResult>; onNeedStepUp: (retry: () => Promise<void>) => void }

const STAGES: Stage[] = ["TRANSLATION_REVIEW", "EDUCATIONAL_REVIEW", "APPROVED"];
const STAGE_LABEL: Record<Stage, { en: string; ckb: string; who: string }> = {
  TRANSLATION_REVIEW: { en: "Translation review", ckb: "پێداچوونەوەی وەرگێڕان", who: "Sorani translator" },
  EDUCATIONAL_REVIEW: { en: "Educational review", ckb: "پێداچوونەوەی فێرکاری", who: "Driving instructor" },
  APPROVED: { en: "Approved (Super Admin)", ckb: "پەسەندکردن (Super Admin)", who: "Content owner" },
};
const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Published", APPROVED_WAITING: "Approved – gate open?", EDUCATIONAL_REVIEW_DONE: "Educational done", TRANSLATION_REVIEW_DONE: "Translation done", AWAITING_REVIEW: "Awaiting review", REJECTED: "Rejected",
};
const ERR: Record<string, string> = {
  REVIEWER_NAME_INVALID: "Reviewer must be a real, named person (not AI / automated).",
  REVIEW_DATE_INVALID: "Review date must be a real date, not in the future.",
  EVIDENCE_REQUIRED: "Evidence reference is required (document, signed list, ticket…; at least 8 characters).",
  NOTE_REQUIRED_FOR_FAIL: "A rejection needs a note explaining what is wrong.",
  CONFIRMATION_REQUIRED: "Tick the confirmation box.",
  VALIDATION_FAILED: "Automatic validation of this item failed.",
  TRANSLATION_REVIEW_FIRST: "Translation review must pass first.",
  REVIEWERS_MUST_DIFFER: "Educational reviewer must be a different person than the translation reviewer.",
  BOTH_REVIEWS_FIRST: "Both reviews must pass before approval.",
  UNKNOWN_ITEM: "Unknown item.", BAD_IDS: "Select 1–200 items.", NOTE_TOO_LONG: "Note is too long.",
};
const stamp = (ms: number) => new Date(ms).toLocaleString("en-GB", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const today = () => new Date().toISOString().slice(0, 10);

const SIGN_BY_ID = new Map<string, TrafficSign>(SIGNS.map((s) => [s.id, s]));
const QUIZ_BY_ID = new Map<string, Question>(SIGN_QUIZ.map((q) => [q.id, q]));

function Bi({ de, ckb }: { de: string; ckb: string }) {
  return <>
    <span className="rv-de" lang="de" dir="ltr">{de}</span>
    <span className="rv-ckb" lang="ckb" dir="rtl">{ckb}</span>
  </>;
}

function Stages({ it }: { it: Item }) {
  return (
    <ol className="rv-stages" aria-label="Review stages">
      {STAGES.map((s) => {
        const x = it.stages[s];
        return (
          <li key={s} className={`rv-stage ${x.state}`} data-testid={`stage-${s}`}>
            <b dir="ltr">{STAGE_LABEL[s].en}</b>
            <span dir="ltr">{x.state === "pass" ? "✔ passed" : x.state === "fail" ? "✘ rejected" : "○ pending"}</span>
            {x.reviewer && <small dir="ltr">{x.reviewer} · {STAGE_LABEL[s].who} · {x.reviewedOn}<br />evidence: {x.evidenceRef}{x.note ? ` · ${x.note}` : ""}</small>}
          </li>
        );
      })}
    </ol>
  );
}

function ItemCard({ it, selected, onToggle }: { it: Item; selected: boolean; onToggle: () => void }) {
  const sign = it.kind === "sign" ? SIGN_BY_ID.get(it.id) : SIGN_BY_ID.get(QUIZ_BY_ID.get(it.id)?.signId ?? "");
  const q = it.kind === "signQuiz" ? QUIZ_BY_ID.get(it.id) : undefined;
  const failing = it.checks.filter((c) => !c.ok);
  return (
    <article className="card rv-item" data-testid="review-item" data-id={it.id} data-status={it.status}>
      <header className="rv-head">
        <label className="rv-pick"><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${it.id}`} /> <code dir="ltr">{it.id}</code></label>
        <span className={`dr-badge ${it.publishable ? "ok" : it.status === "REJECTED" ? "bad" : "warn"}`} dir="ltr">{it.publishable ? "Published (live)" : STATUS_LABEL[it.status] ?? it.status}</span>
      </header>
      <div className="rv-body">
        {sign && <SignIcon sign={sign} className="rv-sign" label={sign.name.de} />}
        <div className="rv-text">
          {it.kind === "sign" && sign && <>
            <Bi de={sign.name.de} ckb={sign.name.ckb} />
            <Bi de={sign.meaning.de} ckb={sign.meaning.ckb} />
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
      <p className="rv-refs" dir="ltr">Official reference: {it.sourceRefs.join(" · ") || "—"}{sign && it.kind === "sign" ? ` · ${signSource(sign)}` : ""}</p>
      <details className="rv-checks">
        <summary dir="ltr">Automatic validation: {it.valid ? "all " + it.checks.length + " checks passed" : `${failing.length} failed`}</summary>
        <ul dir="ltr">{it.checks.map((c, i) => <li key={i} className={c.ok ? "ok" : "bad"}>{c.ok ? "✔" : "✘"} {c.label}</li>)}</ul>
      </details>
      <Stages it={it} />
      {!it.publishable && it.reasons.length > 0 && <details className="rv-checks"><summary dir="ltr">Why not live yet ({it.reasons.length})</summary><ul dir="ltr">{it.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul></details>}
    </article>
  );
}

export function DrReview({ api, onNeedStepUp }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [note, setNote] = useState("loading…");
  const [kind, setKind] = useState<"all" | "sign" | "signQuiz">("all");
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
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api("/api/dr/reviews");
    if (r.status === 200) { setData(r.body as unknown as Data); setNote(""); }
    else setNote(r.status === 401 ? "Sign in again at /dr." : `Could not load the review list (${r.status}). The D1 migration 0006 may not be applied yet.`);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const items = useMemo(() => (data?.items ?? []).filter((it) => {
    if (kind !== "all" && it.kind !== kind) return false;
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
      if (r.status === 200) { setMsg({ kind: "ok", text: `Recorded ${String(r.body.recorded)} decision(s). Items go live automatically only when every required review is valid.` }); setSel(new Set()); setConfirm(false); await load(); return; }
      if (r.body.error === "STEP_UP_REQUIRED") { onNeedStepUp(run); return; }
      const first = Array.isArray(r.body.errors) ? (r.body.errors as { id: string; error: string }[])[0] : undefined;
      const code = first?.error ?? String(r.body.error ?? r.status);
      setMsg({ kind: "err", text: `${ERR[code] ?? code}${first ? ` (${first.id}${Number(r.body.rejectedCount) > 1 ? ` + ${Number(r.body.rejectedCount) - 1} more` : ""})` : ""} Nothing was saved.` });
    };
    await run();
  };
  const revoke = async (rowId: number) => {
    const reason = window.prompt("Reason for withdrawing this decision (min. 5 characters):") ?? "";
    if (reason.trim().length < 5) return;
    const run = async (): Promise<void> => {
      const r = await api("/api/dr/reviews/revoke", { rowId, reason });
      if (r.status === 200) { setMsg({ kind: "ok", text: "Decision withdrawn (kept in the history)." }); await load(); }
      else if (r.body.error === "STEP_UP_REQUIRED") onNeedStepUp(run);
      else setMsg({ kind: "err", text: `Could not withdraw (${r.status}).` });
    };
    await run();
  };

  if (!data) return <p className="small muted" role="status">{note}</p>;
  const c = data.counts;
  const canSubmit = sel.size > 0 && reviewer.trim().length >= 3 && evidence.trim().length >= 8 && (outcome === "fail" ? reviewNote.trim().length >= 5 : confirm) && !busy;

  return (
    <div className="rv" data-testid="dr-review" dir="ltr" lang="en">
      <div className="dr-grid">
        <div className="dr-tile"><b data-testid="rv-signs">{c.signs.published} / {c.signs.total}</b><span>Signs published</span></div>
        <div className="dr-tile"><b data-testid="rv-quiz">{c.signQuiz.published} / {c.signQuiz.total}</b><span>Quiz questions published</span></div>
        <div className="dr-tile"><b>{c.awaiting}</b><span>Awaiting review</span></div>
        <div className="dr-tile"><b>{c.inReview}</b><span>In review</span></div>
        <div className="dr-tile"><b>{c.rejected}</b><span>Rejected</span></div>
      </div>
      <p className="small muted">Order: 1) Sorani translator → 2) driving instructor (different person) → 3) owner approval. Each decision needs a named human reviewer, date and evidence. Content goes live automatically when the publication gate passes; unapproved content stays hidden. Exam rules version: <code>{data.rulesVersion}</code>.</p>

      <div className="rv-filters" role="group" aria-label="Filters">
        {(["all", "sign", "signQuiz"] as const).map((k) => <button key={k} type="button" className="dr-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{k === "all" ? "All" : k === "sign" ? "Signs (40)" : "Quiz (89)"}</button>)}
        {(["all", "awaiting", "review", "published", "rejected"] as const).map((k) => <button key={k} type="button" className="dr-chip" aria-pressed={status === k} onClick={() => setStatus(k)}>{k}</button>)}
        <input type="search" className="rv-search" placeholder="Search id, sign, text…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      </div>

      <section className="card rv-form" aria-labelledby="rv-form-h" data-testid="review-form">
        <h3 id="rv-form-h" className="dr-h" dir="ltr">Record a review decision <small>{sel.size} selected</small></h3>
        <div className="rv-grid">
          <label>Stage<select value={stage} onChange={(e) => setStage(e.target.value as Stage)}>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s].en} — {STAGE_LABEL[s].who}</option>)}</select></label>
          <label>Outcome<select value={outcome} onChange={(e) => setOutcome(e.target.value as "pass" | "fail")}><option value="pass">Pass</option><option value="fail">Reject</option></select></label>
          <label>Reviewer (full name)<input value={reviewer} onChange={(e) => setReviewer(e.target.value)} autoComplete="off" maxLength={80} /></label>
          <label>Review date<input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="wide">Evidence reference (signed list, document, e-mail, ticket)<input value={evidence} onChange={(e) => setEvidence(e.target.value)} autoComplete="off" maxLength={300} /></label>
          <label className="wide">Note {outcome === "fail" ? "(required)" : "(optional)"}<input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} maxLength={500} /></label>
        </div>
        {outcome === "pass" && <label className="rv-confirm"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> I confirm that the named person personally reviewed every selected item as <b>{STAGE_LABEL[stage].who}</b> and that the evidence exists.</label>}
        <div className="dr-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={selectEligible}>Select eligible in list ({items.filter(eligible).length})</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSel(new Set())}>Clear</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!canSubmit} onClick={() => void submit()} data-testid="review-submit">Record decision</button>
        </div>
        {msg && <div className={`dr-msg ${msg.kind}`} role={msg.kind === "err" ? "alert" : "status"}>{msg.text}</div>}
      </section>

      <p className="small muted" role="status">{items.length} item(s) shown</p>
      <div className="rv-list">{items.map((it) => <ItemCard key={it.id} it={it} selected={sel.has(it.id)} onToggle={() => toggle(it.id)} />)}</div>

      <section className="card" aria-labelledby="rv-hist-h">
        <h3 id="rv-hist-h" className="dr-h" dir="ltr">Review history <small>latest 300</small></h3>
        <div className="dr-scroll"><table className="dr-table" dir="ltr"><thead><tr><th>Recorded</th><th>Item</th><th>Stage</th><th>Result</th><th>Reviewer</th><th>Date</th><th>Evidence</th><th>Recorded by</th><th /></tr></thead><tbody>
          {data.history.length === 0 && <tr><td colSpan={9}>No human review has been recorded yet.</td></tr>}
          {data.history.map((h) => <tr key={h.id} className={h.revoked_at ? "rv-revoked" : ""}><td>{stamp(h.recorded_at)}</td><td>{h.content_id}</td><td>{h.stage}</td><td>{h.outcome}{h.revoked_at ? ` (withdrawn: ${h.revoke_reason})` : ""}</td><td>{h.reviewer_name}</td><td>{h.reviewed_on}</td><td>{h.evidence_ref}</td><td>{h.recorded_by}</td><td>{!h.revoked_at && <button type="button" className="btn btn-secondary btn-sm" onClick={() => void revoke(h.id)}>Withdraw</button>}</td></tr>)}
        </tbody></table></div>
      </section>
    </div>
  );
}
