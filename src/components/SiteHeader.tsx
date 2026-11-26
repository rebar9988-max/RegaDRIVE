import { Link } from "../app/router";
import { useApp } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "./Bi";
import { Icon } from "./Icon";
import { LanguageMenu } from "./LanguageMenu";

/**
 * RegaDRIVE — Header (navigation bar), an independent component.
 *
 * It holds only the four controls of the owner's brief: notifications, language, menu and profile,
 * grouped inside one transparent glass rail with glossy green 3D buttons and white icons.
 * The brand art lives in <SiteBanner />; no logo or banner is rendered here (owner rule, 2026-11-26).
 * Behaviour, routes and state are unchanged — this is the same markup the header always had,
 * only split out of the shell and restyled.
 */
export function SiteHeader() {
  const { online } = useApp();
  const label = useBiText();

  return (
    <header className="topbar site-header">
      <div className="header-rail">
        <div className="header-tools">
          <details className="notification-menu">
            <summary className="icon-button" aria-label={label({ ckb: "ئاگادارییەکان", de: "Hinweise", kmr: "Agahdarî", ar: "تنبيهات" })}><Icon name="bell" /></summary>
            <div className="notification-panel"><Bi t={{ ckb: "فێربوون لە هەنگاوێکی بچووکەوە دەست پێ دەکات. ئامانجی ڕۆژانەت لە پەڕەی سەرەکی ببینە.", de: "Lernen beginnt mit einem kleinen Schritt. Dein Tagesziel findest du auf der Startseite.", kmr: "Fêrbûn bi gaveke biçûk dest pê dike. Armanca xwe ya rojane li rûpela destpêkê bibîne.", ar: "يبدأ التعلّم بخطوة صغيرة. ستجد هدفك اليومي في الصفحة الرئيسية." }} /><Link href="/">{label(T.nav.home)}</Link></div>
          </details>
          <LanguageMenu />
          {!online && <span className="offline-pill" role="status" data-testid="offline-pill">{label(T.offline)}</span>}
        </div>
        <div className="header-tools">
          <Link href="/more" className="icon-button" aria-label={label(T.nav.more)}><Icon name="more" /></Link>
          <span className="header-divider" aria-hidden="true" />
          <Link href="/account" className="icon-button" aria-label={label(T.nav.account)}><Icon name="user" /></Link>
        </div>
      </div>
    </header>
  );
}
