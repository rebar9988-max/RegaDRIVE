/**
 * /dr — RegaDRIVE SUPER ADMIN control center (owner only). Every decision is made and enforced by the Worker
 * (worker/dr/handler.ts); this page only displays server state and sends requests.
 */
import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

// Loaded only after the owner signed in and opened the section.
const DrReview = lazy(() => import("./DrReview").then((m) => ({ default: m.DrReview })));
const DrContent = lazy(() => import("./DrContent").then((m) => ({ default: m.DrContent })));
import "./dr.css";

type State = "ON" | "OFF" | "LOCKED";
interface Feature { key: string; group: string; ckb: string; en: string; controllable: boolean; critical: boolean; state: State; effective: boolean; reason: string | null }
interface Overview {
  now: number; owner: string;
  system: { app: string; version: string; contentMode: string; colo: string | null };
  database: { ok: boolean; latencyMs: number; name: string; studentData: string; activeSessions: number; auditEntries: number; logins24h: number; denied24h: number; codesSent24h: number; mailFailures24h: number; backups: number };
  features: Feature[];
  ai: { id: string; status: string; detail: string }[];
  content: { total?: Record<string, number>; published?: Record<string, number>; questionReview?: Record<string, number>; languages?: string[] };
  email: { owner: string; from: string; provider: string; configured: boolean };
  payments: { enabled: boolean; checkout: boolean; webhooks: boolean; purchaseRequired: boolean; priceEur: number } | null;
  security: { sessions: { current: boolean; createdAt: number; lastSeenAt: number; ip: string | null; userAgent: string | null }[]; steppedUp: boolean; stepUpUntil: number; sessionExpiresAt: number };
  backups: { id: string; created_at: number; created_by: string; reason: string }[];
}
interface AuditEntry { id: number; at: number; actor: string; action: string; result: string; detail: string; ip: string | null }
interface CountryMetrics { questions: number; signs: number; published: number; sorani: number; badini?: number }
interface DashboardMetrics {
  de: CountryMetrics | null;
  it: CountryMetrics | null;
  students: number | null;
  progress: number | null;
  activity: Pick<AuditEntry, "id" | "at" | "action" | "result">[];
}
type ApiResult = { status: number; body: Record<string, unknown> };

async function api(path: string, body?: unknown): Promise<ApiResult> {
  try {
    const r = await fetch(path, body === undefined
      ? { credentials: "same-origin", cache: "no-store" }
      : { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-dr-request": "1" }, body: JSON.stringify(body) });
    let parsed: Record<string, unknown> = {};
    try { parsed = await r.json(); } catch { /* non-JSON */ }
    return { status: r.status, body: parsed };
  } catch {
    return { status: 0, body: { error: "NETWORK" } };
  }
}

const ERRORS: Record<string, string> = {
  NETWORK: "پەیوەندی بە سێرڤەرەوە نییە. ئینتەرنێت بپشکنە.",
  RATE_LIMITED: "هەوڵ زۆر بوو. چەند خولەکێک چاوەڕێ بکە.",
  MAIL_NOT_CONFIGURED: "ناردنی ئیمەیڵ هێشتا ڕێکنەخراوە.",
  MAIL_FAILED: "ناردنی ئیمەیڵ سەرکەوتوو نەبوو. دووبارە هەوڵ بدەوە.",
  CODE_EXPIRED: "کۆدەکە بەسەرچووە. کۆدێکی نوێ بنێرە.",
  TOO_MANY_ATTEMPTS: "هەوڵی هەڵە زۆر بوو. کۆدێکی نوێ بنێرە.",
  WRONG_CODE: "کۆدەکە هەڵەیە.",
  BAD_REQUEST: "کۆدی ٦ ژمارەیی بنووسە.",
  DR_NOT_CONFIGURED: "پانێڵەکە لەسەر سێرڤەر ڕێکنەخراوە.",
  FEATURE_LOCKED: "ئەمە تەنها بە هەنگاوی چالاککردنی خاوەن دەکرێتەوە (LOCKED).",
  UNAUTHENTICATED: "سێشنەکە کۆتایی هات. دووبارە بچۆ ژوورەوە.",
  INTERNAL: "هەڵەیەکی ناوخۆیی ڕوویدا.",
};
const errText = (r: ApiResult) => {
  const e = String(r.body.error ?? "");
  const base = ERRORS[e] ?? `هەڵە (${r.status}${e ? ` · ${e}` : ""})`;
  return e === "WRONG_CODE" && typeof r.body.attemptsLeft === "number" ? `${base} ${r.body.attemptsLeft} هەوڵ ماوە.` : base;
};
const time = (ms: number) => new Date(ms).toLocaleString("en-GB", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const SECTIONS = [
  ["dashboard", "🏠", "Dashboard"], ["features", "⚙️", "Feature Controls"], ["security", "🔐", "Security Center"], ["ai", "🤖", "AI Control"],
  ["students", "👨‍🎓", "Students"], ["questions", "📚", "Question Bank"], ["content", "📦", "Content Workbench"], ["signs", "🚦", "Traffic Signs"], ["review", "✅", "Content Review"], ["exams", "📝", "Mock Exams"],
  ["lessons", "🎓", "Lessons"], ["languages", "🌍", "Languages"], ["payments", "💳", "Payments"], ["licenses", "🔑", "Licenses"],
  ["analytics", "📊", "Analytics"], ["email", "📧", "Email Center"], ["design", "🎨", "Design Control"], ["database", "🗄️", "Database"],
  ["health", "🚀", "System Health"], ["audit", "📋", "Audit Logs"],
] as const;
type Section = (typeof SECTIONS)[number][0];

// ── sign-in ───────────────────────────────────────────────────────────────
function CodeForm({ purpose, onDone, onCancel }: { purpose: "login" | "step_up"; onDone: () => void; onCancel?: () => void }) {
  const [phase, setPhase] = useState<"idle" | "sent">("idle");
  const [to, setTo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const send = async () => {
    setBusy(true); setMsg(null);
    const r = await api("/api/dr/auth/request", { purpose });
    setBusy(false);
    if (r.status === 200) { setPhase("sent"); setTo(String(r.body.to ?? "")); setLeft(Number(r.body.expiresInSec ?? 300)); setCode(""); setMsg({ kind: "ok", text: "کۆدەکە نێردرا. Gmail ـەکەت بپشکنە." }); }
    else setMsg({ kind: "err", text: errText(r) });
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await api("/api/dr/auth/verify", { code });
    setBusy(false);
    if (r.status === 200) onDone();
    else {
      setMsg({ kind: "err", text: errText(r) });
      if (r.body.error === "CODE_EXPIRED" || r.body.error === "TOO_MANY_ATTEMPTS") setPhase("idle");
    }
  };

  return (
    <div className="stack" style={{ display: "grid", gap: 12 }}>
      {phase === "idle" ? (
        <button type="button" className="btn btn-primary btn-block" onClick={send} aria-busy={busy} disabled={busy}>
          {purpose === "login" ? "ناردنی کۆدی چوونەژوورەوە" : "ناردنی کۆدی پشتڕاستکردنەوە"}
        </button>
      ) : (
        <form onSubmit={verify} style={{ display: "grid", gap: 10 }}>
          <label htmlFor={`dr-code-${purpose}`}>کۆدی ٦ ژمارەیی کە بۆ <bdi dir="ltr">{to}</bdi> نێردرا</label>
          <input id={`dr-code-${purpose}`} className="input dr-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus />
          <small style={{ color: "var(--muted)" }}>{left > 0 ? `کار دەکات بۆ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "کۆدەکە بەسەرچووە"}</small>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.length !== 6} aria-busy={busy}>پشتڕاستکردنەوە</button>
          <button type="button" className="btn btn-secondary btn-block" onClick={send} disabled={busy}>ناردنەوەی کۆدی نوێ</button>
        </form>
      )}
      {msg && <div className={`dr-msg ${msg.kind}`} role={msg.kind === "err" ? "alert" : "status"}>{msg.text}</div>}
      {onCancel && <button type="button" className="btn btn-secondary btn-block" onClick={onCancel}>هەڵوەشاندنەوە</button>}
    </div>
  );
}

function Login({ to, onDone }: { to: string; onDone: () => void }) {
  return (
    <main className="dr-login">
      <div className="card">
        <img src="/brand/regadrive-logo.webp" width={288} height={96} alt="RegaDRIVE" />
        <h1 style={{ fontSize: "1.3rem" }}>SUPER ADMIN · /dr</h1>
        <p style={{ color: "var(--muted)" }}>کۆدی پارێزراو تەنها دەنێردرێت بۆ <bdi dir="ltr">{to || "Gmail ـی خاوەن"}</bdi>. ٥ خولەک کار دەکات.</p>
        <CodeForm purpose="login" onDone={onDone} />
      </div>
    </main>
  );
}

// ── panel pieces ──────────────────────────────────────────────────────────
function Badge({ ok, warn, children }: { ok?: boolean; warn?: boolean; children: ReactNode }) {
  return <span className={`dr-badge ${warn ? "warn" : ok ? "ok" : "bad"}`}>{children}</span>;
}
function Tile({ value, label }: { value: ReactNode; label: string }) {
  return <div className="dr-tile"><b>{value}</b><span>{label}</span></div>;
}
function Card({ title, en, children, className = "" }: { title: string; en?: string; children: ReactNode; className?: string }) {
  return <section className={`card ${className}`} style={{ display: "grid", gap: 10 }}><h2 className="dr-h">{title}{en && <small>{en}</small>}</h2>{children}</section>;
}
function FeatureRow({ f, onSet, busy }: { f: Feature; onSet: (f: Feature, s: State) => void; busy: boolean }) {
  const states: State[] = ["ON", "OFF", "LOCKED"];
  return (
    <div className="dr-row">
      <div className="dr-row-label">
        <strong>{f.ckb} {f.critical && <span className="dr-badge info">step-up</span>}</strong>
        <small dir="ltr" style={{ textAlign: "start" }}>{f.en}{f.reason ? ` — ${f.reason}` : ""}</small>
        <span style={{ marginTop: 4, display: "inline-block" }}><Badge ok={f.effective}>{f.effective ? "🟢 چالاکە" : "🔴 ناچالاکە"}</Badge></span>
      </div>
      <div className="dr-seg" role="group" aria-label={f.en}>
        {states.map((s) => (
          <button key={s} type="button" className={s.toLowerCase()} aria-pressed={f.state === s}
            disabled={busy || !f.controllable || f.state === s} onClick={() => onSet(f, s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}
function Features({ list, onSet, busy, empty }: { list: Feature[]; onSet: (f: Feature, s: State) => void; busy: boolean; empty?: string }) {
  if (!list.length) return <p style={{ color: "var(--muted)" }}>{empty ?? "—"}</p>;
  return <div>{list.map((f) => <FeatureRow key={f.key} f={f} onSet={onSet} busy={busy} />)}</div>;
}
const Note = ({ children }: { children: ReactNode }) => <div className="dr-msg note">{children}</div>;

function AuditTable() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const load = useCallback(() => api("/api/dr/audit?limit=150").then((r) => setRows(r.status === 200 ? (r.body.entries as AuditEntry[]) : [])), []);
  useEffect(() => {
    let live = true;
    api("/api/dr/audit?limit=150").then((r) => { if (live) setRows(r.status === 200 ? (r.body.entries as AuditEntry[]) : []); });
    return () => { live = false; };
  }, []);
  if (!rows) return <p aria-busy="true">…</p>;
  return (
    <div className="dr-scroll">
      <button type="button" className="btn btn-secondary btn-sm" onClick={load}>نوێکردنەوە</button>
      <table className="dr-table">
        <thead><tr><th>کات</th><th>کردار</th><th>ئەنجام</th><th>IP</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="ltr">{time(r.at)}</td>
              <td className="ltr">{r.action}<br /><small style={{ color: "var(--muted)" }}>{r.detail !== "{}" ? r.detail : ""}</small></td>
              <td><Badge ok={r.result === "allowed"} warn={r.result === "failed"}>{r.result}</Badge></td>
              <td className="ltr">{r.ip ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SECTION_NAMES = {
  dashboard: "پوختە", features: "ڕێکخستنەکان", security: "پاراستن", ai: "یاریدەدەری زیرەک",
  students: "خوێندکاران", questions: "بانکی پرسیار", content: "بەڕێوەبردنی ناوەڕۆک", signs: "نیشانەکانی هاتوچۆ",
  review: "پشکنینی مرۆیی", exams: "تاقیکردنەوەی تاقیکاری", lessons: "وانەکان", languages: "زمان و وەرگێڕان",
  payments: "پارەدان", licenses: "مۆڵەتەکان", analytics: "ئامار و پێشکەوتن", email: "ناوەندی ئیمەیڵ",
  design: "دیزاین", database: "داتابەیس", health: "دۆخی سیستەم", audit: "تۆماری چالاکی",
} satisfies Record<Section, string>;
const EMPTY = "داتا بەردەست نییە";

function CountryOverview({ metrics, go }: { metrics: DashboardMetrics | null; go: (section: Section) => void }) {
  const [country, setCountry] = useState<"DE" | "IT">("DE");
  const [chart, setChart] = useState<"translations" | "publication">("translations");
  const stats = country === "DE" ? metrics?.de : metrics?.it;
  const series = chart === "publication"
    ? [["نیشانکراو بە بڵاوکراوە لە داتابەیس", stats?.published]] as const
    : [["سۆرانی", stats?.sorani], ["بادینی دهۆکی", stats?.badini]] as const;
  return <section className="card dr-country">
    <div className="dr-card-head">
      <h2 className="dr-h">ناوەڕۆک بە پێی وڵات</h2>
      <div className="dr-actions" role="group" aria-label="وڵات">
        <button type="button" className="dr-chip" aria-pressed={country === "DE"} onClick={() => setCountry("DE")}>🇩🇪 ئەڵمانیا</button>
        <button type="button" className="dr-chip" aria-pressed={country === "IT"} onClick={() => setCountry("IT")}>🇮🇹 ئیتاڵیا</button>
      </div>
    </div>
    {stats ? <>
      <div className="dr-grid">
        <Tile value={stats.questions} label="پرسیاری تۆمارکراو" />
        <Tile value={stats.signs} label="نیشانەی تۆمارکراو" />
      </div>
      <div className="dr-card-head">
        <h3>{chart === "translations" ? "دەق و ڕوونکردنەوەی پرسیار" : "دۆخی بڵاوکردنەوە"}</h3>
        <select className="input dr-chart-select" aria-label="جۆری ئامار" value={chart} onChange={(e) => setChart(e.target.value === "publication" ? "publication" : "translations")}>
          <option value="translations">وەرگێڕان</option><option value="publication">بڵاوکردنەوە</option>
        </select>
      </div>
      {stats.questions > 0 ? series.map(([label, count]) => <div className="dr-meter" key={label}>
        <span>{label}</span><bdi>{count === undefined ? EMPTY : `${count} / ${stats.questions}`}</bdi>
        {count !== undefined && <meter aria-label={label} max={stats.questions} value={count} />}
      </div>) : <p className="dr-empty">هیچ پرسیارێک تۆمار نەکراوە.</p>}
    </> : <p className="dr-empty">{EMPTY}</p>}
    <div className="dr-actions">
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => go("content")}>بەڕێوەبردنی ناوەڕۆک</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => go("review")}>پشکنینی مرۆیی</button>
    </div>
  </section>;
}

// ── main ──────────────────────────────────────────────────────────────────
export function DrAdmin() {
  const [auth, setAuth] = useState<{ checked: boolean; ok: boolean; to: string; error?: string }>({ checked: false, ok: false, to: "" });
  const [data, setData] = useState<Overview | null>(null);
  const [section, setSection] = useState<Section>("dashboard");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [stepUp, setStepUp] = useState<null | (() => Promise<void>)>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [search, setSearch] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    document.title = "RegaDRIVE · SUPER ADMIN";
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  const applySession = useCallback((r: ApiResult) => {
    if (r.status !== 200) setAuth({ checked: true, ok: false, to: "", error: errText(r) });
    else setAuth({ checked: true, ok: r.body.authenticated === true, to: String(r.body.to ?? r.body.email ?? "") });
  }, []);
  const applyOverview = useCallback((r: ApiResult) => {
    if (r.status === 401) { setAuth((a) => ({ ...a, ok: false })); setData(null); }
    else if (r.status === 200) setData(r.body as unknown as Overview);
    else setFlash({ kind: "err", text: errText(r) });
  }, []);
  const checkSession = useCallback(() => api("/api/dr/session").then(applySession), [applySession]);
  const load = useCallback(async () => {
    const [overview, dashboard, status] = await Promise.all([
      api("/api/dr/overview"), api("/api/dr/dashboard"), api("/api/health"),
    ]);
    applyOverview(overview);
    setMetrics(dashboard.status === 200 ? dashboard.body as unknown as DashboardMetrics : null);
    setHealth(status.status === 200 ? status.body : { ok: false });
  }, [applyOverview]);
  useEffect(() => { api("/api/dr/session").then(applySession); }, [applySession]);
  useEffect(() => { if (auth.ok) void load(); }, [auth.ok, load]);

  // Runs a mutating request; asks for a fresh e-mail code when the server requires step-up, then retries once.
  const mutate = useCallback(async (path: string, body: unknown, okText: string) => {
    const run = async () => {
      setBusy(true);
      const r = await api(path, body);
      setBusy(false);
      if (r.status === 200) { setFlash({ kind: "ok", text: okText }); await load(); return true; }
      if (r.body.error === "STEP_UP_REQUIRED") return false;
      setFlash({ kind: "err", text: errText(r) });
      if (r.status === 401) await checkSession();
      return true;
    };
    if (!(await run())) setStepUp(() => async () => { setStepUp(null); await run(); });
  }, [load, checkSession]);

  const setFeature = (f: Feature, s: State) => {
    if (f.key === "emergency_lock" && s === "ON" && !confirm("قوفڵی کاتی هەموو تایبەتمەندییە گشتییەکان ڕادەگرێت. دڵنیایت؟")) return;
    void mutate("/api/dr/features", { key: f.key, state: s }, `${f.ckb}: ${s}`);
  };
  const logout = async () => { await api("/api/dr/auth/logout", {}); setData(null); setAuth((a) => ({ ...a, ok: false })); void checkSession(); };

  if (!auth.checked) return <div className="dr dr-login" aria-busy="true"><img src="/brand/regadrive-logo.webp" width={288} height={96} alt="RegaDRIVE" /></div>;
  if (auth.error) return <div className="dr dr-login"><div className="card"><div className="dr-msg err" role="alert">{auth.error}</div></div></div>;
  if (!auth.ok) return <div className="dr" dir="rtl" lang="ckb"><Login to={auth.to} onDone={() => void checkSession()} /></div>;

  const go = (next: Section) => {
    setSection(next);
    setSearch("");
    document.getElementById("dr-section-title")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  };
  const filteredSections = SECTIONS.filter(([key, , label]) =>
    `${SECTION_NAMES[key]} ${label}`.toLowerCase().includes(search.trim().toLowerCase()));
  const activity = metrics?.activity.filter((entry) => activityFilter === "all" || entry.result === activityFilter);

  const fs = data?.features ?? [];
  const byGroup = (g: string) => fs.filter((f) => f.group === g);
  const pick = (...keys: string[]) => fs.filter((f) => keys.includes(f.key));
  const emergency = fs.find((f) => f.key === "emergency_lock");
  const c = data?.content ?? {};
  const aiActive = (data?.ai ?? []).filter((a) => a.status === "ACTIVE").length;

  const body = (): ReactNode => {
    if (!data) return <p aria-busy={flash?.kind !== "err"}>{flash?.kind === "err" ? EMPTY : "داتا باردەکرێت…"}</p>;
    const db = data.database;
    switch (section) {
      case "dashboard": return (<>
        {emergency && <Card title="قوفڵی کاتی" en="Emergency Lock" className={emergency.state === "ON" ? "dr-emergency" : ""}><Features list={[emergency]} onSet={setFeature} busy={busy} /></Card>}
        <div className="dr-grid dr-kpis">
          <Tile value={db.activeSessions} label="سێشنی بەڕێوەبەری چالاک" />
          <Tile value={db.logins24h} label="چوونەژوورەوە · ٢٤ کاتژمێر" />
          <Tile value={db.denied24h} label="داواکاریی ڕەتکراوە · ٢٤ کاتژمێر" />
          <Tile value={`${aiActive} / ${data.ai.length}`} label="دابینکەری زیرەکی چالاک" />
        </div>
        <CountryOverview metrics={metrics} go={go} />
        <Card title="دوایین چالاکییەکان">
          <select className="input dr-chart-select" aria-label="پاڵاوتنی چالاکی" value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)}>
            <option value="all">هەموو ئەنجامەکان</option><option value="allowed">ڕێگەپێدراو</option><option value="denied">ڕەتکراوە</option><option value="failed">شکستخواردوو</option>
          </select>
          {activity?.length ? <ol className="dr-timeline">{activity.map((entry) => <li key={entry.id}>
            <bdi>{entry.action}</bdi><time dateTime={new Date(entry.at).toISOString()} dir="ltr">{time(entry.at)}</time>
            <Badge ok={entry.result === "allowed"} warn={entry.result === "failed"}>{entry.result}</Badge>
          </li>)}</ol> : <p className="dr-empty">{activity ? "چالاکییەک لەم پاڵاوتنەدا نییە." : EMPTY}</p>}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => go("audit")}>هەموو تۆمارەکان</button>
        </Card>
      </>);
      case "features": return (<>
        <Note>🟢 ON چالاک · 🔴 OFF ناچالاک · 🟡 LOCKED ئامادەیە بەڵام پێویستی بە پشتڕاستکردنەوەی خاوەن هەیە. هەموو دۆخەکان لەسەر سێرڤەر جێبەجێ دەکرێن.</Note>
        <Card title="پاراستن" en="Safety"><Features list={byGroup("safety")} onSet={setFeature} busy={busy} /></Card>
        <Card title="AI"><Features list={byGroup("ai")} onSet={setFeature} busy={busy} /></Card>
        <Card title="خوێندکاران" en="Students"><Features list={byGroup("students")} onSet={setFeature} busy={busy} /></Card>
        <Card title="ناوەڕۆک" en="Content"><Features list={byGroup("content")} onSet={setFeature} busy={busy} /></Card>
        <Card title="پارەدان" en="Payments"><Features list={byGroup("payments")} onSet={setFeature} busy={busy} /></Card>
      </>);
      case "security": return (<>
        <Card title="سێشنی ئێستا" en="Current session">
          <p>Owner: <bdi dir="ltr">{data.owner}</bdi></p>
          <p>بەسەردەچێت: <bdi dir="ltr">{time(data.security.sessionExpiresAt)}</bdi> (٣٠ خولەک بێ چالاکی / ٨ کاتژمێر)</p>
          <p>Step-up: {data.security.steppedUp ? <Badge ok>{`valid until ${time(data.security.stepUpUntil)}`}</Badge> : <Badge warn>needed for critical changes</Badge>}</p>
          <div className="dr-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={logout}>چوونەدەرەوە</button></div>
        </Card>
        {emergency && <Card title="قوفڵی کاتی" en="Emergency Lock"><Features list={[emergency]} onSet={setFeature} busy={busy} /></Card>}
        <Card title="سێشنە چالاکەکان" en="Active sessions">
          <div className="dr-scroll"><table className="dr-table"><thead><tr><th>دەستپێک</th><th>دوایین چالاکی</th><th>IP / Device</th></tr></thead><tbody>
            {data.security.sessions.map((s, i) => <tr key={i}><td className="ltr">{time(s.createdAt)}{s.current ? " ★" : ""}</td><td className="ltr">{time(s.lastSeenAt)}</td><td className="ltr">{s.ip}<br /><small>{(s.userAgent ?? "").slice(0, 60)}</small></td></tr>)}
          </tbody></table></div>
          <div className="dr-actions"><button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void mutate("/api/dr/sessions/revoke-others", {}, "سێشنەکانی تر داخران")}>داخستنی هەموو سێشنەکانی تر</button></div>
        </Card>
        <Card title="ڕێسا پارێزراوەکان" en="Protections">
          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
            <li>کۆد تەنها بۆ یەک Gmail: <bdi dir="ltr">{data.owner}</bdi></li>
            <li>کۆد ٥ خولەک · زۆرترین ٥ هەوڵ · سنووری ناردن بۆ هەر IP</li>
            <li>Cookie: HttpOnly · Secure · SameSite=Strict</li>
            <li>هیچ بەڕێوەبەرێکی تر نییە؛ ناتوانرێت دەسەڵات زیاد بکرێت</li>
          </ul>
        </Card>
      </>);
      case "ai": return (<>
        <Card title="کۆنترۆڵی AI" en="Free tiers only · €0 limit"><Features list={byGroup("ai")} onSet={setFeature} busy={busy} /></Card>
        <Card title="دۆخی دابینکەرەکان" en="Provider status">
          {data.ai.map((a) => <div className="dr-row" key={a.id}><div className="dr-row-label"><strong dir="ltr" style={{ textAlign: "start" }}>{a.id}</strong><small dir="ltr" style={{ textAlign: "start" }}>{a.detail}</small></div><Badge ok={a.status === "ACTIVE"} warn={a.status === "RATE_LIMITED" || a.status === "NOT_CONFIGURED"}>{a.status}</Badge></div>)}
        </Card>
      </>);
      case "students": return (<Card title="خوێندکاران" en="Students">
        <Features list={pick("student_accounts")} onSet={setFeature} busy={busy} />
        <Tile value={metrics?.students ?? EMPTY} label="هەژماری خوێندکاری تۆمارکراو لە بەشی ئەڵمانیا" />
        <Note>پێشکەوتنی ناوخۆیی خوێندکاران لە ئاماری هەژمارەکاندا نییە.</Note>
      </Card>);
      case "questions": return (<Card title="بانکی پرسیار" en="Question Bank">
        <div className="dr-grid">
          <Tile value={c.total?.questions ?? 0} label="هەموو پرسیارەکان" />
          <Tile value={c.published?.questions ?? 0} label="بڵاوکراوە (approved)" />
          <Tile value={c.questionReview?.pending ?? 0} label="چاوەڕێی پێداچوونەوە" />
          <Tile value={c.questionReview?.draft ?? 0} label="ڕەشنووس" />
        </div>
        <Features list={pick("official_question_bank", "content_import")} onSet={setFeature} busy={busy} />
        <Note>پرسیارەکان تەنها دوای پێداچوونەوەی مرۆیی بڵاو دەکرێنەوە (docs/CONTENT_REVIEW.md).</Note>
      </Card>);
      case "signs": return (<Card title="نیشانەکانی هاتوچۆ" en="Traffic Signs"><div className="dr-grid"><Tile value={c.total?.signs ?? 0} label="هەموو" /><Tile value={c.published?.signs ?? 0} label="بڵاوکراوە" /></div></Card>);
      case "lessons": return (<Card title="وانەکان" en="Lessons"><div className="dr-grid"><Tile value={c.total?.lessons ?? 0} label="هەموو" /><Tile value={c.published?.lessons ?? 0} label="بڵاوکراوە" /><Tile value={c.total?.vocabulary ?? 0} label="وشەنامە" /></div></Card>);
      case "exams": return (<Card title="تاقیکردنەوەی تاقیکاری" en="Mock Exams">
        <div className="dr-grid"><Tile value={c.published?.questions ?? 0} label="پرسیاری بەردەست بۆ تاقیکردنەوە" /></div>
        <Features list={pick("official_mock_exams")} onSet={setFeature} busy={busy} />
      </Card>);
      case "languages": return (<Card title="زمانەکان" en="Languages">
        <div className="dr-row"><div className="dr-row-label"><strong>کوردیی سۆرانی</strong><small>ckb · RTL · سەرەکی</small></div><Badge ok>ON</Badge></div>
        <div className="dr-row"><div className="dr-row-label"><strong>Kurdî (Kurmancî)</strong><small>kmr · LTR · کرمانجی</small></div><Badge ok>ON</Badge></div>
        <div className="dr-row"><div className="dr-row-label"><strong>العربية</strong><small>ar · RTL · عەرەبی</small></div><Badge ok>ON</Badge></div>
        <div className="dr-row"><div className="dr-row-label"><strong>Deutsch</strong><small>de · LTR · دووەم</small></div><Badge ok>ON</Badge></div>
        <Note>دیزاین لە هەموو زمانەکاندا وەک خۆی دەمێنێتەوە (ڕاست بۆ چەپ)؛ تەنها دەقەکان دەگۆڕێن.</Note>
      </Card>);
      case "payments": return (<Card title="سیستەمی پارەدان" en="Payments">
        <Note>🟡 پارەدان ئامادەیە بەڵام LOCKED ـە. تەنها بە بڕیاری خۆت و هەنگاوەکانی docs/OWNER_ACTIVATION.md §4 دەکرێتەوە؛ ئەم پانێڵە ناتوانێت پارەدان چالاک بکات.</Note>
        <div className="dr-grid"><Tile value={`€${data.payments?.priceEur ?? 20}`} label="Lifetime" /><Tile value={<Badge warn>LOCKED</Badge>} label="Checkout" /></div>
        <Features list={byGroup("payments").filter((f) => f.key !== "license_enforcement")} onSet={setFeature} busy={busy} />
      </Card>);
      case "licenses": return (<Card title="مۆڵەتەکان" en="Licenses"><Features list={pick("license_enforcement")} onSet={setFeature} busy={busy} /><Note>مۆڵەتی بەکارهێنان پێویستی بە پارەدان و داتابەیسی خوێندکاران هەیە.</Note></Card>);
      case "analytics": return (<Card title="ئامار" en="Analytics (24h)">
        <div className="dr-grid">
          <Tile value={db.logins24h} label="چوونەژوورەوەی admin" /><Tile value={db.codesSent24h} label="کۆدی نێردراو" />
          <Tile value={db.denied24h} label="داواکاری ڕەتکراوە" /><Tile value={db.auditEntries} label="کۆی تۆمارەکان" />
        </div>
        <Tile value={metrics?.progress ?? EMPTY} label="خوێندکارانی ئەڵمانیا کە پێشکەوتنیان هاوکات کردووە" />
      </Card>);
      case "email": return (<Card title="ناوەندی ئیمەیڵ" en="Email Center">
        <div className="dr-row"><div className="dr-row-label"><strong>وەرگر (تەنها)</strong><small dir="ltr" style={{ textAlign: "start" }}>{data.email.owner}</small></div><Badge ok>OWNER</Badge></div>
        <div className="dr-row"><div className="dr-row-label"><strong>نێرەر</strong><small dir="ltr" style={{ textAlign: "start" }}>{data.email.from} · {data.email.provider}</small></div><Badge ok={data.email.configured}>{data.email.configured ? "CONFIGURED" : "MISSING KEY"}</Badge></div>
        <div className="dr-grid"><Tile value={db.codesSent24h} label="نێردراو (24h)" /><Tile value={db.mailFailures24h} label="شکستی ناردن (24h)" /></div>
      </Card>);
      case "design": return (<Card title="کۆنترۆڵی دیزاین" en="Design Control">
        <img src="/brand/regadrive-logo.webp" width={288} height={96} alt="RegaDRIVE logo" />
        <div className="dr-swatches" aria-label="Palette">{["--primary", "--primary-bright", "--success", "--warning", "--danger", "--ink", "--canvas"].map((v) => <span key={v} className="dr-swatch" title={v} style={{ background: `var(${v})` }} />)}</div>
        <Note>لۆگۆ و ڕەنگەکان پارێزراون. گۆڕینیان تەنها بە PR و پشتڕاستکردنەوەی تۆ دەکرێت، نەک لە پانێڵەوە.</Note>
      </Card>);
      case "database": return (<>
        <Card title="داتابەیس" en="Cloudflare D1 · regadrive-db">
          <div className="dr-grid"><Tile value={<Badge ok>OK</Badge>} label={`${db.latencyMs} ms`} /><Tile value={db.auditEntries} label="Audit entries" /><Tile value={db.backups} label="Restore points" /><Tile value={db.studentData === "on" ? "ON" : "OFF"} label="Student data" /></div>
          <Note>Cloudflare D1 Time Travel دەتوانێت هەموو داتابەیسەکە بۆ هەر خولەکێکی ٣٠ ڕۆژی ڕابردوو بگەڕێنێتەوە.</Note>
        </Card>
        <Card title="خاڵی گەڕانەوە" en="System backup (feature controls)">
          <div className="dr-actions"><button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void mutate("/api/dr/backups", {}, "خاڵی گەڕانەوە دروست کرا")}>دروستکردنی خاڵی گەڕانەوە</button></div>
          {data.backups.map((b) => <div className="dr-row" key={b.id}><div className="dr-row-label"><strong dir="ltr" style={{ textAlign: "start" }}>{time(b.created_at)}</strong><small dir="ltr" style={{ textAlign: "start" }}>{b.reason}</small></div>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { if (confirm("گەڕاندنەوەی ئەم خاڵە؟")) void mutate("/api/dr/backups/restore", { id: b.id }, "گەڕێندرایەوە"); }}>گەڕاندنەوە</button></div>)}
        </Card>
      </>);
      case "health": return (<Card title="دۆخی سیستەم" en="System Health">
        <div className="dr-grid">
          <Tile value={health?.ok === true ? <Badge ok>OK</Badge> : <Badge>{health ? "ERROR" : "…"}</Badge>} label="/api/health" />
          <Tile value={data.system.contentMode} label="Content mode" />
          <Tile value={data.system.colo ?? "—"} label="Cloudflare edge" />
          <Tile value={`${db.latencyMs} ms`} label="D1 latency" />
        </div>
        <div className="dr-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>نوێکردنەوە</button></div>
      </Card>);
      case "content": return <Card title="کارگەی ناوەڕۆک" en="Content Workbench"><Suspense fallback={<div aria-busy="true" />}><DrContent /></Suspense></Card>;
      case "review": return <Card title="پێداچوونەوە و پەسەندکردنی ناوەڕۆک" en="Content Review & Approval"><Suspense fallback={<div aria-busy="true" />}><DrReview api={api} onNeedStepUp={(retry) => setStepUp(() => async () => { setStepUp(null); await retry(); })} /></Suspense></Card>;
      case "audit": return <Card title="تۆماری گۆڕانکارییەکان" en="Audit Logs"><AuditTable /></Card>;
    }
  };

  return (
    <div className="dr dr-workspace" dir="rtl" lang="ckb">
      <header className="dr-top">
        <img src="/brand/regadrive-logo.webp" width={120} height={40} alt="RegaDRIVE" />
        <div className="dr-search">
          <label className="dr-sr" htmlFor="dr-search">گەڕان لە بەشەکان</label>
          <input id="dr-search" type="search" className="input" placeholder="گەڕان لە هەموو بەشەکان…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Escape") setSearch("");
            if (e.key === "Enter" && search.trim() && filteredSections[0]) go(filteredSections[0][0]);
          }} />
          {search.trim() && <ul className="dr-search-results">
            {filteredSections.length ? filteredSections.map(([key]) => <li key={key}><button type="button" onClick={() => go(key)}>{SECTION_NAMES[key]}</button></li>) : <li>هیچ بەشێک نەدۆزرایەوە.</li>}
          </ul>}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>نوێکردنەوە</button>
      </header>
      <nav className="dr-nav" aria-label="بەشەکانی بەڕێوەبەری">
        {SECTIONS.map(([key, icon]) => (
          <button key={key} type="button" className="dr-chip" aria-current={section === key ? "page" : undefined} onClick={() => go(key)}>
            <span aria-hidden="true">{icon}</span><span>{SECTION_NAMES[key]}</span>
          </button>
        ))}
      </nav>
      <main className="dr-main" id="main">
        <div className="dr-card-head dr-heading">
          <h1 tabIndex={-1} id="dr-section-title">{SECTION_NAMES[section]}</h1>
          {data && <small>نوێکراوەتەوە <time dateTime={new Date(data.now).toISOString()} dir="ltr">{time(data.now)}</time></small>}
        </div>
        {emergency?.state === "ON" && <div className="dr-msg err" role="alert">🚨 قوفڵی کاتی چالاکە — تایبەتمەندییە گشتییەکان ڕاگیراون.</div>}
        {flash && <div className={`dr-msg ${flash.kind}`} role={flash.kind === "err" ? "alert" : "status"} onClick={() => setFlash(null)}>{flash.text}</div>}
        {body()}
      </main>
      {data && <aside className="dr-aside" aria-label="هەژمار و دۆخی سیستەم">
        <Card title="هەژماری بەڕێوەبەر" className="dr-profile">
          <img src="/brand/regadrive-emblem.webp" width={64} height={64} alt="" />
          <strong lang="en" dir="ltr">SUPER ADMIN</strong>
          <bdi dir="ltr">{data.owner}</bdi>
          <div className="dr-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => go("security")}>پاراستن</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>دەرچوون</button>
          </div>
        </Card>
        <Card title="دۆخی سیستەم">
          <div className="dr-row"><span>داتابەیس</span><Badge ok={data.database.ok}>{data.database.ok ? `${data.database.latencyMs} ms` : "ERROR"}</Badge></div>
          <div className="dr-row"><span>API</span><Badge ok={health?.ok === true}>{health ? health.ok === true ? "OK" : "ERROR" : "…"}</Badge></div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => go("health")}>وردەکاری</button>
        </Card>
        <Card title="ئاگادارکردنەوە · ٢٤ کاتژمێر">
          <div className="dr-row"><span>داواکاریی ڕەتکراوە</span><b>{data.database.denied24h}</b></div>
          <div className="dr-row"><span>شکستی ناردنی ئیمەیڵ</span><b>{data.database.mailFailures24h}</b></div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => go("audit")}>تۆماری چالاکی</button>
        </Card>
        <Card title="کارە خێراکان">
          {(["questions", "signs", "review", "database"] as const).map((key) =>
            <button type="button" className="btn btn-secondary btn-sm" key={key} onClick={() => go(key)}>{SECTION_NAMES[key]}</button>)}
        </Card>
      </aside>}
      {stepUp && (
        <div className="dr-dialog-back">
          <div className="dr-dialog" role="dialog" aria-modal="true" aria-labelledby="dr-stepup-title">
            <h2 id="dr-stepup-title" style={{ fontSize: "1.1rem" }}>پشتڕاستکردنەوەی دووبارە</h2>
            <p style={{ color: "var(--muted)" }}>ئەم گۆڕانکارییە گرنگە. کۆدێکی نوێ بۆ Gmail ـەکەت دەنێردرێت.</p>
            <CodeForm purpose="step_up" onDone={() => void stepUp()} onCancel={() => setStepUp(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
