import type { ItText } from "./types.ts";

/**
 * Interface wording of the Italian section, written directly in the three languages Italy offers:
 * Italian (source), Kurdish Sorani and Duhok Badini (Arabic script).
 *
 * Owner rule (2026-11-26), language isolation: every language here is self-contained. Nothing falls
 * back to German or to another language, Sorani forms never appear in the Badini wording and no Latin
 * letters are used in the two Kurdish arms beyond names and codes. tests/unit/italy-ui-strings.test.ts
 * checks each of these for every entry below.
 */
export const ITU = {
  // ── Home ──────────────────────────────────────────────────────────────
  home: {
    kicker: { it: "Italia · Patente B", ckb: "ئیتاڵیا · مۆڵەتی B", kmrArab: "ئیتالیا · دەستوورا B" },
    title: { it: "Il tuo corso di teoria", ckb: "خولی تیۆریی تۆ", kmrArab: "خولا تیۆریا تە" },
    free: {
      it: "Gratis per sempre · nessuna registrazione · nessuna pubblicità",
      ckb: "هەمیشە بێ بەرامبەر · بێ تۆمارکردن · بێ ڕیکلام",
      kmrArab: "هەردەم بێ بەرامبەر · بێ تۆمارکرن · بێ ڕیکلام",
    },
    everything: { it: "Tutto in un posto", ckb: "هەموو شتێک لە یەک شوێندا", kmrArab: "هەمی تشت ل یەک جهی" },
    chaptersHeading: { it: "I 16 capitoli del programma", ckb: "١٦ بەشەکەی پڕۆگرام", kmrArab: "١٦ بەشێن پرۆگرامی" },
    searchChapter: { it: "Cerca un capitolo", ckb: "گەڕان بەدوای بەشێکدا", kmrArab: "ل بەشەکی بگەڕە" },
    noChapterFound: { it: "Nessun capitolo con questo nome.", ckb: "هیچ بەشێک بەم ناوە نییە.", kmrArab: "چ بەشەک ب ڤی ناڤی نینە." },
  },

  // ── The sections of the Italian course ────────────────────────────────
  tiles: {
    practice: { it: "Esercitati", ckb: "ڕاهێنان", kmrArab: "ڕاهێنان" },
    practiceSub: { it: "Domande vero o falso", ckb: "پرسیاری ڕاست یان هەڵە", kmrArab: "پرسێن ڕاست یان چەوت" },
    theory: { it: "Teoria", ckb: "وانەکانی تیۆری", kmrArab: "دەرسێن تیۆریێ" },
    theorySub: { it: "Una lezione per ogni capitolo", ckb: "وانەیەک بۆ هەر بەشێک", kmrArab: "دەرسەک بۆ هەر بەشەکی" },
    mistakes: { it: "Ripassa gli errori", ckb: "پێداچوونەوە بە هەڵەکان", kmrArab: "دوبارەکرنا چەوتیان" },
    mistakesSub: { it: "Solo quello che hai sbagliato", ckb: "تەنها ئەوەی هەڵەت کردووە", kmrArab: "تنێ ئەوێ تە چەوت کری" },
    stats: { it: "Statistiche", ckb: "ئامار و پێشکەوتن", kmrArab: "ئامار و پێشکەفتن" },
    statsSub: { it: "Medie, costanza e progressi", ckb: "ڕێژە، بەردەوامی و پێشکەوتن", kmrArab: "ڕێژە، بەردەوامی و پێشکەفتن" },
    incroci: { it: "Incroci", ckb: "چوارڕێیان", kmrArab: "خاچەڕێ" },
    incrociSub: { it: "Chi passa per primo?", ckb: "کێ سەرەتا تێدەپەڕێت؟", kmrArab: "کی بەری هەمییان دەرباز دبیت؟" },
    exam: { it: "Simulazione d'esame", ckb: "تاقیکردنەوەی نموونەیی", kmrArab: "ئەزموونا نموونەیی" },
    examSub: { it: "Come la prova vera", ckb: "وەک تاقیکردنەوەی ڕاستەقینە", kmrArab: "وەکی ئەزموونا ڕاستەقینە" },
    signs: { it: "Segnali stradali", ckb: "هێماکانی هاتوچۆ", kmrArab: "نیشانێن هاتنوچوونێ" },
    signsSub: { it: "Riconoscili a colpo d'occhio", ckb: "بە یەک سەیرکردن بیانناسە", kmrArab: "ب یەک تەماشەکرنێ وان ناسبکە" },
    guide: { it: "Guida allo studio", ckb: "یاریدەدەری فێرکاری", kmrArab: "هاریکارێ فێرکرنێ" },
    guideSub: { it: "Il passo giusto adesso", ckb: "هەنگاوی گونجاو بۆ ئێستا", kmrArab: "گاڤا گونجای بۆ نوکە" },
  },

  // ── The study guide: one honest next step, chosen from real progress ──
  guide: {
    heading: { it: "Il prossimo passo", ckb: "هەنگاوی دواتر", kmrArab: "گاڤا پاشتر" },
    startLesson: {
      it: "Comincia dalla prima lezione: le parole della strada vengono prima delle regole.",
      ckb: "لە وانەی یەکەمەوە دەست پێ بکە: وشەکانی ڕێگا پێش یاساکان دێن.",
      kmrArab: "ژ دەرسا ئێکێ دەست پێ بکە: پەیڤێن ڕێکێ بەری یاسایان دئێن.",
    },
    continueLesson: {
      it: "Continua con la prossima lezione che hai lasciato aperta.",
      ckb: "بەردەوام بە لەسەر ئەو وانەیەی هێشتا تەواوت نەکردووە.",
      kmrArab: "بەردەوام بە ل سەر وێ دەرسا تە هێشتا قەدیاندی نینە.",
    },
    fixMistakes: {
      it: "Hai domande sbagliate da rivedere: comincia da lì, è il guadagno più rapido.",
      ckb: "پرسیاری هەڵەت هەیە بۆ پێداچوونەوە: لەوێوە دەست پێ بکە، خێراترین سوودە.",
      kmrArab: "پرسێن چەوت یێن تە هەنە بۆ دوبارەکرنێ: ژ وێرێ دەست پێ بکە، ئەڤە زووترین کەلکە.",
    },
    trainIncroci: {
      it: "Allenati sugli incroci: la precedenza è il tema che pesa di più all'esame.",
      ckb: "ڕاهێنان لەسەر چوارڕێیان بکە: مافی تێپەڕین قورسترین بابەتی تاقیکردنەوەیە.",
      kmrArab: "ڕاهێنانێ ل سەر خاچەڕێیان بکە: مافێ پێشیێ گرانترین بابەتێ ئەزموونێیە.",
    },
    takeExam: {
      it: "Sei pronto per una simulazione completa: provala come la prova vera.",
      ckb: "ئامادەی بۆ تاقیکردنەوەیەکی تەواو: وەک تاقیکردنەوەی ڕاستەقینە تاقی بکەرەوە.",
      kmrArab: "تو ئامادەیی بۆ ئەزموونەکا تەمام: وەکی ئەزموونا ڕاستەقینە وێ تاقی بکە.",
    },
    waitForContent: {
      it: "Le domande sono ancora in revisione. Intanto studia la teoria e gli incroci: sono già pronti.",
      ckb: "پرسیارەکان هێشتا لە پێداچوونەوەدان. لەم ماوەیەدا تیۆری و چوارڕێیان بخوێنە: ئامادەن.",
      kmrArab: "پرس هێشتا د پشکنینێ دانە. د ڤێ ماوەیێ دا تیۆری و خاچەڕێیان بخوینە: ئەو ئامادەنە.",
    },
  },

  // ── Statistics ────────────────────────────────────────────────────────
  stats: {
    title: { it: "Le tue statistiche", ckb: "ئاماری تۆ", kmrArab: "ئامارێن تە" },
    readiness: { it: "Pronto per l'esame", ckb: "ئامادەیی بۆ تاقیکردنەوە", kmrArab: "ئامادەیی بۆ ئەزموونێ" },
    readinessNotStarted: { it: "Non ancora iniziato", ckb: "هێشتا دەستت پێ نەکردووە", kmrArab: "هێشتا تە دەست پێ نەکریە" },
    readinessLearning: { it: "In apprendimento", ckb: "لە فێربووندایت", kmrArab: "تو د فێربوونێ دایی" },
    readinessAlmost: { it: "Quasi pronto", ckb: "خەریکە ئامادە دەبیت", kmrArab: "نێزیکی ئامادەبوونێ" },
    readinessReady: { it: "Pronto", ckb: "ئامادەیت", kmrArab: "تو ئامادەیی" },
    readinessHow: {
      it: "Calcolata solo dalle tue risposte e dalle simulazioni che hai fatto davvero.",
      ckb: "تەنها لە وەڵامەکانی خۆت و ئەو تاقیکردنەوانەی بەڕاستی کردوتە هەژمار دەکرێت.",
      kmrArab: "تنێ ژ بەرسڤێن تە و ژ وان ئەزموونێن تە ب ڕاستی کرین دئێتە هەژمارتن.",
    },
    streak: { it: "Costanza", ckb: "بەردەوامی", kmrArab: "بەردەوامی" },
    streakDays: { it: "Giorni di fila", ckb: "ڕۆژی لەسەریەک", kmrArab: "ڕۆژێن ل سەر ئێک" },
    streakNone: { it: "Inizia oggi la tua serie: basta una domanda.", ckb: "ئەمڕۆ زنجیرەکەت دەست پێ بکە: یەک پرسیار بەسە.", kmrArab: "ئەڤرۆ زنجیرا خۆ دەست پێ بکە: ئێک پرس بەسە." },
    thisWeek: { it: "Questa settimana", ckb: "ئەم هەفتەیە", kmrArab: "ڤێ هەفتییێ" },
    today: { it: "Oggi", ckb: "ئەمڕۆ", kmrArab: "ئەڤرۆ" },
    answers: { it: "Risposte", ckb: "وەڵام", kmrArab: "بەرسڤ" },
    correct: { it: "Risposte corrette", ckb: "وەڵامی ڕاست", kmrArab: "بەرسڤێن ڕاست" },
    wrong: { it: "Risposte sbagliate", ckb: "وەڵامی هەڵە", kmrArab: "بەرسڤێن چەوت" },
    accuracy: { it: "Precisione", ckb: "ڕێژەی ڕاستی", kmrArab: "ڕێژا ڕاستیێ" },
    strong: { it: "I tuoi punti forti", ckb: "بەشە بەهێزەکانت", kmrArab: "بەشێن تە یێن بهێز" },
    weak: { it: "Da rinforzare", ckb: "پێویستی بە بەهێزکردن هەیە", kmrArab: "پێدڤی ب بهێزکرنێ هەیە" },
    strongEmpty: { it: "Rispondi a qualche domanda e qui vedrai dove sei forte.", ckb: "چەند پرسیارێک وەڵام بدەرەوە، ئینجا لێرە دەبینیت لە چیدا بەهێزیت.", kmrArab: "چەند پرسان بەرسڤ بدە، پاشی ل ڤێرێ تو دبینی ل کیڤە بهێزی." },
    weakEmpty: { it: "Nessun punto debole finora. Continua così.", ckb: "تا ئێستا هیچ لاوازییەک نییە. بەردەوام بە.", kmrArab: "هەتا نوکە چ لاوازی نینە. بەردەوام بە." },
    examsDone: { it: "Simulazioni svolte", ckb: "تاقیکردنەوەی ئەنجامدراو", kmrArab: "ئەزموونێن هاتینە کرن" },
    examsPassed: { it: "Simulazioni superate", ckb: "تاقیکردنەوەی سەرکەوتوو", kmrArab: "ئەزموونێن سەرکەفتی" },
    notStartedChapters: { it: "Capitoli non iniziati", ckb: "بەشی دەستپێنەکراو", kmrArab: "بەشێن دەست پێ نەکری" },
    noDataYet: {
      it: "Qui compaiono solo i tuoi numeri reali: finché non rispondi, non c'è niente da mostrare.",
      ckb: "لێرە تەنها ژمارە ڕاستەقینەکانی خۆت دەردەکەون: تا وەڵام نەدەیتەوە، هیچ نییە بۆ پیشاندان.",
      kmrArab: "ل ڤێرێ تنێ ژمارێن تە یێن ڕاستەقینە دئێنە دیار: هەتا تو بەرسڤان نەدەی، چ نینە بۆ نیشاندانێ.",
    },
  },

  // ── An exam left in the middle ────────────────────────────────────────
  exam: {
    resumeHeading: { it: "Hai un esame in corso", ckb: "تاقیکردنەوەیەکت کراوەیە", kmrArab: "ئەزموونەک ب تە ڤەکریە" },
    resumeNote: {
      it: "Le tue risposte e il tempo rimasto sono stati conservati. Puoi riprendere da dove eri.",
      ckb: "وەڵامەکانت و کاتی ماوە پارێزراون. دەتوانیت لەوێوە بەردەوام بیت کە لێی بوویت.",
      kmrArab: "بەرسڤێن تە و دەمێ مای هاتینە پاراستن. تو دشێی ژ وێرێ بدۆمینی.",
    },
    resume: { it: "Riprendi l'esame", ckb: "بەردەوامبوون لە تاقیکردنەوە", kmrArab: "ئەزموونێ بدۆمینە" },
    discard: { it: "Scarta e ricomincia", ckb: "فڕێدان و دەستپێکردنەوە", kmrArab: "بەردە و ژ نوی دەست پێ بکە" },
  },

  // ── Incroci (right of way) ────────────────────────────────────────────
  incroci: {
    title: { it: "Incroci e precedenze", ckb: "چوارڕێیان و مافی تێپەڕین", kmrArab: "خاچەڕێ و مافێ پێشیێ" },
    short: { it: "Incroci", ckb: "چوارڕێیان", kmrArab: "خاچەڕێ" },
    question: { it: "Chi passa per primo?", ckb: "کێ سەرەتا تێدەپەڕێت؟", kmrArab: "کی بەری هەمییان دەرباز دبیت؟" },
    intro: {
      it: "Tocca i veicoli nell'ordine in cui passano: prima chi ha la precedenza.",
      ckb: "ئۆتۆمبێلەکان بە ڕیزبەندی تێپەڕینیان دەستیان لێ بدە: یەکەم ئەوەی مافی تێپەڕینی هەیە.",
      kmrArab: "دەستێ خۆ ل ترۆمبێلان بدە ل گۆرا ڕیزا دەربازبوونا وان: ئێکێ ئەوێ مافێ پێشیێ هەی.",
    },
    solved: { it: "Scene risolte", ckb: "دۆخی چارەسەرکراو", kmrArab: "دۆخێن چارەسەرکری" },
    solvedOne: { it: "Risolta", ckb: "چارەسەرکرا", kmrArab: "هاتە چارەسەرکرن" },
    order: { it: "Il tuo ordine", ckb: "ڕیزبەندییەکەت", kmrArab: "ڕیزا تە" },
    undo: { it: "Annulla l'ultima scelta", ckb: "هەڵبژاردنی کۆتایی بسڕەوە", kmrArab: "هەلبژارتنا دووماهیێ ڕاکە" },
    reset: { it: "Ricomincia la scena", ckb: "دۆخەکە لە سەرەتاوە", kmrArab: "دۆخی ژ نوی دەست پێ بکە" },
    check: { it: "Controlla", ckb: "پشکنین", kmrArab: "پشکنین" },
    right: { it: "Esatto!", ckb: "ڕاستە!", kmrArab: "ڕاستە!" },
    notRight: { it: "Non è questo l'ordine.", ckb: "ئەمە ڕیزبەندییە ڕاستەکە نییە.", kmrArab: "ئەڤە ڕیزا ڕاست نینە." },
    why: { it: "Perché", ckb: "هۆکارەکەی", kmrArab: "چیمکی" },
    showAnswer: { it: "Mostra la soluzione", ckb: "وەڵامەکە پیشان بدە", kmrArab: "بەرسڤێ نیشان بدە" },
    correctOrder: { it: "Ordine corretto", ckb: "ڕیزبەندی ڕاست", kmrArab: "ڕیزا ڕاست" },
    next: { it: "Scena successiva", ckb: "دۆخی دواتر", kmrArab: "دۆخێ پاشتر" },
    prev: { it: "Scena precedente", ckb: "دۆخی پێشوو", kmrArab: "دۆخێ بەری" },
    back: { it: "Tutte le scene", ckb: "هەموو دۆخەکان", kmrArab: "هەمی دۆخ" },
    rule: { it: "La regola", ckb: "یاساکە", kmrArab: "یاسا" },
    vehicle: { it: "Veicolo", ckb: "ئۆتۆمبێل", kmrArab: "ترۆمبێل" },
    position: { it: "Posizione", ckb: "جێگا", kmrArab: "جه" },
    chooseVehicle: { it: "Scegli questo veicolo", ckb: "ئەم ئۆتۆمبێلە هەڵبژێرە", kmrArab: "ڤێ ترۆمبێلێ هەلبژێرە" },
    scene: { it: "Scena", ckb: "دۆخ", kmrArab: "دۆخ" },
    original: {
      it: "Disegni originali RegaDRIVE: schemi didattici, non figure ufficiali d'esame.",
      ckb: "وێنەی ڕەسەنی RegaDRIVE: شێوەی فێرکاری، نەک وێنەی فەرمیی تاقیکردنەوە.",
      kmrArab: "وێنەیێن ڕەسەن یێن RegaDRIVE: شێوەیێن فێرکرنێ، نە وێنەیێن فەرمی یێن ئەزموونێ.",
    },
  },

  // ── Directions, used as the accessible name of a vehicle ──────────────
  dir: {
    north: { it: "da nord", ckb: "لە باکوورەوە", kmrArab: "ژ باکووری ڤە" },
    south: { it: "da sud", ckb: "لە باشوورەوە", kmrArab: "ژ باشووری ڤە" },
    east: { it: "da est", ckb: "لە ڕۆژهەڵاتەوە", kmrArab: "ژ ڕۆژهەلاتی ڤە" },
    west: { it: "da ovest", ckb: "لە ڕۆژئاوداوە", kmrArab: "ژ ڕۆژئاڤایی ڤە" },
  },

  // ── Colours, used as the accessible name of a vehicle ─────────────────
  colour: {
    blue: { it: "Auto blu", ckb: "ئۆتۆمبێلی شین", kmrArab: "ترۆمبێلا شین" },
    red: { it: "Auto rossa", ckb: "ئۆتۆمبێلی سوور", kmrArab: "ترۆمبێلا سۆر" },
    yellow: { it: "Auto gialla", ckb: "ئۆتۆمبێلی زەرد", kmrArab: "ترۆمبێلا زەر" },
    green: { it: "Auto verde", ckb: "ئۆتۆمبێلی سەوز", kmrArab: "ترۆمبێلا کەسک" },
    tram: { it: "Tram", ckb: "تڕام", kmrArab: "تڕام" },
  },
} as const satisfies Record<string, Record<string, ItText>>;
