import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { kv } from "../lib/storage";
import { emptyProgress, MASTERY_THRESHOLD_DEFAULT, type ProgressState } from "../lib/progress";

export type LangMode = "bi" | "ckb" | "de";
export interface Settings { langMode: LangMode; masteryThreshold: number; dailyGoal: number }
const defaultSettings: Settings = { langMode: "bi", masteryThreshold: MASTERY_THRESHOLD_DEFAULT, dailyGoal: 10 };

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

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettingsState] = useState<Settings>(defaultSettings);
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [saveError, setSaveError] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    Promise.all([kv.get<Settings>("settings"), kv.get<ProgressState>("progress")])
      .then(([s, p]) => {
        if (s) setSettingsState({ ...defaultSettings, ...s });
        if (p && p.version === 1) setProgress({ ...emptyProgress(), ...p });
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
  useEffect(() => { if (loaded.current) kv.set("progress", progress).then(() => setSaveError(false), () => setSaveError(true)); }, [progress]);
  useEffect(() => { if (loaded.current) kv.set("settings", settings).catch(() => setSaveError(true)); }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = settings.langMode === "de" ? "de" : "ckb";
    root.dir = settings.langMode === "de" ? "ltr" : "rtl";
    root.classList.toggle("mode-de", settings.langMode === "de");
  }, [settings.langMode]);

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
