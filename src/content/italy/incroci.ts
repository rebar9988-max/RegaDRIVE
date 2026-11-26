import type { ItText } from "./types.ts";

/**
 * "Incroci": right-of-way scenes of the Italian section.
 *
 * Original RegaDRIVE teaching material. Each scene is a schematic drawn by this app from the data
 * below (src/components/ItIncrocioScene.tsx) — it is not a reproduction of a ministerial figure and
 * carries no official figure number. The order of precedence is authored together with the rule it
 * rests on and the article of the Codice della Strada behind it, exactly as the lessons are.
 *
 * Nothing here is an examination question: the exam bank stays in questions.ts and keeps its own
 * publication gate.
 */

/** The arm of the junction a vehicle arrives from. */
export type ItApproach = "north" | "south" | "east" | "west";

/** Where the vehicle is going once it reaches the junction. */
export type ItTurn = "straight" | "left" | "right";

export type ItVehicleColour = "blue" | "red" | "yellow" | "green" | "tram";

/** The sign that faces this vehicle on its own arm. */
export type ItApproachSign = "stop" | "giveway" | "priority";

export interface ItIncrocioVehicle {
  /** Unique inside its scene; the order below is a list of these ids. */
  id: string;
  colour: ItVehicleColour;
  from: ItApproach;
  turn: ItTurn;
  sign?: ItApproachSign;
}

export type ItIncrocioGroup = "basics" | "three" | "many" | "lanes";

export interface ItIncrocio {
  id: string;
  group: ItIncrocioGroup;
  title: ItText;
  /** Which arms the junction has; a T junction simply lists three. */
  arms: ItApproach[];
  /** Drawn narrower than a road: a private access or a driveway. */
  narrowArm?: ItApproach;
  /** A roundabout island instead of a plain junction. */
  roundabout?: boolean;
  vehicles: ItIncrocioVehicle[];
  /** Vehicle ids in the order of precedence. A permutation of the vehicles above. */
  order: string[];
  /** The rule in one line. */
  rule: ItText;
  /** Why this order and no other, step by step. */
  why: ItText;
  /** The article of the Codice della Strada the rule rests on. */
  ref: string;
}

export const IT_INCROCI: ItIncrocio[] = [
  // ── Le basi: one rule at a time ──────────────────────────────────────
  {
    id: "it-inc-destra",
    group: "basics",
    arms: ["north", "south", "east", "west"],
    title: {
      it: "La precedenza a destra",
      ckb: "مافی تێپەڕین بۆ لای ڕاست",
      kmrArab: "مافێ پێشیێ بۆ لایێ ڕاستێ",
    },
    vehicles: [
      { id: "b", colour: "blue", from: "south", turn: "straight" },
      { id: "y", colour: "yellow", from: "east", turn: "straight" },
    ],
    order: ["y", "b"],
    rule: {
      it: "All'incrocio senza segnali devi dare la precedenza a chi arriva dalla tua destra.",
      ckb: "لە چوارڕێیانی بێ هێما، دەبێت ڕێگا بدەیت بەوەی لە لای ڕاستتەوە دێت.",
      kmrArab: "ل خاچەڕێیا بێ نیشان، دڤێت تو ڕێکێ بدەی وی ئەوێ ژ لایێ تە یێ ڕاستێ ڤە دئێت.",
    },
    why: {
      it: "L'auto blu arriva da sud e va diritto: alla sua destra c'è l'auto gialla, quindi passa prima la gialla.",
      ckb: "ئۆتۆمبێلە شینەکە لە باشوورەوە دێت و ڕاست دەڕوات: لە لای ڕاستی ئۆتۆمبێلە زەردەکەیە، کەواتە یەکەم زەردەکە تێدەپەڕێت.",
      kmrArab: "ترۆمبێلا شین ژ باشووری ڤە دئێت و ڕاست دچیت: ل لایێ وێ یێ ڕاستێ ترۆمبێلا زەر هەیە، ڤێجا ئێکێ یا زەر دەرباز دبیت.",
    },
    ref: "CdS art. 145",
  },
  {
    id: "it-inc-dare-precedenza",
    group: "basics",
    arms: ["north", "south", "east", "west"],
    title: {
      it: "Il segnale cambia la regola",
      ckb: "هێماکە یاساکە دەگۆڕێت",
      kmrArab: "نیشان یاسایێ دگوهۆڕیت",
    },
    vehicles: [
      { id: "b", colour: "blue", from: "south", turn: "straight", sign: "giveway" },
      { id: "r", colour: "red", from: "west", turn: "straight" },
    ],
    order: ["r", "b"],
    rule: {
      it: "Dove c'è un segnale, comanda il segnale: la regola della destra vale solo se non c'è segnaletica.",
      ckb: "لە شوێنێک هێما هەبێت، هێماکە فەرمان دەدات: یاسای لای ڕاست تەنها کاتێک کار دەکات کە هیچ هێمایەک نەبێت.",
      kmrArab: "ل جهێ نیشان هەبیت، نیشان فەرمانێ ددەت: یاسایا لایێ ڕاستێ تنێ گاڤا چ نیشان نەبن دخەبتیت.",
    },
    why: {
      it: "Senza segnali l'auto blu avrebbe la precedenza, perché la rossa arriva dalla sua sinistra. Ma la blu ha il segnale di dare precedenza, quindi passa prima la rossa.",
      ckb: "بەبێ هێما ئۆتۆمبێلە شینەکە مافی تێپەڕینی دەبوو، چونکە سوورەکە لە لای چەپییەوە دێت. بەڵام شینەکە هێمای ڕێگادان هەیە، کەواتە یەکەم سوورەکە تێدەپەڕێت.",
      kmrArab: "بێ نیشان دا ترۆمبێلا شین مافێ پێشیێ هەبا، چونکی یا سۆر ژ لایێ وێ یێ چەپێ ڤە دئێت. بەلێ یا شین نیشانا ڕێکدانێ هەیە، ڤێجا ئێکێ یا سۆر دەرباز دبیت.",
    },
    ref: "CdS art. 145",
  },
  {
    id: "it-inc-svolta-sinistra",
    group: "basics",
    arms: ["north", "south", "east", "west"],
    title: {
      it: "Svoltare a sinistra",
      ckb: "سووڕانەوە بۆ لای چەپ",
      kmrArab: "زڤڕین بۆ لایێ چەپێ",
    },
    vehicles: [
      { id: "b", colour: "blue", from: "south", turn: "left" },
      { id: "r", colour: "red", from: "north", turn: "straight" },
    ],
    order: ["r", "b"],
    rule: {
      it: "Chi svolta a sinistra lascia passare chi arriva in senso opposto e prosegue diritto.",
      ckb: "ئەوەی بۆ لای چەپ دەسووڕێتەوە، ڕێگا دەدات بەوەی لە بەرامبەرەوە دێت و ڕاست دەڕوات.",
      kmrArab: "ئەوێ بۆ لایێ چەپێ دزڤڕیت، ڕێکێ ددەت وی ئەوێ ژ بەرامبەری ڤە دئێت و ڕاست دچیت.",
    },
    why: {
      it: "Le due auto arrivano da armi opposte, quindi la regola della destra non le riguarda. L'auto blu taglia la corsia della rossa per svoltare, perciò aspetta.",
      ckb: "هەردوو ئۆتۆمبێل لە دوو لای بەرامبەرەوە دێن، بۆیە یاسای لای ڕاست لێرە کار ناکات. ئۆتۆمبێلە شینەکە بۆ سووڕانەوە ڕێڕەوی سوورەکە دەبڕێت، لەبەر ئەوە چاوەڕێ دەکات.",
      kmrArab: "هەردوو ترۆمبێل ژ دوو لایێن بەرامبەر ڤە دئێن، ڤێجا یاسایا لایێ ڕاستێ ل ڤێرێ ناخەبتیت. ترۆمبێلا شین بۆ زڤڕینێ ڕێکا یا سۆر دبڕیت، ژ بەر هندێ چاڤەڕێ دکەت.",
    },
    ref: "CdS art. 154",
  },
  {
    id: "it-inc-tram",
    group: "basics",
    arms: ["north", "south", "east", "west"],
    title: {
      it: "Il tram passa prima",
      ckb: "تڕام یەکەم تێدەپەڕێت",
      kmrArab: "تڕام ئێکێ دەرباز دبیت",
    },
    vehicles: [
      { id: "t", colour: "tram", from: "west", turn: "straight" },
      { id: "b", colour: "blue", from: "south", turn: "straight" },
    ],
    order: ["t", "b"],
    rule: {
      it: "I veicoli su rotaia hanno la precedenza, salvo segnalazione diversa.",
      ckb: "ئەو ئامێرانەی لەسەر هێڵی ئاسن دەڕۆن مافی تێپەڕینیان هەیە، مەگەر هێمایەکی جیاواز هەبێت.",
      kmrArab: "ئەو هاتنوچوونا ل سەر هێلا ئاسنی دچیت مافێ پێشیێ وێ هەیە، ئەگەر نیشانەکا دی نەبیت.",
    },
    why: {
      it: "Alla destra dell'auto blu non c'è nessuno, ma il tram arriva da ovest sui binari: il tram ha comunque la precedenza.",
      ckb: "لە لای ڕاستی ئۆتۆمبێلە شینەکە کەس نییە، بەڵام تڕام لە ڕۆژئاواوە لەسەر هێڵەکان دێت: تڕام لە هەر حاڵەتێکدا مافی تێپەڕینی هەیە.",
      kmrArab: "ل لایێ ترۆمبێلا شین یێ ڕاستێ کەس نینە، بەلێ تڕام ژ ڕۆژئاڤایی ڤە ل سەر هێلان دئێت: تڕام ل هەر حالەتەکی مافێ پێشیێ وێ هەیە.",
    },
    ref: "CdS art. 145",
  },

  // ── Tre veicoli ──────────────────────────────────────────────────────
  {
    id: "it-inc-tre-destra",
    group: "three",
    arms: ["north", "south", "east", "west"],
    title: {
      it: "Tre veicoli, nessun segnale",
      ckb: "سێ ئۆتۆمبێل، بێ هیچ هێمایەک",
      kmrArab: "سێ ترۆمبێل، بێ چ نیشان",
    },
    vehicles: [
      { id: "r", colour: "red", from: "north", turn: "straight" },
      { id: "y", colour: "yellow", from: "east", turn: "straight" },
      { id: "b", colour: "blue", from: "south", turn: "straight" },
    ],
    order: ["r", "y", "b"],
    rule: {
      it: "Con tre veicoli e nessun segnale si applica tre volte la stessa regola della destra.",
      ckb: "لەگەڵ سێ ئۆتۆمبێل و بێ هێما، هەمان یاسای لای ڕاست سێ جار بەکاردێت.",
      kmrArab: "د گەل سێ ترۆمبێلان و بێ نیشان، هەمان یاسایا لایێ ڕاستێ سێ جاران دئێتە بکارئینان.",
    },
    why: {
      it: "Alla destra della rossa (da nord) non c'è nessuno, quindi passa per prima. Alla destra della gialla (da est) c'è la rossa. Alla destra della blu (da sud) c'è la gialla.",
      ckb: "لە لای ڕاستی سوورەکە (لە باکوورەوە) کەس نییە، بۆیە یەکەم دەڕوات. لە لای ڕاستی زەردەکە (لە ڕۆژهەڵاتەوە) سوورەکەیە. لە لای ڕاستی شینەکە (لە باشوورەوە) زەردەکەیە.",
      kmrArab: "ل لایێ یا سۆر یێ ڕاستێ (ژ باکووری ڤە) کەس نینە، ڤێجا ئێکێ دچیت. ل لایێ یا زەر یێ ڕاستێ (ژ ڕۆژهەلاتی ڤە) یا سۆر هەیە. ل لایێ یا شین یێ ڕاستێ (ژ باشووری ڤە) یا زەر هەیە.",
    },
    ref: "CdS art. 145",
  },
  {
    id: "it-inc-stop-laterale",
    group: "three",
    arms: ["east", "south", "west"],
    title: {
      it: "Stop sulla strada laterale",
      ckb: "وەستان لەسەر ڕێگای لاوەکی",
      kmrArab: "ڕاوەستان ل سەر ڕێکا لاوەکی",
    },
    vehicles: [
      { id: "r", colour: "red", from: "west", turn: "straight" },
      { id: "y", colour: "yellow", from: "east", turn: "left" },
      { id: "b", colour: "blue", from: "south", turn: "right", sign: "stop" },
    ],
    order: ["r", "y", "b"],
    rule: {
      it: "Con il segnale di arresto ti fermi sempre, anche quando la strada sembra libera.",
      ckb: "لەگەڵ هێمای وەستان هەمیشە دەوەستیت، تەنانەت کاتێک ڕێگا بەتاڵ دیارە.",
      kmrArab: "د گەل نیشانا ڕاوەستانێ هەردەم تو ڕادوەستی، تنانەت گاڤا ڕێک ڤالا دیار بیت.",
    },
    why: {
      it: "L'auto gialla svolta a sinistra, quindi lascia passare la rossa che le arriva in senso opposto. L'auto blu ha il segnale di arresto: si ferma e passa per ultima.",
      ckb: "ئۆتۆمبێلە زەردەکە بۆ لای چەپ دەسووڕێتەوە، بۆیە ڕێگا دەدات بە سوورەکە کە لە بەرامبەرەوە دێت. ئۆتۆمبێلە شینەکە هێمای وەستانی هەیە: دەوەستێت و دوایین کەس تێدەپەڕێت.",
      kmrArab: "ترۆمبێلا زەر بۆ لایێ چەپێ دزڤڕیت، ڤێجا ڕێکێ ددەت یا سۆر ئەوا ژ بەرامبەری ڤە دئێت. ترۆمبێلا شین نیشانا ڕاوەستانێ وێ هەیە: ڕادوەستیت و یا دووماهیێ دەرباز دبیت.",
    },
    ref: "CdS art. 145",
  },
  {
    id: "it-inc-tre-svolta",
    group: "three",
    arms: ["north", "south", "east", "west"],
    title: {
      it: "Una svolta dentro la regola della destra",
      ckb: "سووڕانەوەیەک لەناو یاسای لای ڕاستدا",
      kmrArab: "زڤڕینەک د ناڤ یاسایا لایێ ڕاستێ دا",
    },
    vehicles: [
      { id: "r", colour: "red", from: "north", turn: "straight" },
      { id: "y", colour: "yellow", from: "east", turn: "straight" },
      { id: "b", colour: "blue", from: "south", turn: "left" },
    ],
    order: ["r", "y", "b"],
    rule: {
      it: "Prima si guarda a destra, poi si guarda chi arriva in senso opposto.",
      ckb: "سەرەتا سەیری لای ڕاست دەکەیت، پاشان سەیری ئەوە دەکەیت کە لە بەرامبەرەوە دێت.",
      kmrArab: "ئێکجار تەماشەیا لایێ ڕاستێ دکەی، پاشی تەماشەیا وی دکەی ئەوێ ژ بەرامبەری ڤە دئێت.",
    },
    why: {
      it: "La rossa non ha nessuno alla sua destra e passa per prima. La gialla ha la rossa alla sua destra. La blu ha la gialla alla sua destra e in più svolta a sinistra davanti alla rossa: passa per ultima.",
      ckb: "سوورەکە کەسی لە لای ڕاستی نییە و یەکەم دەڕوات. زەردەکە سوورەکەی لە لای ڕاستییەتی. شینەکە زەردەکەی لە لای ڕاستییەتی و سەرەڕای ئەوە لەبەردەم سوورەکەدا بۆ چەپ دەسووڕێتەوە: دواترین دەڕوات.",
      kmrArab: "یا سۆر کەسێ ل لایێ وێ یێ ڕاستێ نینە و ئێکێ دچیت. یا زەر یا سۆر ل لایێ خۆ یێ ڕاستێ هەیە. یا شین یا زەر ل لایێ خۆ یێ ڕاستێ هەیە و دگەل ڤێ یەکێ ل بەرامبەرا یا سۆر بۆ چەپێ دزڤڕیت: یا دووماهیێ دچیت.",
    },
    ref: "CdS art. 145",
  },

  // ── Quattro veicoli ──────────────────────────────────────────────────
  {
    id: "it-inc-strada-principale",
    group: "many",
    arms: ["north", "south", "east", "west"],
    title: {
      it: "Strada con diritto di precedenza",
      ckb: "ڕێگای خاوەن مافی تێپەڕین",
      kmrArab: "ڕێکا خودان مافێ پێشیێ",
    },
    vehicles: [
      { id: "b", colour: "blue", from: "south", turn: "straight", sign: "priority" },
      { id: "r", colour: "red", from: "north", turn: "left", sign: "priority" },
      { id: "y", colour: "yellow", from: "east", turn: "straight", sign: "giveway" },
      { id: "g", colour: "green", from: "west", turn: "left", sign: "giveway" },
    ],
    order: ["b", "r", "y", "g"],
    rule: {
      it: "Prima passa chi è sulla strada con diritto di precedenza; fra loro valgono le regole normali.",
      ckb: "یەکەم ئەوانە تێدەپەڕن کە لەسەر ڕێگای خاوەن مافی تێپەڕینن؛ لەنێو خۆیاندا یاسا ئاساییەکان کار دەکەن.",
      kmrArab: "ئێکجار ئەو دەرباز دبن ئەوێن ل سەر ڕێکا خودان مافێ پێشیێ نە؛ د ناڤبەرا خۆ دا یاسایێن ئاسایی دخەبتن.",
    },
    why: {
      it: "Blu e rossa sono sulla strada principale, quindi passano per prime; fra loro la rossa svolta a sinistra e lascia passare la blu. Gialla e verde devono dare la precedenza; fra loro la verde svolta a sinistra davanti alla gialla.",
      ckb: "شین و سوور لەسەر ڕێگای سەرەکین، بۆیە یەکەم دەڕۆن؛ لەنێو خۆیاندا سوورەکە بۆ چەپ دەسووڕێتەوە و ڕێگا بە شینەکە دەدات. زەرد و سەوز دەبێت ڕێگا بدەن؛ لەنێو خۆیاندا سەوزەکە لەبەردەم زەردەکەدا بۆ چەپ دەسووڕێتەوە.",
      kmrArab: "یا شین و یا سۆر ل سەر ڕێکا سەرەکی نە، ڤێجا ئێکجار ئەو دچن؛ د ناڤبەرا خۆ دا یا سۆر بۆ چەپێ دزڤڕیت و ڕێکێ ددەت یا شین. یا زەر و یا کەسک دڤێت ڕێکێ بدەن؛ د ناڤبەرا خۆ دا یا کەسک ل بەرامبەرا یا زەر بۆ چەپێ دزڤڕیت.",
    },
    ref: "CdS art. 145",
  },

  // ── Corsie e manovre ─────────────────────────────────────────────────
  {
    id: "it-inc-rotatoria",
    group: "lanes",
    arms: ["north", "south", "east", "west"],
    roundabout: true,
    title: {
      it: "Rotatoria con dare precedenza",
      ckb: "خولانەوە لەگەڵ هێمای ڕێگادان",
      kmrArab: "زڤڕۆک دگەل نیشانا ڕێکدانێ",
    },
    vehicles: [
      { id: "b", colour: "blue", from: "east", turn: "straight" },
      { id: "r", colour: "red", from: "south", turn: "straight", sign: "giveway" },
    ],
    order: ["b", "r"],
    rule: {
      it: "Con il segnale di dare precedenza all'ingresso, chi è già nella rotatoria passa prima.",
      ckb: "کاتێک لە دەروازەدا هێمای ڕێگادان هەبێت، ئەوەی پێشتر لەناو خولانەوەدایە یەکەم تێدەپەڕێت.",
      kmrArab: "گاڤا ل دەرگەهی نیشانا ڕێکدانێ هەبیت، ئەوێ بەرێ د ناڤ زڤرۆکێ دا ئێکێ دەرباز دبیت.",
    },
    why: {
      it: "L'auto rossa è ferma all'ingresso davanti al segnale e aspetta; l'auto blu sta già girando nell'anello e continua.",
      ckb: "ئۆتۆمبێلە سوورەکە لە دەروازە لەبەردەم هێماکە وەستاوە و چاوەڕێ دەکات؛ ئۆتۆمبێلە شینەکە پێشتر لەناو بازنەکەدا دەسووڕێتەوە و بەردەوام دەبێت.",
      kmrArab: "ترۆمبێلا سۆر ل دەرگەهی ل بەرامبەرا نیشانێ ڕاوەستیایی و چاڤەڕێ دکەت؛ ترۆمبێلا شین بەرێ د ناڤ خەلەکێ دا دزڤڕیت و بەردەوام دبیت.",
    },
    ref: "CdS art. 145",
  },
  {
    id: "it-inc-accesso-privato",
    group: "lanes",
    arms: ["east", "west", "south"],
    narrowArm: "south",
    title: {
      it: "Uscire da un accesso privato",
      ckb: "دەرچوون لە دەروازەیەکی تایبەت",
      kmrArab: "دەرکەفتن ژ دەرگەهەکێ تایبەت",
    },
    vehicles: [
      { id: "r", colour: "red", from: "west", turn: "straight" },
      { id: "b", colour: "blue", from: "south", turn: "right" },
    ],
    order: ["r", "b"],
    rule: {
      it: "Chi esce da un passo carrabile o da un'area privata dà la precedenza a tutti.",
      ckb: "ئەوەی لە دەروازەی ماڵ یان لە شوێنێکی تایبەتەوە دێتە دەرەوە، ڕێگا بە هەمووان دەدات.",
      kmrArab: "ئەوێ ژ دەرگەهێ مالێ یان ژ جهەکێ تایبەت دەردکەڤیت، ڕێکێ ددەت هەمییان.",
    },
    why: {
      it: "L'uscita non è una strada normale: l'auto blu si immette nel traffico, quindi aspetta che la rossa sia passata.",
      ckb: "دەروازەکە ڕێگایەکی ئاسایی نییە: ئۆتۆمبێلە شینەکە خۆی دەخاتە ناو هاتوچۆوە، بۆیە چاوەڕێ دەکات تا سوورەکە تێدەپەڕێت.",
      kmrArab: "دەرگەه ڕێکەکا ئاسایی نینە: ترۆمبێلا شین خۆ دئێخیتە ناڤ هاتنوچوونێ، ڤێجا چاڤەڕێ دکەت هەتا یا سۆر دەرباز دبیت.",
    },
    ref: "CdS art. 145",
  },
];

export const IT_INCROCI_GROUPS: { id: ItIncrocioGroup; title: ItText; subtitle: ItText }[] = [
  {
    id: "basics",
    title: { it: "Le basi", ckb: "بنەماکان", kmrArab: "بنگەه" },
    subtitle: { it: "Una regola alla volta", ckb: "جارێک یەک یاسا", kmrArab: "جارەکێ ئێک یاسا" },
  },
  {
    id: "three",
    title: { it: "Tre veicoli", ckb: "سێ ئۆتۆمبێل", kmrArab: "سێ ترۆمبێل" },
    subtitle: { it: "Le regole si sommano", ckb: "یاساکان لەسەر یەک زیاد دەبن", kmrArab: "یاسا ل سەر ئێک زێدە دبن" },
  },
  {
    id: "many",
    title: { it: "Quattro veicoli", ckb: "چوار ئۆتۆمبێل", kmrArab: "چوار ترۆمبێل" },
    subtitle: { it: "Strada principale e secondaria", ckb: "ڕێگای سەرەکی و لاوەکی", kmrArab: "ڕێکا سەرەکی و لاوەکی" },
  },
  {
    id: "lanes",
    title: { it: "Corsie e manovre", ckb: "لەین و جوڵەکان", kmrArab: "لەین و جوولە" },
    subtitle: { it: "Rotatoria e accessi", ckb: "خولانەوە و دەروازەکان", kmrArab: "زڤرۆک و دەرگەه" },
  },
];

export const itIncrocioById = (id: string): ItIncrocio | undefined => IT_INCROCI.find((s) => s.id === id);

export const itIncrociOf = (group: ItIncrocioGroup): ItIncrocio[] => IT_INCROCI.filter((s) => s.group === group);

/** The id a solved scene is stored under, inside Italy's own progress record. */
export const itIncrocioLessonId = (id: string): string => `it-incrocio-${id}`;

/** Scene before and after this one, across the whole set, for the scene's own navigation. */
export function itIncrocioNeighbours(id: string): { prev: string | null; next: string | null } {
  const i = IT_INCROCI.findIndex((s) => s.id === id);
  if (i < 0) return { prev: null, next: null };
  return { prev: i > 0 ? IT_INCROCI[i - 1]!.id : null, next: i < IT_INCROCI.length - 1 ? IT_INCROCI[i + 1]!.id : null };
}
