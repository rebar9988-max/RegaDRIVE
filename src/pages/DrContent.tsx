import { useEffect, useState } from "react";
import { AdminImport } from "./AdminImport";
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

export function DrContent() {
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
