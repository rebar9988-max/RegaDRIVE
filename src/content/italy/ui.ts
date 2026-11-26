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

  // ── The question overview, shared by the exam and the practice run ────
  nav: {
    title: { it: "Elenco delle domande", ckb: "پێڕستی پرسیارەکان", kmrArab: "لیستا پرسان" },
    open: { it: "Apri la domanda", ckb: "پرسیار بکەرەوە", kmrArab: "پرسێ ڤەکە" },
    answered: { it: "con risposta", ckb: "وەڵامدراوە", kmrArab: "بەرسڤدای" },
    unanswered: { it: "senza risposta", ckb: "بێ وەڵام", kmrArab: "بێ بەرسڤ" },
    flagged: { it: "da rivedere", ckb: "بۆ پێداچوونەوە", kmrArab: "بۆ ڤەگەرێ" },
    correct: { it: "corretta", ckb: "ڕاست", kmrArab: "ڕاست" },
    wrong: { it: "sbagliata", ckb: "هەڵە", kmrArab: "چەوت" },
  },

  // ── The exam result ───────────────────────────────────────────────────
  result: {
    score: { it: "Risposte corrette", ckb: "وەڵامی ڕاست", kmrArab: "بەرسڤێن ڕاست" },
    allowed: { it: "Errori consentiti", ckb: "هەڵەی ڕێپێدراو", kmrArab: "چەوتیێن ڕێپێدای" },
    timeUsed: { it: "Tempo impiegato", ckb: "کاتی بەکارهاتوو", kmrArab: "دەمێ هاتی بکارئینان" },
    byChapter: { it: "Errori per capitolo", ckb: "هەڵە بەپێی بەش", kmrArab: "چەوتی ل گۆرا بەشان" },
    perfect: { it: "Nessun errore. Ottimo lavoro.", ckb: "هیچ هەڵەیەک نەبوو. زۆر باش.", kmrArab: "چ چەوتی نەبوون. گەلەک باش." },
    passNote: {
      it: "Con questo risultato avresti superato la prova.",
      ckb: "بەم ئەنجامە لە تاقیکردنەوەی ڕاستەقینە سەرکەوتوو دەبوویت.",
      kmrArab: "ب ڤێ ئەنجامێ تە ل ئەزموونا ڕاستەقینە سەرکەفتی ببوویی.",
    },
    failNote: {
      it: "Con più di 3 errori la prova non è superata. Ripassa gli errori e riprova.",
      ckb: "بە زیاتر لە ٣ هەڵە تاقیکردنەوە سەرکەوتوو نییە. پێداچوونەوە بە هەڵەکان بکە و دووبارە هەوڵ بدە.",
      kmrArab: "ب پتر ژ ٣ چەوتیان ئەزموون سەرکەفتی نینە. چەوتیان دوبارە بکە و ژ نوی هەول بدە.",
    },
  },

  // ── Finishing a practice run ──────────────────────────────────────────
  practice: {
    stillWrong: { it: "Ancora da correggere", ckb: "هێشتا بۆ ڕاستکردنەوە", kmrArab: "هێشتا بۆ ڕاستکرنێ" },
    continueWrong: { it: "Continua con gli errori", ckb: "بەردەوام بە بە هەڵەکان", kmrArab: "ب چەوتیان بدۆمینە" },
    allFixed: { it: "Hai corretto tutti i tuoi errori.", ckb: "هەموو هەڵەکانت ڕاستکردەوە.", kmrArab: "تە هەمی چەوتیێن خۆ ڕاست کرن." },
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

  // ── Account: free, self-service, no payment ever ──────────────────────
  account: {
    title: { it: "Il tuo account", ckb: "هەژمارەکەت", kmrArab: "هەژمێرێ تە" },
    free: { it: "Gratis per sempre, nessun pagamento", ckb: "بۆ هەتاهەتایە بەخۆڕایی، بێ هیچ پارەدانێک", kmrArab: "ب بەلاش هەتا هەتایێ، بێ هیچ دراڤدانەک" },
    why: { it: "Crea un account per salvare i tuoi progressi e ritrovarli su ogni dispositivo.", ckb: "هەژمارێک دروست بکە بۆ پاشەکەوتکردنی پێشکەوتنەکەت و دۆزینەوەی لەسەر هەر ئامێرێک.", kmrArab: "هەژمێرەکێ چێکە دا پێشکەفتنا خۆ بپارێزی و ل سەر هەر ئامێرەکێ ببینی." },
    noCard: { it: "Nessuna carta, nessun abbonamento, nessun limite.", ckb: "هیچ کارتێک، هیچ بەشداریەک، هیچ سنوورێک نییە.", kmrArab: "چ کارت، چ بەشداری، چ سنوور نینن." },
    keepsLocal: { it: "I progressi già su questo dispositivo restano al loro posto.", ckb: "ئەو پێشکەوتنەی لەسەر ئەم ئامێرەیە لە شوێنی خۆی دەمێنێتەوە.", kmrArab: "ئەو پێشکەفتنا ل سەر ڤی ئامێری د جهێ خۆ دا دمینیت." },
    openNow: { it: "Il corso è già aperto: puoi studiare anche senza account.", ckb: "خولەکە ئێستاش کراوەیە: بەبێ هەژماریش دەتوانیت بخوێنیت.", kmrArab: "خول نوکە ژی ڤەکری یە: بێ هەژمێر ژی دشێی بخوینی." },

    signIn: { it: "Accedi", ckb: "چوونەژوورەوە", kmrArab: "چوونا ژۆرێ" },
    createAccount: { it: "Crea account", ckb: "دروستکردنی هەژمار", kmrArab: "چێکرنا هەژمێری" },
    createFree: { it: "Crea il tuo account gratuito", ckb: "هەژمارە بەخۆڕاییەکەت دروست بکە", kmrArab: "هەژمێرێ خۆ یێ بەلاش چێکە" },

    name: { it: "Nome", ckb: "ناو", kmrArab: "ناڤ" },
    email: { it: "E-mail", ckb: "ئیمەیڵ", kmrArab: "ئیمەیل" },
    password: { it: "Password", ckb: "وشەی نهێنی", kmrArab: "پەیڤا ڤەشارتی" },
    newPassword: { it: "Nuova password", ckb: "وشەی نهێنیی نوێ", kmrArab: "پەیڤا ڤەشارتی یا نی" },
    passwordHint: { it: "Almeno dieci caratteri.", ckb: "لانیکەم دە پیت.", kmrArab: "ب کێمی دە تیپ." },
    showPassword: { it: "Mostra la password", ckb: "پیشاندانی وشەی نهێنی", kmrArab: "نیشاندانا پەیڤا ڤەشارتی" },
    hidePassword: { it: "Nascondi la password", ckb: "شاردنەوەی وشەی نهێنی", kmrArab: "ڤەشارتنا پەیڤا ڤەشارتی" },
    forgot: { it: "Password dimenticata?", ckb: "وشەی نهێنیت لەبیر چووە؟", kmrArab: "پەیڤا ڤەشارتی ژبیرکری؟" },
    sendCode: { it: "Invia il codice", ckb: "ناردنی کۆد", kmrArab: "هنارتنا کۆدی" },

    verifyTitle: { it: "Controlla la tua e-mail", ckb: "ئیمەیڵەکەت بپشکنە", kmrArab: "ئیمەیلا خۆ ببینە" },
    verifyBody: { it: "Abbiamo inviato un codice di sei cifre a questo indirizzo. Vale dieci minuti.", ckb: "کۆدێکی شەش ژمارەییمان بۆ ئەم ناونیشانە نارد. دە خولەک کاردەکات.", kmrArab: "مە کۆدەکێ شەش ژمارەیی بۆ ڤێ ناڤنیشانێ هنارت. دە خولەکان دەربازدار ە." },
    code: { it: "Codice a sei cifre", ckb: "کۆدی شەش ژمارەیی", kmrArab: "کۆدێ شەش ژمارەیی" },
    confirm: { it: "Conferma", ckb: "پشتڕاستکردنەوە", kmrArab: "پشتراستکرن" },
    resend: { it: "Invia di nuovo il codice", ckb: "دووبارە ناردنەوەی کۆد", kmrArab: "دیسا هنارتنا کۆدی" },
    resetTitle: { it: "Scegli una nuova password", ckb: "وشەیەکی نهێنیی نوێ هەڵبژێرە", kmrArab: "پەیڤەکا ڤەشارتی یا نی هەلبژێرە" },
    resetBody: { it: "Inserisci il codice ricevuto per e-mail e la nuova password.", ckb: "ئەو کۆدەی بە ئیمەیڵ پێت گەیشتووە و وشە نهێنییە نوێیەکە بنووسە.", kmrArab: "ئەو کۆدا ب ئیمەیلێ گەهشتیە تە و پەیڤا ڤەشارتی یا نی بنڤیسە." },
    back: { it: "Indietro", ckb: "گەڕانەوە", kmrArab: "زڤرین" },

    verified: { it: "E-mail confermata", ckb: "ئیمەیڵ پشتڕاستکراوەتەوە", kmrArab: "ئیمەیل هاتیە پشتراستکرن" },
    unverified: { it: "E-mail da confermare", ckb: "ئیمەیڵ پێویستی بە پشتڕاستکردنەوەیە", kmrArab: "ئیمەیل پێدڤی ب پشتراستکرنێ یە" },
    everything: { it: "Tutto incluso, senza costi", ckb: "هەموو شتێک لەخۆدەگرێت، بێ تێچوون", kmrArab: "هەمی تشت د خۆ دگریت، بێ خەرجی" },
    everythingBody: { it: "Quiz, lezioni, incroci e simulazioni: ogni parte del corso è aperta.", ckb: "ڕاهێنان، وانە، چوارڕێیان و تاقیکردنەوەی نموونەیی: هەموو بەشێکی خولەکە کراوەیە.", kmrArab: "راهێنان، وانە، چوارریان و تاقیکرنا نموونەیی: هەر بەشەکێ خولی ڤەکری یە." },

    licenseRow: { it: "Tipo di patente", ckb: "جۆری مۆڵەت", kmrArab: "جورێ دەستووری" },
    progressRow: { it: "I tuoi progressi", ckb: "پێشکەوتنەکانت", kmrArab: "پێشکەفتنێن تە" },
    lessonsRow: { it: "Lezioni di teoria", ckb: "وانەکانی تیۆری", kmrArab: "وانێن تیۆریێ" },
    incrociRow: { it: "Incroci", ckb: "چوارڕێیان", kmrArab: "چوارریان" },

    backup: { it: "Copia di sicurezza", ckb: "کۆپی پاراستن", kmrArab: "کۆپیا پاراستنێ" },
    backupBody: { it: "Salva i progressi nel tuo account e ritrovali su un altro dispositivo.", ckb: "پێشکەوتنەکان لە هەژمارەکەتدا پاشەکەوت بکە و لەسەر ئامێرێکی تر بیاندۆزەوە.", kmrArab: "پێشکەفتنان د هەژمێرێ خۆ دا بپارێزە و ل سەر ئامێرەکێ دی ببینە." },
    saveNow: { it: "Salva ora", ckb: "ئێستا پاشەکەوتی بکە", kmrArab: "نوکە بپارێزە" },
    restore: { it: "Ripristina", ckb: "گەڕاندنەوە", kmrArab: "ڤەگەراندن" },
    lastSaved: { it: "Ultimo salvataggio", ckb: "دوایین پاشەکەوتکردن", kmrArab: "پاراستنا دویماهیێ" },
    neverSaved: { it: "Nessuna copia salvata", ckb: "هیچ کۆپییەک پاشەکەوت نەکراوە", kmrArab: "چ کۆپی نەهاتیە پاراستن" },
    exportData: { it: "Scarica i tuoi dati", ckb: "داتاکانت دابەزێنە", kmrArab: "داتایێن خۆ دابگرە" },

    signOut: { it: "Esci", ckb: "دەرچوون", kmrArab: "دەرکەفتن" },
    signOutAll: { it: "Esci da tutti i dispositivi", ckb: "دەرچوون لە هەموو ئامێرەکان", kmrArab: "دەرکەفتن ژ هەمی ئامێران" },
    deleteAccount: { it: "Elimina l\u2019account", ckb: "سڕینەوەی هەژمار", kmrArab: "ژێبرنا هەژمێری" },
    deleteBody: { it: "L\u2019account e la copia di sicurezza spariscono per sempre. I progressi su questo dispositivo restano.", ckb: "هەژمارەکە و کۆپی پاراستنەکە بۆ هەمیشە دەسڕێنەوە. پێشکەوتنی سەر ئەم ئامێرە دەمێنێتەوە.", kmrArab: "هەژمێر و کۆپیا پاراستنێ هەتا هەتایێ دچن. پێشکەفتنا ل سەر ڤی ئامێری دمینیت." },
    deleteConfirm: { it: "Conferma l\u2019eliminazione", ckb: "سڕینەوەکە پشتڕاست بکەرەوە", kmrArab: "ژێبرنێ پشتراست بکە" },
    cancel: { it: "Annulla", ckb: "هەڵوەشاندنەوە", kmrArab: "بەتالکرن" },

    okResent: { it: "Codice inviato di nuovo.", ckb: "کۆد دووبارە نێردرایەوە.", kmrArab: "کۆد دیسا هاتە هنارتن." },
    okSaved: { it: "Progressi salvati nel tuo account.", ckb: "پێشکەوتنەکان لە هەژمارەکەتدا پاشەکەوت کران.", kmrArab: "پێشکەفتن د هەژمێرێ تە دا هاتنە پاراستن." },
    okRestored: { it: "Progressi ripristinati su questo dispositivo.", ckb: "پێشکەوتنەکان بۆ سەر ئەم ئامێرە گەڕێنرانەوە.", kmrArab: "پێشکەفتن بۆ سەر ڤی ئامێری هاتنە ڤەگەراندن." },
    okNothing: { it: "Non c\u2019è ancora nessuna copia da ripristinare.", ckb: "هێشتا هیچ کۆپییەک نییە بۆ گەڕاندنەوە.", kmrArab: "هێژ چ کۆپی نینن بۆ ڤەگەراندنێ." },
    okExported: { it: "I tuoi dati sono stati scaricati.", ckb: "داتاکانت دابەزێنران.", kmrArab: "داتایێن تە هاتنە دابگرتن." },
    okDeleted: { it: "Account eliminato.", ckb: "هەژمار سڕدرایەوە.", kmrArab: "هەژمێر هاتە ژێبرن." },
    okResetDone: { it: "Password aggiornata. Ora puoi accedere.", ckb: "وشەی نهێنی نوێ کرایەوە. ئێستا دەتوانیت بچیتە ژوورەوە.", kmrArab: "پەیڤا ڤەشارتی هاتە نویکرن. نوکە دشێی بچییە ژۆرێ." },

    errGeneric: { it: "Qualcosa non ha funzionato. Riprova.", ckb: "شتێک سەرکەوتوو نەبوو. دووبارە هەوڵ بدەرەوە.", kmrArab: "تشتەک نەچۆ سەرێ. دیسا هەول بدە." },
    errCredentials: { it: "E-mail o password non corretti.", ckb: "ئیمەیڵ یان وشەی نهێنی هەڵەیە.", kmrArab: "ئیمەیل یان پەیڤا ڤەشارتی یا چەوت ە." },
    errEmail: { it: "Inserisci un indirizzo e-mail valido.", ckb: "ناونیشانێکی ئیمەیڵی دروست بنووسە.", kmrArab: "ناڤنیشانەکا ئیمەیلێ یا راست بنڤیسە." },
    errPassword: { it: "La password deve avere almeno dieci caratteri.", ckb: "وشەی نهێنی پێویستە لانیکەم دە پیت بێت.", kmrArab: "پەیڤا ڤەشارتی پێدڤی ب کێمی دە تیپ بیت." },
    errCode: { it: "Codice non valido o scaduto.", ckb: "کۆد هەڵەیە یان بەسەرچووە.", kmrArab: "کۆد یێ چەوت یان یێ بدویڤچووی." },
    errTaken: { it: "Controlla la tua e-mail: se l\u2019indirizzo è libero, il codice è in arrivo.", ckb: "ئیمەیڵەکەت بپشکنە: ئەگەر ناونیشانەکە بەتاڵ بێت، کۆدەکە لە ڕێگادایە.", kmrArab: "ئیمەیلا خۆ ببینە: ئەگەر ناڤنیشان ڤالا بیت، کۆد د ڕێکێ دا یە." },
    errRate: { it: "Troppi tentativi. Riprova più tardi.", ckb: "هەوڵدانی زۆر. دواتر دووبارە هەوڵ بدەرەوە.", kmrArab: "هەولدانێن پر. پاشی دیسا هەول بدە." },
    errNetwork: { it: "Nessuna connessione. Controlla la rete e riprova.", ckb: "هیچ پەیوەندییەک نییە. تۆڕەکە بپشکنە و دووبارە هەوڵ بدەرەوە.", kmrArab: "چ گرێدان نینە. تۆرێ ببینە و دیسا هەول بدە." },
    errSession: { it: "La sessione è scaduta. Accedi di nuovo.", ckb: "دانیشتنەکە بەسەرچووە. دووبارە بچۆرە ژوورەوە.", kmrArab: "دانیشتن یا بدویڤچووی. دیسا بچە ژۆرێ." },
    unavailable: { it: "Gli account non sono disponibili in questo momento. Il corso resta aperto.", ckb: "هەژمارەکان لەم کاتەدا بەردەست نین. خولەکە کراوە دەمێنێتەوە.", kmrArab: "هەژمێر د ڤێ دەمێ دا نەبەردەست ن. خول ڤەکری دمینیت." },
    loading: { it: "Caricamento", ckb: "بارکردن", kmrArab: "بارکرن" },
  },

} as const satisfies Record<string, Record<string, ItText>>;
