import type { ItSign } from "./types.ts";

/**
 * Simplified RegaDRIVE illustrations for the Italian section. They are drawn in-house as plain SVG
 * (public/signs/it) and are not reproductions of official artwork.
 */
export const IT_SIGNS: ItSign[] = [
  { id: "it-autostrada", file: "autostrada.svg", group: "information",
    name: { ckb: "ئۆتۆسترادا", it: "Autostrada", kmrArab: "ئۆتۆسترادا", kmr: "Otostrada", de: "Autobahn", ar: "طريق سريع" } },
  { id: "it-pericolo", file: "pericolo.svg", group: "danger",
    name: { ckb: "مەترسی گشتی", it: "Pericolo generico", kmrArab: "مەترسیا گشتی", kmr: "Xetereya giştî", de: "Gefahrstelle", ar: "خطر عام" } },
  { id: "it-divieto", file: "divieto.svg", group: "prohibition",
    name: { ckb: "سنووری خێرایی ٥٠", it: "Limite di velocità 50", kmrArab: "سنوورێ لەزاتیێ ٥٠", kmr: "Sînorê lezê 50", de: "Zulässige Höchstgeschwindigkeit 50", ar: "حد السرعة ٥٠" } },
  { id: "it-obbligo", file: "obbligo.svg", group: "mandatory",
    name: { ckb: "ناچاری: ڕاست بڕۆ", it: "Direzione obbligatoria diritto", kmrArab: "نەچاری: ڕاست بچە", kmr: "Aliyê neçarî: rasterast", de: "Vorgeschriebene Fahrtrichtung geradeaus", ar: "اتجاه إلزامي للأمام" } },
  { id: "it-precedenza", file: "precedenza.svg", group: "priority",
    name: { ckb: "ڕێگا بدە", it: "Dare precedenza", kmrArab: "ڕێکێ بدە", kmr: "Mafê pêşiyê bide", de: "Vorfahrt gewähren", ar: "أعطِ الأولوية" } },
  { id: "it-stop", file: "stop.svg", group: "priority",
    name: { ckb: "وەستان (STOP)", it: "Fermarsi e dare precedenza (STOP)", kmrArab: "ڕاوەستە (STOP)", kmr: "Raweste (STOP)", de: "Halt! Vorfahrt gewähren", ar: "قف وأعطِ الأولوية" } },
  { id: "it-semaforo", file: "semaforo.svg", group: "information",
    name: { ckb: "ترافیک لایت", it: "Semaforo", kmrArab: "ترافیک لایت", kmr: "Lambeya trafîkê", de: "Lichtzeichenanlage", ar: "إشارة ضوئية" } },
  { id: "it-parcheggio", file: "parcheggio.svg", group: "information",
    name: { ckb: "پارکینگ", it: "Parcheggio", kmrArab: "پارکینگ", kmr: "Parking", de: "Parkplatz", ar: "موقف سيارات" } },
];

/** Public URL of a sign illustration. */
export const itSignSrc = (sign: ItSign): string => `/signs/it/${sign.file}`;

export const itSignById = (id: string): ItSign | undefined => IT_SIGNS.find((s) => s.id === id);
