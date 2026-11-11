import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useApp } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { emptyProgress, mergeProgress, type ProgressState } from "../lib/progress";
import type { Bilingual } from "../content/types";

/**
 * Student account: e-mail registration, 6-digit e-mail verification, sign-in, password reset, sign-out,
 * opt-in progress backup, data export and account deletion. The session lives in an HttpOnly cookie that
 * JavaScript never sees. Signing in never replaces the progress stored on this device.
 */
type View = "loading" | "unavailable" | "signin" | "register" | "verify" | "forgot" | "reset" | "account";
interface Student { email: string; displayName: string; lang: string; emailVerified: boolean; createdAt: number }
interface ApiResult { status: number; data: Record<string, unknown> }

async function api(path: string, body?: unknown): Promise<ApiResult> {
  try {
    const r = await fetch(path, body === undefined
      ? { credentials: "same-origin", headers: { accept: "application/json" } }
      : { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-rd-request": "1" }, body: JSON.stringify(body) });
    let data: Record<string, unknown> = {};
    try { data = await r.json(); } catch { /* empty body */ }
    return { status: r.status, data };
  } catch {
    return { status: 0, data: { error: "NETWORK" } };
  }
}

const S = {
  intro: { ckb: "هەژمارێک دروست بکە بۆ پاشەکەوتکردنی پێشکەوتنەکەت. پێشکەوتنی سەر ئەم ئامێرە هەرگیز ناسڕدرێتەوە.", de: "Erstelle ein Konto, um deinen Fortschritt zu sichern. Der Fortschritt auf diesem Gerät wird nie gelöscht.", kmr: "Hesabekî çêke da ku pêşketina xwe biparêzî. Pêşketina li ser vê amûrê qet nayê jêbirin.", ar: "أنشئ حسابًا لحفظ تقدّمك. لن يُحذف التقدّم المحفوظ على هذا الجهاز أبدًا." },
  signin: { ckb: "چوونەژوورەوە", de: "Anmelden", kmr: "Têkeve", ar: "تسجيل الدخول" },
  register: { ckb: "دروستکردنی هەژمار", de: "Konto erstellen", kmr: "Hesab çêke", ar: "إنشاء حساب" },
  email: { ckb: "ئیمەیڵ", de: "E-Mail", kmr: "E-name", ar: "البريد الإلكتروني" },
  password: { ckb: "وشەی نهێنی", de: "Passwort", kmr: "Şîfre", ar: "كلمة المرور" },
  newPassword: { ckb: "وشەی نهێنیی نوێ", de: "Neues Passwort", kmr: "Şîfreya nû", ar: "كلمة مرور جديدة" },
  passwordHint: { ckb: "لانیکەم ١٠ پیت.", de: "Mindestens 10 Zeichen.", kmr: "Herî kêm 10 tîp.", ar: "10 أحرف على الأقل." },
  showPassword: { ckb: "پیشاندانی وشەی نهێنی", de: "Passwort anzeigen", kmr: "Şîfreyê nîşan bide", ar: "إظهار كلمة المرور" },
  name: { ckb: "ناو (ئارەزوومەندانە)", de: "Name (optional)", kmr: "Nav (bijarte)", ar: "الاسم (اختياري)" },
  code: { ckb: "کۆدی ٦ ژمارەیی", de: "6-stelliger Code", kmr: "Koda 6 hejmarî", ar: "رمز من 6 أرقام" },
  verifyTitle: { ckb: "ئیمەیڵەکەت پشتڕاست بکەرەوە", de: "E-Mail bestätigen", kmr: "E-nameya xwe piştrast bike", ar: "أكّد بريدك الإلكتروني" },
  verifyText: { ckb: "کۆدێکی ٦ ژمارەییمان نارد بۆ ئیمەیڵەکەت. ١٠ خولەک کار دەکات. فۆڵدەری سپامیش بپشکنە.", de: "Wir haben dir einen 6-stelligen Code geschickt. Er ist 10 Minuten gültig. Sieh auch im Spam-Ordner nach.", kmr: "Me koda 6 hejmarî ji te re şand. 10 deqîqeyan derbasdar e. Peldanka spamê jî kontrol bike.", ar: "أرسلنا إليك رمزًا من 6 أرقام صالحًا لمدة 10 دقائق. تحقّق أيضًا من مجلد الرسائل غير المرغوب فيها." },
  verify: { ckb: "پشتڕاستکردنەوە", de: "Bestätigen", kmr: "Piştrast bike", ar: "تأكيد" },
  resend: { ckb: "ناردنەوەی کۆد", de: "Code erneut senden", kmr: "Kodê dîsa bişîne", ar: "إعادة إرسال الرمز" },
  resent: { ckb: "ئەگەر ئەم ئیمەیڵە پێویستی بە پشتڕاستکردنەوە بێت، کۆدێکی نوێ نێردرا.", de: "Falls diese Adresse noch bestätigt werden muss, wurde ein neuer Code gesendet.", kmr: "Heke ev navnîşan hê piştrastkirinê hewce bike, kodeke nû hat şandin.", ar: "إذا كان هذا العنوان لا يزال بحاجة إلى تأكيد، فقد أُرسل رمز جديد." },
  forgot: { ckb: "وشەی نهێنیت لەبیرچووە؟", de: "Passwort vergessen?", kmr: "Şîfre ji bîr kir?", ar: "نسيت كلمة المرور؟" },
  forgotText: { ckb: "ئیمەیڵەکەت بنووسە. ئەگەر هەژمارێکی پشتڕاستکراو هەبێت، کۆدێکی گۆڕینت بۆ دەنێرین.", de: "Gib deine E-Mail ein. Wenn ein bestätigtes Konto existiert, senden wir dir einen Code.", kmr: "E-nameya xwe binivîse. Heke hesabekî piştrastkirî hebe, em ê kodekê ji te re bişînin.", ar: "أدخل بريدك الإلكتروني. إذا كان هناك حساب مؤكَّد، فسنرسل إليك رمزًا." },
  sendCode: { ckb: "ناردنی کۆد", de: "Code senden", kmr: "Kodê bişîne", ar: "إرسال الرمز" },
  resetTitle: { ckb: "دانانی وشەی نهێنیی نوێ", de: "Neues Passwort festlegen", kmr: "Şîfreya nû diyar bike", ar: "تعيين كلمة مرور جديدة" },
  resetSave: { ckb: "پاشەکەوتکردنی وشەی نهێنی", de: "Passwort speichern", kmr: "Şîfreyê tomar bike", ar: "حفظ كلمة المرور" },
  resetDone: { ckb: "وشەی نهێنی گۆڕدرا. تکایە بە وشەی نهێنیی نوێ بچۆ ژوورەوە.", de: "Passwort geändert. Bitte melde dich mit dem neuen Passwort an.", kmr: "Şîfre hat guhertin. Ji kerema xwe bi şîfreya nû têkeve.", ar: "تم تغيير كلمة المرور. يرجى تسجيل الدخول بكلمة المرور الجديدة." },
  back: { ckb: "گەڕانەوە بۆ چوونەژوورەوە", de: "Zurück zur Anmeldung", kmr: "Vegere têketinê", ar: "العودة إلى تسجيل الدخول" },
  noAccount: { ckb: "هەژمارت نییە؟", de: "Noch kein Konto?", kmr: "Hesabê te tune?", ar: "ليس لديك حساب؟" },
  haveAccount: { ckb: "هەژمارت هەیە؟", de: "Schon ein Konto?", kmr: "Hesabê te heye?", ar: "لديك حساب بالفعل؟" },
  welcome: { ckb: "بەخێربێیت", de: "Willkommen", kmr: "Bi xêr hatî", ar: "مرحبًا" },
  signedInAs: { ckb: "چوویتە ژوورەوە وەک", de: "Angemeldet als", kmr: "Têketî wek", ar: "تم تسجيل الدخول باسم" },
  localSafe: { ckb: "پێشکەوتنەکەت لەسەر ئەم ئامێرە دەمێنێتەوە. دەتوانیت بە ئارەزووی خۆت کۆپییەکی لە هەژمارەکەتدا پاشەکەوت بکەیت.", de: "Dein Fortschritt bleibt auf diesem Gerät. Du kannst freiwillig eine Kopie in deinem Konto sichern.", kmr: "Pêşketina te li ser vê amûrê dimîne. Tu dikarî bi dilxwazî kopiyekê di hesabê xwe de biparêzî.", ar: "يبقى تقدّمك على هذا الجهاز. يمكنك اختياريًا حفظ نسخة في حسابك." },
  backup: { ckb: "پاشەکەوتکردنی پێشکەوتن لە هەژمار", de: "Fortschritt im Konto sichern", kmr: "Pêşketinê di hesabê de biparêze", ar: "حفظ التقدّم في الحساب" },
  restore: { ckb: "هێنانەوەی پێشکەوتن لە هەژمار", de: "Fortschritt aus dem Konto holen", kmr: "Pêşketinê ji hesabê bîne", ar: "استعادة التقدّم من الحساب" },
  backedUp: { ckb: "پێشکەوتن پاشەکەوت کرا.", de: "Fortschritt gesichert.", kmr: "Pêşketin hat parastin.", ar: "تم حفظ التقدّم." },
  restored: { ckb: "پێشکەوتن تێکەڵ کرا؛ هیچ شتێک لەم ئامێرە نەسڕایەوە.", de: "Fortschritt zusammengeführt; auf diesem Gerät wurde nichts gelöscht.", kmr: "Pêşketin hat yekkirin; li ser vê amûrê tiştek nehat jêbirin.", ar: "تم دمج التقدّم؛ لم يُحذف أي شيء من هذا الجهاز." },
  nothingSaved: { ckb: "هێشتا هیچ پێشکەوتنێک لە هەژمارەکەتدا نییە.", de: "In deinem Konto ist noch kein Fortschritt gespeichert.", kmr: "Hê di hesabê te de tu pêşketin nehatiye tomarkirin.", ar: "لا يوجد تقدّم محفوظ في حسابك بعد." },
  logout: { ckb: "چوونەدەرەوە", de: "Abmelden", kmr: "Derkeve", ar: "تسجيل الخروج" },
  logoutAll: { ckb: "چوونەدەرەوە لە هەموو ئامێرەکان", de: "Auf allen Geräten abmelden", kmr: "Ji hemû amûran derkeve", ar: "تسجيل الخروج من جميع الأجهزة" },
  privacy: { ckb: "داتا و تایبەتمەندی", de: "Daten & Datenschutz", kmr: "Dane û nepenî", ar: "البيانات والخصوصية" },
  export: { ckb: "داگرتنی داتاکانم (JSON)", de: "Meine Daten herunterladen (JSON)", kmr: "Daneyên min daxe (JSON)", ar: "تنزيل بياناتي (JSON)" },
  deleteTitle: { ckb: "سڕینەوەی هەژمار", de: "Konto löschen", kmr: "Hesabê jê bibe", ar: "حذف الحساب" },
  deleteText: { ckb: "هەژمار و کۆپیی پاشەکەوتکراوی پێشکەوتن بە یەکجاری دەسڕێنەوە. پێشکەوتنی سەر ئەم ئامێرە دەمێنێتەوە.", de: "Konto und gesicherte Fortschrittskopie werden endgültig gelöscht. Der Fortschritt auf diesem Gerät bleibt erhalten.", kmr: "Hesab û kopiya pêşketinê ya parastî bi temamî têne jêbirin. Pêşketina li ser vê amûrê dimîne.", ar: "سيُحذف الحساب ونسخة التقدّم المحفوظة نهائيًا. يبقى التقدّم على هذا الجهاز." },
  deleteConfirm: { ckb: "بە یەکجاری بیسڕەوە", de: "Endgültig löschen", kmr: "Bi temamî jê bibe", ar: "حذف نهائي" },
  deleted: { ckb: "هەژمارەکەت سڕایەوە.", de: "Dein Konto wurde gelöscht.", kmr: "Hesabê te hat jêbirin.", ar: "تم حذف حسابك." },
  unavailable: { ckb: "هەژماری قوتابی لە ئێستادا بەردەست نییە. هەموو پێشکەوتنەکەت بە سەلامەتی لەسەر ئەم ئامێرە پاشەکەوت دەکرێت.", de: "Schülerkonten sind gerade nicht verfügbar. Dein gesamter Lernfortschritt wird sicher auf diesem Gerät gespeichert.", kmr: "Hesabên xwendekaran niha ne berdest in. Hemû pêşketina te bi ewlehî li ser vê amûrê tê tomarkirin.", ar: "حسابات الطلاب غير متاحة حاليًا. يُحفظ كل تقدّمك في التعلّم بأمان على هذا الجهاز." },
  working: { ckb: "چاوەڕێ بکە…", de: "Bitte warten …", kmr: "Ji kerema xwe bisekine …", ar: "يرجى الانتظار…" },
} satisfies Record<string, Bilingual>;

const ERRORS: Record<string, Bilingual> = {
  INVALID_EMAIL: { ckb: "ئیمەیڵەکە دروست نییە.", de: "Die E-Mail-Adresse ist ungültig.", kmr: "Navnîşana e-nameyê ne derbasdar e.", ar: "عنوان البريد الإلكتروني غير صالح." },
  WEAK_PASSWORD: { ckb: "وشەی نهێنی دەبێت لانیکەم ١٠ پیت بێت و وەک ئیمەیڵەکە نەبێت.", de: "Das Passwort braucht mindestens 10 Zeichen und darf nicht deine E-Mail sein.", kmr: "Şîfre divê herî kêm 10 tîp be û ne wek e-nameya te be.", ar: "يجب أن تتكوّن كلمة المرور من 10 أحرف على الأقل وألا تكون بريدك الإلكتروني." },
  INVALID_CREDENTIALS: { ckb: "ئیمەیڵ یان وشەی نهێنی هەڵەیە.", de: "E-Mail oder Passwort ist falsch.", kmr: "E-name an şîfre şaş e.", ar: "البريد الإلكتروني أو كلمة المرور غير صحيحة." },
  EMAIL_NOT_VERIFIED: { ckb: "ئیمەیڵەکەت هێشتا پشتڕاست نەکراوەتەوە. کۆدەکە بنووسە یان کۆدێکی نوێ داوا بکە.", de: "Deine E-Mail ist noch nicht bestätigt. Gib den Code ein oder fordere einen neuen an.", kmr: "E-nameya te hê nehatiye piştrastkirin. Kodê binivîse an kodeke nû bixwaze.", ar: "لم يتم تأكيد بريدك الإلكتروني بعد. أدخل الرمز أو اطلب رمزًا جديدًا." },
  INVALID_CODE: { ckb: "کۆدەکە هەڵەیە یان بەسەرچووە. کۆدێکی نوێ داوا بکە.", de: "Der Code ist falsch oder abgelaufen. Fordere einen neuen an.", kmr: "Kod şaş e an jî dema wê derbas bûye. Kodeke nû bixwaze.", ar: "الرمز غير صحيح أو منتهي الصلاحية. اطلب رمزًا جديدًا." },
  RATE_LIMITED: { ckb: "هەوڵی زۆر دراوە. تکایە کەمێک چاوەڕێ بکە و دووبارە هەوڵ بدەرەوە.", de: "Zu viele Versuche. Bitte warte kurz und versuche es erneut.", kmr: "Gelek hewl hatin dayîn. Ji kerema xwe hinekî bisekine û dîsa biceribîne.", ar: "محاولات كثيرة جدًا. يرجى الانتظار قليلًا ثم المحاولة مرة أخرى." },
  MAIL_FAILED: { ckb: "ناردنی ئیمەیڵ سەرکەوتوو نەبوو. تکایە دواتر هەوڵ بدەرەوە.", de: "Die E-Mail konnte nicht gesendet werden. Bitte versuche es später erneut.", kmr: "E-name nehat şandin. Ji kerema xwe paşê dîsa biceribîne.", ar: "تعذّر إرسال البريد الإلكتروني. يرجى المحاولة لاحقًا." },
  AUTH_UNAVAILABLE: S.unavailable,
  NETWORK: { ckb: "پەیوەندی بە ئینتەرنێتەوە نییە. پێشکەوتنەکەت لەسەر ئەم ئامێرە پارێزراوە.", de: "Keine Internetverbindung. Dein Fortschritt bleibt auf diesem Gerät gespeichert.", kmr: "Girêdana înternetê tune. Pêşketina te li ser vê amûrê parastî ye.", ar: "لا يوجد اتصال بالإنترنت. يبقى تقدّمك محفوظًا على هذا الجهاز." },
  GENERIC: { ckb: "هەڵەیەک ڕوویدا. تکایە دووبارە هەوڵ بدەرەوە.", de: "Etwas ist schiefgelaufen. Bitte versuche es erneut.", kmr: "Tiştek xelet çû. Ji kerema xwe dîsa biceribîne.", ar: "حدث خطأ ما. يرجى المحاولة مرة أخرى." },
};
const errorFor = (r: ApiResult): Bilingual => ERRORS[String(r.data.error ?? "")] ?? ERRORS.GENERIC!;

function Field({ label, children, hint, id }: { label: Bilingual; children: ReactNode; hint?: Bilingual; id: string }) {
  const text = useBiText();
  return (
    <div className="stack auth-field">
      <label className="small auth-label" htmlFor={id}>{text(label)}</label>
      {children}
      {hint && <p className="small muted auth-hint" id={`${id}-hint`}>{text(hint)}</p>}
    </div>
  );
}

export function Account() {
  const { progress, update } = useApp();
  const text = useBiText();
  const [view, setView] = useState<View>("loading");
  const [student, setStudent] = useState<Student | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Bilingual | null>(null);
  const [info, setInfo] = useState<Bilingual | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const flags = await api("/api/flags");
      if (!alive) return;
      if (flags.status !== 200 || flags.data.studentAuthEnabled !== true) { setView("unavailable"); return; }
      const me = await api("/api/me");
      if (!alive) return;
      if (me.status === 200 && me.data.authenticated === true) { setStudent(me.data.student as Student); setView("account"); }
      else setView(me.status === 503 ? "unavailable" : "signin");
    })();
    return () => { alive = false; };
  }, []);

  const go = useCallback((v: View, keepInfo = false) => {
    setView(v); setError(null); if (!keepInfo) setInfo(null); setCode(""); setConfirmDelete(false);
    requestAnimationFrame(() => document.getElementById("auth-heading")?.focus());
  }, []);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(null); setInfo(null);
    try { await fn(); } finally { setBusy(false); }
  };
  const submit = (fn: () => Promise<void>) => (e: FormEvent) => { e.preventDefault(); void run(fn); };

  const signedIn = (s: Student) => { setStudent(s); setPassword(""); setCode(""); go("account"); };

  const doRegister = submit(async () => {
    const r = await api("/api/auth/register", { email, password, displayName: name, lang: document.documentElement.lang });
    if (r.status === 202) { setPassword(""); go("verify"); } else setError(errorFor(r));
  });
  const doVerify = submit(async () => {
    const r = await api("/api/auth/verify-email", { email, code });
    if (r.status === 200) signedIn(r.data.student as Student); else setError(errorFor(r));
  });
  const doResend = () => run(async () => {
    const r = await api("/api/auth/resend-code", { email });
    if (r.status === 202) setInfo(S.resent); else setError(errorFor(r));
  });
  const doLogin = submit(async () => {
    const r = await api("/api/auth/login", { email, password });
    if (r.status === 200) signedIn(r.data.student as Student);
    else if (r.data.error === "EMAIL_NOT_VERIFIED") { setPassword(""); go("verify"); setError(errorFor(r)); }
    else setError(errorFor(r));
  });
  const doForgot = submit(async () => {
    const r = await api("/api/auth/forgot-password", { email });
    if (r.status === 202) go("reset"); else setError(errorFor(r));
  });
  const doReset = submit(async () => {
    const r = await api("/api/auth/reset-password", { email, code, password });
    if (r.status === 200) { setPassword(""); go("signin", true); setInfo(S.resetDone); } else setError(errorFor(r));
  });
  const doLogout = (all: boolean) => run(async () => {
    await api("/api/auth/logout", { all });
    setStudent(null); go("signin");
  });
  const doBackup = () => run(async () => {
    const cur = await api("/api/me/progress");
    if (cur.status !== 200) { setError(errorFor(cur)); return; }
    const remote = (cur.data.progress as ProgressState | null) ?? emptyProgress();
    const merged = mergeProgress(progress, remote);
    const r = await api("/api/me/progress", { progress: merged, baseVersion: cur.data.version });
    if (r.status === 200) setInfo(S.backedUp); else setError(errorFor(r));
  });
  const doRestore = () => run(async () => {
    const cur = await api("/api/me/progress");
    if (cur.status !== 200) { setError(errorFor(cur)); return; }
    const remote = cur.data.progress as ProgressState | null;
    if (!remote) { setInfo(S.nothingSaved); return; }
    update((local) => mergeProgress(local, remote));
    setInfo(S.restored);
  });
  const doExport = () => run(async () => {
    const r = await api("/api/me/export");
    if (r.status !== 200) { setError(errorFor(r)); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = "regadrive-account.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const doDelete = submit(async () => {
    const r = await api("/api/me/delete", { password });
    if (r.status === 200) { setStudent(null); setPassword(""); go("signin", true); setInfo(S.deleted); } else setError(errorFor(r));
  });

  const status = (
    <div aria-live="polite" className="stack">
      {error && <p className="notice auth-error" role="alert" data-testid="auth-error">{text(error)}</p>}
      {info && <p className="notice auth-ok" role="status" data-testid="auth-info">{text(info)}</p>}
    </div>
  );
  const submitBtn = (label: Bilingual, testid: string) => (
    <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy} data-testid={testid}>{text(busy ? S.working : label)}</button>
  );
  const emailField = (
    <Field label={S.email} id="auth-email">
      <input id="auth-email" className="input" type="email" dir="ltr" required maxLength={254} autoComplete="email" inputMode="email"
        value={email} onChange={(e) => setEmail(e.target.value)} data-testid="auth-email" />
    </Field>
  );
  const passwordField = (label: Bilingual, autoComplete: "current-password" | "new-password", hint?: Bilingual) => (
    <Field label={label} id="auth-password" hint={hint}>
      <input id="auth-password" className="input" type={show ? "text" : "password"} dir="ltr" required minLength={autoComplete === "new-password" ? 10 : 1} maxLength={256}
        autoComplete={autoComplete} aria-describedby={hint ? "auth-password-hint" : undefined}
        value={password} onChange={(e) => setPassword(e.target.value)} data-testid="auth-password" />
      <label className="small auth-check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> {text(S.showPassword)}</label>
    </Field>
  );
  const codeField = (
    <Field label={S.code} id="auth-code">
      <input id="auth-code" className="input auth-code" dir="ltr" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} data-testid="auth-code" />
    </Field>
  );
  const link = (label: Bilingual, v: View, testid: string) => (
    <button type="button" className="btn btn-secondary" onClick={() => go(v)} disabled={busy} data-testid={testid}>{text(label)}</button>
  );

  let body: ReactNode;
  switch (view) {
    case "loading":
      body = <section className="card stack" aria-busy="true"><p className="muted">{text(S.working)}</p></section>;
      break;
    case "unavailable":
      body = (
        <section className="card stack" data-testid="account-unavailable">
          <img className="account-logo" src="/brand/regadrive-logo.svg" alt="RegaDRIVE" width={112} height={112} />
          <Bi t={S.unavailable} />
        </section>
      );
      break;
    case "signin":
      body = (
        <form className="card stack" onSubmit={doLogin} data-testid="signin-form" noValidate={false}>
          <img className="account-logo" src="/brand/regadrive-logo.svg" alt="RegaDRIVE" width={112} height={112} />
          <h2 id="auth-heading" tabIndex={-1}><Bi t={S.signin} /></h2>
          <Bi t={S.intro} className="small muted" />
          {status}
          {emailField}
          {passwordField(S.password, "current-password")}
          {submitBtn(S.signin, "signin-submit")}
          <div className="auth-links">
            {link(S.forgot, "forgot", "to-forgot")}
            <span className="small muted">{text(S.noAccount)}</span>
            {link(S.register, "register", "to-register")}
          </div>
        </form>
      );
      break;
    case "register":
      body = (
        <form className="card stack" onSubmit={doRegister} data-testid="register-form">
          <h2 id="auth-heading" tabIndex={-1}><Bi t={S.register} /></h2>
          <Bi t={S.intro} className="small muted" />
          {status}
          <Field label={S.name} id="auth-name">
            <input id="auth-name" className="input" maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} data-testid="auth-name" />
          </Field>
          {emailField}
          {passwordField(S.password, "new-password", S.passwordHint)}
          {submitBtn(S.register, "register-submit")}
          <div className="auth-links">
            <span className="small muted">{text(S.haveAccount)}</span>
            {link(S.signin, "signin", "to-signin")}
          </div>
        </form>
      );
      break;
    case "verify":
      body = (
        <form className="card stack" onSubmit={doVerify} data-testid="verify-form">
          <h2 id="auth-heading" tabIndex={-1}><Bi t={S.verifyTitle} /></h2>
          <Bi t={S.verifyText} className="small" />
          <p className="small" dir="ltr" data-testid="verify-email">{email}</p>
          {status}
          {codeField}
          {submitBtn(S.verify, "verify-submit")}
          <div className="auth-links">
            <button type="button" className="btn btn-secondary" onClick={doResend} disabled={busy} data-testid="resend">{text(S.resend)}</button>
            {link(S.back, "signin", "to-signin")}
          </div>
        </form>
      );
      break;
    case "forgot":
      body = (
        <form className="card stack" onSubmit={doForgot} data-testid="forgot-form">
          <h2 id="auth-heading" tabIndex={-1}><Bi t={S.forgot} /></h2>
          <Bi t={S.forgotText} className="small" />
          {status}
          {emailField}
          {submitBtn(S.sendCode, "forgot-submit")}
          <div className="auth-links">{link(S.back, "signin", "to-signin")}</div>
        </form>
      );
      break;
    case "reset":
      body = (
        <form className="card stack" onSubmit={doReset} data-testid="reset-form">
          <h2 id="auth-heading" tabIndex={-1}><Bi t={S.resetTitle} /></h2>
          <Bi t={S.verifyText} className="small" />
          <p className="small" dir="ltr">{email}</p>
          {status}
          {codeField}
          {passwordField(S.newPassword, "new-password", S.passwordHint)}
          {submitBtn(S.resetSave, "reset-submit")}
          <div className="auth-links">{link(S.back, "signin", "to-signin")}</div>
        </form>
      );
      break;
    case "account":
      body = (
        <div className="stack">
          <section className="card stack" data-testid="account-signed-in">
            <h2 id="auth-heading" tabIndex={-1}><Bi t={S.welcome} />{student?.displayName ? <span className="auth-name"> {student.displayName}</span> : null}</h2>
            <p className="small muted">{text(S.signedInAs)} <span dir="ltr" data-testid="account-email">{student?.email}</span></p>
            {status}
            <Bi t={S.localSafe} className="small" />
            <div className="auth-actions">
              <button type="button" className="btn btn-primary" onClick={doBackup} disabled={busy} data-testid="backup">{text(S.backup)}</button>
              <button type="button" className="btn btn-secondary" onClick={doRestore} disabled={busy} data-testid="restore">{text(S.restore)}</button>
            </div>
            <div className="auth-actions">
              <button type="button" className="btn btn-secondary" onClick={() => doLogout(false)} disabled={busy} data-testid="logout">{text(S.logout)}</button>
              <button type="button" className="btn btn-secondary" onClick={() => doLogout(true)} disabled={busy} data-testid="logout-all">{text(S.logoutAll)}</button>
            </div>
          </section>
          <section className="card stack">
            <h2 className="section-title"><Bi t={S.privacy} /></h2>
            <button type="button" className="btn btn-secondary" onClick={doExport} disabled={busy} data-testid="export">{text(S.export)}</button>
            {!confirmDelete ? (
              <button type="button" className="btn btn-secondary auth-danger" onClick={() => { setConfirmDelete(true); setPassword(""); }} disabled={busy} data-testid="delete-start">{text(S.deleteTitle)}</button>
            ) : (
              <form className="stack" onSubmit={doDelete} data-testid="delete-form">
                <Bi t={S.deleteText} className="small" />
                {passwordField(S.password, "current-password")}
                <button className="btn btn-primary auth-danger-solid" type="submit" disabled={busy} aria-busy={busy} data-testid="delete-confirm">{text(S.deleteConfirm)}</button>
              </form>
            )}
          </section>
        </div>
      );
      break;
  }

  return (
    <div>
      <header className="page-head"><h1><Bi t={T.nav.account} /></h1></header>
      {body}
    </div>
  );
}
