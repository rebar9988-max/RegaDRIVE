import type { TrafficSign } from "../content/types";

const RED = "#c1272d"; // regulatory sign red (sign artwork only, not UI chrome)
const BLUE = "#1f5fa8";
const YEL = "#f4c430";

/** Simplified illustration of an StVO sign. Decorative-by-default; pass label for a meaningful image. */
export function SignIcon({ sign, label, className }: { sign: TrafficSign; label?: string; className?: string }) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg viewBox="0 0 100 100" className={className} {...a11y}>
      {shape(sign)}
      {glyph(sign)}
    </svg>
  );
}

function shape(s: TrafficSign) {
  switch (s.shape) {
    case "triangle": return <path d="M50 8 94 88H6z" fill="#fff" stroke={RED} strokeWidth="9" strokeLinejoin="round" />;
    case "triangle-down": return <path d="M6 12h88L50 92z" fill="#fff" stroke={RED} strokeWidth="9" strokeLinejoin="round" />;
    case "octagon": return <path d="M30 4h40l26 26v40L70 96H30L4 70V30z" fill={RED} stroke="#fff" strokeWidth="3" />;
    case "diamond": return <g><path d="M50 4 96 50 50 96 4 50z" fill="#fff" stroke="#333" strokeWidth="1.5" /><path d="M50 18 82 50 50 82 18 50z" fill={YEL} /></g>;
    case "circle-red": return <circle cx="50" cy="50" r="44" fill={s.glyph === "bar" ? RED : "#fff"} stroke={RED} strokeWidth={s.glyph === "bar" ? 0 : 10} />;
    case "circle-blue": return s.glyph === "arrow-right"
      ? <circle cx="50" cy="50" r="46" fill={BLUE} />
      : <circle cx="50" cy="50" r="42" fill={BLUE} stroke={RED} strokeWidth="9" />;
    case "circle-plain": return <circle cx="50" cy="50" r="45" fill="#fff" stroke="#999" strokeWidth="1.5" />;
    case "rect-blue": return <rect x="6" y="6" width="88" height="88" rx="8" fill={BLUE} />;
    case "rect-yellow": return <rect x="4" y="22" width="92" height="56" rx="6" fill={YEL} stroke="#222" strokeWidth="3" />;
  }
}

function glyph(s: TrafficSign) {
  switch (s.glyph) {
    case "!": return <g fill="#111"><rect x="45.5" y="36" width="9" height="30" rx="3" /><circle cx="50" cy="75" r="5" /></g>;
    case "+": return <g fill="#111"><rect x="46" y="34" width="8" height="44" /><rect x="34" y="46" width="32" height="5" /></g>;
    case "STOP": return <text x="50" y="59" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="26" fill="#fff">STOP</text>;
    case "50": return <text x="50" y="62" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="36" fill="#111">50</text>;
    case "bar": return <rect x="18" y="42" width="64" height="16" fill="#fff" />;
    case "x": return <g stroke={RED} strokeWidth="9"><path d="M22 22 78 78M78 22 22 78" /></g>;
    case "slash": return <path d="M22 22 78 78" stroke={RED} strokeWidth="9" />;
    case "stripes": return <g stroke="#111" strokeWidth="3"><path d="M24 70 70 24M30 76 76 30M18 64 64 18" /></g>;
    case "arrow-right": return <path d="M24 50h40M52 34l18 16-18 16" stroke="#fff" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    case "zebra": return <g><path d="M50 18 84 80H16z" fill="#fff" /><g fill="#111"><rect x="30" y="68" width="8" height="8" /><rect x="44" y="68" width="8" height="8" /><rect x="58" y="68" width="8" height="8" /><circle cx="50" cy="38" r="5" /><rect x="47" y="45" width="6" height="18" rx="2" /></g></g>;
    case "Ortsname": return <text x="50" y="57" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="14" fill="#111">Ortsname</text>;
    default: return null;
  }
}
