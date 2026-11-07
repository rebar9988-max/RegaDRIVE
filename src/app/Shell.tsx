import type { ReactNode } from "react";
import { Link, usePath } from "./router";
import { useApp } from "./state";
import { T } from "./strings";
import { CONTENT_MODE } from "./content";
import { Bi, useBiText } from "../components/Bi";
import { Icon, type IconName } from "../components/Icon";
import type { Bilingual } from "../content/types";

const TABS: { href: string; icon: IconName; t: Bilingual }[] = [
  { href: "/", icon: "home", t: T.nav.home },
  { href: "/learn", icon: "book", t: T.nav.learn },
  { href: "/exam", icon: "exam", t: T.nav.exam },
  { href: "/progress", icon: "chart", t: T.nav.progress },
  { href: "/settings", icon: "gear", t: T.nav.settings },
];
export const MORE_LINKS: { href: string; icon: IconName; t: Bilingual }[] = [
  { href: "/practice", icon: "check", t: T.nav.practice },
  { href: "/signs", icon: "sign", t: T.nav.signs },
  { href: "/progress", icon: "chart", t: T.nav.progress },
  { href: "/vocabulary", icon: "words", t: T.nav.vocab },
  { href: "/services", icon: "pin", t: T.nav.services },
  { href: "/account", icon: "user", t: T.nav.account },
  { href: "/access", icon: "lock", t: T.nav.access },
  { href: "/settings", icon: "gear", t: T.nav.settings },
  { href: "/about", icon: "info", t: T.nav.about },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

export function Shell({ children }: { children: ReactNode }) {
  const path = usePath();
  const { online, saveError } = useApp();
  const label = useBiText();

  return (
    <div className="app">
      <a className="skip-link" href="#main">{label({ ckb: "بازدان بۆ ناوەڕۆک", de: "Zum Inhalt springen", kmr: "Here naverokê", ar: "انتقل إلى المحتوى" })}</a>
      <header className="topbar">
        <div className="header-tools">
          <Link href="/account" className="icon-button" aria-label={label(T.nav.account)}><Icon name="user" /></Link>
          <Link href="/more" className="icon-button" aria-label={label(T.nav.more)}><Icon name="more" /></Link>
        </div>
        <Link href="/" className="brand" aria-label="RegaDRIVE">
          <img src="/brand/regadrive-logo.webp" width={58} height={58} alt="" />
          <span className="brand-name" lang="en">Rega<span>DRIVE</span></span>
        </Link>
        <div className="header-tools">
          {!online && <span className="offline-pill" role="status" data-testid="offline-pill">{label(T.offline)}</span>}
          <details className="notification-menu">
            <summary className="icon-button" aria-label={label({ ckb: "ئاگادارییەکان", de: "Hinweise", kmr: "Agahdarî", ar: "تنبيهات" })}><Icon name="bell" /></summary>
            <div className="notification-panel"><Bi t={{ ckb: "فێربوون لە هەنگاوێکی بچووکەوە دەست پێ دەکات. ئامانجی ڕۆژانەت لە پەڕەی سەرەکی ببینە.", de: "Lernen beginnt mit einem kleinen Schritt. Dein Tagesziel findest du auf der Startseite.", kmr: "Fêrbûn bi gaveke biçûk dest pê dike. Armanca xwe ya rojane li rûpela destpêkê bibîne.", ar: "يبدأ التعلّم بخطوة صغيرة. ستجد هدفك اليومي في الصفحة الرئيسية." }} /><Link href="/">{label(T.nav.home)}</Link></div>
          </details>
        </div>
      </header>
      <div className="layout">
        <nav className="sidenav" aria-label={label({ ckb: "ڕێنیشاندەری سەرەکی", de: "Hauptnavigation", kmr: "Navîgasyona sereke", ar: "التنقل الرئيسي" })}>
          {[...TABS, ...MORE_LINKS.filter((l) => !TABS.some((t) => t.href === l.href))].map((l) => (
            <Link key={l.href} href={l.href} className="navlink" aria-current={isActive(path, l.href) ? "page" : undefined}>
              <Icon name={l.icon} /><Bi t={l.t} />
            </Link>
          ))}
        </nav>
        <main id="main" className="main" tabIndex={-1}>
          {CONTENT_MODE === "preview" && <div className="notice small" role="note" data-testid="preview-banner" style={{ marginBottom: 16 }}><Bi t={T.previewBanner} /></div>}
          {saveError && <div className="notice small" role="alert" style={{ marginBottom: 16 }}><Bi t={T.saveError} /></div>}
          {children}
          <nav className="row small muted" aria-label={label({ ckb: "بەستەرە یاساییەکان", de: "Rechtliche Informationen", kmr: "Agahiyên qanûnî", ar: "المعلومات القانونية" })} style={{ justifyContent: "center", flexWrap: "wrap", gap: 16, padding: "16px 0" }}>
            <Link href="/about#impressum">{label({ ckb: "زانیاری دابینکەر", de: "Impressum", kmr: "Agahiyên pêşkêşkar (Impressum)", ar: "بيانات الناشر (Impressum)" })}</Link>
            <Link href="/about#privacy">{label({ ckb: "تایبەتمەندی", de: "Datenschutz", kmr: "Nepenî", ar: "الخصوصية" })}</Link>
            <Link href="/about">{label(T.nav.about)}</Link>
          </nav>
          <footer className="feature-strip" aria-label={label({ ckb: "تایبەتمەندییەکان", de: "Funktionen", kmr: "Taybetmendî", ar: "الميزات" })}>
            {[
              { icon: "book" as const, ckb: "کوردی، عەرەبی و ئەڵمانی", de: "Kurdisch, Arabisch, Deutsch", kmr: "Kurdî, erebî û almanî", ar: "الكردية والعربية والألمانية" },
              { icon: "wifi" as const, ckb: "فێربوون بەبێ ئینتەرنێت", de: "Offline nach dem ersten Besuch", kmr: "Bê înternet fêr bibe", ar: "تعلّم بدون إنترنت" },
              { icon: "shield" as const, ckb: "پاراستن و نهێنیپارێزی", de: "Privacy & Security", kmr: "Ewlehî û parastina nepeniyê", ar: "الأمان وحماية الخصوصية" },
              { icon: "devices" as const, ckb: "بۆ مۆبایل و کۆمپیوتەر", de: "Responsive & PWA", kmr: "Ji bo mobîl û komputerê", ar: "للهاتف والكمبيوتر" },
            ].map((item) => <div className="feature-item" key={item.icon}><Icon name={item.icon} /><Bi t={item} /></div>)}
          </footer>
        </main>
      </div>
      <nav className="tabbar" aria-label={label({ ckb: "ڕێنیشاندەری سەرەکی", de: "Hauptnavigation", kmr: "Navîgasyona sereke", ar: "التنقل الرئيسي" })}>
        {TABS.map((t) => {
          const active = isActive(path, t.href);
          return (
            <Link key={t.href} href={t.href} className="tab" aria-current={active ? "page" : undefined}>
              <Icon name={t.icon} /><span>{label(t.t)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
