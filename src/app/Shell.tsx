import type { ReactNode } from "react";
import { Link, usePath } from "./router";
import { useApp } from "./state";
import { T } from "./strings";
import { Bi, useBiText } from "../components/Bi";
import { Icon, type IconName } from "../components/Icon";
import type { Bilingual } from "../content/types";

const TABS: { href: string; icon: IconName; t: Bilingual }[] = [
  { href: "/", icon: "home", t: T.nav.home },
  { href: "/learn", icon: "book", t: T.nav.learn },
  { href: "/practice", icon: "check", t: T.nav.practice },
  { href: "/exam", icon: "exam", t: T.nav.exam },
  { href: "/more", icon: "more", t: T.nav.more },
];
export const MORE_LINKS: { href: string; icon: IconName; t: Bilingual }[] = [
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
  const moreActive = MORE_LINKS.some((l) => isActive(path, l.href)) || path === "/more";
  return (
    <div className="app">
      <a className="skip-link" href="#main">{label({ ckb: "بازدان بۆ ناوەڕۆک", de: "Zum Inhalt springen" })}</a>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="RegaDRIVE">
          <img src="/brand/regadrive-emblem.webp" width={40} height={40} alt="" />
          <span className="brand-name" lang="en">Rega<span>DRIVE</span></span>
        </Link>
        <div className="topbar-actions">
          {!online && <span className="offline-pill" role="status" data-testid="offline-pill">{label(T.offline)}</span>}
        </div>
      </header>
      <div className="layout">
        <nav className="sidenav" aria-label={label(T.nav.more)}>
          {[...TABS.filter((t) => t.href !== "/more"), ...MORE_LINKS].map((l) => (
            <Link key={l.href} href={l.href} className="navlink" aria-current={isActive(path, l.href) ? "page" : undefined}>
              <Icon name={l.icon} /><Bi t={l.t} />
            </Link>
          ))}
        </nav>
        <main id="main" className="main" tabIndex={-1}>
          {saveError && <div className="notice small" role="alert" style={{ marginBottom: 16 }}><Bi t={T.saveError} /></div>}
          {children}
        </main>
      </div>
      <nav className="tabbar" aria-label={label(T.nav.home)}>
        {TABS.map((t) => {
          const active = t.href === "/more" ? moreActive : isActive(path, t.href);
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
