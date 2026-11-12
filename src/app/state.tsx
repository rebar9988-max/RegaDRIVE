import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { kv } from "../lib/storage";
import { emptyProgress, normalizeProgress, type ProgressState } from "../lib/progress";
import { langDir } from "./i18n";
import { countryKey, defaultSettings, normalizeSettings, type CountryId, type Settings } from "./settings";

export type { Settings } from "./settings";

interface Ctx {
  ready: boolean;
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  progress: ProgressState;
  update: (fn: (p: ProgressState) => ProgressState) => void;
  resetProgress: () => void;
  online: boolean;
  saveError: boolean;
}
const AppCtx = createContext<Ctx | null>(null);

/** Progress is stored per country. Germany keeps the original key, so existing learners lose nothing. */
export const progressKey = (country: CountryId | null) => countryKey("progress", country);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettingsState] = useState<Settings>(defaultSettings);
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [saveError, setSaveError] = useState(false);
  const loaded = useRef(false);
  /** The storage key the in-memory progress belongs to. */
  const owner = useRef(progressKey(null));

  useEffect(() => {
    kv.get<unknown>("settings")
      .then(async (s) => {
        const next = s ? normalizeSettings(s) : defaultSettings;
        owner.current = progressKey(next.country);
        const p = await kv.get<unknown>(owner.current);
        if (s) setSettingsState(next);
        // Stored data is rebuilt field by field, so a damaged or outdated record can never break the app.
        const clean = normalizeProgress(p);
        if (clean) setProgress(clean);
      })
      .catch(() => setSaveError(true))
      .finally(() => { loaded.current = true; setReady(true); });
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Persist after every change; never overwrite stored data before the initial load finished.
  useEffect(() => { if (loaded.current) kv.set(owner.current, progress).then(() => setSaveError(false), () => setSaveError(true)); }, [progress]);
  // Choosing another country loads that country's own progress; the two are never merged.
  useEffect(() => {
    if (!loaded.current) return;
    const key = progressKey(settings.country);
    if (settings.country === null || key === owner.current) return;
    let alive = true;
    kv.get<unknown>(key).then((p) => { if (alive) { owner.current = key; setProgress(normalizeProgress(p) ?? emptyProgress()); } }, () => setSaveError(true));
    return () => { alive = false; };
  }, [settings.country]);
  useEffect(() => { if (loaded.current) kv.set("settings", settings).catch(() => setSaveError(true)); }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = settings.lang;
    // The layout never mirrors: it stays right-to-left in every language. Latin-script languages
    // only switch their own text direction (see .text-ltr in app.css).
    root.dir = "rtl";
    root.classList.toggle("text-ltr", langDir(settings.lang) === "ltr");
  }, [settings.lang]);

  const setSettings = useCallback((s: Partial<Settings>) => setSettingsState((prev) => ({ ...prev, ...s })), []);
  const update = useCallback((fn: (p: ProgressState) => ProgressState) => setProgress(fn), []);
  const resetProgress = useCallback(() => setProgress(emptyProgress()), []);

  const value = useMemo(() => ({ ready, settings, setSettings, progress, update, resetProgress, online, saveError }),
    [ready, settings, setSettings, progress, update, resetProgress, online, saveError]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

/** Stable "now" for render (refreshes every minute), keeping components pure. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  return now;
}
