import "./italy.css";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useApp } from "../app/state";
import { Link } from "../app/router";
import { Bi, useBiText } from "../components/Bi";
import { Icon, type IconName } from "../components/Icon";
import { ITU } from "../content/italy/ui";
import type { ItText } from "../content/italy/types";
import { PATENTE_B_RULES_IT } from "../lib/shared/examIt";
import { emptyProgress, mergeProgress, normalizeProgress } from "../lib/progress";

/**
 * The Italian section's own account screen: free self-service registration, e-mail verification,
 * sign-in, password reset, profile, progress backup, sign-out and deletion.
 *
 * Free forever (owner rule): the Italian course asks for no payment anywhere, so this screen offers
 * no purchase, no plan and no upgrade. An account only carries the learner's progress between
 * devices; everything in the course is already open without one.
 *
 * Language isolation (owner rule, 2026-11-26): every word comes from ITU (Italian, Sorani, Badini),
 * so no screen here falls back to German. The German /account page is untouched and still serves the
 * German section. The security model is the server's and is not weakened here: the session lives in
 * an HttpOnly cookie this code never reads, and every state-changing call carries `x-rd-request`.
 */
type View = "loading" | "unavailable" | "signin" | "register" | "verify" | "forgot" | "reset" | "account";
type Scope = "form" | "account" | "backup";
type Busy = null | "form" | "signout" | "signout-all" | "save" | "restore" | "export" | "delete";
interface Student { email: string; displayName: string; lang: string; emailVerified: boolean; createdAt: number }
interface ApiResult { status: number; data: Record<string, unknown> }
interface Msg { scope: Scope; kind: "error" | "info"; t: ItText }
type Backup = { state: "checking" | "none" | "unknown" } | { state: "saved"; at: number };

const A = ITU.account;

async function api(path: string, body?: unknown): Promise<ApiResult> {
  try {
    const r = await fetch(path, body === undefined
      ? { credentials: "same-origin", headers: { accept: "application/json" } }
      : { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-rd-request": "1" }, body: JSON.stringify(body) });
    let data: Record<string, unknown> = {};
    try { data = await r.json(); } catch { /* no body */ }
    return { status: r.status, data };
  } catch {
    return { status: 0, data: { error: "NETWORK" } };
  }
}

/** The server's error codes, each answered in the learner's own language. */
const ERRORS: Record<string, ItText> = {
  INVALID_EMAIL: A.errEmail,
  WEAK_PASSWORD: A.errPassword,
  INVALID_CREDENTIALS: A.errCredentials,
  EMAIL_NOT_VERIFIED: A.errTaken,
  INVALID_CODE: A.errCode,
  RATE_LIMITED: A.errRate,
  MAIL_FAILED: A.errGeneric,
  AUTH_UNAVAILABLE: A.unavailable,
  UNAUTHENTICATED: A.errSession,
  VERSION_CONFLICT: A.errGeneric,
  PAYLOAD_TOO_LARGE: A.errGeneric,
  NETWORK: A.errNetwork,
};
const errorFor = (r: ApiResult): ItText => ERRORS[String(r.data.error ?? "")] ?? A.errGeneric;

function Field({ id, label, hint, children }: { id: string; label: ItText; hint?: ItText; children: ReactNode }) {
  return (
    <div className="ita-field">
      <label className="ita-label" htmlFor={id}><Bi t={label} /></label>
      {children}
      {hint && <p className="ita-hint" id={`${id}-hint`}><Bi t={hint} /></p>}
    </div>
  );
}

function Row({ href, icon, title, value }: { href: string; icon: IconName; title: ItText; value: ItText | string }) {
  return (
    <Link href={href} className="ita-row">
      <span className="ita-row-icon" aria-hidden="true"><Icon name={icon} /></span>
      <span className="ita-row-copy">
        <strong><Bi t={title} inline /></strong>
        <span className="ita-row-value">{typeof value === "string" ? value : <Bi t={value} inline />}</span>
      </span>
      <span className="ita-row-go" aria-hidden="true"><Icon name="arrow" /></span>
    </Link>
  );
}

export function ItalyAccount() {
  const { progress, update } = useApp();
  const label = useBiText();
  const [view, setView] = useState<View>("loading");
  const [student, setStudent] = useState<Student | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [backup, setBackup] = useState<Backup>({ state: "checking" });

  // A network or server hiccup is not a sign-out: retry before ever showing the sign-in form.
  useEffect(() => {
    let alive = true;
    (async () => {
      const flags = await api("/api/flags");
      if (!alive) return;
      if (flags.status !== 200 || flags.data.studentAuthEnabled !== true) { setView("unavailable"); return; }
      let me = await api("/api/me");
      for (let i = 0; i < 3 && (me.status === 0 || me.status >= 500) && me.status !== 503; i++) {
        await new Promise((res) => setTimeout(res, 800 * (i + 1)));
        if (!alive) return;
        me = await api("/api/me");
      }
      if (!alive) return;
      if (me.status === 200 && me.data.authenticated === true) { setStudent(me.data.student as Student); setView("account"); }
      else setView(me.status === 503 ? "unavailable" : "signin");
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (view !== "account") return;
    let alive = true;
    void api("/api/me/progress").then((r) => {
      if (!alive) return;
      if (r.status !== 200) { setBackup({ state: "unknown" }); return; }
      const at = typeof r.data.updatedAt === "number" ? r.data.updatedAt : null;
      setBackup(r.data.progress && at !== null ? { state: "saved", at } : { state: "none" });
    });
    return () => { alive = false; };
  }, [view]);

  const go = useCallback((v: View, keep = false) => {
    setView(v); setCode(""); setConfirmDelete(false);
    setMsg((m) => (keep && m?.kind === "info" ? m : null));
    requestAnimationFrame(() => document.getElementById("ita-heading")?.focus());
  }, []);

  /** The session ended on the server (expired, revoked elsewhere, account gone): back to sign-in, explained. */
  const expired = useCallback(() => {
    setStudent(null); setPassword(""); go("signin");
    setMsg({ scope: "form", kind: "info", t: A.errSession });
  }, [go]);

  const run = async (key: Exclude<Busy, null>, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key); setMsg(null);
    try { await fn(); } finally { setBusy(null); }
  };
  const fail = (scope: Scope, r: ApiResult) => {
    if (scope !== "form" && r.status === 401) { expired(); return; }
    setMsg({ scope, kind: "error", t: errorFor(r) });
  };
  const ok = (scope: Scope, t: ItText) => setMsg({ scope, kind: "info", t });
  const submit = (fn: () => Promise<void>) => (e: FormEvent) => { e.preventDefault(); void run("form", fn); };
  const signedIn = (s: Student) => { setStudent(s); setPassword(""); setCode(""); setBackup({ state: "checking" }); go("account"); };

  const doRegister = submit(async () => {
    const r = await api("/api/auth/register", { email, password, displayName: name, lang: document.documentElement.lang });
    if (r.status === 202) { setPassword(""); go("verify"); } else fail("form", r);
  });
  const doVerify = submit(async () => {
    const r = await api("/api/auth/verify-email", { email, code });
    if (r.status === 200) signedIn(r.data.student as Student); else fail("form", r);
  });
  const doResend = () => run("form", async () => {
    const r = await api("/api/auth/resend-code", { email });
    if (r.status === 202) ok("form", A.okResent); else fail("form", r);
  });
  const doLogin = submit(async () => {
    const r = await api("/api/auth/login", { email, password });
    if (r.status === 200) signedIn(r.data.student as Student);
    else if (r.data.error === "EMAIL_NOT_VERIFIED") { setPassword(""); go("verify"); fail("form", r); }
    else fail("form", r);
  });
  const doForgot = submit(async () => {
    const r = await api("/api/auth/forgot-password", { email });
    if (r.status === 202) go("reset"); else fail("form", r);
  });
  const doReset = submit(async () => {
    const r = await api("/api/auth/reset-password", { email, code, password });
    if (r.status === 200) { setPassword(""); setMsg({ scope: "form", kind: "info", t: A.okResetDone }); go("signin", true); } else fail("form", r);
  });
  const doSignOut = (all: boolean) => run(all ? "signout-all" : "signout", async () => {
    const r = await api("/api/auth/logout", { all });
    // 401 means the session is already gone — the learner is signed out either way.
    if (r.status === 200 || r.status === 401) { setStudent(null); setPassword(""); go("signin"); } else fail("account", r);
  });
  const doSave = () => run("save", async () => {
    // Loss-free: the account copy is merged with this device's progress. One retry on a concurrent write.
    for (let attempt = 0; attempt < 2; attempt++) {
      const cur = await api("/api/me/progress");
      if (cur.status !== 200) { fail("backup", cur); return; }
      const remote = normalizeProgress(cur.data.progress) ?? emptyProgress();
      const r = await api("/api/me/progress", { progress: mergeProgress(progress, remote), baseVersion: cur.data.version });
      if (r.status === 200) {
        if (typeof r.data.updatedAt === "number") setBackup({ state: "saved", at: r.data.updatedAt });
        ok("backup", A.okSaved); return;
      }
      if (r.status !== 409 || attempt === 1) { fail("backup", r); return; }
    }
  });
  const doRestore = () => run("restore", async () => {
    const cur = await api("/api/me/progress");
    if (cur.status !== 200) { fail("backup", cur); return; }
    const remote = normalizeProgress(cur.data.progress);
    if (!remote) { setBackup({ state: "none" }); ok("backup", A.okNothing); return; }
    update((local) => mergeProgress(local, remote));
    ok("backup", A.okRestored);
  });
  const doExport = () => run("export", async () => {
    const r = await api("/api/me/export");
    if (r.status !== 200) { fail("account", r); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = "regadrive-account.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    ok("account", A.okExported);
  });
  const doDelete = (e: FormEvent) => {
    e.preventDefault();
    void run("delete", async () => {
      const r = await api("/api/me/delete", { password });
      if (r.status === 200) { setStudent(null); setPassword(""); setMsg({ scope: "form", kind: "info", t: A.okDeleted }); go("signin", true); }
      else if (r.status === 401 && r.data.error === "UNAUTHENTICATED") expired();
      else setMsg({ scope: "account", kind: "error", t: errorFor(r) });
    });
  };

  const status = (scope: Scope) => (
    <div aria-live="polite" className="ita-status">
      {msg?.scope === scope && (msg.kind === "error"
        ? <p className="notice ita-error" role="alert" data-testid="italy-auth-error"><Icon name="alert" /><Bi t={msg.t} /></p>
        : <p className="notice ita-ok" role="status" data-testid="italy-auth-info"><Icon name="check" /><Bi t={msg.t} /></p>)}
    </div>
  );

  const passwordField = (id: string, t: ItText, autoComplete: string) => (
    <Field id={id} label={t} hint={A.passwordHint}>
      <input
        id={id} className="ita-input" type={show ? "text" : "password"} value={password} required minLength={10}
        autoComplete={autoComplete} aria-describedby={`${id}-hint`} onChange={(e) => setPassword(e.target.value)}
      />
      <label className="ita-show" htmlFor={`${id}-show`}>
        <input id={`${id}-show`} type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        <Bi t={A.showPassword} inline />
      </label>
    </Field>
  );
  const emailField = (id = "ita-email") => (
    <Field id={id} label={A.email}>
      <input id={id} className="ita-input" type="email" inputMode="email" value={email} required autoComplete="email" dir="ltr" onChange={(e) => setEmail(e.target.value)} />
    </Field>
  );
  const codeField = (id = "ita-code") => (
    <Field id={id} label={A.code}>
      <input id={id} className="ita-input" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} required autoComplete="one-time-code" dir="ltr" onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
    </Field>
  );
  const working = busy === "form";

  if (view === "loading") {
    return (
      <section className="stack italy-account" data-testid="italy-account">
        <h1 id="ita-heading" tabIndex={-1}><Bi t={A.title} /></h1>
        <p className="ita-hint" role="status"><Bi t={A.loading} /></p>
      </section>
    );
  }

  if (view === "unavailable") {
    return (
      <section className="stack italy-account" data-testid="italy-account">
        <h1 id="ita-heading" tabIndex={-1}><Bi t={A.title} /></h1>
        <div className="card ita-card">
          <p><Bi t={A.unavailable} /></p>
          <Link href="/" className="btn btn-primary ita-wide"><Bi t={A.openNow} inline /></Link>
        </div>
      </section>
    );
  }

  if (view === "account" && student) {
    const initial = (student.displayName || student.email).trim().charAt(0).toUpperCase() || "?";
    const saved = backup.state === "saved"
      ? `${label(A.lastSaved)}: ${new Date(backup.at).toLocaleDateString()}`
      : label(A.neverSaved);
    return (
      <section className="stack italy-account" data-testid="italy-account">
        <h1 id="ita-heading" tabIndex={-1} className="ita-h1"><Bi t={A.title} /></h1>

        <section className="card ita-profile" data-testid="italy-account-profile">
          <span className="ita-avatar" aria-hidden="true">{initial}</span>
          <strong className="ita-name">{student.displayName || student.email}</strong>
          <span className="ita-email" dir="ltr">{student.email}</span>
          <span className={`ita-chip${student.emailVerified ? " is-ok" : ""}`}>
            <Icon name={student.emailVerified ? "verified" : "alert"} />
            <Bi t={student.emailVerified ? A.verified : A.unverified} inline />
          </span>
        </section>

        <section className="ita-free" data-testid="italy-account-free">
          <span className="ita-free-icon" aria-hidden="true"><Icon name="star" /></span>
          <div className="ita-free-copy">
            <strong><Bi t={A.everything} /></strong>
            <p><Bi t={A.everythingBody} /></p>
          </div>
        </section>

        <nav className="ita-rows" aria-label={label(A.title)}>
          <Row href="/exam" icon="exam" title={A.licenseRow} value={`Patente ${PATENTE_B_RULES_IT.licenseClass}`} />
          <Row href="/progress" icon="chart" title={A.progressRow} value={ITU.tiles.statsSub} />
          <Row href="/learn" icon="book" title={A.lessonsRow} value={ITU.tiles.theorySub} />
          <Row href="/incroci" icon="sign" title={A.incrociRow} value={ITU.tiles.incrociSub} />
        </nav>

        <section className="card ita-card" aria-labelledby="ita-backup-title" data-testid="italy-account-backup">
          <h2 id="ita-backup-title" className="ita-h2"><Bi t={A.backup} /></h2>
          <p className="ita-hint"><Bi t={A.backupBody} /></p>
          <p className="ita-saved" data-testid="italy-account-saved">{saved}</p>
          {status("backup")}
          <div className="ita-actions">
            <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={doSave} data-testid="italy-account-save">
              <Icon name="cloudUp" /><Bi t={A.saveNow} inline />
            </button>
            <button type="button" className="btn" disabled={busy !== null} onClick={doRestore} data-testid="italy-account-restore">
              <Icon name="cloudDown" /><Bi t={A.restore} inline />
            </button>
          </div>
        </section>

        <section className="card ita-card" aria-labelledby="ita-data-title">
          <h2 id="ita-data-title" className="ita-h2"><Bi t={A.exportData} /></h2>
          {status("account")}
          <div className="ita-actions">
            <button type="button" className="btn" disabled={busy !== null} onClick={doExport} data-testid="italy-account-export">
              <Icon name="download" /><Bi t={A.exportData} inline />
            </button>
            <button type="button" className="btn" disabled={busy !== null} onClick={() => doSignOut(false)} data-testid="italy-account-signout">
              <Icon name="signout" /><Bi t={A.signOut} inline />
            </button>
            <button type="button" className="btn" disabled={busy !== null} onClick={() => doSignOut(true)} data-testid="italy-account-signout-all">
              <Icon name="devices" /><Bi t={A.signOutAll} inline />
            </button>
          </div>
        </section>

        <section className="card ita-card ita-danger" aria-labelledby="ita-delete-title">
          <h2 id="ita-delete-title" className="ita-h2"><Bi t={A.deleteAccount} /></h2>
          <p className="ita-hint"><Bi t={A.deleteBody} /></p>
          {!confirmDelete
            ? <button type="button" className="btn ita-wide" onClick={() => setConfirmDelete(true)} data-testid="italy-account-delete">
                <Icon name="trash" /><Bi t={A.deleteAccount} inline />
              </button>
            : <form className="ita-form" onSubmit={doDelete}>
                {passwordField("ita-del-pass", A.password, "current-password")}
                <div className="ita-actions">
                  <button type="submit" className="btn ita-btn-danger" disabled={busy !== null} data-testid="italy-account-delete-confirm"><Bi t={A.deleteConfirm} inline /></button>
                  <button type="button" className="btn" onClick={() => { setConfirmDelete(false); setPassword(""); }}><Bi t={A.cancel} inline /></button>
                </div>
              </form>}
        </section>
      </section>
    );
  }

  // ── Signed out: one welcome, then the step the learner is on ──────────
  const isRegister = view === "register";
  return (
    <section className="stack italy-account" data-testid="italy-account">
      <header className="ita-hero">
        <p className="ita-badge" data-testid="italy-account-free-badge"><Icon name="star" /><Bi t={A.free} inline /></p>
        <h1 id="ita-heading" tabIndex={-1} className="ita-h1"><Bi t={A.title} /></h1>
        <p className="ita-lead"><Bi t={A.why} /></p>
        <ul className="ita-points">
          {[A.noCard, A.keepsLocal, A.openNow].map((t, i) => (
            <li key={i}><span className="ita-tick" aria-hidden="true"><Icon name="check" /></span><Bi t={t} /></li>
          ))}
        </ul>
      </header>

      {(view === "signin" || view === "register") && (
        <>
          <div className="ita-switch" role="group" aria-label={label(A.title)}>
            <button type="button" className={`ita-tab${isRegister ? "" : " is-on"}`} aria-pressed={!isRegister} onClick={() => go("signin")} data-testid="italy-account-tab-signin">
              <Bi t={A.signIn} inline />
            </button>
            <button type="button" className={`ita-tab${isRegister ? " is-on" : ""}`} aria-pressed={isRegister} onClick={() => go("register")} data-testid="italy-account-tab-register">
              <Bi t={A.createAccount} inline />
            </button>
          </div>

          <form className="card ita-card ita-form" onSubmit={isRegister ? doRegister : doLogin} data-testid={isRegister ? "italy-account-register" : "italy-account-signin"}>
            {isRegister && (
              <Field id="ita-name" label={A.name}>
                <input id="ita-name" className="ita-input" type="text" value={name} required maxLength={60} autoComplete="name" onChange={(e) => setName(e.target.value)} />
              </Field>
            )}
            {emailField()}
            {passwordField("ita-pass", A.password, isRegister ? "new-password" : "current-password")}
            {status("form")}
            <button type="submit" className="btn btn-primary ita-wide" disabled={working} data-testid="italy-account-submit">
              <Bi t={isRegister ? A.createFree : A.signIn} inline />
            </button>
            {!isRegister && (
              <button type="button" className="ita-link" onClick={() => go("forgot")} data-testid="italy-account-forgot"><Bi t={A.forgot} inline /></button>
            )}
          </form>
        </>
      )}

      {view === "verify" && (
        <form className="card ita-card ita-form" onSubmit={doVerify} data-testid="italy-account-verify">
          <h2 className="ita-h2"><Bi t={A.verifyTitle} /></h2>
          <p className="ita-hint"><Bi t={A.verifyBody} /></p>
          {codeField()}
          {status("form")}
          <button type="submit" className="btn btn-primary ita-wide" disabled={working} data-testid="italy-account-verify-submit"><Bi t={A.confirm} inline /></button>
          <div className="ita-actions">
            <button type="button" className="ita-link" disabled={working} onClick={doResend}><Bi t={A.resend} inline /></button>
            <button type="button" className="ita-link" onClick={() => go("signin")}><Bi t={A.back} inline /></button>
          </div>
        </form>
      )}

      {view === "forgot" && (
        <form className="card ita-card ita-form" onSubmit={doForgot} data-testid="italy-account-forgot-form">
          <h2 className="ita-h2"><Bi t={A.forgot} /></h2>
          {emailField("ita-forgot-email")}
          {status("form")}
          <button type="submit" className="btn btn-primary ita-wide" disabled={working}><Bi t={A.sendCode} inline /></button>
          <button type="button" className="ita-link" onClick={() => go("signin")}><Bi t={A.back} inline /></button>
        </form>
      )}

      {view === "reset" && (
        <form className="card ita-card ita-form" onSubmit={doReset} data-testid="italy-account-reset">
          <h2 className="ita-h2"><Bi t={A.resetTitle} /></h2>
          <p className="ita-hint"><Bi t={A.resetBody} /></p>
          {codeField("ita-reset-code")}
          {passwordField("ita-reset-pass", A.newPassword, "new-password")}
          {status("form")}
          <button type="submit" className="btn btn-primary ita-wide" disabled={working}><Bi t={A.confirm} inline /></button>
          <button type="button" className="ita-link" onClick={() => go("signin")}><Bi t={A.back} inline /></button>
        </form>
      )}
    </section>
  );
}
