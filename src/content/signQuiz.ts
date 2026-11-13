import type { Bilingual, Question, QuestionPoints, SignAnlage, TrafficSign } from "./types.ts";
import { SIGNS, signSource } from "./signs.ts";

/**
 * Verkehrszeichen-Quiz (educational). ORIGINAL RegaDRIVE practice questions about traffic signs of the StVO.
 * They are kept apart from the exam question bank (QUESTIONS), carry no official question code and are
 * NOT TÜV/DEKRA examination questions. Every item is "pending" until a qualified reviewer approves it
 * (docs/CONTENT_REVIEW.md); production shows nothing before that (fail closed).
 */
export const SIGN_QUIZ_VERSION = "2026.11-signquiz-1";

const SIGN_ALT: Bilingual = { ckb: "هێمای هاتووچۆ", de: "Verkehrszeichen", kmr: "Nîşaneya trafîkê", ar: "إشارة مرور" };
export const SIGN_QUIZ_SIGN_LABEL = SIGN_ALT;

const KINDS: Record<SignAnlage, Bilingual> = {
  1: { ckb: "نیشانەی مەترسی (Gefahrzeichen)", de: "Gefahrzeichen", kmr: "Nîşaneya xeterê (Gefahrzeichen)", ar: "إشارة تحذير (Gefahrzeichen)" },
  2: { ckb: "نیشانەی فەرمان و قەدەغە (Vorschriftzeichen)", de: "Vorschriftzeichen", kmr: "Nîşaneya ferman û qedexeyan (Vorschriftzeichen)", ar: "إشارة إلزام وحظر (Vorschriftzeichen)" },
  3: { ckb: "نیشانەی ڕێنمایی (Richtzeichen)", de: "Richtzeichen", kmr: "Nîşaneya rêwerzê (Richtzeichen)", ar: "إشارة إرشادية (Richtzeichen)" },
};
export const SIGN_KIND_NAMES = KINDS;

const POINTS_BY_GROUP: Record<TrafficSign["group"], QuestionPoints> = { danger: 3, priority: 5, prohibition: 4, mandatory: 4, information: 3 };

const base = { questionCode: null, licenseClasses: ["B"], sourceType: "original", contentVersion: SIGN_QUIZ_VERSION, reviewStatus: "pending", publicationStatus: "published", vocabularyIds: [] } satisfies Partial<Question>;

/** Deterministic rotation so the right answer is not always in the same place. */
const rotate = <T,>(items: T[], by: number): T[] => items.map((_, i) => items[(i + by) % items.length]!);

const withSource = (t: Bilingual, source: string): Bilingual => ({
  ckb: `${t.ckb} (${source})`, de: `${t.de} (${source})`, kmr: t.kmr ? `${t.kmr} (${source})` : undefined, ar: t.ar ? `${t.ar} (${source})` : undefined,
});

const MEANING_PROMPT: Bilingual = {
  de: "Was bedeutet dieses Verkehrszeichen?", ckb: "ئەم هێمایەی هاتوچۆ چی دەگەیەنێت؟", kmr: "Ev nîşaneya trafîkê çi tê wateya?", ar: "ماذا تعني إشارة المرور هذه؟",
};
const KIND_PROMPT: Bilingual = {
  de: "Zu welcher Art von Verkehrszeichen gehört dieses Zeichen?", ckb: "ئەم هێمایە سەر بە کام جۆری نیشانەی هاتوچۆیە؟", kmr: "Ev nîşane ji kîjan cureyê nîşaneyên trafîkê ye?", ar: "إلى أي نوع من إشارات المرور تنتمي هذه الإشارة؟",
};
const KIND_EXPLAIN: Bilingual = {
  de: "Gefahrzeichen stehen in Anlage 1 der StVO, Vorschriftzeichen in Anlage 2 und Richtzeichen in Anlage 3.",
  ckb: "نیشانەکانی مەترسی لە پاشکۆی ١ی StVO دان، نیشانەکانی فەرمان و قەدەغە لە پاشکۆی ٢ و نیشانەکانی ڕێنمایی لە پاشکۆی ٣.",
  kmr: "Nîşaneyên xeterê di Anlage 1ê ya StVO de ne, yên ferman û qedexeyan di Anlage 2 de û yên rêwerzê di Anlage 3 de.",
  ar: "إشارات التحذير في الملحق 1 من StVO، وإشارات الإلزام والحظر في الملحق 2، والإشارات الإرشادية في الملحق 3.",
};

function meaningQuestion(sign: TrafficSign, index: number): Question {
  // Wrong answers: other signs, same group first (plausible), never one with an identical name.
  const others = SIGNS.filter((s) => s.id !== sign.id && s.name.de !== sign.name.de);
  const same = others.filter((s) => s.group === sign.group);
  const rest = others.filter((s) => s.group !== sign.group);
  const pool = [...rotate(same, index), ...rotate(rest, index)];
  const picks = pool.slice(0, 2);
  const options = rotate([sign, ...picks], index % 3).map((s, i) => ({ id: "abc"[i]!, sign: s }));
  return {
    ...base,
    id: `rd-sq-${sign.id}-m`,
    topicId: "signs",
    categoryType: "Grundstoff",
    points: POINTS_BY_GROUP[sign.group],
    prompt: MEANING_PROMPT,
    options: options.map((o) => ({ id: o.id, text: o.sign.name })),
    correct: [options.find((o) => o.sign.id === sign.id)!.id],
    explanation: withSource(sign.meaning, signSource(sign)),
    signId: sign.id,
  };
}

function kindQuestion(sign: TrafficSign, index: number): Question {
  const order = rotate<SignAnlage>([1, 2, 3], index % 3);
  return {
    ...base,
    id: `rd-sq-${sign.id}-k`,
    topicId: "signs",
    categoryType: "Grundstoff",
    points: 3,
    prompt: KIND_PROMPT,
    options: order.map((a, i) => ({ id: "abc"[i]!, text: KINDS[a] })),
    correct: ["abc"[order.indexOf(sign.anlage)]!],
    explanation: withSource({
      de: `${KIND_EXPLAIN.de} Dieses Zeichen: ${KINDS[sign.anlage].de}, Anlage ${sign.anlage}.`,
      ckb: `${KIND_EXPLAIN.ckb} ئەم هێمایە: ${KINDS[sign.anlage].ckb}، پاشکۆی ${sign.anlage}.`,
      kmr: `${KIND_EXPLAIN.kmr} Ev nîşane: ${KINDS[sign.anlage].kmr}, Anlage ${sign.anlage}.`,
      ar: `${KIND_EXPLAIN.ar} هذه الإشارة: ${KINDS[sign.anlage].ar}، الملحق ${sign.anlage}.`,
    }, signSource(sign)),
    signId: sign.id,
  };
}

type Opt = [ckb: string, de: string, kmr: string, ar: string];
interface Hand { id: string; signId: string; points: QuestionPoints; prompt: Bilingual; options: [Opt, Opt, Opt]; explanation: Bilingual; refs: string[] }

const b = (ckb: string, de: string, kmr: string, ar: string): Bilingual => ({ ckb, de, kmr, ar });

/** Hand-written scenario questions (right/left, priority, prohibitions). The first option of each is the correct one; it is rotated by index. */
const HAND: Hand[] = [
  { id: "rd-sq-h-001", signId: "s102", points: 5,
    prompt: b("نزیک بەم هێمایە دەبیتەوە. ئەگەر هیچ ڕێکخستنێکی تر نەبێت، کێ لە چوارڕێیانەکەدا پێشەنگی هەیە؟", "Sie nähern sich diesem Zeichen. Wer hat an der Kreuzung Vorfahrt, wenn nichts anderes geregelt ist?", "Tu nêzîkî vê nîşaneyê dibî. Heke qaîdeyeke din tune be, li xaçerê mafê pêşiyê yê kê ye?", "تقترب من هذه الإشارة. إذا لم يوجد تنظيم آخر، لمن الأولوية عند التقاطع؟"),
    options: [["ئەوەی لە ڕاستەوە دێت", "Wer von rechts kommt", "Yê ji aliyê rastê tê", "من يأتي من اليمين"], ["ئەوەی لە چەپەوە دێت", "Wer von links kommt", "Yê ji aliyê çepê tê", "من يأتي من اليسار"], ["ئەوەی خێراتر دەڕوات", "Wer schneller fährt", "Yê bileztir diçe", "الأسرع سيرًا"]],
    explanation: b("ئەم هێمایە ئاگادارت دەکاتەوە کە «ڕاست پێش چەپ» کاردەکات: ئەوەی لە ڕاستەوە دێت پێشەنگی هەیە.", "Das Zeichen warnt vor einer Kreuzung mit „rechts vor links“: Wer von rechts kommt, hat Vorfahrt.", "Ev nîşane li ser xaçerekê hişyar dike ku „rast beriya çep“ derbasdar e: yê ji rastê tê mafê pêşiyê heye.", "تحذّر الإشارة من تقاطع تسري فيه قاعدة «اليمين قبل اليسار»: من يأتي من اليمين له الأولوية."),
    refs: ["StVO §8 Abs. 1", "StVO Anlage 1 lfd. Nr. 2"] },
  { id: "rd-sq-h-002", signId: "s206", points: 5,
    prompt: b("لەم هێمایەدا چی دەکەیت؟", "Was müssen Sie an diesem Zeichen tun?", "Li vê nîşaneyê tu çi dikî?", "ماذا يجب أن تفعل عند هذه الإشارة؟"),
    options: [["هەمیشە بە تەواوی دەوەستم، تەنانەت ئەگەر هاتووچۆی تر نەبینم", "Immer vollständig anhalten, auch wenn kein anderer Verkehr zu sehen ist", "Her tim bi temamî radiwestim, her çend trafîkeke din nebînim", "أتوقف دائمًا توقفًا كاملًا حتى لو لم أرَ مرورًا آخر"], ["تەنها ئەگەر ئۆتۆمبێلێک بێت دەوەستم", "Nur anhalten, wenn ein Fahrzeug kommt", "Tenê heke wesayîtek bê radiwestim", "أتوقف فقط إذا جاءت مركبة"], ["تەنها خێرایی کەم دەکەمەوە", "Nur die Geschwindigkeit verringern", "Tenê leza xwe kêm dikim", "أخفف السرعة فقط"]],
    explanation: b("هێمای STOP (٢٠٦) هەمیشە وەستانی تەواو دەوێت؛ پاشان پێشەنگی بدە.", "Zeichen 206 verlangt immer vollständiges Anhalten; danach ist Vorfahrt zu gewähren.", "Nîşaneya STOP (206) her tim rawestana temam dixwaze; paşê mafê pêşiyê bide.", "تتطلب إشارة STOP (206) التوقف الكامل دائمًا، ثم إعطاء الأولوية."),
    refs: ["StVO Anlage 2 lfd. Nr. 3"] },
  { id: "rd-sq-h-003", signId: "s209", points: 4,
    prompt: b("کام ئاڕاستە لێرەدا دیاری کراوە؟", "Welche Fahrtrichtung ist hier vorgeschrieben?", "Kîjan rê li vir hatiye diyarkirin?", "ما الاتجاه الإلزامي هنا؟"),
    options: [["تەنها بۆ ڕاست", "Nur nach rechts", "Tenê ber bi rastê", "إلى اليمين فقط"], ["تەنها بۆ چەپ", "Nur nach links", "Tenê ber bi çepê", "إلى اليسار فقط"], ["ڕاستەوخۆ یان بۆ ڕاست", "Geradeaus oder rechts", "Rasterast an ber bi rastê", "مباشرة أو يمينًا"]],
    explanation: b("تیرەی سپی لەسەر بازنەی شین ئاڕاستەی ناچارییە (٢٠٩): تەنها بۆ ڕاست.", "Ein weißer Pfeil auf blauem Grund ist ein Gebot (Zeichen 209): nur nach rechts.", "Tîra spî li ser bingeha şîn ferman e (209): tenê ber bi rastê.", "السهم الأبيض على خلفية زرقاء إلزام (209): إلى اليمين فقط."),
    refs: ["StVO Anlage 2 lfd. Nr. 5"] },
  { id: "rd-sq-h-004", signId: "s222", points: 4,
    prompt: b("چۆن لە کۆسپەکە تێدەپەڕیت؟", "Wie müssen Sie an dem Hindernis vorbeifahren?", "Tu çawa ji astengiyê derbas dibî?", "كيف تتجاوز العائق؟"),
    options: [["لە ڕاستەوە", "Rechts vorbei", "Ji rastê", "من اليمين"], ["لە چەپەوە", "Links vorbei", "Ji çepê", "من اليسار"], ["لە هەر لایەکەوە دەتوانم", "Auf beliebiger Seite", "Ji her alî dikarim", "من أي جهة"]],
    explanation: b("هێمای ٢٢٢ (Rechts vorbei): دەبێت لە ڕاستەوە لە کۆسپەکە تێپەڕیت.", "Zeichen 222 (Rechts vorbei): Das Hindernis ist rechts zu umfahren.", "Nîşaneya 222 (Rechts vorbei): divê tu astengiyê ji rastê derbas bikî.", "الإشارة 222 (Rechts vorbei): يجب تجاوز العائق من اليمين."),
    refs: ["StVO Anlage 2 lfd. Nr. 10"] },
  { id: "rd-sq-h-005", signId: "s208", points: 5,
    prompt: b("لە ڕێگایەکی تەنگدا ئەم هێمایە دەبینیت. کێ دەبێت چاوەڕێ بکات؟", "An einer Engstelle sehen Sie dieses Zeichen. Wer muss warten?", "Li cihekî teng vê nîşaneyê dibînî. Kî divê bisekine?", "عند مقطع ضيق ترى هذه الإشارة. من يجب أن ينتظر؟"),
    options: [["من، چونکە دەبێت پێشەنگی بدەم بە هاتووچۆی بەرانبەر", "Ich, denn ich muss dem Gegenverkehr Vorrang gewähren", "Ez, ji ber ku divê mafê pêşiyê bidim trafîka berevajî", "أنا، لأن عليّ إعطاء الأولوية للمرور القادم"], ["هاتووچۆی بەرانبەر", "Der Gegenverkehr", "Trafîka berevajî", "المرور القادم"], ["ئەوەی خێراتر دەڕوات", "Wer schneller fährt", "Yê bileztir diçe", "الأسرع سيرًا"]],
    explanation: b("هێمای ٢٠٨: تیری سووری بەرانبەر پێشەنگی هەیە؛ تۆ دەبێت چاوەڕێ بکەیت.", "Zeichen 208: Der Gegenverkehr (roter Pfeil) hat Vorrang; Sie müssen warten.", "Nîşaneya 208: trafîka berevajî (tîra sor) mafê pêşiyê heye; divê tu bisekinî.", "الإشارة 208: للمرور القادم (السهم الأحمر) الأولوية؛ عليك الانتظار."),
    refs: ["StVO Anlage 2 lfd. Nr. 4"] },
  { id: "rd-sq-h-006", signId: "s308", points: 5,
    prompt: b("لە ڕێگایەکی تەنگدا ئەم هێمایە دەبینیت. چی بۆ تۆ ڕاستە؟", "Sie sehen dieses Zeichen an einer Engstelle. Was gilt für Sie?", "Li cihekî teng vê nîşaneyê dibînî. Ji bo te çi derbasdar e?", "ترى هذه الإشارة عند مقطع ضيق. ماذا ينطبق عليك؟"),
    options: [["پێشەنگیم هەیە بەسەر هاتووچۆی بەرانبەر", "Ich habe Vorrang vor dem Gegenverkehr", "Mafê pêşiyê yê min li ber trafîka berevajî heye", "لي الأولوية على المرور القادم"], ["دەبێت پێشەنگی بدەم بە هاتووچۆی بەرانبەر", "Ich muss dem Gegenverkehr Vorrang gewähren", "Divê mafê pêşiyê bidim trafîka berevajî", "يجب أن أعطي الأولوية للمرور القادم"], ["«ڕاست پێش چەپ» کاردەکات", "Es gilt „rechts vor links“", "„Rast beriya çep“ derbasdar e", "تسري قاعدة «اليمين قبل اليسار»"]],
    explanation: b("هێمای ٣٠٨: تیری سپی ڕووەو سەرەوەیە، واتە پێشەنگی بۆ تۆیە؛ لە ٢٠٨ بەپێچەوانەوەیە.", "Zeichen 308: Der weiße Pfeil weist in Ihre Richtung – Sie haben Vorrang. Bei Zeichen 208 ist es umgekehrt.", "Nîşaneya 308: tîra spî ber bi te ve ye – mafê pêşiyê yê te ye. Di 208 de berevajî ye.", "الإشارة 308: السهم الأبيض في اتجاهك، فلك الأولوية. في الإشارة 208 العكس."),
    refs: ["StVO Anlage 3 lfd. Nr. 4"] },
  { id: "rd-sq-h-007", signId: "s220", points: 4,
    prompt: b("چۆن دەتوانیت ئەم ڕێگایە بەکاربهێنیت؟", "Wie dürfen Sie diese Straße befahren?", "Tu çawa dikarî vê rêyê bi kar bînî?", "كيف يجوز لك استخدام هذا الشارع؟"),
    options: [["تەنها بە ئاڕاستەی تیرەکە", "Nur in Pfeilrichtung", "Tenê li gorî rêya tîrê", "باتجاه السهم فقط"], ["بە هەردوو ئاڕاستە", "In beide Richtungen", "Bi her du alî ve", "في الاتجاهين"], ["پێچەوانەی تیرەکە، ئەگەر ڕێگا بەتاڵ بێت", "Gegen den Pfeil, wenn die Straße frei ist", "Berevajî tîrê, heke rê vala be", "عكس السهم إذا كان الطريق خاليًا"]],
    explanation: b("ڕێگای یەک ئاڕاستە (٢٢٠) تەنها بە ئاڕاستەی تیرەکە بەکار دێت.", "Eine Einbahnstraße (Zeichen 220) darf nur in Pfeilrichtung befahren werden.", "Rêya yek alî (220) tenê li gorî rêya tîrê tê bikaranîn.", "الشارع ذو الاتجاه الواحد (220) يُستخدم باتجاه السهم فقط."),
    refs: ["StVO Anlage 2 lfd. Nr. 9"] },
  { id: "rd-sq-h-008", signId: "s2741", points: 4,
    prompt: b("لەم ناوچەیەدا بەرزترین خێرایی چەندە؟", "Wie schnell dürfen Sie in dieser Zone höchstens fahren?", "Di vê herêmê de herî zêde bi çi lezê dikarî biajoyî?", "ما السرعة القصوى في هذه المنطقة؟"),
    options: [["٣٠ کیلۆمەتر لە کاتژمێرێکدا", "30 km/h", "30 km/h", "30 كم/س"], ["٥٠ کیلۆمەتر لە کاتژمێرێکدا", "50 km/h", "50 km/h", "50 كم/س"], ["٢٠ کیلۆمەتر لە کاتژمێرێکدا", "20 km/h", "20 km/h", "20 كم/س"]],
    explanation: b("ناوچەی ٣٠ (٢٧٤.١): تا نیشانەی کۆتایی ناوچەکە، نابێت لە ٣٠ کیلۆمەتر لە کاتژمێرێکدا خێراتر بڕۆیت.", "Tempo 30-Zone (Zeichen 274.1): bis zum Ende der Zone nicht schneller als 30 km/h.", "Herêma 30 (274.1): heta dawiya herêmê ji 30 km/h bileztir neajo.", "منطقة 30 (274.1): لا تتجاوز 30 كم/س حتى نهاية المنطقة."),
    refs: ["StVO Anlage 2 lfd. Nr. 50"] },
  { id: "rd-sq-h-009", signId: "s307", points: 5,
    prompt: b("دوای ئەم هێمایە، لە چوارڕێیانی داهاتوودا چی کاردەکات ئەگەر ڕێکخستنی تر نەبێت؟", "Was gilt nach diesem Zeichen an der nächsten Kreuzung, wenn nichts anderes geregelt ist?", "Piştî vê nîşaneyê li xaçera paşê, heke qaîdeyeke din tune be, çi derbasdar e?", "ماذا يسري بعد هذه الإشارة عند التقاطع التالي إذا لم يوجد تنظيم آخر؟"),
    options: [["ڕاست پێش چەپ", "Rechts vor links", "Rast beriya çep", "اليمين قبل اليسار"], ["هێشتا پێشەنگیم هەیە", "Ich habe weiterhin Vorfahrt", "Hê jî mafê pêşiyê yê min heye", "ما زالت لي الأولوية"], ["هەموو کەس پێشەنگی هەیە", "Alle haben Vorfahrt", "Her kes mafê pêşiyê heye", "للجميع الأولوية"]],
    explanation: b("هێمای ٣٠٧ کۆتایی ڕێگای سەرەکی دەهێنێت؛ دووبارە «ڕاست پێش چەپ» کاردەکات.", "Zeichen 307 beendet die Vorfahrtstraße; es gilt wieder „rechts vor links“.", "Nîşaneya 307 rêya sereke diqedîne; dîsa „rast beriya çep“ derbasdar e.", "تُنهي الإشارة 307 الطريق ذا الأولوية؛ وتسري قاعدة «اليمين قبل اليسار» من جديد."),
    refs: ["StVO Anlage 3 lfd. Nr. 3", "StVO §8 Abs. 1"] },
];

function handQuestion(h: Hand, index: number): Question {
  const order = rotate([0, 1, 2], index % 3);
  const opts = order.map((src, i) => ({ id: "abc"[i]!, src, o: h.options[src]! }));
  return {
    ...base,
    id: h.id,
    topicId: "signs",
    categoryType: "Grundstoff",
    points: h.points,
    prompt: h.prompt,
    options: opts.map(({ id, o }) => ({ id, text: b(o[0], o[1], o[2], o[3]) })),
    correct: [opts.find((x) => x.src === 0)!.id],
    explanation: h.explanation,
    signId: h.signId,
  };
}

export const SIGN_QUIZ: Question[] = [
  ...SIGNS.flatMap((s, i) => [meaningQuestion(s, i), kindQuestion(s, i)]),
  ...HAND.map(handQuestion),
];

/** Legal sources per quiz question (feeds the content registry). */
export const SIGN_QUIZ_SOURCES: Record<string, string[]> = {
  ...Object.fromEntries(SIGNS.flatMap((s) => [[`rd-sq-${s.id}-m`, [signSource(s)]], [`rd-sq-${s.id}-k`, [signSource(s), "StVO Anlagen 1–3"]]])),
  ...Object.fromEntries(HAND.map((h) => [h.id, h.refs])),
};
