import type { Topic } from "./types";
export const TOPICS: Topic[] = [
  { id: "priority", category: "Grundstoff", title: { ckb: "پێشەنگی و ڕێگەدان", de: "Vorfahrt" } },
  { id: "speed", category: "Grundstoff", title: { ckb: "خێرایی", de: "Geschwindigkeit" } },
  { id: "distance", category: "Grundstoff", title: { ckb: "مەودا و ڕێگای وەستان", de: "Abstand und Anhalteweg" } },
  { id: "signs", category: "Grundstoff", title: { ckb: "نیشانەکانی هاتووچۆ", de: "Verkehrszeichen" } },
  { id: "people", category: "Grundstoff", title: { ckb: "پیادە و پاسکیلسوار", de: "Fußgänger und Radfahrer" } },
  { id: "behaviour", category: "Grundstoff", title: { ckb: "ئەلکهول، ماندوویی و ڕەفتار", de: "Alkohol, Müdigkeit und Verhalten" } },
  { id: "emergency", category: "Grundstoff", title: { ckb: "ڕووداو و فریاکەوتن", de: "Unfall und Notfall" } },
  { id: "vehicle", category: "Zusatzstoff", title: { ckb: "تەکنیکی ئۆتۆمبێل", de: "Fahrzeugtechnik" } },
  { id: "motorway", category: "Zusatzstoff", title: { ckb: "ئۆتۆبان", de: "Autobahn" } },
  { id: "environment", category: "Zusatzstoff", title: { ckb: "ژینگە و لێخوڕینی ئابووری", de: "Umweltbewusstes Fahren" } },
];
export const topicById = (id: string) => TOPICS.find((t) => t.id === id);
