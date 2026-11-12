import { useState } from "react";
import { Bi, useBiText } from "../components/Bi";
import { TOPICS } from "../content/topics";
import { checkMedia } from "../lib/shared/media";
import { catalogReport } from "../lib/shared/catalog";
import { CATALOG_PLAN_STATUS, planCoverage } from "../lib/shared/catalogPlan";
import { parseMediaManifest, validateMediaManifest, type MediaManifest } from "../lib/shared/mediaManifest";
import { licenseChecklist, licenseProblems, parseLicenseRegister, type LicenseRecord } from "../lib/shared/license";
import { csvToImport, jsonToImport, validateImport, type ImportPreview, type ImportQuestion, type MediaManifestEntry } from "../lib/shared/importer";

/**
 * Owner-only import workbench (compiled only into builds with VITE_ADMIN_UI=true).
 * Everything runs locally in the browser: no upload, no database write, no publication.
 */
const t = {
  title: { ckb: "هاوردەکردنی ناوەڕۆک (تەنها خاوەن)", de: "Inhaltsimport (nur Inhaber)", kmr: "Anîna naverokê (tenê xwedî)", ar: "استيراد المحتوى (للمالك فقط)" },
  local: { ckb: "هەموو پشکنینەکان لە وێبگەڕەکەتدا دەکرێن. هیچ شتێک نانێردرێت و هیچ شتێک بڵاو ناکرێتەوە.", de: "Alle Prüfungen laufen lokal im Browser. Nichts wird hochgeladen oder veröffentlicht.", kmr: "Hemû kontrol di gerokê te de tên kirin. Tiştek nayê barkirin an weşandin.", ar: "تجري كل عمليات الفحص محليًا في المتصفح. لا يُرفع أو يُنشر أي شيء." },
  licences: { ckb: "ناسنامەی مۆڵەتە تۆمارکراوەکان", de: "Registrierte Lizenz-IDs", kmr: "Nasnameyên lîsansê yên tomarkirî", ar: "معرّفات التراخيص المسجّلة" },
  file: { ckb: "فایلی پرسیارەکان (JSON یان CSV)", de: "Fragendatei (JSON oder CSV)", kmr: "Pelê pirsan (JSON an CSV)", ar: "ملف الأسئلة (JSON أو CSV)" },
  media: { ckb: "وێنە و ڤیدیۆکان", de: "Bilder und Videos", kmr: "Wêne û vîdyo", ar: "الصور والفيديوهات" },
  validate: { ckb: "پشکنین و پێشبینین", de: "Prüfen und Vorschau", kmr: "Kontrol û pêşdîtin", ar: "الفحص والمعاينة" },
  export: { ckb: "هەناردەکردنی JSON ـی ڕاستکراوە", de: "Korrigiertes JSON exportieren", kmr: "JSON-a rastkirî derxîne", ar: "تصدير JSON المصحّح" },
  commit: { ckb: "هاوردەکردن بۆ داتابەیس (ناچالاک)", de: "In Datenbank importieren (deaktiviert)", kmr: "Têxe databasê (neçalak)", ar: "استيراد إلى قاعدة البيانات (معطّل)" },
  commitWhy: { ckb: "داتابەیسی بەرهەمهێنان کوژاوەیە. هاوردەکردن تەنها دوای ڕەزامەندی خاوەن چالاک دەبێت.", de: "Die Produktionsdatenbank ist ausgeschaltet. Der Import wird erst nach Freigabe durch den Inhaber aktiviert.", kmr: "Databasa hilberînê girtî ye. Anîn tenê piştî pejirandina xwedî çalak dibe.", ar: "قاعدة بيانات الإنتاج متوقفة. لن يُفعَّل الاستيراد إلا بعد موافقة المالك." },
  manifest: { ckb: "لیستی سەرچاوە و پێداچوونەوەی وێنە و ڤیدیۆکان (JSON)", de: "Medien-Manifest: Herkunft und Prüfung der Bilder und Videos (JSON)", kmr: "Manîfestoya medyayê: çavkanî û kontrola wêne û vîdyoyan (JSON)", ar: "بيان الوسائط: مصدر الصور والفيديوهات ومراجعتها (JSON)" },
  register: { ckb: "تۆماری مۆڵەت لە گرێبەستی واژۆکراوەوە (JSON)", de: "Lizenzregister aus dem unterschriebenen Vertrag (JSON)", kmr: "Tomara lîsansê ji peymana îmzekirî (JSON)", ar: "سجل الترخيص من العقد الموقَّع (JSON)" },
  manual: { ckb: "زیادکردنی دەستی", de: "Manuelle Eingabe", kmr: "Têketina bi destan", ar: "إدخال يدوي" },
  add: { ckb: "زیادکردن", de: "Hinzufügen", kmr: "Zêde bike", ar: "إضافة" },
};

const emptyManual = () => ({ questionCode: "", catalogueVersion: "", licenseId: "", categoryType: "Grundstoff", points: "4", topicId: "priority", answerType: "choice", promptDe: "", promptCkb: "", a: "", aCkb: "", b: "", bCkb: "", c: "", cCkb: "", correct: "a", numeric: "", explDe: "", explCkb: "" });

export function AdminImport() {
  const label = useBiText();
  const [rows, setRows] = useState<ImportQuestion[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [licences, setLicences] = useState("");
  const [media, setMedia] = useState<Map<string, MediaManifestEntry>>(new Map());
  const [mediaErrors, setMediaErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [manual, setManual] = useState(emptyManual);
  // Coverage of the validated file against the owner target; media must be among the attached files.
  // Licence register from the signed contract. With it, licensed rows are checked against verified rights.
  const [register, setRegister] = useState<LicenseRecord[] | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const knownLicenseIds = () => new Set([...licences.split(/[\s,;]+/).filter(Boolean), ...(register ?? []).map((l) => l.id)]);
  const loadRegister = async (f: File | undefined) => {
    setPreview(null);
    if (!f) { setRegister(null); setRegisterError(null); return; }
    try { setRegister(parseLicenseRegister(await f.text())); setRegisterError(null); }
    catch (e) { setRegister(null); setRegisterError((e as Error).message); }
  };
  const [manifest, setManifest] = useState<MediaManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const shaOf = (key: string) => key.replace(/^media\//, "").replace(/\.[a-z0-9]+$/, "");
  // Provenance and instructor review of the attached files. Without a manifest no media file counts as approved.
  const manifestResult = manifest ? validateMediaManifest(manifest, {
    knownLicenses: knownLicenseIds(),
    attached: new Map([...media.values()].map((m) => [m.file, { sha256: shaOf(m.key), kind: m.kind }])),
  }) : null;
  const approvedMediaKeys = new Set((manifestResult?.approvedFiles ?? []).flatMap((f) => { const k = media.get(f)?.key; return k ? [k] : []; }));
  const catalogOptions = { mediaKeys: new Set([...media.values()].map((m) => m.key)), approvedMediaKeys };
  const validQuestions = preview && !preview.fatal ? preview.rows.flatMap((r) => (r.question ? [r.question] : [])) : null;
  const catalog = validQuestions ? catalogReport(validQuestions, catalogOptions) : null;
  const plan = validQuestions ? planCoverage(validQuestions, catalogOptions) : null;

  const loadManifest = async (f: File | undefined) => {
    if (!f) { setManifest(null); setManifestError(null); return; }
    try { setManifest(parseMediaManifest(await f.text())); setManifestError(null); }
    catch (e) { setManifest(null); setManifestError((e as Error).message); }
  };

  const loadFile = async (f: File | undefined) => {
    if (!f) return;
    setPreview(null);
    try {
      const text = await f.text();
      setRows(f.name.toLowerCase().endsWith(".csv") ? csvToImport(text) : jsonToImport(text));
      setParseError(null);
    } catch (e) { setRows([]); setParseError((e as Error).message); }
  };

  const loadMedia = async (files: FileList | null) => {
    const next = new Map<string, MediaManifestEntry>();
    const errs: string[] = [];
    for (const f of Array.from(files ?? [])) {
      const r = await checkMedia(f.name, new Uint8Array(await f.arrayBuffer()));
      if (r.ok && r.result) next.set(f.name, { file: f.name, kind: r.result.kind, key: r.result.key, bytes: r.result.bytes, mime: r.result.mime });
      else errs.push(`${f.name}: ${r.errors.join("; ")}`);
    }
    setMedia(next); setMediaErrors(errs); setPreview(null);
  };

  const validate = async () => setPreview(await validateImport(rows, {
    knownTopics: new Set(TOPICS.map((x) => x.id)),
    knownLicenses: knownLicenseIds(),
    existing: new Map(),
    media,
    // With a register the rights of the verified licence decide; without one only the id is checked.
    ...(register ? { licenses: new Map(register.map((l) => [l.id, l])), today } : {}),
  }));

  const editCkb = (i: number, path: "prompt" | "explanation" | `option:${string}`, value: string) => {
    setRows((rs) => rs.map((r, idx) => {
      if (idx !== i) return r;
      if (path === "prompt") return { ...r, prompt: { ...r.prompt, ckb: value || undefined } };
      if (path === "explanation") return { ...r, explanation: { ...r.explanation, ckb: value || undefined } };
      const id = path.slice(7);
      return { ...r, options: (r.options ?? []).map((o) => (o.id === id ? { ...o, ckb: value || undefined } : o)) };
    }));
    setPreview(null);
  };

  const addManual = () => {
    const m = manual;
    const opts = (["a", "b", "c"] as const).filter((k) => m[k].trim()).map((k) => ({ id: k, de: m[k], ckb: m[`${k}Ckb` as "aCkb"] || undefined }));
    setRows((rs) => [...rs, {
      questionCode: m.questionCode || null, catalogueVersion: m.catalogueVersion || null, sourceType: "licensed_official", licenseId: m.licenseId || null,
      categoryType: m.categoryType as ImportQuestion["categoryType"], points: Number(m.points), licenseClasses: ["B"], topicId: m.topicId,
      answerType: m.answerType as ImportQuestion["answerType"], prompt: { de: m.promptDe, ckb: m.promptCkb || undefined },
      options: m.answerType === "choice" ? opts : undefined, correct: m.answerType === "choice" ? m.correct.split(/[;,\s]+/).filter(Boolean) : undefined,
      numericAnswer: m.answerType === "number" ? Number(m.numeric.replace(",", ".")) : undefined,
      explanation: { de: m.explDe || undefined, ckb: m.explCkb || undefined }, media: [],
    }]);
    setManual(emptyManual()); setPreview(null);
  };

  const exportJson = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ questions: rows }, null, 2)], { type: "application/json" }));
    a.download = "regadrive-import.json"; a.click(); URL.revokeObjectURL(a.href);
  };

  const field = (k: keyof ReturnType<typeof emptyManual>, l: string, opts?: { dir?: "rtl" | "ltr"; area?: boolean }) => (
    <label className="stack" style={{ gap: 4 }}>
      <span className="small muted">{l}</span>
      {opts?.area
        ? <textarea className="input" style={{ minHeight: 72, paddingBlock: 8 }} dir={opts.dir ?? "ltr"} value={manual[k]} onChange={(e) => setManual({ ...manual, [k]: e.target.value })} />
        : <input className="input" dir={opts?.dir ?? "ltr"} value={manual[k]} onChange={(e) => setManual({ ...manual, [k]: e.target.value })} />}
    </label>
  );

  return (
    <div data-testid="admin-import">
      <header className="page-head"><h1><Bi t={t.title} /></h1><p className="notice small"><Bi t={t.local} /></p></header>

      <section className="card stack">
        <label className="stack" style={{ gap: 4 }}><span className="small muted">{label(t.licences)}</span>
          <input className="input" dir="ltr" value={licences} onChange={(e) => { setLicences(e.target.value); setPreview(null); }} data-testid="licences" /></label>
        <label className="stack" style={{ gap: 4 }}><span className="small muted">{label(t.file)}</span>
          <input type="file" accept=".json,.csv,application/json,text/csv" onChange={(e) => loadFile(e.target.files?.[0])} data-testid="question-file" /></label>
        {parseError && <p className="feedback bad" role="alert">{parseError}</p>}
        <label className="stack" style={{ gap: 4 }}><span className="small muted">{label(t.media)}</span>
          <input type="file" multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" onChange={(e) => loadMedia(e.target.files)} data-testid="media-files" /></label>
        {media.size > 0 && <p className="small muted" dir="ltr">{[...media.values()].map((m) => `${m.file} → ${m.key.slice(0, 18)}…`).join(" · ")}</p>}
        {mediaErrors.map((m) => <p key={m} className="feedback bad small" role="alert">{m}</p>)}
        {media.size > 0 && (
          <div className="dr-scroll" dir="ltr" data-testid="media-table">
            <table className="dr-table"><thead><tr><th>File</th><th>Kind</th><th>Size</th><th>Storage key</th><th>Review</th></tr></thead><tbody>
              {[...media.values()].map((m) => {
                const approved = manifestResult?.approvedFiles.includes(m.file);
                const issues = manifestResult?.issues.filter((i) => i.subject === m.file).length ?? 0;
                return <tr key={m.file}><td>{m.file}</td><td>{m.kind}</td><td>{(m.bytes / 1024).toFixed(1)} KB</td><td>{m.key.slice(0, 22)}…</td>
                  <td>{!manifestResult ? "no manifest" : approved ? "approved" : `${issues} open issue(s)`}</td></tr>;
              })}
            </tbody></table>
          </div>
        )}
        <label className="stack" style={{ gap: 4 }}><span className="small muted">{label(t.register)}</span>
          <input type="file" accept=".json,application/json" onChange={(e) => loadRegister(e.target.files?.[0])} data-testid="register-file" /></label>
        {registerError && <p className="feedback bad small" role="alert">{registerError}</p>}
        <div className="stack" dir="ltr" data-testid="license-report">
          {(register && register.length ? register : [undefined]).map((l, n) => {
            const list = licenseChecklist(l, today);
            const problems = l ? licenseProblems(l) : [];
            return (
              <div key={l?.id ?? n} className="stack" style={{ gap: 6 }}>
                <p className="small"><strong>{l ? `Licence ${l.id} (${l.country}) — ${l.status}` : "No licence on record"}</strong>{l ? "" : " — official content cannot be imported or published."}</p>
                <ul className="list small">{list.map((c) => <li key={c.item}>{c.done ? "✓" : "✗"} {c.item}</li>)}</ul>
                {problems.length > 0 && <p className="feedback bad small">{problems.join("; ")}</p>}
              </div>
            );
          })}
        </div>
        <label className="stack" style={{ gap: 4 }}><span className="small muted">{label(t.manifest)}</span>
          <input type="file" accept=".json,application/json" onChange={(e) => loadManifest(e.target.files?.[0])} data-testid="manifest-file" /></label>
        {manifestError && <p className="feedback bad small" role="alert">{manifestError}</p>}
        {manifestResult && (
          <div className="stack" dir="ltr" data-testid="manifest-report">
            <p className="small"><strong>Media manifest</strong> — files: {manifestResult.summary.media}; approved: {manifestResult.summary.approved}; original: {manifestResult.summary.original}; licensed: {manifestResult.summary.licensed}; AI-generated: {manifestResult.summary.aiGenerated}; scenarios: {manifestResult.summary.scenarios}.</p>
            {manifestResult.issues.length > 0 && <ul className="list small">{manifestResult.issues.map((i, n) => <li key={n}>{i.subject}: {i.kind}{i.detail ? ` — ${i.detail}` : ""}</li>)}</ul>}
          </div>
        )}
        <p className="small muted" dir="ltr" data-testid="row-count">{rows.length} rows</p>
        <div className="q-actions">
          <button type="button" className="btn btn-primary" disabled={rows.length === 0} onClick={validate} data-testid="validate"><Bi t={t.validate} /></button>
          <button type="button" className="btn btn-secondary" disabled={rows.length === 0} onClick={exportJson}><Bi t={t.export} /></button>
        </div>
      </section>

      <details className="card section">
        <summary className="section-title" style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}><Bi t={t.manual} inline /></summary>
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          {field("questionCode", "questionCode")}{field("catalogueVersion", "catalogueVersion (YYYY-MM-DD)")}{field("licenseId", "licenseId")}
          <label className="stack" style={{ gap: 4 }}><span className="small muted">categoryType</span>
            <select className="input" value={manual.categoryType} onChange={(e) => setManual({ ...manual, categoryType: e.target.value })}><option>Grundstoff</option><option>Zusatzstoff</option></select></label>
          <label className="stack" style={{ gap: 4 }}><span className="small muted">points</span>
            <select className="input" value={manual.points} onChange={(e) => setManual({ ...manual, points: e.target.value })}>{[2, 3, 4, 5].map((p) => <option key={p}>{p}</option>)}</select></label>
          <label className="stack" style={{ gap: 4 }}><span className="small muted">topicId</span>
            <select className="input" value={manual.topicId} onChange={(e) => setManual({ ...manual, topicId: e.target.value })}>{TOPICS.map((x) => <option key={x.id} value={x.id}>{x.id}</option>)}</select></label>
          <label className="stack" style={{ gap: 4 }}><span className="small muted">answerType</span>
            <select className="input" value={manual.answerType} onChange={(e) => setManual({ ...manual, answerType: e.target.value })}><option value="choice">choice</option><option value="number">number</option></select></label>
          {field("promptDe", "prompt (DE, original)", { area: true })}{field("promptCkb", "prompt (CKB)", { area: true, dir: "rtl" })}
          {manual.answerType === "choice" ? <>
            {field("a", "option a (DE)")}{field("aCkb", "option a (CKB)", { dir: "rtl" })}{field("b", "option b (DE)")}{field("bCkb", "option b (CKB)", { dir: "rtl" })}
            {field("c", "option c (DE)")}{field("cCkb", "option c (CKB)", { dir: "rtl" })}{field("correct", "correct (e.g. a;c)")}
          </> : field("numeric", "numericAnswer")}
          {field("explDe", "explanation (DE)", { area: true })}{field("explCkb", "explanation (CKB)", { area: true, dir: "rtl" })}
        </div>
        <div className="q-actions"><button type="button" className="btn btn-secondary" onClick={addManual}><Bi t={t.add} /></button></div>
      </details>

      {preview && (
        <section className="section stack" data-testid="preview">
          {preview.fatal && <p className="feedback bad" role="alert">{preview.fatal}</p>}
          <div className="chip-row" dir="ltr" data-testid="summary">
            {(["new", "update", "duplicate", "invalid"] as const).map((k) => <span key={k} className="badge">{k}: {preview.summary[k]}</span>)}
            <span className="badge badge-outline">warnings: {preview.summary.warnings}</span>
          </div>
          {catalog && (
            <div className="stack" dir="ltr" data-testid="catalog-report">
              <p className="small"><strong>Catalogue coverage</strong> — valid records in this file: {catalog.valid} of target {catalog.target}; still missing: {catalog.missing}; approved and published: {catalog.ready}. {catalog.complete ? "Target reached." : "The bank is NOT complete."}</p>
              <div className="chip-row">
                <span className="badge badge-outline">Grundstoff: {catalog.byCategory.Grundstoff}</span>
                <span className="badge badge-outline">Zusatzstoff: {catalog.byCategory.Zusatzstoff}</span>
                <span className="badge badge-outline">licensed official: {catalog.bySource.licensed_official}</span>
                <span className="badge badge-outline">original: {catalog.bySource.original}</span>
                <span className="badge badge-outline">with image: {catalog.withImage}</span>
                <span className="badge badge-outline">with video: {catalog.withVideo}</span>
                {Object.entries(catalog.issueCounts).map(([k, n]) => <span key={k} className="badge">{k}: {n}</span>)}
              </div>
            </div>
          )}
          {plan && (
            <div className="stack" dir="ltr" data-testid="plan-report">
              <p className="small"><strong>Plan per topic</strong> ({CATALOG_PLAN_STATUS === "proposed" ? "proposed quota, not yet confirmed by the owner" : "owner-confirmed quota"}) — valid / quota, ready for learners, media.</p>
              <ul className="list small">
                {plan.topics.map((x) => <li key={x.topicId}>{x.topicId} ({x.category}): {x.valid} / {x.quota} valid, {x.ready} ready, {x.missing} missing; media {x.mediaHave} / {x.withMedia}</li>)}
              </ul>
              {plan.unplanned.length > 0 && <p className="feedback bad small">Topics without a quota: {plan.unplanned.join(", ")}</p>}
            </div>
          )}
          {preview.rows.map((r) => (
            <article key={r.index} className="card stack" data-testid="preview-row" data-status={r.status}>
              <div className="row" dir="ltr"><span className="badge">{r.status}</span><strong>#{r.index + 1}</strong><span className="muted">{r.code ?? "—"}</span>
                {r.question && <span className="badge badge-outline">draft · hidden</span>}</div>
              {r.errors.map((e, i) => <p key={`e${i}`} className="small" dir="ltr" style={{ color: "var(--danger-ink)" }}>✕ {e.field}: {e.message}</p>)}
              {r.warnings.map((w, i) => <p key={`w${i}`} className="small muted" dir="ltr">⚠ {w.field}: {w.message}</p>)}
              {r.question && (
                <div className="stack">
                  <p dir="ltr" lang="de">{r.question.prompt.de}</p>
                  <textarea className="input" dir="rtl" lang="ckb" style={{ minHeight: 64, paddingBlock: 8 }} aria-label="prompt CKB"
                    defaultValue={rows[r.index]?.prompt.ckb ?? ""} onBlur={(e) => editCkb(r.index, "prompt", e.target.value)} data-testid="edit-prompt-ckb" />
                  {(rows[r.index]?.options ?? []).map((o) => (
                    <div key={o.id} className="grid grid-2">
                      <span dir="ltr" lang="de">{o.id}) {o.de}{(rows[r.index]?.correct ?? []).includes(o.id) ? " ✓" : ""}</span>
                      <input className="input" dir="rtl" lang="ckb" aria-label={`option ${o.id} CKB`} defaultValue={o.ckb ?? ""} onBlur={(e) => editCkb(r.index, `option:${o.id}`, e.target.value)} />
                    </div>
                  ))}
                  <textarea className="input" dir="rtl" lang="ckb" style={{ minHeight: 64, paddingBlock: 8 }} aria-label="explanation CKB"
                    defaultValue={rows[r.index]?.explanation?.ckb ?? ""} onBlur={(e) => editCkb(r.index, "explanation", e.target.value)} />
                </div>
              )}
            </article>
          ))}
          <div className="card stack">
            <button type="button" className="btn btn-primary" disabled aria-disabled="true" data-testid="commit"><Bi t={t.commit} /></button>
            <p className="small muted"><Bi t={t.commitWhy} /></p>
          </div>
        </section>
      )}
    </div>
  );
}
