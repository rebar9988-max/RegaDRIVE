import { useEffect, useState } from "react";
import { AdminImport } from "./AdminImport";
import { DrItalyCatalogue } from "./DrItalyCatalogue";
import { QUESTIONS } from "../content/questions";
import { catalogReport } from "../lib/shared/catalog";
import { CATALOG_PLAN_STATUS, planCoverage } from "../lib/shared/catalogPlan";
import { STAGES } from "../content/pipeline";
import "./dr.css";

/**
 * Owner content workbench (inside /dr): progress of the question bank, storage and licence status, review
 * workflow, and the local import / media preview. Read-only towards the server: nothing here stores or
 * publishes content. Storing needs the owner-activated content database (docs/OWNER_ACTIVATION.md).
 */
interface Status {
  italy?: null | { country: "IT"; counts: Record<string, number>; questions: { id: string; chapter: number; prompt: string }[] };
  storage: { active: boolean; missing: string[] };
  officialContent: { shown: boolean; publicExams: boolean };
  progress: null | {
    questions: { total: number; published: number; byStage: Record<string, number>; bySource: Record<string, number>; withSorani: number; withMedia: number };
    translations: Record<string, number>;
    media: { total: number; images: number; videos: number; withProvenance: number; reviewed: number; scenes: number; scenarios: number };
    licenses: { id: string; status: string; country: string; validUntil: string | null; questions: number }[];
    batches: { id: string; fileName: string | null; status: string; total: number; createdAt: number; rolledBack: boolean }[];
  };
}

const STAGE_WHO: Record<string, string> = {
  DRAFT: "imported, hidden", SOURCE_CHECK: "automatic: legal reference present", LICENSE_CHECK: "automatic: licence verified and in force",
  TRANSLATION_REVIEW: "Sorani reviewer", EDUCATIONAL_REVIEW: "driving instructor (text and media)", APPROVED: "owner", PUBLISHED: "owner; the database checks every rule again",
};

type ApiResult = { status: number; body: Record<string, unknown> };
interface DrProps { api?: (path: string, body?: unknown) => Promise<ApiResult>; onNeedStepUp?: (retry: () => Promise<void>) => void }

export function DrContent({ api, onNeedStepUp }: DrProps = {}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [statusNote, setStatusNote] = useState("loading…");
  useEffect(() => {
    let alive = true;
    fetch("/api/dr/content/status", { credentials: "same-origin" })
      .then(async (r) => { if (!alive) return; if (r.ok) { setStatus(await r.json() as Status); setStatusNote(""); } else setStatusNote(r.status === 401 ? "Sign in at /dr to see the storage status." : `Status not available (HTTP ${r.status}).`); })
      .catch(() => { if (alive) setStatusNote("Status not available (offline)."); });
    return () => { alive = false; };
  }, []);

  // The bank that ships with the app: RegaDRIVE's own practice questions. Measured, never assumed.
  const bundled = catalogReport(QUESTIONS);
  const plan = planCoverage(QUESTIONS);
  const p = status?.progress ?? null;

  return (
    <div className="stack" data-testid="dr-content" dir="ltr" lang="en">
      <section className="card stack" data-testid="content-progress">
        <h2 className="section-title">Question bank progress</h2>
        <p className="small">Target {bundled.target}. In the app today: <strong>{bundled.total}</strong> original RegaDRIVE questions, {bundled.valid} valid, <strong>{bundled.ready}</strong> approved and published, {bundled.missing} still missing. Licensed official questions: <strong>{p?.questions.bySource.licensed_official ?? 0}</strong>.</p>
        <p className="small muted">{bundled.complete ? "Target reached." : "The bank is NOT complete."} Plan per topic: {CATALOG_PLAN_STATUS === "proposed" ? "proposed, not yet confirmed by the owner" : "confirmed by the owner"}.</p>
        <div className="dr-scroll"><table className="dr-table"><thead><tr><th>Topic</th><th>Category</th><th>Valid / quota</th><th>Ready</th><th>Missing</th><th>Media</th></tr></thead><tbody>
          {plan.topics.map((x) => <tr key={x.topicId}><td>{x.topicId}</td><td>{x.category}</td><td>{x.valid} / {x.quota}</td><td>{x.ready}</td><td>{x.missing}</td><td>{x.mediaHave} / {x.withMedia}</td></tr>)}
        </tbody></table></div>
      </section>

      <ItalyImportPanel api={api} onNeedStepUp={onNeedStepUp} />
      <DrItalyCatalogue api={api} onNeedStepUp={onNeedStepUp} />

      <section className="card stack" data-testid="italy-storage">
        <h2 className="section-title">🇮🇹 ئیتالیا — بانکی ناوەڕۆک</h2>
        {status?.italy ? <>
          <p>Italy · Stored questions: <strong>{status.italy.counts.question ?? 0}</strong> · Signs: <strong>{status.italy.counts.sign ?? 0}</strong> · Chapters: <strong>{status.italy.counts.chapter ?? 0}</strong></p>
          <p className="small">Stored in the Italian inventory. Learner publication requires the separate translation, educational and owner reviews.</p>
          <div className="dr-scroll"><table className="dr-table"><thead><tr><th>ID</th><th>Chapter</th><th>Italian question</th></tr></thead><tbody>
            {status.italy.questions.map(q => <tr key={q.id}><td>{q.id}</td><td>{q.chapter}</td><td lang="it">{q.prompt}</td></tr>)}
          </tbody></table></div>
        </> : <p className="small muted">{status ? "Italian database inventory is not available." : "Loading Italian database inventory…"}</p>}
      </section>

      <section className="card stack" data-testid="content-storage">
        <h2 className="section-title">Storage and official content</h2>
        {statusNote && <p className="small muted">{statusNote}</p>}
        {status && <>
          <p className="small"><strong>Stored imports: {status.storage.active ? "ON" : "OFF"}</strong> · Official content shown to learners: {status.officialContent.shown ? "ON" : "OFF"} · Public official exams: {status.officialContent.publicExams ? "ON" : "OFF"}</p>
          {status.storage.missing.length > 0 && <ul className="list small">{status.storage.missing.map((m) => <li key={m}>✗ {m}</li>)}</ul>}
          {p && <>
            <p className="small">Stored questions: {p.questions.total} ({p.questions.published} published) · with Sorani: {p.questions.withSorani} · with media: {p.questions.withMedia}</p>
            <p className="small">Media: {p.media.total} files ({p.media.images} images, {p.media.videos} videos) · with provenance: {p.media.withProvenance} · instructor-reviewed: {p.media.reviewed} · reusable scenes: {p.media.scenes} · scenario sheets: {p.media.scenarios}</p>
            <div className="dr-scroll"><table className="dr-table"><thead><tr><th>Import</th><th>File</th><th>Rows</th><th>State</th></tr></thead><tbody>
              {p.batches.map((b) => <tr key={b.id}><td>{b.id}</td><td>{b.fileName ?? "—"}</td><td>{b.total}</td><td>{b.rolledBack ? "rolled back" : b.status}</td></tr>)}
            </tbody></table></div>
          </>}
        </>}
      </section>

      <section className="card stack" data-testid="content-workflow">
        <h2 className="section-title">Review and approval workflow</h2>
        <div className="dr-scroll"><table className="dr-table"><thead><tr><th>Stage</th><th>Who</th><th>Stored questions</th></tr></thead><tbody>
          {STAGES.map((s) => <tr key={s}><td>{s}</td><td>{STAGE_WHO[s]}</td><td>{p ? (p.questions.byStage[s] ?? 0) : "—"}</td></tr>)}
        </tbody></table></div>
        <p className="small muted">An import never publishes. A change of German text, answer key or media creates a new version and needs approval again. If a licence is suspended, expired or revoked, everything under it is hidden at once.</p>
      </section>

      <section className="card stack" data-testid="content-preview">
        <h2 className="section-title">Import, licence and media preview</h2>
        <p className="small muted">Runs in this browser only. Nothing is uploaded, stored or published.</p>
        <AdminImport />
      </section>
    </div>
  );
}

interface ImportReady { ready: boolean; missing: string[]; maxItemsPerRequest: number; catalogue: null | { source: string; questions: number; signs: number; skipped: number } }
interface ImportReport { ok?: boolean; dryRun?: boolean; received?: number; stored?: number; unchanged?: number; changed?: string[]; rejected?: { index: number; id: string; issues: { field: string; problem: string }[] }[]; error?: string; reason?: string; needStepUp?: boolean }

/**
 * Italy: one-off setup of the review table, then import of the catalogue.
 *
 * Storing is not publishing. Every imported item still has to pass the three human review stages in
 * Content Review before a learner sees it, and re-importing an item with different wording withdraws
 * the approval that was bound to the old wording.
 */
function ItalyImportPanel({ api, onNeedStepUp }: DrProps) {
  const [info, setInfo] = useState<ImportReady | null>(null);
  const [note, setNote] = useState("loading…");
  const [payload, setPayload] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    fetch("/api/dr/italy/import", { credentials: "same-origin" })
      .then(async (r) => { if (r.ok) { setInfo(await r.json() as ImportReady); setNote(""); } else setNote(r.status === 401 ? "Sign in at /dr." : `Not available (HTTP ${r.status}).`); })
      .catch(() => setNote("Not available (offline)."));
  };
  useEffect(refresh, []);

  const post = async (path: string, body?: unknown): Promise<void> => {
    setBusy(true);
    try {
      // Every /dr write needs the x-dr-request header; a real import also needs a fresh sign-in code.
      const r = api ? await api(path, body ?? {}) : await fetch(path, {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-dr-request": "1" },
        body: JSON.stringify(body ?? {}),
      }).then(async (x) => ({ status: x.status, body: await x.json().catch(() => ({})) as Record<string, unknown> }));
      if (r.body.error === "STEP_UP_REQUIRED" && onNeedStepUp) { onNeedStepUp(() => post(path, body)); return; }
      setReport(r.body as ImportReport);
      refresh();
    } catch { setReport({ error: "NETWORK" }); } finally { setBusy(false); }
  };

  const send = (dryRun: boolean) => {
    let items: unknown;
    try { items = JSON.parse(payload); } catch { setReport({ error: "NOT_JSON" }); return; }
    const list = Array.isArray(items) ? items : (items as { items?: unknown }).items;
    if (!Array.isArray(list)) { setReport({ error: "EXPECTED_ARRAY" }); return; }
    void post("/api/dr/italy/import", { items: list, dryRun });
  };

  return (
    <section className="card stack" data-testid="italy-import">
      <h2 className="section-title">Italy · setup and import</h2>
      {note && <p className="small muted">{note}</p>}
      {info && <>
        <p className="small">
          Imports: <strong>{info.ready ? "ready" : "not ready"}</strong>
          {info.catalogue && <> · catalogue <strong>{info.catalogue.source}</strong> · {info.catalogue.questions} questions · {info.catalogue.signs} signs{info.catalogue.skipped > 0 && <> · {info.catalogue.skipped} unusable rows</>}</>}
          · up to {info.maxItemsPerRequest} items per request
        </p>
        {info.missing.length > 0 && <ul className="small">{info.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
      </>}
      <div className="q-actions">
        <button type="button" className="btn" disabled={busy} onClick={() => void post("/api/dr/italy/setup")} data-testid="italy-setup">
          Create the Italian review table
        </button>
      </div>
      <label className="stack small" htmlFor="italy-import-json">
        Catalogue JSON — an array of questions and signs, each with its own legal reference
        <textarea id="italy-import-json" rows={8} value={payload} spellCheck={false}
          onChange={(e) => setPayload(e.target.value)} data-testid="italy-import-json"
          placeholder={'[{"id":"it-b-013","chapter":1,"answer":true,"sourceRefs":["CdS art. 3"],"prompt":{"it":"…","ckb":"…","kmrArab":"…"},"explanation":{"it":"VERO: …","ckb":"…","kmrArab":"…"}}]'} />
      </label>
      <div className="q-actions">
        <button type="button" className="btn" disabled={busy || payload.trim() === ""} onClick={() => send(true)} data-testid="italy-import-check">Check only</button>
        <button type="button" className="btn btn-primary" disabled={busy || payload.trim() === ""} onClick={() => send(false)} data-testid="italy-import-store">Store</button>
      </div>
      {report && <div className="stack small" data-testid="italy-import-report">
        {report.error
          ? <p className="dr-msg err">{report.error}{report.reason ? `: ${report.reason}` : ""}</p>
          : <p>{report.dryRun ? "Checked" : "Stored"}: {report.stored ?? 0} of {report.received ?? 0} · unchanged {report.unchanged ?? 0} · rejected {report.rejected?.length ?? 0}{(report.changed?.length ?? 0) > 0 && <> · wording changed, review withdrawn: {report.changed?.join(", ")}</>}</p>}
        {(report.rejected?.length ?? 0) > 0 && <div className="dr-scroll"><table className="dr-table"><thead><tr><th>#</th><th>id</th><th>problem</th></tr></thead><tbody>
          {report.rejected?.map((r) => <tr key={`${r.index}-${r.id}`}><td>{r.index}</td><td>{r.id || "—"}</td><td>{r.issues.map((i) => `${i.field}: ${i.problem}`).join("; ")}</td></tr>)}
        </tbody></table></div>}
      </div>}
      <p className="small muted">Storing is not publishing: imported items appear in Content Review and reach learners only after the translation, educational and owner stages.</p>
    </section>
  );
}
