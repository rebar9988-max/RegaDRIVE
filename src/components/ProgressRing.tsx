/** Accessible progress chart; the value always comes from the learner's stored progress. */
export function ProgressRing({ value, label }: { value: number; label: string }) {
  const percent = Math.round(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)));
  return (
    <div className="progress-ring" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="ring-track" cx="50" cy="50" r="42" fill="none" strokeWidth="8" />
        <circle className="ring-fill" cx="50" cy="50" r="42" fill="none" strokeWidth="8" pathLength="100" strokeDasharray={`${percent} 100`} strokeLinecap="round" transform="rotate(-90 50 50)" />
      </svg>
      <strong dir="ltr" aria-hidden="true">{percent}%</strong>
    </div>
  );
}
