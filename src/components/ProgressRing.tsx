import { useId } from "react";

/** Accessible progress chart; the value always comes from the learner's stored progress. */
export function ProgressRing({ value, label }: { value: number; label: string }) {
  const gid = `ring-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const percent = Math.round(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)));
  return (
    <div className="progress-ring" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs><linearGradient id={gid} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#087f4f" /><stop offset=".55" stopColor="#22c55e" /><stop offset="1" stopColor="#f5b700" /></linearGradient></defs>
        <circle className="ring-track" cx="50" cy="50" r="42" fill="none" strokeWidth="8" />
        <circle className="ring-fill" cx="50" cy="50" r="42" fill="none" strokeWidth="8" pathLength="100" strokeDasharray={`${percent} 100`} strokeLinecap="round" transform="rotate(-90 50 50)" style={{ stroke: `url(#${gid})` }} />
      </svg>
      <strong dir="ltr" aria-hidden="true">{percent}%</strong>
    </div>
  );
}
