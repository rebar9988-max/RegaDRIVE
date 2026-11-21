import type { ItChapter } from "./types.ts";

/**
 * The 16 chapters of the Italian Patente B theory syllabus.
 * plannedCount is the size the full syllabus plans for each chapter; it is NOT the number of
 * questions that exist in this repository (see IT_QUESTIONS for what is actually here).
 */
export const IT_CHAPTERS: ItChapter[] = [
  { id: 1, plannedCount: 465,
    title: { ckb: "پێناسەکانی ڕێگاوبان و هاتوچۆ", it: "Definizioni stradali e di traffico", kmrArab: "پێناسەیێن ڕێ و هاتنوچوونێ", kmr: "Pênaseyên rê û trafîkê", de: "Straßen- und Verkehrsdefinitionen", ar: "تعريفات الطرق والمرور" } },
  { id: 2, plannedCount: 580,
    title: { ckb: "هێماکانی مەترسی", it: "Segnali di pericolo", kmrArab: "نیشانێن مەترسیێ", kmr: "Nîşaneyên xeterê", de: "Gefahrzeichen", ar: "إشارات الخطر" } },
  { id: 3, plannedCount: 540,
    title: { ckb: "هێماکانی قەدەغەکردن", it: "Segnali di divieto", kmrArab: "نیشانێن قەدەغەکرنێ", kmr: "Nîşaneyên qedexeyê", de: "Verbotszeichen", ar: "إشارات المنع" } },
  { id: 4, plannedCount: 450,
    title: { ckb: "هێماکانی ناچاری (پابەندبوون)", it: "Segnali di obbligo", kmrArab: "نیشانێن پابەندبوونێ", kmr: "Nîşaneyên neçariyê", de: "Gebotszeichen", ar: "إشارات الإلزام" } },
  { id: 5, plannedCount: 470,
    title: { ckb: "هێماکانی پێشەنگی (ئەولەویەت)", it: "Segnali di precedenza", kmrArab: "نیشانێن مافێ پێشیێ", kmr: "Nîşaneyên mafê pêşiyê", de: "Vorfahrtzeichen", ar: "إشارات الأولوية" } },
  { id: 6, plannedCount: 440,
    title: { ckb: "هێڵکاری سەر شەقام و بەربەستەکان", it: "Segnaletica orizzontale e ostacoli", kmrArab: "خەتکێشانا سەر جاددێ و ئاستەنگ", kmr: "Nîşanên ser rê û astengî", de: "Fahrbahnmarkierungen und Hindernisse", ar: "علامات الطريق الأرضية والعوائق" } },
  { id: 7, plannedCount: 420,
    title: { ckb: "ترافیک لایت و ئاماژەکانی پۆلیسی هاتوچۆ", it: "Semafori e segnalazioni degli agenti", kmrArab: "چرایێن هاتنوچوونێ و ئیشارەتێن پۆلیسی", kmr: "Lambeyên trafîkê û îşaretên polîsan", de: "Lichtzeichen und Zeichen der Polizeibeamten", ar: "الإشارات الضوئية وإشارات رجال المرور" } },
  { id: 8, plannedCount: 435,
    title: { ckb: "هێماکانی ڕێنمایی و زانیاری", it: "Segnali di indicazione", kmrArab: "نیشانێن ڕێنیشاندان و پێزانینان", kmr: "Nîşaneyên rênîşandanê", de: "Richtzeichen und Hinweise", ar: "إشارات الإرشاد والمعلومات" } },
  { id: 9, plannedCount: 460,
    title: { ckb: "سنووری خێرایی، مەترسی و بەربەست دروستکردن", it: "Limiti di velocità, pericolo e intralcio", kmrArab: "سنوورێ لەزێ، مەترسی و ئاستەنگکرنا هاتنوچوونێ", kmr: "Sînorên lezê, xetere û astengkirin", de: "Geschwindigkeitsgrenzen, Gefährdung und Behinderung", ar: "حدود السرعة والخطر وإعاقة المرور" } },
  { id: 10, plannedCount: 430,
    title: { ckb: "ماوەی سەلامەتی و شوێنی ئۆتۆمبێل لەسەر شەقام", it: "Distanza di sicurezza e posizione sulla carreggiata", kmrArab: "دووریا سلامەتیێ و جهێ ترۆمبێلێ ل سەر جاددێ", kmr: "Mesafeya ewlehiyê û cihê wesayîtê", de: "Sicherheitsabstand und Position auf der Fahrbahn", ar: "مسافة الأمان وموقع المركبة على الطريق" } },
  { id: 11, plannedCount: 510,
    title: { ckb: "یاساکانی پێشەنگی لە چوارڕێیانەکاندا", it: "Norme di precedenza agli incroci", kmrArab: "ڕێسایێن مافێ پێشیێ ل خاچەرێیان", kmr: "Rêzikên mafê pêşiyê li xaçerêyan", de: "Vorfahrtregeln an Kreuzungen", ar: "قواعد الأولوية في التقاطعات" } },
  { id: 12, plannedCount: 380,
    title: { ckb: "تێپەڕاندن (دەربازبوون) و یاساکانی هاتوچۆ", it: "Sorpasso e norme di circolazione", kmrArab: "دەربازبوون و یاسایێن هاتنوچوونێ", kmr: "Derbasbûn û rêzikên trafîkê", de: "Überholen und Verkehrsregeln", ar: "التجاوز وقواعد السير" } },
  { id: 13, plannedCount: 390,
    title: { ckb: "وەستانی کاتی، پارککردن، وەستان و دەرچوون", it: "Fermata, sosta, arresto e partenza", kmrArab: "ڕاوەستیانا دەمکی، پارککرن، ڕاوەستیان و دەرکەفتن", kmr: "Rawestan, park kirin û dest pê kirin", de: "Halten, Parken, Anhalten und Anfahren", ar: "التوقف والوقوف والانطلاق" } },
  { id: 14, plannedCount: 375,
    title: { ckb: "بەکارهێنانی گڵۆپەکان، هۆڕن و گڵۆپە ئاگادارکەرەوەکان", it: "Uso delle luci, dispositivi acustici e spie", kmrArab: "بکارئینانا گڵۆپان، هۆڕن و گڵۆپێن ئاگەهدارکرنێ", kmr: "Bikaranîna ronahiyan, bîp û lambeyên hişyariyê", de: "Beleuchtung, Hupe und Kontrollleuchten", ar: "استخدام الأنوار والمنبّه ومصابيح التحذير" } },
  { id: 15, plannedCount: 345,
    title: { ckb: "مۆڵەتی شۆفێری، خاڵەکان و بەڵگەنامەکان", it: "Patente di guida, punti e documenti", kmrArab: "دەستوورا شۆفێریێ، خال و بەلگەنامە", kmr: "Destûrnameya ajotinê, pûan û belge", de: "Führerschein, Punkte und Dokumente", ar: "رخصة القيادة والنقاط والوثائق" } },
  { id: 16, plannedCount: 330,
    title: { ckb: "ڕووداوەکانی هاتوچۆ، فریاگوزاری سەرەتایی و سەلامەتی", it: "Incidenti stradali, primo soccorso e sicurezza", kmrArab: "ڕوودانێن هاتنوچوونێ، فریاگوزاریا دەستپێکی و سلامەتی", kmr: "Qezayên trafîkê, pêşkêşiya yekem û ewlehî", de: "Verkehrsunfälle, Erste Hilfe und Sicherheit", ar: "حوادث الطرق والإسعاف الأولي والسلامة" } },
];

export const itChapterById = (id: number): ItChapter | undefined => IT_CHAPTERS.find((c) => c.id === id);

/** What the full syllabus plans in total (7020), for progress wording. Not a count of existing questions. */
export const IT_PLANNED_TOTAL: number = IT_CHAPTERS.reduce((n, c) => n + c.plannedCount, 0);
