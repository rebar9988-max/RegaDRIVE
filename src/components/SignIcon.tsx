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

/** Mandatory-sign glyphs drawn on a plain blue disc (no red ring). */
const BLUE_DISC = new Set(["roundabout", "pass-right", "bike-white", "walk-white", "bike-walk", "30"]);
const K = "#111";

const Car = ({ x, y, fill = K }: { x: number; y: number; fill?: string }) => (
  <g fill={fill} transform={`translate(${x} ${y})`}>
    <path d="M0 14 L3 6 Q5 2 9 2 H19 Q23 2 25 6 L28 14 Z" />
    <rect x="-2" y="12" width="32" height="9" rx="4" />
    <circle cx="6" cy="22" r="4.5" /><circle cx="22" cy="22" r="4.5" />
  </g>
);
const Bike = ({ color, w = 3.5, x = 0, y = 0, k = 1 }: { color: string; w?: number; x?: number; y?: number; k?: number }) => (
  <g fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${x} ${y}) scale(${k})`}>
    <circle cx="34" cy="60" r="11" /><circle cx="66" cy="60" r="11" />
    <path d="M34 60 L46 42 L60 60 Z M46 42 L58 42 M58 42 L62 34 M56 34 L66 34" />
  </g>
);
const Walker = ({ color, x = 0, y = 0, k = 1 }: { color: string; x?: number; y?: number; k?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${k})`} stroke={color} fill={color} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="50" cy="26" r="6" stroke="none" />
    <path d="M50 36 V58 M50 58 L42 80 M50 58 L58 80 M50 42 L40 54 M50 42 L60 54" strokeWidth="6" fill="none" />
  </g>
);

function shape(s: TrafficSign) {
  switch (s.shape) {
    case "triangle": return <path d="M50 8 94 88H6z" fill="#fff" stroke={RED} strokeWidth="9" strokeLinejoin="round" />;
    case "triangle-down": return <path d="M6 12h88L50 92z" fill="#fff" stroke={RED} strokeWidth="9" strokeLinejoin="round" />;
    case "octagon": return <path d="M30 4h40l26 26v40L70 96H30L4 70V30z" fill={RED} stroke="#fff" strokeWidth="3" />;
    case "diamond": return <g><path d="M50 4 96 50 50 96 4 50z" fill="#fff" stroke="#333" strokeWidth="1.5" /><path d="M50 18 82 50 50 82 18 50z" fill={YEL} /></g>;
    case "circle-red": return <circle cx="50" cy="50" r="44" fill={s.glyph === "bar" ? RED : "#fff"} stroke={RED} strokeWidth={s.glyph === "bar" ? 0 : 10} />;
    case "circle-blue": return s.glyph === "arrow-right" || BLUE_DISC.has(s.glyph)
      ? <circle cx="50" cy="50" r="46" fill={BLUE} />
      : <circle cx="50" cy="50" r="42" fill={BLUE} stroke={RED} strokeWidth="9" />;
    case "circle-plain": return <circle cx="50" cy="50" r="45" fill="#fff" stroke="#999" strokeWidth="1.5" />;
    case "rect-blue": return <rect x="6" y="6" width="88" height="88" rx="8" fill={BLUE} />;
    case "rect-yellow": return <rect x="4" y="22" width="92" height="56" rx="6" fill={YEL} stroke="#222" strokeWidth="3" />;
    case "square-red": return <rect x="8" y="8" width="84" height="84" rx="8" fill="#fff" stroke={RED} strokeWidth="9" />;
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
    case "cross-eq": return <g fill={K}><rect x="46.5" y="32" width="7" height="46" /><rect x="29" y="51" width="42" height="7" /></g>;
    case "slope-down": return <g><path d="M28 40 L72 62 L28 62Z" fill={K} /><text x="50" y="76" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="12" fill={K}>10%</text></g>;
    case "slope-up": return <g><path d="M72 40 L28 62 L72 62Z" fill={K} /><text x="50" y="76" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="12" fill={K}>10%</text></g>;
    case "skid": return <g><g transform="translate(-12 -14) scale(1.3)"><Car x={36} y={46} /></g><path d="M28 78 q5 -6 11 0 t11 0 t11 0 t11 0" stroke={K} strokeWidth="2.5" fill="none" strokeLinecap="round" /></g>;
    case "narrow": return <g stroke={K} strokeWidth="6" fill="none" strokeLinecap="round"><path d="M36 78 V58 Q36 48 42 36" /><path d="M64 78 V58 Q64 48 58 36" /></g>;
    case "worker": return <g fill={K} stroke={K} strokeLinecap="round"><circle cx="42" cy="41" r="4.5" stroke="none" /><path d="M42 47 L50 60 M50 60 L43 74 M50 60 L58 72 M45 51 L58 47 M58 40 L66 62" strokeWidth="4" fill="none" /><path d="M30 78 L46 66 L70 78Z" stroke="none" /></g>;
    case "jam": return <g><Car x={28} y={42} /><Car x={46} y={58} /></g>;
    case "trafficlight": return <g><rect x="39" y="32" width="22" height="48" rx="5" fill={K} /><circle cx="50" cy="43" r="5.5" fill="#d33" /><circle cx="50" cy="56" r="5.5" fill="#f4c430" /><circle cx="50" cy="69" r="5.5" fill="#2c9e4b" /></g>;
    case "pedestrian": return <Walker color={K} x={0} y={0} k={1} />;
    case "cyclist": return <g><Bike color={K} w={3.6} x={4} y={6} k={0.85} /><circle cx="52" cy="32" r="4.5" fill={K} /><path d="M52 38 L46 50 M50 42 L58 46" stroke={K} strokeWidth="4" strokeLinecap="round" fill="none" /></g>;
    case "oncoming": return <g><path d="M38 78 V42" stroke={K} strokeWidth="9" /><path d="M38 24 L25 46 H51Z" fill={K} /><path d="M62 22 V58" stroke={RED} strokeWidth="9" /><path d="M62 76 L49 54 H75Z" fill={RED} /></g>;
    case "roundabout": return <g fill="#fff" stroke="#fff">{[0, 120, 240].map((a) => <g key={a} transform={`rotate(${a} 50 50)`}><path d="M57.5 29.3 A22 22 0 0 1 71.7 53.8" fill="none" strokeWidth="7" /><path d="M70.1 62.7 L78.6 55 L64.8 52.6Z" stroke="none" /></g>)}</g>;
    case "pass-right": return <g><path d="M30 30 L58 58" stroke="#fff" strokeWidth="11" strokeLinecap="round" /><path d="M74 74 L48 68 L68 48Z" fill="#fff" /></g>;
    case "bike-white": return <Bike color="#fff" w={4} y={-2} />;
    case "walk-white": return <g><Walker color="#fff" x={-9} y={0} k={1} /><Walker color="#fff" x={32} y={22} k={0.62} /></g>;
    case "bike-walk": return <g><path d="M50 14 V86" stroke="#fff" strokeWidth="3" /><Walker color="#fff" x={-22} y={4} k={0.8} /><Bike color="#fff" w={5} x={32} y={20} k={0.5} /></g>;
    case "car": return <g transform="translate(-30 -26) scale(1.6)"><Car x={36} y={34} /></g>;
    case "bicycle": return <Bike color={K} w={4} x={0} y={-2} />;
    case "overtake": return <g><Car x={22} y={40} /><Car x={52} y={40} fill={RED} /></g>;
    case "30": return <text x="50" y="62" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="36" fill="#fff">30</text>;
    case "zone30": return <g><text x="50" y="56" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="34" fill={K}>30</text><text x="50" y="76" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="14" fill={K}>ZONE</text></g>;
    case "arrow-up": return <g><path d="M50 84 V36" stroke="#fff" strokeWidth="13" /><path d="M50 14 L74 42 H26Z" fill="#fff" /></g>;
    case "diag-bars": return <g stroke={K} strokeWidth="5"><path d="M24 62 62 24M32 70 70 32M40 78 78 40" /></g>;
    case "oncoming-blue": return <g><path d="M34 14 V62" stroke={RED} strokeWidth="11" /><path d="M34 88 L18 60 H50Z" fill={RED} /><path d="M66 86 V38" stroke="#fff" strokeWidth="11" /><path d="M66 12 L82 40 H50Z" fill="#fff" /></g>;
    case "play-street": return <g fill="#fff" stroke="#fff"><path d="M56 40 L72 26 L88 40 V62 H56Z" stroke="none" /><circle cx="26" cy="32" r="5" stroke="none" /><path d="M26 40 V60 M26 60 L20 76 M26 60 L33 76 M26 44 L17 54 M26 44 L36 52" strokeWidth="5" fill="none" strokeLinecap="round" /><circle cx="46" cy="52" r="4" stroke="none" /><path d="M46 58 V70 M46 70 L42 80 M46 70 L50 80" strokeWidth="4" fill="none" strokeLinecap="round" /></g>;
    case "town-end": return <g><text x="50" y="42" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="12" fill={K}>Ortsname</text><text x="50" y="66" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="12" fill={K}>Ortsname</text><path d="M12 76 88 28" stroke={RED} strokeWidth="5" /></g>;
    case "Ortsname": return <text x="50" y="57" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="14" fill="#111">Ortsname</text>;
    default: return null;
  }
}
