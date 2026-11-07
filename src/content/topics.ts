import type { Topic } from "./types";
export const TOPICS: Topic[] = [
  { id: "priority", category: "Grundstoff", title: { ckb: "پێشەنگی و ڕێگەدان", de: "Vorfahrt", kmr: "Mafê pêşiyê", ar: "أولوية المرور" } },
  { id: "speed", category: "Grundstoff", title: { ckb: "خێرایی", de: "Geschwindigkeit", kmr: "Lez", ar: "السرعة" } },
  { id: "distance", category: "Grundstoff", title: { ckb: "مەودا و ڕێگای وەستان", de: "Abstand und Anhalteweg", kmr: "Mesafe û rêya rawestanê", ar: "المسافة ومسافة التوقف" } },
  { id: "signs", category: "Grundstoff", title: { ckb: "نیشانەکانی هاتووچۆ", de: "Verkehrszeichen", kmr: "Nîşaneyên trafîkê", ar: "إشارات المرور" } },
  { id: "people", category: "Grundstoff", title: { ckb: "پیادە و پاسکیلسوار", de: "Fußgänger und Radfahrer", kmr: "Peyar û duçerxevan", ar: "المشاة وراكبو الدراجات" } },
  { id: "behaviour", category: "Grundstoff", title: { ckb: "ئەلکهول، ماندوویی و ڕەفتار", de: "Alkohol, Müdigkeit und Verhalten", kmr: "Alkol, westan û tevger", ar: "الكحول والتعب والسلوك" } },
  { id: "emergency", category: "Grundstoff", title: { ckb: "ڕووداو و فریاکەوتن", de: "Unfall und Notfall", kmr: "Qeza û rewşa awarte", ar: "الحوادث والطوارئ" } },
  { id: "vehicle", category: "Zusatzstoff", title: { ckb: "تەکنیکی ئۆتۆمبێل", de: "Fahrzeugtechnik", kmr: "Teknîka wesayîtê", ar: "تقنية المركبة" } },
  { id: "motorway", category: "Zusatzstoff", title: { ckb: "ئۆتۆبان", de: "Autobahn", kmr: "Otoban", ar: "الطريق السريع (أوتوبان)" } },
  { id: "environment", category: "Zusatzstoff", title: { ckb: "ژینگە و لێخوڕینی ئابووری", de: "Umweltbewusstes Fahren", kmr: "Ajotina hawirdorparêz", ar: "القيادة الصديقة للبيئة" } },
];
export const topicById = (id: string) => TOPICS.find((t) => t.id === id);
