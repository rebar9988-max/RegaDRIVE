import type { ReactNode } from "react";
import { Link, usePath } from "./router";
import { useApp } from "./state";
import { T } from "./strings";
import { CONTENT_MODE } from "./content";
import { Bi, useBiText } from "../components/Bi";
import { SiteHeader } from "../components/SiteHeader";
import { SiteBanner } from "../components/SiteBanner";
import { Icon, type IconName } from "../components/Icon";
import type { Bilingual } from "../content/types";
import type { CountryId } from "./settings";

const TABS: { href: string; icon: IconName; t: Bilingual }[] = [
  { href: "/", icon: "home", t: T.nav.home },
  // Primary student navigation: learn, practise, take an exam. Everything else lives under "More".
  { href: "/learn", icon: "book", t: T.nav.learn },
  { href: "/practice", icon: "check", t: T.nav.practice },
  { href: "/exam", icon: "exam", t: T.nav.exam },
  { href: "/more", icon: "more", t: T.nav.more },
];
/**
 * Italy's tabs: start, lessons, practice, exam, and the learner's own area. They point at Italy's own
 * screens; nothing German is linked here.
 *
 * The fifth tab is the account, not "More": registering and signing in are free and belong one tap away,
 * not two. The pages that sit under "More" in the German section are listed inside that area
 * (src/pages/Account.tsx), signed in or not, so nothing becomes unreachable. The German navigation keeps
 * "More" unchanged (owner instruction 2026-11-12).
 */
const IT_TABS: { href: string; icon: IconName; t: Bilingual }[] = [
  { href: "/", icon: "home", t: T.nav.home },
  { href: "/learn", icon: "book", t: T.nav.learn },
  { href: "/practice", icon: "check", t: T.nav.practice },
  { href: "/exam", icon: "exam", t: T.nav.exam },
  { href: "/account", icon: "user", t: T.nav.account },
];
export const MORE_LINKS: { href: string; icon: IconName; t: Bilingual }[] = [
  { href: "/account", icon: "user", t: T.nav.account },
  { href: "/progress", icon: "chart", t: T.nav.progress },
  { href: "/settings", icon: "gear", t: T.nav.settings },
  { href: "/signs", icon: "sign", t: T.nav.signs },
  { href: "/vocabulary", icon: "words", t: T.nav.vocab },
  { href: "/services", icon: "pin", t: T.nav.services },
  { href: "/access", icon: "lock", t: T.nav.access },
  { href: "/about", icon: "info", t: T.nav.about },
];

/** Links under "More" that exist for a country. German vocabulary is not part of the Italian section. */
const IT_MORE_HREFS = new Set(["/account", "/progress", "/settings", "/signs", "/services", "/access", "/about"]);
export const moreLinksFor = (country: CountryId | null) => (country === "IT" ? MORE_LINKS.filter((l) => IT_MORE_HREFS.has(l.href)) : MORE_LINKS);
export const tabsFor = (country: CountryId | null) => (country === "IT" ? IT_TABS : TABS);

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

export function Shell({ children }: { children: ReactNode }) {
  const path = usePath();
  const { saveError, settings } = useApp();
  const tabs = tabsFor(settings.country);
  const moreLinks = moreLinksFor(settings.country);
  const label = useBiText();

  return (
    <div className="app">
      <a className="skip-link" href="#main">{label({ ckb: "بازدان بۆ ناوەڕۆک", de: "Zum Inhalt springen", kmr: "Here naverokê", ar: "انتقل إلى المحتوى" })}</a>
      <SiteHeader />
      <SiteBanner />
      <div className="layout">
        <nav className="sidenav" aria-label={label({ ckb: "ڕێنیشاندەری سەرەکی", de: "Hauptnavigation", kmr: "Navîgasyona sereke", ar: "التنقل الرئيسي" })}>
          {/* Every destination is listed once: a tab that is also a "More" link (Italy's account tab) is not repeated. */}
          {[...tabs.filter((t) => t.href !== "/more"), ...moreLinks].filter((l, i, all) => all.findIndex((o) => o.href === l.href) === i).map((l) => (
            <Link key={l.href} href={l.href} className="navlink" aria-current={isActive(path, l.href) ? "page" : undefined}>
              <Icon name={l.icon} /><Bi t={l.t} />
            </Link>
          ))}
        </nav>
        <main id="main" className="main" tabIndex={-1}>
          {CONTENT_MODE === "preview" && <div className="notice small" role="note" data-testid="preview-banner" style={{ marginBottom: 16 }}><Bi t={T.previewBanner} /></div>}
          {saveError && <div className="notice small" role="alert" style={{ marginBottom: 16 }}><Bi t={T.saveError} /></div>}
          {children}
          <nav className="row small muted legal-nav" data-testid="legal-nav" aria-label={label({ ckb: "بەستەرە یاساییەکان", de: "Rechtliche Informationen", kmr: "Agahiyên qanûnî", ar: "المعلومات القانونية" })}>
            <Link href="/about#impressum">{label({ ckb: "زانیاری دابینکەر", de: "Impressum", kmr: "Agahiyên pêşkêşkar (Impressum)", ar: "بيانات الناشر (Impressum)" })}</Link>
            <Link href="/about#privacy">{label({ ckb: "تایبەتمەندی", de: "Datenschutz", kmr: "Nepenî", ar: "الخصوصية" })}</Link>
            <Link href="/about">{label(T.nav.about)}</Link>
          </nav>
        </main>
      </div>
      <nav className="tabbar" aria-label={label({ ckb: "ڕێنیشاندەری سەرەکی", de: "Hauptnavigation", kmr: "Navîgasyona sereke", ar: "التنقل الرئيسي" })}>
        {tabs.map((t) => {
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
