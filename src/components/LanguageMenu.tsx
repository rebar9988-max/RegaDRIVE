import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { langDir, type Lang } from "../app/i18n";
import { useApp } from "../app/state";
import { Icon } from "./Icon";
import { useBiText } from "./Bi";

/** The four learner languages, in the order of the owner's brief. Names are written in their own language. */
type LangOption = { id: Lang; code: string; native: string; flag: string };
const SORANI: LangOption = { id: "ckb", code: "CKB", native: "کوردی (سۆرانی)", flag: "/flags/kurdistan.png" };
const OPTIONS: LangOption[] = [
  SORANI,
  { id: "kmr", code: "KMR", native: "Kurmancî (Badînî)", flag: "/flags/kurdistan.png" },
  { id: "de", code: "DE", native: "Deutsch", flag: "/flags/de.png" },
  { id: "ar", code: "AR", native: "العربية", flag: "/flags/arabic.png" },
];
const TITLE = { ckb: "زمان", de: "Sprache", kmr: "Ziman", ar: "اللغة" };
const PANEL_WIDTH = 288;
const EDGE = 8;

/**
 * One compact language selector for the header: a globe and the current code. It opens a dropdown on
 * wide screens and a bottom sheet on phones (same markup, see .lang-panel in premium-light.css).
 * The panel is rendered in a portal because the sticky header uses backdrop-filter, which would
 * otherwise become the containing block of a fixed-position sheet.
 * Only the words and their own text direction change with the language; the page layout never mirrors.
 */
export function LanguageMenu() {
  const { settings, setSettings } = useApp();
  const label = useBiText();
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(EDGE);
  const [top, setTop] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const current = OPTIONS.find((o) => o.id === settings.lang) ?? SORANI;
  const title = label(TITLE);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);

  // Anchor the desktop dropdown to the button when it opens. (On phones the CSS turns the panel into a bottom sheet and ignores this.)
  const toggle = () => {
    if (!open && trigger.current) {
      const r = trigger.current.getBoundingClientRect();
      setTop(Math.round(r.bottom + 8));
      setLeft(Math.round(Math.max(EDGE, Math.min(r.left, window.innerWidth - PANEL_WIDTH - EDGE))));
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(true); } };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) close(false);
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("resize", onResize);
    // Move focus into the list, onto the active language.
    panel.current?.querySelector<HTMLButtonElement>("button[aria-pressed='true']")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  const choose = (id: Lang) => {
    setSettings({ lang: id });
    close(true);
  };

  const onListKey = (e: ReactKeyboardEvent<HTMLUListElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    e.preventDefault();
    items[next]?.focus();
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="icon-button lang-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        data-testid="header-lang-trigger"
      >
        <Icon name="globe" />
        <span className="lang-code" dir="ltr" aria-hidden="true">{current.code}</span>
        <span className="sr-only" lang={settings.lang}>{`${title}: ${current.native}`}</span>
      </button>
      {open && createPortal(
        <>
          <div className="lang-backdrop" aria-hidden="true" onPointerDown={() => close(false)} />
          <div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-label={title}
            className="lang-panel"
            style={{ top, left }}
            data-testid="header-lang-panel"
          >
            <span className="lang-grip" aria-hidden="true" />
            <p className="lang-title" lang={settings.lang} dir={langDir(settings.lang)}>{title}</p>
            <ul className="lang-list" onKeyDown={onListKey}>
              {OPTIONS.map((o) => {
                const active = settings.lang === o.id;
                return (
                  <li key={o.id}>
                    <button type="button" className="lang-option" aria-pressed={active} onClick={() => choose(o.id)} data-testid={`header-lang-${o.id}`}>
                      <img className="lang-flag" src={o.flag} width={30} height={20} alt="" />
                      <span className="lang-native" lang={o.id} dir={langDir(o.id)}>{o.native}</span>
                      <span className="lang-option-code" dir="ltr">{o.code}</span>
                      <span className="lang-check" aria-hidden="true">{active && <Icon name="check" />}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
