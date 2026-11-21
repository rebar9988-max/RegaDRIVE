import type { ItChapter } from "./types.ts";

/**
 * The 16 chapters of the Italian Patente B theory syllabus.
 * plannedCount is the size the full syllabus plans for each chapter; it is NOT the number of
 * questions that exist in this repository (see IT_QUESTIONS for what is actually here).
 */
export const IT_CHAPTERS: ItChapter[] = [
  { id: 1, plannedCount: 465,
    title: { ckb: "پێناسەکانی ڕێگاوبان و هاتوچۆ", it: "Definizioni stradali e di traffico", kmrArab: "پێناسێن ڕێک و بانان و هاتنوچوونێ", kmr: "تعريفات الطرق والمرور", de: "Straßen- und Verkehrsdefinitionen", ar: "Pênaseyên rê û trafîkê" } },
  { id: 2, plannedCount: 580,
    title: { ckb: "هێماکانی مەترسی", it: "Segnali di pericolo", kmrArab: "نیشانێن مەترسیێ", kmr: "إشارات الخطر", de: "Gefahrzeichen", ar: "Nîşaneyên xeterê" } },
  { id: 3, plannedCount: 540,
    title: { ckb: "هێماکانی قەدەغەکردن", it: "Segnali di divieto", kmrArab: "نیشانێن قەدەغەکرنێ", kmr: "إشارات المنع", de: "Verbotszeichen", ar: "Nîşaneyên qedexeyê" } },
  { id: 4, plannedCount: 450,
    title: { ckb: "هێماکانی ناچاری (پابەندبوون)", it: "Segnali di obbligo", kmrArab: "نیشانێن نەچاریێ (پێگیریێ)", kmr: "إشارات الإلزام", de: "Gebotszeichen", ar: "Nîşaneyên neçariyê" } },
  { id: 5, plannedCount: 470,
    title: { ckb: "هێماکانی پێشەنگی (ئەولەویەت)", it: "Segnali di precedenza", kmrArab: "نیشانێن پێشینەیێ (ئەولەویەتێ)", kmr: "إشارات الأولوية", de: "Vorfahrtzeichen", ar: "Nîşaneyên mafê pêşiyê" } },
  { id: 6, plannedCount: 440,
    title: { ckb: "هێڵکاری سەر شەقام و بەربەستەکان", it: "Segnaletica orizzontale e ostacoli", kmrArab: "خەتکێشانا سەر جاددێ و ئاستەنگ", kmr: "علامات الطريق الأرضية والعوائق", de: "Fahrbahnmarkierungen und Hindernisse", ar: "Nîşanên ser rê û astengî" } },
  { id: 7, plannedCount: 420,
    title: { ckb: "ترافیک لایت و ئاماژەکانی پۆلیسی هاتوچۆ", it: "Semafori e segnalazioni degli agenti", kmrArab: "ترافیک لایت و ئیشارەتێن پۆلیسێن هاتنوچوونێ", kmr: "الإشارات الضوئية وإشارات رجال المرور", de: "Lichtzeichen und Zeichen der Polizeibeamten", ar: "Lambeyên trafîkê û îşaretên polîsan" } },
  { id: 8, plannedCount: 435,
    title: { ckb: "هێماکانی ڕێنمایی و زانیاری", it: "Segnali di indicazione", kmrArab: "نیشانێن ڕێنیشاندان و پێزانینان", kmr: "إشارات الإرشاد والمعلومات", de: "Richtzeichen und Hinweise", ar: "Nîşaneyên rênîşandanê" } },
  { id: 9, plannedCount: 460,
    title: { ckb: "سنووری خێرایی، مەترسی و بەربەست دروستکردن", it: "Limiti di velocità, pericolo e intralcio", kmrArab: "سنوورێ لەزاتیێ، مەترسی و ئاستەنگ دروستکرن", kmr: "حدود السرعة والخطر وإعاقة المرور", de: "Geschwindigkeitsgrenzen, Gefährdung und Behinderung", ar: "Sînorên lezê, xetere û astengkirin" } },
  { id: 10, plannedCount: 430,
    title: { ckb: "ماوەی سەلامەتی و شوێنی ئۆتۆمبێل لەسەر شەقام", it: "Distanza di sicurezza e posizione sulla carreggiata", kmrArab: "ماوەیێ سلامەتیێ و جهێ ترۆمبێلێ ل سەر جاددێ", kmr: "مسافة الأمان وموقع المركبة على الطريق", de: "Sicherheitsabstand und Position auf der Fahrbahn", ar: "Mesafeya ewlehiyê û cihê wesayîtê" } },
  { id: 11, plannedCount: 510,
    title: { ckb: "یاساکانی پێشەنگی لە چوارڕێیانەکاندا", it: "Norme di precedenza agli incroci", kmrArab: "یاسایێن پێشینەیێ ل چوارڕێیانان", kmr: "قواعد الأولوية في التقاطعات", de: "Vorfahrtregeln an Kreuzungen", ar: "Rêzikên mafê pêşiyê li xaçerêyan" } },
  { id: 12, plannedCount: 380,
    title: { ckb: "تێپەڕاندن (دەربازبوون) و یاساکانی هاتوچۆ", it: "Sorpasso e norme di circolazione", kmrArab: "دەربازبوون و یاسایێن هاتنوچوونێ", kmr: "التجاوز وقواعد السير", de: "Überholen und Verkehrsregeln", ar: "Derbasbûn û rêzikên trafîkê" } },
  { id: 13, plannedCount: 390,
    title: { ckb: "وەستانی کاتی، پارککردن، وەستان و دەرچوون", it: "Fermata, sosta, arresto e partenza", kmrArab: "ڕاوەستیانا دەمکی، پارککرن، ڕاوەستیان و دەرکەفتن", kmr: "التوقف والوقوف والانطلاق", de: "Halten, Parken, Anhalten und Anfahren", ar: "Rawestan, park kirin û dest pê kirin" } },
  { id: 14, plannedCount: 375,
    title: { ckb: "بەکارهێنانی گڵۆپەکان، هۆڕن و گڵۆپە ئاگادارکەرەوەکان", it: "Uso delle luci, dispositivi acustici e spie", kmrArab: "بکارئینانا گڵۆپان، هۆڕن و گڵۆپێن ئاگەهدارکرنێ", kmr: "استخدام الأنوار والمنبّه ومصابيح التحذير", de: "Beleuchtung, Hupe und Kontrollleuchten", ar: "Bikaranîna ronahiyan, bîp û lambeyên hişyariyê" } },
  { id: 15, plannedCount: 345,
    title: { ckb: "مۆڵەتی شۆفێری، خاڵەکان و بەڵگەنامەکان", it: "Patente di guida, punti e documenti", kmrArab: "دەستوورا شۆفێریێ، خال و بەلگەنامە", kmr: "رخصة القيادة والنقاط والوثائق", de: "Führerschein, Punkte und Dokumente", ar: "Destûrnameya ajotinê, pûan û belge" } },
  { id: 16, plannedCount: 330,
    title: { ckb: "ڕووداوەکانی هاتوچۆ، فریاگوزاری سەرەتایی و سەلامەتی", it: "Incidenti stradali, primo soccorso e sicurezza", kmrArab: "ڕوودانێن هاتنوچوونێ، فریاگوزاریا دەستپێکی و سلامەتی", kmr: "حوادث الطرق والإسعاف الأولي والسلامة", de: "Verkehrsunfälle, Erste Hilfe und Sicherheit", ar: "Qezayên trafîkê, pêşkêşiya yekem û ewlehî" } },
];

export const itChapterById = (id: number): ItChapter | undefined => IT_CHAPTERS.find((c) => c.id === id);

/** What the full syllabus plans in total (7020), for progress wording. Not a count of existing questions. */
export const IT_PLANNED_TOTAL: number = IT_CHAPTERS.reduce((n, c) => n + c.plannedCount, 0);
