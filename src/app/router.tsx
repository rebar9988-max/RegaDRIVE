import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";

const listeners = new Set<() => void>();
const routeLocation = () => location.pathname + location.search;

/** Invalid URL escapes should render a missing page/anchor, never crash the app. */
export function decodeLocationPart(value: string): string | null {
  try { return decodeURIComponent(value); } catch { return null; }
}

export function navigate(to: string) {
  const target = new URL(to, location.href);
  const next = target.pathname + target.search + target.hash;
  if (next !== routeLocation() + location.hash) {
    history.pushState(null, "", next);
    listeners.forEach((l) => l());
  }
  const hash = decodeLocationPart(target.hash.slice(1));
  if (hash) {
    window.setTimeout(() => document.getElementById(hash)?.scrollIntoView(), 0);
  } else if (!target.hash) {
    window.scrollTo(0, 0);
  }
}

/** Queries are part of a page's identity; anchors only move within that page. */
export function useRouteLocation(): string {
  const [path, setPath] = useState(routeLocation);
  useEffect(() => {
    const up = () => setPath(routeLocation());
    listeners.add(up);
    window.addEventListener("popstate", up);
    return () => { listeners.delete(up); window.removeEventListener("popstate", up); };
  }, []);
  return path;
}
export function usePath(): string {
  return useRouteLocation().split("?")[0]!;
}
export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !href.startsWith("/")
      || (rest.target && rest.target !== "_self") || rest.download !== undefined || new URL(href, location.href).origin !== location.origin) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handle} {...rest} />;
}
