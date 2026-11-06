import type { Lesson } from "./types";

/** Original RegaDRIVE lesson texts (educational summaries, not official exam material). */
export const LESSONS: Lesson[] = [
  {
    id: "l-priority", topicId: "priority", minutes: 6,
    title: { ckb: "پێشەنگی لە چوارڕێیاندا", de: "Vorfahrt an Kreuzungen" },
    summary: { ckb: "کێ یەکەم جار دەڕوات؟ ڕیزبەندی ڕێکخستنەکان و یاسای «ڕاست پێش چەپ».", de: "Wer fährt zuerst? Rangfolge der Regelungen und „rechts vor links“." },
    sections: [
      { heading: { ckb: "ڕیزبەندی ڕێکخستن", de: "Rangfolge" },
        body: { ckb: "١. ئاماژەی پۆلیس  ٢. گڵۆپی هاتووچۆ  ٣. نیشانەکانی پێشەنگی  ٤. یاسای «ڕاست پێش چەپ». هەمیشە بەرزترین ڕێکخستن جێبەجێ دەکرێت.", de: "1. Polizeibeamte  2. Ampeln  3. Vorfahrtszeichen  4. „rechts vor links“. Es gilt immer die ranghöchste Regelung." } },
      { heading: { ckb: "ڕاست پێش چەپ", de: "Rechts vor links" },
        body: { ckb: "ئەگەر هیچ نیشانە و گڵۆپێک نەبێت، ئەوەی لە لای ڕاستەوە دێت پێشەنگی هەیە. بە هێمنی نزیک ببەوە و ئامادەی وەستان بە.", de: "Ohne Schilder und Ampeln hat Vorfahrt, wer von rechts kommt. Langsam heranfahren und bremsbereit sein." } },
      { heading: { ckb: "نیشانە گرنگەکان", de: "Wichtige Zeichen" },
        body: { ckb: "٢٠٥ = پێشەنگی بدە. ٢٠٦ (STOP) = هەمیشە بوەستە. ٣٠١ = پێشەنگی لە چوارڕێیانی داهاتوو. ٣٠٦ = ڕێگای سەرەکی.", de: "205 = Vorfahrt gewähren. 206 (STOP) = immer anhalten. 301 = Vorfahrt an der nächsten Kreuzung. 306 = Vorfahrtstraße." } },
    ],
  },
  {
    id: "l-speed", topicId: "speed", minutes: 5,
    title: { ckb: "سنوورەکانی خێرایی", de: "Geschwindigkeitsgrenzen" },
    summary: { ckb: "خێرایی لە ناو شار، دەرەوەی شار و ئۆتۆبان.", de: "Tempo innerorts, außerorts und auf der Autobahn." },
    sections: [
      { heading: { ckb: "سنوورە گشتییەکان بۆ ئۆتۆمبێلی سواری", de: "Allgemeine Grenzen für Pkw" },
        body: { ckb: "ناو شار: ٥٠ کیلۆمەتر لە کاتژمێرێکدا. دەرەوەی شار: ١٠٠. ئۆتۆبان: سنووری گشتی نییە، بەڵام ١٣٠ پێشنیارکراوە.", de: "Innerorts: 50 km/h. Außerorts: 100 km/h. Autobahn: keine allgemeine Grenze, Richtgeschwindigkeit 130 km/h." } },
      { heading: { ckb: "خێرایی گونجاو", de: "Angepasste Geschwindigkeit" },
        body: { ckb: "سنوور واتای خێرایی گونجاو نییە. لە باران، تەم، شەو و هاتووچۆی قەرەباڵغدا هێواشتر بڕۆ.", de: "Die Höchstgeschwindigkeit ist nicht automatisch angemessen. Bei Regen, Nebel, Dunkelheit und dichtem Verkehr langsamer fahren." } },
    ],
  },
  {
    id: "l-distance", topicId: "distance", minutes: 7,
    title: { ckb: "مەودا و ڕێگای وەستان", de: "Abstand und Anhalteweg" },
    summary: { ckb: "یاسا سادەکانی ژمارەکردن بۆ کاردانەوە، بریک و مەودا.", de: "Faustformeln für Reaktionsweg, Bremsweg und Abstand." },
    sections: [
      { heading: { ckb: "ڕێگای کاردانەوە", de: "Reaktionsweg" },
        body: { ckb: "(خێرایی ÷ ١٠) × ٣. نموونە: ٥٠ کیلۆمەتر ← ١٥ مەتر.", de: "(Geschwindigkeit ÷ 10) × 3. Beispiel: 50 km/h → 15 m." } },
      { heading: { ckb: "ڕێگای بریک", de: "Bremsweg" },
        body: { ckb: "(خێرایی ÷ ١٠) × (خێرایی ÷ ١٠). نموونە: ٥٠ کیلۆمەتر ← ٢٥ مەتر. لە بریکی لەناکاودا نزیکەی نیوەی ئەوە.", de: "(Geschwindigkeit ÷ 10) × (Geschwindigkeit ÷ 10). Beispiel: 50 km/h → 25 m. Bei einer Gefahrbremsung etwa die Hälfte." } },
      { heading: { ckb: "ڕێگای وەستان", de: "Anhalteweg" },
        body: { ckb: "ڕێگای کاردانەوە + ڕێگای بریک. لە ٥٠ کیلۆمەتردا: ١٥ + ٢٥ = ٤٠ مەتر.", de: "Reaktionsweg + Bremsweg. Bei 50 km/h: 15 m + 25 m = 40 m." } },
    ],
  },
  {
    id: "l-people", topicId: "people", minutes: 5,
    title: { ckb: "پیادە، مناڵ و پاسکیلسوار", de: "Fußgänger, Kinder und Radfahrer" },
    summary: { ckb: "پاراستنی بەشداربووانی لاوازی هاتووچۆ.", de: "Schutz schwächerer Verkehrsteilnehmer." },
    sections: [
      { heading: { ckb: "پەڕینەوەی پیادە", de: "Fußgängerüberweg" },
        body: { ckb: "پیادە پێشەنگیان هەیە. بە هێمنی نزیک ببەوە و لە بەردەم پەڕینەوەکەدا تێپەڕاندن مەکە.", de: "Fußgänger haben Vorrang. Mit mäßiger Geschwindigkeit heranfahren und vor dem Überweg nicht überholen." } },
      { heading: { ckb: "مەودای لاتەنیشت لە پاسکیلسوار", de: "Seitenabstand zu Radfahrern" },
        body: { ckb: "ناو شار لانیکەم ١.٥ مەتر، دەرەوەی شار لانیکەم ٢ مەتر.", de: "Innerorts mindestens 1,5 m, außerorts mindestens 2 m." } },
    ],
  },
  {
    id: "l-emergency", topicId: "emergency", minutes: 6,
    title: { ckb: "ڕووداو و ڕێڕەوی فریاکەوتن", de: "Unfall und Rettungsgasse" },
    summary: { ckb: "پاراستنی شوێنی ڕووداو، یارمەتی یەکەم و ڕێڕەوی فریاکەوتن.", de: "Unfallstelle absichern, Erste Hilfe und Rettungsgasse." },
    sections: [
      { heading: { ckb: "پاراستنی شوێنەکە", de: "Absichern" },
        body: { ckb: "چرای ئاگادارکردنەوە ← جلی ئاگادارکردنەوە ← سێگۆشەی ئاگادارکردنەوە ← ١١٢ ← یارمەتی یەکەم.", de: "Warnblinklicht → Warnweste → Warndreieck → Notruf 112 → Erste Hilfe." } },
      { heading: { ckb: "ڕێڕەوی فریاکەوتن", de: "Rettungsgasse" },
        body: { ckb: "هێڵی چەپ بۆ چەپ، هەموو هێڵەکانی تر بۆ ڕاست — هەر کاتێک هاتووچۆ هێواش بوو.", de: "Linker Fahrstreifen nach links, alle anderen nach rechts – sobald der Verkehr stockt." } },
    ],
  },
  {
    id: "l-motorway", topicId: "motorway", minutes: 5,
    title: { ckb: "لێخوڕین لە ئۆتۆبان", de: "Fahren auf der Autobahn" },
    summary: { ckb: "چوونە ناوەوە، خێرایی و قەدەغەکان.", de: "Auffahren, Tempo und Verbote." },
    sections: [
      { heading: { ckb: "چوونە ناوەوە", de: "Auffahren" },
        body: { ckb: "لەسەر هێڵی خێراکردن خێرایی زیاد بکە؛ هاتووچۆی سەر ئۆتۆبان پێشەنگی هەیە.", de: "Auf dem Beschleunigungsstreifen beschleunigen; der Verkehr auf der Autobahn hat Vorfahrt." } },
      { heading: { ckb: "قەدەغەکان", de: "Verbote" },
        body: { ckb: "سووڕانەوە، بە دواوە ڕۆیشتن و وەستان (جگە لە فریاکەوتن) قەدەغەن.", de: "Wenden, Rückwärtsfahren und Halten (außer im Notfall) sind verboten." } },
    ],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
