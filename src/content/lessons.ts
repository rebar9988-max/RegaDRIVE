import type { Lesson } from "./types";

/** Original RegaDRIVE lesson texts (educational summaries, not official exam material). */
export const LESSONS: Lesson[] = [
  {
    id: "l-priority", topicId: "priority", minutes: 6,
    title: { ckb: "پێشەنگی لە چوارڕێیاندا", de: "Vorfahrt an Kreuzungen", kmr: "Mafê pêşiyê li xaçerêyan", ar: "الأولوية عند التقاطعات" },
    summary: { ckb: "کێ یەکەم جار دەڕوات؟ ڕیزبەندی ڕێکخستنەکان و یاسای «ڕاست پێش چەپ».", de: "Wer fährt zuerst? Rangfolge der Regelungen und „rechts vor links“.", kmr: "Kî pêşî diajo? Rêza qaîdeyan û qaîdeya «rast berî çep».", ar: "من يمرّ أولًا؟ ترتيب القواعد وقاعدة «اليمين قبل اليسار»." },
    sections: [
      { heading: { ckb: "ڕیزبەندی ڕێکخستن", de: "Rangfolge", kmr: "Rêza qaîdeyan", ar: "ترتيب القواعد" },
        body: { ckb: "١. ئاماژەی پۆلیس  ٢. گڵۆپی هاتووچۆ  ٣. نیشانەکانی پێشەنگی  ٤. یاسای «ڕاست پێش چەپ». هەمیشە بەرزترین ڕێکخستن جێبەجێ دەکرێت.", de: "1. Polizeibeamte  2. Ampeln  3. Vorfahrtszeichen  4. „rechts vor links“. Es gilt immer die ranghöchste Regelung.", kmr: "1. Polîs  2. Ronahiyên trafîkê  3. Nîşaneyên mafê pêşiyê  4. «Rast berî çep». Her tim qaîdeya herî bilind derbasdar e.", ar: "1. رجال الشرطة  2. الإشارات الضوئية  3. إشارات الأولوية  4. «اليمين قبل اليسار». تسري دائمًا القاعدة الأعلى مرتبة." } },
      { heading: { ckb: "ڕاست پێش چەپ", de: "Rechts vor links", kmr: "Rast berî çep", ar: "اليمين قبل اليسار" },
        body: { ckb: "ئەگەر هیچ نیشانە و گڵۆپێک نەبێت، ئەوەی لە لای ڕاستەوە دێت پێشەنگی هەیە. بە هێمنی نزیک ببەوە و ئامادەی وەستان بە.", de: "Ohne Schilder und Ampeln hat Vorfahrt, wer von rechts kommt. Langsam heranfahren und bremsbereit sein.", kmr: "Heke nîşane û ronahiyên trafîkê tune bin, mafê pêşiyê yê kesê ji aliyê rastê tê ye. Hêdî nêzîk bibe û ji bo frenkirinê amade be.", ar: "عند عدم وجود إشارات أو أضواء مرور، تكون الأولوية للقادم من اليمين. اقترب ببطء وكن مستعدًا للكبح." } },
      { heading: { ckb: "نیشانە گرنگەکان", de: "Wichtige Zeichen", kmr: "Nîşaneyên girîng", ar: "إشارات مهمة" },
        body: { ckb: "٢٠٥ = پێشەنگی بدە. ٢٠٦ (STOP) = هەمیشە بوەستە. ٣٠١ = پێشەنگی لە چوارڕێیانی داهاتوو. ٣٠٦ = ڕێگای سەرەکی.", de: "205 = Vorfahrt gewähren. 206 (STOP) = immer anhalten. 301 = Vorfahrt an der nächsten Kreuzung. 306 = Vorfahrtstraße.", kmr: "205 = Mafê pêşiyê bide. 206 (STOP) = her tim raweste. 301 = Mafê pêşiyê li xaçerêya pêş. 306 = Rêya sereke.", ar: "205 = أعطِ الأولوية. 206 (STOP) = توقّف دائمًا. 301 = الأولوية عند التقاطع التالي. 306 = طريق ذو أولوية." } },
    ],
  },
  {
    id: "l-speed", topicId: "speed", minutes: 5,
    title: { ckb: "سنوورەکانی خێرایی", de: "Geschwindigkeitsgrenzen", kmr: "Sînorên lezê", ar: "حدود السرعة" },
    summary: { ckb: "خێرایی لە ناو شار، دەرەوەی شار و ئۆتۆبان.", de: "Tempo innerorts, außerorts und auf der Autobahn.", kmr: "Lez li nav bajêr, li derveyî bajêr û li ser otobanê.", ar: "السرعة داخل المدن وخارجها وعلى الطريق السريع." },
    sections: [
      { heading: { ckb: "سنوورە گشتییەکان بۆ ئۆتۆمبێلی سواری", de: "Allgemeine Grenzen für Pkw", kmr: "Sînorên giştî ji bo otomobîlan", ar: "الحدود العامة لسيارات الركاب" },
        body: { ckb: "ناو شار: ٥٠ کیلۆمەتر لە کاتژمێرێکدا. دەرەوەی شار: ١٠٠. ئۆتۆبان: سنووری گشتی نییە، بەڵام ١٣٠ پێشنیارکراوە.", de: "Innerorts: 50 km/h. Außerorts: 100 km/h. Autobahn: keine allgemeine Grenze, Richtgeschwindigkeit 130 km/h.", kmr: "Nav bajêr: 50 km/h. Derveyî bajêr: 100 km/h. Otoban: sînorê giştî tune, leza pêşniyarkirî 130 km/h.", ar: "داخل المدن: 50 كم/س. خارج المدن: 100 كم/س. الطريق السريع: لا يوجد حد عام، والسرعة الموصى بها 130 كم/س." } },
      { heading: { ckb: "خێرایی گونجاو", de: "Angepasste Geschwindigkeit", kmr: "Leza guncav", ar: "السرعة المناسبة" },
        body: { ckb: "سنوور واتای خێرایی گونجاو نییە. لە باران، تەم، شەو و هاتووچۆی قەرەباڵغدا هێواشتر بڕۆ.", de: "Die Höchstgeschwindigkeit ist nicht automatisch angemessen. Bei Regen, Nebel, Dunkelheit und dichtem Verkehr langsamer fahren.", kmr: "Leza herî bilind bi xwe ne leza guncav e. Di baran, mij, tarîtî û trafîka qerebalix de hêdîtir biajo.", ar: "السرعة القصوى ليست بالضرورة السرعة المناسبة. قُد أبطأ عند المطر والضباب والظلام وازدحام المرور." } },
    ],
  },
  {
    id: "l-distance", topicId: "distance", minutes: 7,
    title: { ckb: "مەودا و ڕێگای وەستان", de: "Abstand und Anhalteweg", kmr: "Mesafe û rêya rawestanê", ar: "المسافة ومسافة التوقف" },
    summary: { ckb: "یاسا سادەکانی ژمارەکردن بۆ کاردانەوە، بریک و مەودا.", de: "Faustformeln für Reaktionsweg, Bremsweg und Abstand.", kmr: "Formulên hêsan ji bo rêya reaksiyonê, rêya frenê û mesafeyê.", ar: "قواعد حسابية مبسّطة لمسافة رد الفعل ومسافة الكبح والمسافة الفاصلة." },
    sections: [
      { heading: { ckb: "ڕێگای کاردانەوە", de: "Reaktionsweg", kmr: "Rêya reaksiyonê", ar: "مسافة رد الفعل" },
        body: { ckb: "(خێرایی ÷ ١٠) × ٣. نموونە: ٥٠ کیلۆمەتر ← ١٥ مەتر.", de: "(Geschwindigkeit ÷ 10) × 3. Beispiel: 50 km/h → 15 m.", kmr: "(Lez ÷ 10) × 3. Mînak: 50 km/h → 15 m.", ar: "(السرعة ÷ 10) × 3. مثال: 50 كم/س ← 15 م." } },
      { heading: { ckb: "ڕێگای بریک", de: "Bremsweg", kmr: "Rêya frenê", ar: "مسافة الكبح" },
        body: { ckb: "(خێرایی ÷ ١٠) × (خێرایی ÷ ١٠). نموونە: ٥٠ کیلۆمەتر ← ٢٥ مەتر. لە بریکی لەناکاودا نزیکەی نیوەی ئەوە.", de: "(Geschwindigkeit ÷ 10) × (Geschwindigkeit ÷ 10). Beispiel: 50 km/h → 25 m. Bei einer Gefahrbremsung etwa die Hälfte.", kmr: "(Lez ÷ 10) × (Lez ÷ 10). Mînak: 50 km/h → 25 m. Di frenkirina awarte de nêzîkî nîvê wê.", ar: "(السرعة ÷ 10) × (السرعة ÷ 10). مثال: 50 كم/س ← 25 م. وعند الكبح الطارئ تقريبًا النصف." } },
      { heading: { ckb: "ڕێگای وەستان", de: "Anhalteweg", kmr: "Rêya rawestanê", ar: "مسافة التوقف" },
        body: { ckb: "ڕێگای کاردانەوە + ڕێگای بریک. لە ٥٠ کیلۆمەتردا: ١٥ + ٢٥ = ٤٠ مەتر.", de: "Reaktionsweg + Bremsweg. Bei 50 km/h: 15 m + 25 m = 40 m.", kmr: "Rêya reaksiyonê + rêya frenê. Bi 50 km/h: 15 m + 25 m = 40 m.", ar: "مسافة رد الفعل + مسافة الكبح. عند 50 كم/س: 15 م + 25 م = 40 م." } },
    ],
  },
  {
    id: "l-people", topicId: "people", minutes: 5,
    title: { ckb: "پیادە، مناڵ و پاسکیلسوار", de: "Fußgänger, Kinder und Radfahrer", kmr: "Peyar, zarok û duçerxevan", ar: "المشاة والأطفال وراكبو الدراجات" },
    summary: { ckb: "پاراستنی بەشداربووانی لاوازی هاتووچۆ.", de: "Schutz schwächerer Verkehrsteilnehmer.", kmr: "Parastina beşdarên trafîkê yên lawaztir.", ar: "حماية مستخدمي الطريق الأكثر عرضة للخطر." },
    sections: [
      { heading: { ckb: "پەڕینەوەی پیادە", de: "Fußgängerüberweg", kmr: "Derbasgeha peyaran", ar: "ممر المشاة" },
        body: { ckb: "پیادە پێشەنگیان هەیە. بە هێمنی نزیک ببەوە و لە بەردەم پەڕینەوەکەدا تێپەڕاندن مەکە.", de: "Fußgänger haben Vorrang. Mit mäßiger Geschwindigkeit heranfahren und vor dem Überweg nicht überholen.", kmr: "Mafê pêşiyê yê peyaran e. Bi leza nerm nêzîk bibe û li ber derbasgehê derbas neke.", ar: "للمشاة الأولوية. اقترب بسرعة معتدلة ولا تتجاوز قبل ممر المشاة." } },
      { heading: { ckb: "مەودای لاتەنیشت لە پاسکیلسوار", de: "Seitenabstand zu Radfahrern", kmr: "Mesafeya alî ji duçerxevanan", ar: "المسافة الجانبية عن راكبي الدراجات" },
        body: { ckb: "ناو شار لانیکەم ١.٥ مەتر، دەرەوەی شار لانیکەم ٢ مەتر.", de: "Innerorts mindestens 1,5 m, außerorts mindestens 2 m.", kmr: "Li nav bajêr herî kêm 1,5 m, li derveyî bajêr herî kêm 2 m.", ar: "داخل المدن 1.5 م على الأقل، وخارجها 2 م على الأقل." } },
    ],
  },
  {
    id: "l-emergency", topicId: "emergency", minutes: 6,
    title: { ckb: "ڕووداو و ڕێڕەوی فریاکەوتن", de: "Unfall und Rettungsgasse", kmr: "Qeza û korîdora rizgariyê", ar: "الحادث وممر الطوارئ" },
    summary: { ckb: "پاراستنی شوێنی ڕووداو، یارمەتی یەکەم و ڕێڕەوی فریاکەوتن.", de: "Unfallstelle absichern, Erste Hilfe und Rettungsgasse.", kmr: "Ewlekirina cihê qezayê, alîkariya yekem û korîdora rizgariyê.", ar: "تأمين موقع الحادث والإسعافات الأولية وممر الطوارئ." },
    sections: [
      { heading: { ckb: "پاراستنی شوێنەکە", de: "Absichern", kmr: "Ewlekirina cih", ar: "تأمين الموقع" },
        body: { ckb: "چرای ئاگادارکردنەوە ← جلی ئاگادارکردنەوە ← سێگۆشەی ئاگادارکردنەوە ← ١١٢ ← یارمەتی یەکەم.", de: "Warnblinklicht → Warnweste → Warndreieck → Notruf 112 → Erste Hilfe.", kmr: "Ronahiya hişyariyê → yeleka hişyariyê → sêgoşeya hişyariyê → bangawaziya awarte 112 → alîkariya yekem.", ar: "أضواء التحذير ← سترة التحذير ← مثلث التحذير ← رقم الطوارئ 112 ← الإسعافات الأولية." } },
      { heading: { ckb: "ڕێڕەوی فریاکەوتن", de: "Rettungsgasse", kmr: "Korîdora rizgariyê", ar: "ممر الطوارئ" },
        body: { ckb: "هێڵی چەپ بۆ چەپ، هەموو هێڵەکانی تر بۆ ڕاست — هەر کاتێک هاتووچۆ هێواش بوو.", de: "Linker Fahrstreifen nach links, alle anderen nach rechts – sobald der Verkehr stockt.", kmr: "Xeta çepê ber bi çepê, hemû xetên din ber bi rastê – gava ku trafîk hêdî dibe.", ar: "المسار الأيسر إلى اليسار، وجميع المسارات الأخرى إلى اليمين – بمجرد تباطؤ حركة المرور." } },
    ],
  },
  {
    id: "l-motorway", topicId: "motorway", minutes: 5,
    title: { ckb: "لێخوڕین لە ئۆتۆبان", de: "Fahren auf der Autobahn", kmr: "Ajotin li ser otobanê", ar: "القيادة على الطريق السريع" },
    summary: { ckb: "چوونە ناوەوە، خێرایی و قەدەغەکان.", de: "Auffahren, Tempo und Verbote.", kmr: "Ketina otobanê, lez û qedexe.", ar: "الدخول إلى الطريق السريع والسرعة والمحظورات." },
    sections: [
      { heading: { ckb: "چوونە ناوەوە", de: "Auffahren", kmr: "Ketina otobanê", ar: "الدخول إلى الطريق السريع" },
        body: { ckb: "لەسەر هێڵی خێراکردن خێرایی زیاد بکە؛ هاتووچۆی سەر ئۆتۆبان پێشەنگی هەیە.", de: "Auf dem Beschleunigungsstreifen beschleunigen; der Verkehr auf der Autobahn hat Vorfahrt.", kmr: "Li ser xeta lezkirinê leza xwe zêde bike; mafê pêşiyê yê trafîka li ser otobanê ye.", ar: "زِد سرعتك على مسار التسارع؛ الأولوية لحركة المرور على الطريق السريع." } },
      { heading: { ckb: "قەدەغەکان", de: "Verbote", kmr: "Qedexe", ar: "المحظورات" },
        body: { ckb: "سووڕانەوە، بە دواوە ڕۆیشتن و وەستان (جگە لە فریاکەوتن) قەدەغەن.", de: "Wenden, Rückwärtsfahren und Halten (außer im Notfall) sind verboten.", kmr: "Zivirîn, ajotina paşve û rawestan (ji bilî rewşa awarte) qedexe ne.", ar: "الدوران والرجوع إلى الخلف والتوقف (إلا في حالات الطوارئ) ممنوعة." } },
    ],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
