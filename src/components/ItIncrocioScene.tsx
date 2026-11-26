import type { ItApproach, ItIncrocio, ItIncrocioVehicle } from "../content/italy/incroci";

/**
 * The picture of a right-of-way scene, drawn from the scene data in src/content/italy/incroci.ts.
 *
 * Original RegaDRIVE artwork: plain geometry generated here, never a copy of an official figure. The
 * drawing is decorative for assistive technology — every vehicle is also a real button in the list
 * below the picture (src/pages/Italy.tsx), which carries its colour, its arm and its chosen position.
 */

const C = 110;          // centre of the 220 × 220 board
const HALF = 30;        // half width of a normal road
const NARROW = 16;      // half width of a private access
const LANE = 15;        // distance of a driving lane from the road axis
const NARROW_LANE = 8;

const halfOf = (scene: ItIncrocio, arm: ItApproach) => (scene.narrowArm === arm ? NARROW : HALF);
const laneOf = (scene: ItIncrocio, arm: ItApproach) => (scene.narrowArm === arm ? NARROW_LANE : LANE);

/** Where a vehicle waiting on its own arm stands, and which way it points. */
function place(scene: ItIncrocio, from: ItApproach): { x: number; y: number; rot: number } {
  const lane = laneOf(scene, from);
  if (from === "north") return { x: C - lane, y: 55, rot: 180 };
  if (from === "south") return { x: C + lane, y: 165, rot: 0 };
  if (from === "east") return { x: 165, y: C - lane, rot: -90 };
  return { x: 55, y: C + lane, rot: 90 };
}

/** A vehicle already circulating in a roundabout, placed on the ring next to its own arm. */
function placeOnRing(from: ItApproach): { x: number; y: number; rot: number } {
  if (from === "north") return { x: C - 30, y: C - 30, rot: 225 };
  if (from === "south") return { x: C + 30, y: C + 30, rot: 45 };
  if (from === "east") return { x: C + 30, y: C - 30, rot: 315 };
  return { x: C - 30, y: C + 30, rot: 135 };
}

const SIGN_SPOT: Record<ItApproach, { x: number; y: number }> = {
  north: { x: 66, y: 50 },
  south: { x: 154, y: 170 },
  east: { x: 170, y: 66 },
  west: { x: 50, y: 154 },
};

const COLOUR: Record<ItIncrocioVehicle["colour"], { body: string; roof: string }> = {
  blue: { body: "var(--rd-blue, #1e88e5)", roof: "#bfe0fa" },
  red: { body: "var(--rd-red, #e5323b)", roof: "#f9cfd1" },
  yellow: { body: "var(--rd-warm, #f5b700)", roof: "#fdeab3" },
  green: { body: "#0d9488", roof: "#c3ebe6" },
  tram: { body: "#155e75", roof: "#cfe8f0" },
};

/** One arm of the junction, drawn from the centre outwards. */
function Arm({ scene, arm }: { scene: ItIncrocio; arm: ItApproach }) {
  const h = halfOf(scene, arm);
  const box = HALF;
  const rect: { x: number; y: number; width: number; height: number } =
    arm === "north" ? { x: C - h, y: 0, width: h * 2, height: C - box }
    : arm === "south" ? { x: C - h, y: C + box, width: h * 2, height: C - box }
    : arm === "east" ? { x: C + box, y: C - h, width: C - box, height: h * 2 }
    : { x: 0, y: C - h, width: C - box, height: h * 2 };
  const dash: { x1: number; y1: number; x2: number; y2: number } =
    arm === "north" ? { x1: C, y1: 4, x2: C, y2: C - box - 4 }
    : arm === "south" ? { x1: C, y1: C + box + 4, x2: C, y2: 216 }
    : arm === "east" ? { x1: C + box + 4, y1: C, x2: 216, y2: C }
    : { x1: 4, y1: C, x2: C - box - 4, y2: C };
  return (
    <g>
      <rect {...rect} fill="#4a5a66" />
      {scene.narrowArm !== arm && <line {...dash} stroke="#f2f6f8" strokeWidth="2" strokeDasharray="9 9" strokeLinecap="round" />}
    </g>
  );
}

function Sign({ kind, at }: { kind: NonNullable<ItIncrocioVehicle["sign"]>; at: { x: number; y: number } }) {
  if (kind === "stop") {
    return (
      <g transform={`translate(${at.x} ${at.y})`}>
        <circle r="13" fill="#c62828" stroke="#fff" strokeWidth="2.5" />
        <text y="3.4" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">STOP</text>
      </g>
    );
  }
  if (kind === "giveway") {
    return (
      <g transform={`translate(${at.x} ${at.y})`}>
        <polygon points="-13,-11 13,-11 0,12" fill="#fff" stroke="#c62828" strokeWidth="4" strokeLinejoin="round" />
      </g>
    );
  }
  return (
    <g transform={`translate(${at.x} ${at.y}) rotate(45)`}>
      <rect x="-9.5" y="-9.5" width="19" height="19" fill="#f5b700" stroke="#fff" strokeWidth="3" />
    </g>
  );
}

/** The arrow in front of a vehicle: where it is going once it is in the junction. */
function TurnArrow({ turn }: { turn: ItIncrocioVehicle["turn"] }) {
  const path: string =
    turn === "straight" ? "M0,-16 L0,-29"
    : turn === "left" ? "M0,-16 L0,-24 L-13,-24"
    : "M0,-16 L0,-24 L13,-24";
  const head: string =
    turn === "straight" ? "0,-33 -3.6,-27 3.6,-27"
    : turn === "left" ? "-17,-24 -11,-27.6 -11,-20.4"
    : "17,-24 11,-27.6 11,-20.4";
  return (
    <g>
      <path d={path} fill="none" stroke="#123326" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
      <polygon points={head} fill="#123326" opacity="0.75" />
    </g>
  );
}

function Vehicle({ v, spot, position }: { v: ItIncrocioVehicle; spot: { x: number; y: number; rot: number }; position: number | null }) {
  const c = COLOUR[v.colour];
  const long = v.colour === "tram";
  const h = long ? 44 : 28;
  return (
    <g transform={`translate(${spot.x} ${spot.y}) rotate(${spot.rot})`}>
      <TurnArrow turn={v.turn} />
      <rect x="-8.5" y={-h / 2} width="17" height={h} rx="4.5" fill={c.body} stroke="#123326" strokeOpacity="0.35" strokeWidth="1.2" />
      <rect x="-5.5" y={-h / 2 + 4} width="11" height={long ? 12 : 8} rx="2.4" fill={c.roof} />
      {!long && <rect x="-5.5" y={h / 2 - 11} width="11" height="7" rx="2.4" fill={c.roof} opacity="0.75" />}
      {position !== null && (
        <g transform={`rotate(${-spot.rot})`}>
          <circle r="10" fill="#fff" stroke="#123326" strokeWidth="1.6" />
          <text y="3.6" textAnchor="middle" fontSize="12" fontWeight="700" fill="#123326" fontFamily="system-ui, sans-serif">{position}</text>
        </g>
      )}
    </g>
  );
}

/**
 * @param chosen vehicle ids in the order the learner has picked them so far; a picked vehicle carries
 *               its position as a number on the drawing.
 */
export function ItIncrocioScene({ scene, chosen = [] }: { scene: ItIncrocio; chosen?: readonly string[] }) {
  const trams = scene.vehicles.filter((v) => v.colour === "tram");
  return (
    <svg viewBox="0 0 220 220" className="it-inc-board" aria-hidden="true" focusable="false">
      <rect width="220" height="220" rx="18" fill="#e6f3ea" />
      {scene.arms.map((arm) => <Arm key={arm} scene={scene} arm={arm} />)}
      <rect x={C - HALF} y={C - HALF} width={HALF * 2} height={HALF * 2} fill="#4a5a66" />
      {trams.map((t) => {
        const vertical = t.from === "north" || t.from === "south";
        return (
          <g key={`rail-${t.id}`} stroke="#9fb3bd" strokeWidth="1.8">
            {vertical
              ? <><line x1={C - 7} y1="0" x2={C - 7} y2="220" /><line x1={C + 7} y1="0" x2={C + 7} y2="220" /></>
              : <><line x1="0" y1={C - 7} x2="220" y2={C - 7} /><line x1="0" y1={C + 7} x2="220" y2={C + 7} /></>}
          </g>
        );
      })}
      {scene.roundabout && (
        <>
          <circle cx={C} cy={C} r="42" fill="none" stroke="#4a5a66" strokeWidth="26" />
          <circle cx={C} cy={C} r="29" fill="#cde9d6" stroke="#fff" strokeWidth="2" />
        </>
      )}
      {scene.vehicles.map((v) => v.sign ? <Sign key={`sign-${v.id}`} kind={v.sign} at={SIGN_SPOT[v.from]} /> : null)}
      {scene.vehicles.map((v) => {
        const onRing = scene.roundabout === true && v.sign === undefined;
        const i = chosen.indexOf(v.id);
        return <Vehicle key={v.id} v={v} spot={onRing ? placeOnRing(v.from) : place(scene, v.from)} position={i < 0 ? null : i + 1} />;
      })}
    </svg>
  );
}
