import { useCallback, useEffect, useState, type ElementType, type FormEvent, type HTMLAttributes, type ReactNode } from "react";
import { useApp } from "../app/state";
import { T } from "../app/strings";
import { LANGS, langDir, pick } from "../app/i18n";
import { Link } from "../app/router";
import { CONTENT } from "../app/content";
import { useBiText } from "../components/Bi";
import { Icon, type IconName } from "../components/Icon";
import { emptyProgress, mergeProgress, normalizeProgress, questionStatus } from "../lib/progress";
import type { Bilingual } from "../content/types";

/**
 * Student account: e-mail registration, 6-digit e-mail verification, sign-in, password reset, sign-out,
 * opt-in progress backup, data export and account deletion. The session lives in an HttpOnly cookie that
 * JavaScript never sees. Signing in never replaces the progress stored on this device.
 *
 * Signed in, the page has three clearly separated parts: account (profile, data, sign-out), learning
 * progress (real figures from this device plus the account backup) and settings. Every label is shown
 * once, in the learner's language, with its own lang/dir; the RTL page layout itself never mirrors.
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
  myAccount: { ckb: "هەژمارەکەم", de: "Mein Konto", kmr: "Hesabê min", ar: "حسابي" },
  learning: { ckb: "پێشکەوتنی فێربوون", de: "Lernfortschritt", kmr: "Pêşketina fêrbûnê", ar: "تقدّم التعلّم" },
  verified: { ckb: "ئیمەیڵ پشتڕاستکراوەتەوە", de: "E-Mail bestätigt", kmr: "E-name hatiye piştrastkirin", ar: "البريد الإلكتروني مؤكَّد" },
  unverified: { ckb: "ئیمەیڵ پشتڕاست نەکراوەتەوە", de: "E-Mail nicht bestätigt", kmr: "E-name nehatiye piştrastkirin", ar: "البريد الإلكتروني غير مؤكَّد" },
  licence: { ckb: "وڵات و پۆلی مۆڵەت", de: "Land & Führerscheinklasse", kmr: "Welat û pola ehliyetê", ar: "البلد وفئة الرخصة" },
  countryDE: { ckb: "ئەڵمانیا · پۆلی B", de: "Deutschland · Klasse B", kmr: "Almanya · Pola B", ar: "ألمانيا · الفئة B" },
  countryIT: { ckb: "ئیتاڵیا · Patente B", de: "Italien · Patente B", kmr: "Îtalya · Patente B", ar: "إيطاليا · Patente B" },
  countryNone: { ckb: "هێشتا هەڵنەبژێردراوە", de: "Noch nicht gewählt", kmr: "Hê nehatiye hilbijartin", ar: "لم يتم الاختيار بعد" },
  change: { ckb: "گۆڕین", de: "Ändern", kmr: "Biguherîne", ar: "تغيير" },
  language: { ckb: "زمان", de: "Sprache", kmr: "Ziman", ar: "اللغة" },
  germanLine: { ckb: "دەقی ئەڵمانی لە ژێرەوە", de: "Deutsch darunter", kmr: "Almanî li jêr", ar: "الألمانية أسفل النص" },
  on: { ckb: "پیشان دەدرێت", de: "An", kmr: "Vekirî", ar: "مفعّل" },
  off: { ckb: "شاراوەیە", de: "Aus", kmr: "Girtî", ar: "متوقف" },
  allSettings: { ckb: "هەموو ڕێکخستنەکان", de: "Alle Einstellungen", kmr: "Hemû mîheng", ar: "كل الإعدادات" },
  answered: { ckb: "وەڵامدراوە", de: "Beantwortet", kmr: "Bersivandî", ar: "تمت الإجابة" },
  masteredShort: { ckb: "فێربووە", de: "Gemeistert", kmr: "Fêrbûyî", ar: "متقَن" },
  exams: { ckb: "تاقیکردنەوەی ڕاهێنان", de: "Simulationen", kmr: "Ezmûnên ceribandinê", ar: "امتحانات تجريبية" },
  details: { ckb: "بینینی وردەکاری", de: "Details ansehen", kmr: "Hûrguliyan bibîne", ar: "عرض التفاصيل" },
  syncTitle: { ckb: "پاشەکەوت لە هەژمار", de: "Sicherung im Konto", kmr: "Parastina di hesabê de", ar: "النسخ الاحتياطي في الحساب" },
  lastBackup: { ckb: "دوایین پاشەکەوت:", de: "Zuletzt gesichert:", kmr: "Parastina dawî:", ar: "آخر نسخ احتياطي:" },
  neverBackedUp: { ckb: "هێشتا هیچ پاشەکەوتێک لە هەژمارەکەتدا نییە.", de: "Noch keine Sicherung im Konto.", kmr: "Hê di hesabê de parastin tune.", ar: "لا توجد نسخة احتياطية في الحساب بعد." },
  syncChecking: { ckb: "دۆخی پاشەکەوت باردەکرێت…", de: "Sicherungsstatus wird geladen …", kmr: "Rewşa parastinê tê barkirin …", ar: "جارٍ تحميل حالة النسخ الاحتياطي…" },
  syncUnknown: { ckb: "دۆخی پاشەکەوت لە ئێستادا بەردەست نییە.", de: "Sicherungsstatus derzeit nicht verfügbar.", kmr: "Rewşa parastinê niha ne berdest e.", ar: "حالة النسخ الاحتياطي غير متاحة حاليًا." },
  backupShort: { ckb: "پاشەکەوتکردن لە هەژمار", de: "Im Konto sichern", kmr: "Di hesabê de biparêze", ar: "حفظ في الحساب" },
  restoreShort: { ckb: "هێنانەوە لە هەژمار", de: "Aus dem Konto holen", kmr: "Ji hesabê bîne", ar: "استعادة من الحساب" },
  exportShort: { ckb: "داگرتنی داتاکانم", de: "Meine Daten herunterladen", kmr: "Daneyên min daxe", ar: "تنزيل بياناتي" },
  exported: { ckb: "داگرتنی داتاکانت دەستی پێکرد.", de: "Der Download deiner Daten wurde gestartet.", kmr: "Daxistina daneyên te dest pê kir.", ar: "بدأ تنزيل بياناتك." },
  cancel: { ckb: "پاشگەزبوونەوە", de: "Abbrechen", kmr: "Betal bike", ar: "إلغاء" },
  sessionExpired: { ckb: "دانیشتنەکەت بەسەرچوو. تکایە دووبارە بچۆ ژوورەوە.", de: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.", kmr: "Danişîna te qediya. Ji kerema xwe dîsa têkeve.", ar: "انتهت جلستك. يرجى تسجيل الدخول مرة أخرى." },
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
  UNAUTHENTICATED: S.sessionExpired,
  VERSION_CONFLICT: { ckb: "پاشەکەوتەکە لە هەمان کاتدا لە ئامێرێکی ترەوە گۆڕدرا. تکایە دووبارە هەوڵ بدەرەوە.", de: "Die Sicherung wurde gleichzeitig auf einem anderen Gerät geändert. Bitte versuche es erneut.", kmr: "Parastin di heman demê de li ser amûreke din hat guhertin. Ji kerema xwe dîsa biceribîne.", ar: "تم تغيير النسخة الاحتياطية في الوقت نفسه من جهاز آخر. يرجى المحاولة مرة أخرى." },
  PAYLOAD_TOO_LARGE: { ckb: "پێشکەوتنەکە زۆر گەورەیە بۆ پاشەکەوتکردن لە هەژمار.", de: "Der Fortschritt ist zu groß für die Sicherung im Konto.", kmr: "Pêşketin ji bo parastina di hesabê de pir mezin e.", ar: "التقدّم كبير جدًا لحفظه في الحساب." },
  NETWORK: { ckb: "پەیوەندی بە ئینتەرنێتەوە نییە. پێشکەوتنەکەت لەسەر ئەم ئامێرە پارێزراوە.", de: "Keine Internetverbindung. Dein Fortschritt bleibt auf diesem Gerät gespeichert.", kmr: "Girêdana înternetê tune. Pêşketina te li ser vê amûrê parastî ye.", ar: "لا يوجد اتصال بالإنترنت. يبقى تقدّمك محفوظًا على هذا الجهاز." },
  GENERIC: { ckb: "هەڵەیەک ڕوویدا. تکایە دووبارە هەوڵ بدەرەوە.", de: "Etwas ist schiefgelaufen. Bitte versuche es erneut.", kmr: "Tiştek xelet çû. Ji kerema xwe dîsa biceribîne.", ar: "حدث خطأ ما. يرجى المحاولة مرة أخرى." },
};
const errorFor = (r: ApiResult): Bilingual => ERRORS[String(r.data.error ?? "")] ?? ERRORS.GENERIC!;

/** One label in the learner's language only, carrying its own lang/dir (no German second line). */
function Tx({ t, as: Tag = "span", ...rest }: { t: Bilingual; as?: ElementType } & HTMLAttributes<HTMLElement>) {
  const { settings } = useApp();
  const p = pick(t, settings.lang);
  return <Tag lang={p.lang} dir={langDir(p.lang)} {...rest}>{p.text}</Tag>;
}

function Field({ label, children, hint, id }: { label: Bilingual; children: ReactNode; hint?: Bilingual; id: string }) {
  const { settings } = useApp();
  const l = pick(label, settings.lang);
  return (
    <div className="stack auth-field">
      <label className="small auth-label" htmlFor={id} lang={l.lang} dir={langDir(l.lang)}>{l.text}</label>
      {children}
      {hint && <Tx t={hint} as="p" className="small muted auth-hint" id={`${id}-hint`} />}
    </div>
  );
}

type Scope = "form" | "account" | "progress";
interface Msg { scope: Scope; kind: "error" | "info"; t: Bilingual }
type Busy = null | "form" | "backup" | "restore" | "export" | "logout" | "logout-all" | "delete";
/** Account backup state, read from the server — never guessed. */
type Remote = { state: "checking" } | { state: "none" } | { state: "saved"; at: number } | { state: "unknown" };

const fmtDate = (t: number) => new Date(t).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });

export function Account() {
  const { progress, update, settings } = useApp();
  const text = useBiText();
  const [view, setView] = useState<View>("loading");
  const [student, setStudent] = useState<Student | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [remote, setRemote] = useState<Remote>({ state: "checking" });

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

  // Real backup status for the signed-in student (last saved time or "none yet").
  useEffect(() => {
    if (view !== "account") return;
    let alive = true;
    api("/api/me/progress").then((r) => {
      if (!alive) return;
      if (r.status !== 200) { setRemote({ state: "unknown" }); return; }
      const at = typeof r.data.updatedAt === "number" ? r.data.updatedAt : null;
      setRemote(r.data.progress && at !== null ? { state: "saved", at } : { state: "none" });
    });
    return () => { alive = false; };
  }, [view]);

  const go = useCallback((v: View, keepMsg = false) => {
    setView(v); setCode(""); setConfirmDelete(false);
    setMsg((m) => (keepMsg && m?.kind === "info" ? { ...m, scope: "form" } : null));
    requestAnimationFrame(() => document.getElementById("auth-heading")?.focus());
  }, []);

  /** The session ended on the server (expired, revoked elsewhere, account gone): back to sign-in, explained. */
  const expired = useCallback(() => {
    setStudent(null); setPassword(""); go("signin");
    setMsg({ scope: "form", kind: "info", t: S.sessionExpired });
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
  const ok = (scope: Scope, t: Bilingual) => setMsg({ scope, kind: "info", t });
  const submit = (fn: () => Promise<void>) => (e: FormEvent) => { e.preventDefault(); void run("form", fn); };

  const signedIn = (s: Student) => { setStudent(s); setPassword(""); setCode(""); setRemote({ state: "checking" }); go("account"); };

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
    if (r.status === 202) ok("form", S.resent); else fail("form", r);
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
    if (r.status === 200) { setPassword(""); ok("form", S.resetDone); go("signin", true); } else fail("form", r);
  });
  const doLogout = (all: boolean) => run(all ? "logout-all" : "logout", async () => {
    const r = await api("/api/auth/logout", { all });
    // 401 means the session is already gone — the student is signed out either way.
    if (r.status === 200 || r.status === 401) { setStudent(null); setPassword(""); go("signin"); }
    else fail("account", r);
  });
  const doBackup = () => run("backup", async () => {
    // Loss-free: the account copy is merged with this device's progress. One retry on a concurrent write.
    for (let attempt = 0; attempt < 2; attempt++) {
      const cur = await api("/api/me/progress");
      if (cur.status !== 200) { fail("progress", cur); return; }
      // The account copy is rebuilt field by field before it is merged; a damaged copy counts as empty.
      const remoteCopy = normalizeProgress(cur.data.progress) ?? emptyProgress();
      const r = await api("/api/me/progress", { progress: mergeProgress(progress, remoteCopy), baseVersion: cur.data.version });
      if (r.status === 200) {
        if (typeof r.data.updatedAt === "number") setRemote({ state: "saved", at: r.data.updatedAt });
        ok("progress", S.backedUp); return;
      }
      if (r.status !== 409 || attempt === 1) { fail("progress", r); return; }
    }
  });
  const doRestore = () => run("restore", async () => {
    const cur = await api("/api/me/progress");
    if (cur.status !== 200) { fail("progress", cur); return; }
    const remoteCopy = normalizeProgress(cur.data.progress);
    if (!remoteCopy) { setRemote({ state: "none" }); ok("progress", S.nothingSaved); return; }
    update((local) => mergeProgress(local, remoteCopy));
    ok("progress", S.restored);
  });
  const doExport = () => run("export", async () => {
    const r = await api("/api/me/export");
    if (r.status !== 200) { fail("account", r); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = "regadrive-account.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    ok("account", S.exported);
  });
  const doDelete = (e: FormEvent) => {
    e.preventDefault();
    void run("delete", async () => {
      const r = await api("/api/me/delete", { password });
      if (r.status === 200) { setStudent(null); setPassword(""); ok("form", S.deleted); go("signin", true); }
      else if (r.status === 401 && r.data.error === "UNAUTHENTICATED") expired();
      else setMsg({ scope: "account", kind: "error", t: errorFor(r) });
    });
  };

  const status = (scope: Scope) => (
    <div aria-live="polite" className="acct-status">
      {msg?.scope === scope && (msg.kind === "error"
        ? <p className="notice auth-error" role="alert" data-testid="auth-error"><Icon name="alert" /><Tx t={msg.t} /></p>
        : <p className="notice auth-ok" role="status" data-testid="auth-info"><Icon name="check" /><Tx t={msg.t} /></p>)}
    </div>
  );
  const isBusy = (k: Busy) => busy === k;
  const submitBtn = (label: Bilingual, testid: string) => (
    <button className="btn btn-primary" type="submit" disabled={busy !== null} aria-busy={isBusy("form")} data-testid={testid}>{text(isBusy("form") ? S.working : label)}</button>
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
      <label className="small auth-check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> <Tx t={S.showPassword} /></label>
    </Field>
  );
  const codeField = (
    <Field label={S.code} id="auth-code">
      <input id="auth-code" className="input auth-code" dir="ltr" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} data-testid="auth-code" />
    </Field>
  );
  const link = (label: Bilingual, v: View, testid: string) => (
    <button type="button" className="btn btn-secondary" onClick={() => go(v)} disabled={busy !== null} data-testid={testid}>{text(label)}</button>
  );
  const heading = (t: Bilingual) => <Tx t={t} as="h2" id="auth-heading" tabIndex={-1} className="acct-form-title" />;
  const logo = <img className="account-logo acct-logo" src="/brand/regadrive-logo.webp" alt="RegaDRIVE" width={72} height={72} />;

  /** A full-width settings-style row: icon, label, optional value, chevron or action. */
  const row = (icon: IconName, label: Bilingual, value?: ReactNode, extra?: { danger?: boolean }) => (
    <>
      <span className={`acct-row-icon${extra?.danger ? " is-danger" : ""}`}><Icon name={icon} /></span>
      <span className="acct-row-text">
        <Tx t={label} className="acct-row-label" />
        {value !== undefined && <span className="acct-row-value">{value}</span>}
      </span>
    </>
  );
  const rowBtn = (key: Exclude<Busy, null>, icon: IconName, label: Bilingual, onClick: () => void, testid: string, danger = false) => (
    <li>
      <button type="button" className={`acct-row${danger ? " is-danger" : ""}`} onClick={onClick} disabled={busy !== null} aria-busy={isBusy(key)} data-testid={testid}>
        {row(icon, isBusy(key) ? S.working : label, undefined, { danger })}
      </button>
    </li>
  );

  let body: ReactNode;
  switch (view) {
    case "loading":
      body = <section className="card acct-card" aria-busy="true"><Tx t={S.working} as="p" className="muted" role="status" /></section>;
      break;
    case "unavailable":
      body = (
        <section className="card acct-card acct-form" data-testid="account-unavailable">
          {logo}
          <Tx t={S.unavailable} as="p" />
        </section>
      );
      break;
    case "signin":
      body = (
        <form className="card acct-card acct-form" onSubmit={doLogin} data-testid="signin-form">
          {logo}
          {heading(S.signin)}
          <Tx t={S.intro} as="p" className="small muted acct-intro" />
          {status("form")}
          {emailField}
          {passwordField(S.password, "current-password")}
          {submitBtn(S.signin, "signin-submit")}
          <div className="auth-links">
            {link(S.forgot, "forgot", "to-forgot")}
          </div>
          <div className="acct-switch">
            <Tx t={S.noAccount} className="small muted" />
            {link(S.register, "register", "to-register")}
          </div>
        </form>
      );
      break;
    case "register":
      body = (
        <form className="card acct-card acct-form" onSubmit={doRegister} data-testid="register-form">
          {heading(S.register)}
          <Tx t={S.intro} as="p" className="small muted acct-intro" />
          {status("form")}
          <Field label={S.name} id="auth-name">
            <input id="auth-name" className="input" maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} data-testid="auth-name" />
          </Field>
          {emailField}
          {passwordField(S.password, "new-password", S.passwordHint)}
          {submitBtn(S.register, "register-submit")}
          <div className="acct-switch">
            <Tx t={S.haveAccount} className="small muted" />
            {link(S.signin, "signin", "to-signin")}
          </div>
        </form>
      );
      break;
    case "verify":
      body = (
        <form className="card acct-card acct-form" onSubmit={doVerify} data-testid="verify-form">
          {heading(S.verifyTitle)}
          <Tx t={S.verifyText} as="p" className="small" />
          <p className="small acct-email" dir="ltr" data-testid="verify-email">{email}</p>
          {status("form")}
          {codeField}
          {submitBtn(S.verify, "verify-submit")}
          <div className="auth-links">
            <button type="button" className="btn btn-secondary" onClick={doResend} disabled={busy !== null} aria-busy={isBusy("form")} data-testid="resend">{text(S.resend)}</button>
            {link(S.back, "signin", "to-signin")}
          </div>
        </form>
      );
      break;
    case "forgot":
      body = (
        <form className="card acct-card acct-form" onSubmit={doForgot} data-testid="forgot-form">
          {heading(S.forgot)}
          <Tx t={S.forgotText} as="p" className="small" />
          {status("form")}
          {emailField}
          {submitBtn(S.sendCode, "forgot-submit")}
          <div className="auth-links">{link(S.back, "signin", "to-signin")}</div>
        </form>
      );
      break;
    case "reset":
      body = (
        <form className="card acct-card acct-form" onSubmit={doReset} data-testid="reset-form">
          {heading(S.resetTitle)}
          <Tx t={S.verifyText} as="p" className="small" />
          <p className="small acct-email" dir="ltr">{email}</p>
          {status("form")}
          {codeField}
          {passwordField(S.newPassword, "new-password", S.passwordHint)}
          {submitBtn(S.resetSave, "reset-submit")}
          <div className="auth-links">{link(S.back, "signin", "to-signin")}</div>
        </form>
      );
      break;
    case "account": {
      const qs = CONTENT.questions;
      const th = settings.masteryThreshold;
      const answered = qs.filter((q) => questionStatus(progress.questions[q.id], th) !== "unanswered").length;
      const mastered = qs.filter((q) => questionStatus(progress.questions[q.id], th) === "mastered").length;
      const exams = progress.examHistory.length;
      const displayName = student?.displayName?.trim() || "";
      const initial = (displayName || student?.email || "?").trim().charAt(0).toLocaleUpperCase();
      const licence = settings.country === "DE" ? S.countryDE : settings.country === "IT" ? S.countryIT : S.countryNone;
      const lang = LANGS.find((l) => l.id === settings.lang);
      const stat = (value: ReactNode, label: Bilingual, testid: string) => (
        <div className="acct-stat" data-testid={testid}>
          <span className="acct-stat-value" dir="ltr">{value}</span>
          <Tx t={label} className="acct-stat-label" />
        </div>
      );
      body = (
        <div className="acct" data-testid="account-signed-in">
          {/* ── Account ─────────────────────────────────────────── */}
          <section className="acct-section" aria-labelledby="auth-heading">
            <Tx t={S.myAccount} as="h2" id="auth-heading" tabIndex={-1} className="acct-section-title" />
            <div className="card acct-card">
              <div className="acct-profile">
                <span className="acct-avatar" aria-hidden="true">{initial}</span>
                <div className="acct-id">
                  {displayName && <p className="acct-name" data-testid="account-name">{displayName}</p>}
                  <p className="acct-email" dir="ltr" data-testid="account-email">{student?.email}</p>
                  <ul className="acct-tags">
                    <li className={`acct-tag ${student?.emailVerified ? "is-ok" : "is-warn"}`} data-testid="account-verified" data-verified={student?.emailVerified ? "true" : "false"}>
                      <Icon name={student?.emailVerified ? "verified" : "alert"} /><Tx t={student?.emailVerified ? S.verified : S.unverified} />
                    </li>
                    <li className="acct-tag" data-testid="account-licence">
                      <Icon name="car" /><span className="sr-only">{text(S.licence)}: </span><Tx t={licence} />
                    </li>
                  </ul>
                </div>
              </div>
              {status("account")}
              <ul className="acct-rows">
                {rowBtn("export", "download", S.exportShort, () => void doExport(), "export")}
                {rowBtn("logout-all", "devices", S.logoutAll, () => void doLogout(true), "logout-all")}
                {!confirmDelete && rowBtn("delete", "trash", S.deleteTitle, () => { setConfirmDelete(true); setPassword(""); setMsg(null); }, "delete-start", true)}
              </ul>
              {confirmDelete && (
                <form className="stack acct-delete" onSubmit={doDelete} data-testid="delete-form">
                  <Tx t={S.deleteTitle} as="h3" className="acct-delete-title" />
                  <Tx t={S.deleteText} as="p" className="small" />
                  {passwordField(S.password, "current-password")}
                  <div className="auth-actions">
                    <button className="btn btn-primary auth-danger-solid" type="submit" disabled={busy !== null} aria-busy={isBusy("delete")} data-testid="delete-confirm">{text(isBusy("delete") ? S.working : S.deleteConfirm)}</button>
                    <button className="btn btn-secondary" type="button" onClick={() => { setConfirmDelete(false); setPassword(""); setMsg(null); }} disabled={busy !== null} data-testid="delete-cancel">{text(S.cancel)}</button>
                  </div>
                </form>
              )}
              <button type="button" className="btn btn-secondary acct-logout" onClick={() => void doLogout(false)} disabled={busy !== null} aria-busy={isBusy("logout")} data-testid="logout">
                <Icon name="signout" /><Tx t={isBusy("logout") ? S.working : S.logout} />
              </button>
            </div>
          </section>

          {/* ── Learning progress ───────────────────────────────── */}
          <section className="acct-section" aria-labelledby="acct-progress-title">
            <Tx t={S.learning} as="h2" id="acct-progress-title" className="acct-section-title" />
            <div className="card acct-card">
              <div className="acct-stats">
                {stat(<>{answered}<span className="acct-stat-of">/{qs.length}</span></>, S.answered, "account-answered")}
                {stat(mastered, S.masteredShort, "account-mastered")}
                {stat(exams, S.exams, "account-exams")}
              </div>
              <Link href="/progress" className="acct-link"><Tx t={S.details} /><Icon name="arrow" className="flip-rtl" /></Link>
              <div className="acct-sync">
                <div className="acct-sync-head">
                  <span className="acct-row-icon"><Icon name="cloudUp" /></span>
                  <div className="acct-sync-copy">
                    <Tx t={S.syncTitle} as="h3" className="acct-sync-title" />
                    <p className="small muted" data-testid="sync-status" data-state={remote.state}>
                      {remote.state === "saved"
                        ? <><Tx t={S.lastBackup} /> <span dir="ltr">{fmtDate(remote.at)}</span></>
                        : <Tx t={remote.state === "none" ? S.neverBackedUp : remote.state === "checking" ? S.syncChecking : S.syncUnknown} />}
                    </p>
                  </div>
                </div>
                {status("progress")}
                <div className="auth-actions">
                  <button type="button" className="btn btn-primary" onClick={() => void doBackup()} disabled={busy !== null} aria-busy={isBusy("backup")} data-testid="backup">
                    {text(isBusy("backup") ? S.working : S.backupShort)}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => void doRestore()} disabled={busy !== null} aria-busy={isBusy("restore")} data-testid="restore">
                    <Icon name="cloudDown" />{text(isBusy("restore") ? S.working : S.restoreShort)}
                  </button>
                </div>
                <Tx t={S.localSafe} as="p" className="small muted" />
              </div>
            </div>
          </section>

          {/* ── Settings ────────────────────────────────────────── */}
          <section className="acct-section" aria-labelledby="acct-settings-title">
            <Tx t={T.nav.settings} as="h2" id="acct-settings-title" className="acct-section-title" />
            <div className="card acct-card acct-card-flush">
              <ul className="acct-rows">
                <li>
                  <Link href="/settings" className="acct-row" data-testid="settings-language">
                    {row("globe", S.language, lang ? <span lang={lang.id} dir={langDir(lang.id)}>{lang.native}</span> : null)}
                    <Icon name="arrow" className="flip-rtl" />
                  </Link>
                </li>
                {settings.lang !== "de" && (
                  <li>
                    <Link href="/settings" className="acct-row" data-testid="settings-german">
                      {row("words", S.germanLine, <Tx t={settings.withGerman ? S.on : S.off} />)}
                      <Icon name="arrow" className="flip-rtl" />
                    </Link>
                  </li>
                )}
                <li>
                  <Link href="/settings#country" className="acct-row" data-testid="settings-licence">
                    {row("car", S.licence, <Tx t={licence} />)}
                    <Icon name="arrow" className="flip-rtl" />
                  </Link>
                </li>
                <li>
                  <Link href="/settings" className="acct-row" data-testid="settings-all">
                    {row("gear", S.allSettings)}
                    <Icon name="arrow" className="flip-rtl" />
                  </Link>
                </li>
              </ul>
            </div>
          </section>
        </div>
      );
      break;
    }
  }

  return (
    <div className="acct-page">
      <header className="page-head acct-head"><Tx t={T.nav.account} as="h1" /></header>
      {body}
    </div>
  );
}
