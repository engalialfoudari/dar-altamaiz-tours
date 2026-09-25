export type StoreCategory = "electrical" | "comfort" | "bags";

export interface StoreProduct {
  id: string;
  name: { en: string; ar: string };
  desc: { en: string; ar: string };
  priceKwd: number;
  category: StoreCategory;
  image: any;
  active?: boolean;
  imageUrl?: string;
}

export function parseServerCatalog(payload: any): StoreProduct[] {
  const rows = Array.isArray(payload) ? payload : payload?.products;
  if (!Array.isArray(rows)) return [];
  return rows.map((row: any) => {
    const fallback = STORE_CATALOG.find(product => product.id === String(row.product_id ?? row.productId ?? row.id));
    const id = String(row.product_id ?? row.productId ?? row.id ?? "");
    return {
      id,
      name: { en: String(row.title ?? row.name ?? fallback?.name.en ?? id), ar: String(row.title_ar ?? row.title ?? row.name ?? fallback?.name.ar ?? id) },
      desc: { en: String(row.description ?? fallback?.desc.en ?? ""), ar: String(row.description_ar ?? row.description ?? fallback?.desc.ar ?? "") },
      priceKwd: Number(row.price_kwd ?? row.priceKwd ?? fallback?.priceKwd ?? 0),
      category: (["electrical", "comfort", "bags"].includes(row.category) ? row.category : fallback?.category ?? "comfort") as StoreCategory,
      image: fallback?.image,
      imageUrl: typeof row.image_url === "string" && /^https?:\/\//i.test(row.image_url) ? row.image_url : undefined,
      active: row.active !== false,
    };
  }).filter(product => product.id && product.active !== false && Number.isFinite(product.priceKwd));
}

export const STORE_CATALOG: StoreProduct[] = [
  {
    id: "universal-adapter",
    name: { en: "Universal Travel Adapter Pro", ar: "محول سفر عالمي برو" },
    desc: { en: "Compact 65W GaN universal adapter for 150+ countries, with 2 USB-C ports and 1 USB-A port. Supports fast charging for compatible phones, tablets, and laptops. Built-in safety shutters and replaceable fuse. Charging cables are not included.", ar: "محول سفر عالمي مدمج بتقنية GaN بقدرة 65 واط لأكثر من 150 دولة، مع منفذي USB-C ومنفذ USB-A. يدعم الشحن السريع للهواتف والأجهزة اللوحية وأجهزة اللابتوب المتوافقة. مزود بحماية داخلية وفيوز قابل للاستبدال. كابلات الشحن غير مشمولة." },
    priceKwd: 12.5,
    category: "electrical",
    image: require("@/assets/images/store/adapter.jpg"),
  },
  {
    id: "portable-bidet",
    name: { en: "Portable Travel Bidet", ar: "شطاف السفر المحمول" },
    desc: { en: "Portable blue travel bidet with a front-mounted 65° angled long-neck nozzle for horizontal spray. Uses no electricity or batteries. Compact and suitable for travel; nozzle connector compatibility varies by regional standard.", ar: "شطاف سفر محمول باللون الأزرق مع فوهة أمامية طويلة بزاوية 65 درجة للرش الأفقي. يعمل دون كهرباء أو بطاريات، وهو مدمج ومناسب للسفر. قد يختلف توافق وصلة الفوهة حسب المعيار الإقليمي." },
    priceKwd: 3.5,
    category: "comfort",
    image: require("@/assets/images/store/portable-bidet.jpg"),
  },
  {
    id: "thermal-mug",
    name: { en: "Insulated Thermal Mug", ar: "مق حراري حافظ للحرارة والبرودة" },
    desc: { en: "Double-wall insulated travel mug designed to keep drinks hot or cold during your journey. Secure lid helps reduce spills in normal use. Hand-wash before first use; check the product label for exact capacity and care instructions.", ar: "مق سفر معزول مزدوج الجدار مصمم للحفاظ على المشروبات ساخنة أو باردة أثناء الرحلة. يساعد الغطاء المحكم على تقليل الانسكاب عند الاستخدام العادي. يُغسل يدوياً قبل أول استخدام، وتُراجع بطاقة المنتج لمعرفة السعة وتعليمات العناية." },
    priceKwd: 6.75,
    category: "comfort",
    image: require("@/assets/images/store/thermal-mug.jpg"),
  },
  {
    id: "luggage-scale",
    name: { en: "Digital Luggage Scale", ar: "ميزان أمتعة رقمي" },
    desc: { en: "Compact digital hanging scale for checking luggage weight before airport check-in. Clear display, tare function, and travel-friendly strap. Airline limits vary; the reading is a travel guide and does not replace the airline's official scale.", ar: "ميزان رقمي معلق ومدمج لفحص وزن الأمتعة قبل تسجيل الوصول في المطار. شاشة واضحة وخاصية تصفير وحزام مناسب للسفر. تختلف حدود شركات الطيران، والقراءة إرشادية ولا تستبدل ميزان شركة الطيران الرسمي." },
    priceKwd: 3.9,
    category: "bags",
    image: require("@/assets/images/store/luggage-scale.jpg"),
  },
  {
    id: "pillow-mem-1",
    name: { en: "Memory Foam Neck Pillow", ar: "وسادة رقبة ميموري فوم" },
    desc: { en: "Ergonomic memory-foam neck pillow with a cooling-gel layer and adjustable front strap. The removable outer cover is washable; the foam core must not be machine washed. Comfort and fit vary by user.", ar: "وسادة رقبة مريحة من الميموري فوم مع طبقة جل للتبريد وحزام أمامي قابل للتعديل. الغطاء الخارجي قابل للإزالة والغسيل، بينما لا تُغسل حشوة الفوم في الغسالة. مستوى الراحة والملاءمة يختلف من شخص لآخر." },
    priceKwd: 8.0,
    category: "comfort",
    image: require("@/assets/images/store/pillow.jpg"),
  },
  {
    id: "luggage-cabin-1",
    name: { en: "Polycarbonate Cabin Luggage", ar: "حقيبة مقصورة بولي كربونات" },
    desc: { en: "Lightweight 20-inch polycarbonate cabin case with TSA combination lock, telescopic handle, organized interior, and 360° spinner wheels. Cabin-size rules differ by airline; confirm your airline's dimensions and weight allowance before travel.", ar: "حقيبة مقصورة بولي كربونات خفيفة مقاس 20 إنش، مع قفل TSA رقمي ومقبض سحب وتقسيم داخلي وعجلات دوارة 360 درجة. تختلف مقاسات وأوزان المقصورة حسب شركة الطيران؛ يرجى التحقق من شروط الناقل قبل السفر." },
    priceKwd: 25.0,
    category: "bags",
    image: require("@/assets/images/store/luggage.jpg"),
  },
  {
    id: "powerbank-10k",
    name: { en: "Slim Power Bank 10,000mAh", ar: "شاحن متنقل نحيف 10,000mAh" },
    desc: { en: "Slim 10,000mAh power bank with up to 20W USB-C Power Delivery for compatible devices. Includes charge-level indicators and built-in electrical protection. Carry in cabin baggage only and follow your airline's battery rules. Cable availability is shown on the packaging.", ar: "شاحن متنقل نحيف بسعة 10,000mAh ويدعم USB-C Power Delivery حتى 20 واط للأجهزة المتوافقة. مزود بمؤشر مستوى الشحن وحماية كهربائية داخلية. يُحمل في حقيبة المقصورة فقط مع الالتزام بقواعد بطاريات شركة الطيران. توفر الكابل موضح على العبوة." },
    priceKwd: 9.5,
    category: "electrical",
    image: require("@/assets/images/store/powerbank.jpg"),
  },
  {
    id: "portable-medicine-bag",
    name: { en: "Portable Medicine Storage Bag", ar: "حقيبة أدوية محمولة" },
    desc: { en: "Compact black medicine organizer made from 100% polyester, with a zipper closure, hand strap, and internal mesh compartments. Foldable, lightweight, and easy to clean with a wet wipe. Approx. 18 × 10 × 3 cm.", ar: "حقيبة أدوية سوداء مدمجة مصنوعة من البوليستر 100%، مع إغلاق بسحاب وحزام يد وجيوب شبكية داخلية. قابلة للطي وخفيفة الوزن، وتُنظف بمسحة مبللة. المقاس التقريبي 18 × 10 × 3 سم." },
    priceKwd: 1.75,
    category: "bags",
    image: require("@/assets/images/store/medicine-bag.jpg"),
  },
  {
    id: "travel-coffee-tumbler",
    name: { en: "Travel Coffee Tumbler", ar: "كوب قهوة للسفر" },
    desc: { en: "Reusable white travel coffee tumbler made from food-contact 304 stainless steel, with a secure lid and carrying strap. Multipurpose 17.92 oz size. Hand wash only.", ar: "كوب قهوة أبيض قابل لإعادة الاستخدام للسفر، مصنوع من الستانلس ستيل 304 المخصص لملامسة الطعام، مع غطاء محكم وحزام للحمل. سعة متعددة الاستخدامات 17.92 أونصة. يُغسل يدوياً فقط." },
    priceKwd: 4.75,
    category: "comfort",
    image: require("@/assets/images/store/travel-coffee-tumbler.jpg"),
  },
  {
    id: "waterproof-phone-pouch-pink",
    name: { en: "Waterproof Phone Pouch - Pink", ar: "حافظة هاتف مقاومة للماء - وردي" },
    desc: { en: "Pink transparent waterproof phone pouch with dual locking clips and an adjustable neck strap. Helps protect a phone from water, splashes, sand, and dust while keeping the screen visible. Test the seal with tissue before each use.", ar: "حافظة هاتف شفافة مقاومة للماء باللون الوردي، مع مشبكي إغلاق وحزام رقبة قابل للتعديل. تساعد على حماية الهاتف من الماء والرذاذ والرمل والغبار مع إبقاء الشاشة ظاهرة. يُنصح باختبار الإغلاق بمنديل قبل كل استخدام." },
    priceKwd: 1.75,
    category: "bags",
    image: require("@/assets/images/store/waterproof-phone-pouch-pink.jpg"),
  },
  {
    id: "waterproof-phone-pouch-blue",
    name: { en: "Waterproof Phone Pouch - Blue", ar: "حافظة هاتف مقاومة للماء - أزرق" },
    desc: { en: "Blue transparent waterproof phone pouch with dual locking clips and an adjustable neck strap. Helps protect a phone from water, splashes, sand, and dust while keeping the screen visible. Test the seal with tissue before each use.", ar: "حافظة هاتف شفافة مقاومة للماء باللون الأزرق، مع مشبكي إغلاق وحزام رقبة قابل للتعديل. تساعد على حماية الهاتف من الماء والرذاذ والرمل والغبار مع إبقاء الشاشة ظاهرة. يُنصح باختبار الإغلاق بمنديل قبل كل استخدام." },
    priceKwd: 1.75,
    category: "bags",
    image: require("@/assets/images/store/waterproof-phone-pouch-blue.jpg"),
  },
  {
    id: "digital-luggage-scale-champagne",
    name: { en: "Digital Luggage Scale - Champagne Gold", ar: "ميزان أمتعة رقمي - ذهبي شامبانيا" },
    desc: { en: "Handheld digital luggage scale with a metal handle and hanging hook. Capacity up to 50 kg. The package states 5 g graduation from 0–10 kg and 10 g graduation from 10–50 kg. Airline limits vary; use the reading as a travel guide.", ar: "ميزان أمتعة رقمي محمول بمقبض معدني وخطاف تعليق، بسعة تصل إلى 50 كجم. توضح العبوة تدريج 5 جم من 0 إلى 10 كجم، وتدريج 10 جم من 10 إلى 50 كجم. تختلف حدود شركات الطيران، لذا تُستخدم القراءة كدليل للسفر." },
    priceKwd: 2.75,
    category: "bags",
    image: require("@/assets/images/store/digital-luggage-scale-champagne.jpg"),
  },
  {
    id: "look-find-activity-book",
    name: { en: "Look & Find Activity Book", ar: "كتاب أنشطة ابحث واعثر" },
    desc: { en: "Look & Find activity book with illustrated seek-and-find pages and colorful checklist prompts. A compact travel activity that encourages observation, focus, and screen-free entertainment.", ar: "كتاب أنشطة «ابحث واعثر» مع صفحات مصورة للبحث وقوائم ملونة لتحديد العناصر المطلوبة. نشاط سفر مدمج يشجع على الملاحظة والتركيز ويوفر ترفيهاً بعيداً عن الشاشات." },
    priceKwd: 2.25,
    category: "comfort",
    image: require("@/assets/images/store/look-find-activity-book.jpg"),
  },
  {
    id: "hanging-toiletry-organizer-red",
    name: { en: "Hanging Travel Toiletry Organizer - Red", ar: "منظم مستلزمات سفر معلق - أحمر" },
    desc: { en: "Red foldable hanging toiletry organizer made from 100% polyester, with a zipper closure, built-in hook, carrying handle, and multiple mesh compartments. Lightweight and wet-wipe clean. Approx. 23 × 19 × 7 cm closed and 41 × 23 cm open.", ar: "منظم مستلزمات سفر معلق باللون الأحمر، مصنوع من البوليستر 100%، وقابل للطي مع إغلاق بسحاب وخطاف مدمج ومقبض حمل وجيوب شبكية متعددة. خفيف الوزن ويُنظف بمسحة مبللة. المقاس التقريبي 23 × 19 × 7 سم عند الإغلاق و41 × 23 سم عند الفتح." },
    priceKwd: 2.75,
    category: "bags",
    image: require("@/assets/images/store/hanging-toiletry-organizer-red.jpg"),
  },
  {
    id: "hanging-toiletry-organizer-blue",
    name: { en: "Hanging Travel Toiletry Organizer - Blue", ar: "منظم مستلزمات سفر معلق - أزرق" },
    desc: { en: "Blue foldable hanging toiletry organizer made from 100% polyester, with a zipper closure, built-in hook, carrying handle, and multiple mesh compartments. Lightweight and wet-wipe clean. Approx. 23 × 19 × 7 cm closed and 41 × 23 cm open.", ar: "منظم مستلزمات سفر معلق باللون الأزرق، مصنوع من البوليستر 100%، وقابل للطي مع إغلاق بسحاب وخطاف مدمج ومقبض حمل وجيوب شبكية متعددة. خفيف الوزن ويُنظف بمسحة مبللة. المقاس التقريبي 23 × 19 × 7 سم عند الإغلاق و41 × 23 سم عند الفتح." },
    priceKwd: 2.75,
    category: "bags",
    image: require("@/assets/images/store/hanging-toiletry-organizer-blue.jpg"),
  },
  {
    id: "insulated-bottle-cup-pink",
    name: { en: "Insulated Stainless Steel Bottle with Cup - Pink", ar: "قارورة ستانلس ستيل معزولة مع كوب - وردي" },
    desc: { en: "Multipurpose insulated stainless steel bottle with a matching removable drinking cup, carrying strap, and matte-painted finish. Approx. 600 ml capacity. Use without electricity; hand wash recommended.", ar: "قارورة ستانلس ستيل معزولة متعددة الاستخدامات مع كوب شرب قابل للفصل وحزام حمل وطلاء مطفي. السعة التقريبية 600 مل. تُستخدم دون كهرباء ويُنصح بغسلها يدوياً." },
    priceKwd: 4.75,
    category: "comfort",
    image: require("@/assets/images/store/insulated-bottle-cup-pink.jpg"),
  },
  {
    id: "insulated-bottle-cup-white",
    name: { en: "Insulated Stainless Steel Bottle with Cup - White", ar: "قارورة ستانلس ستيل معزولة مع كوب - أبيض" },
    desc: { en: "Multipurpose insulated stainless steel bottle with a matching removable drinking cup, carrying strap, and matte-painted finish. Approx. 600 ml capacity. Use without electricity; hand wash recommended.", ar: "قارورة ستانلس ستيل معزولة متعددة الاستخدامات مع كوب شرب قابل للفصل وحزام حمل وطلاء مطفي. السعة التقريبية 600 مل. تُستخدم دون كهرباء ويُنصح بغسلها يدوياً." },
    priceKwd: 4.75,
    category: "comfort",
    image: require("@/assets/images/store/insulated-bottle-cup-white.jpg"),
  },
  {
    id: "insulated-bottle-cup-purple",
    name: { en: "Insulated Stainless Steel Bottle with Cup - Purple", ar: "قارورة ستانلس ستيل معزولة مع كوب - بنفسجي" },
    desc: { en: "Multipurpose insulated stainless steel bottle with a matching removable drinking cup, carrying strap, and matte-painted finish. Approx. 600 ml capacity. Use without electricity; hand wash recommended.", ar: "قارورة ستانلس ستيل معزولة متعددة الاستخدامات مع كوب شرب قابل للفصل وحزام حمل وطلاء مطفي. السعة التقريبية 600 مل. تُستخدم دون كهرباء ويُنصح بغسلها يدوياً." },
    priceKwd: 4.75,
    category: "comfort",
    image: require("@/assets/images/store/insulated-bottle-cup-purple.jpg"),
  },
  {
    id: "universal-travel-adapter-orange",
    name: { en: "Universal Travel Adapter - Orange", ar: "محول سفر عالمي - برتقالي" },
    desc: { en: "Compact orange universal travel adapter for British, Australian, European, and US-style plugs. Supports 110–240V input and includes two USB-C ports and one USB-A port for compatible devices. Indoor use only; this is a non-grounding plug adapter and does not convert voltage.", ar: "محول سفر عالمي مدمج باللون البرتقالي، مناسب للقوابس البريطانية والأسترالية والأوروبية والأمريكية. يدعم دخل 110–240 فولت ويضم منفذي USB-C ومنفذ USB-A للأجهزة المتوافقة. للاستخدام الداخلي فقط؛ المحول غير مؤرض ولا يحول الجهد الكهربائي." },
    priceKwd: 5.5,
    category: "electrical",
    image: require("@/assets/images/store/universal-travel-adapter-orange.jpg"),
  },
  {
    id: "world-landmark-travel-mug",
    name: { en: "World Landmark Insulated Travel Mug", ar: "كوب سفر معزول بتصميم معالم العالم" },
    desc: { en: "Reusable 530 ml stainless steel insulated travel mug with a world-landmark design, leak-resistant lid, and white carrying strap. Suitable for hot or cold drinks. Hand wash recommended.", ar: "كوب سفر قابل لإعادة الاستخدام بسعة 530 مل، مصنوع من الستانلس ستيل المعزول ومزين بتصميم معالم عالمية، مع غطاء مقاوم للتسرب وحزام حمل أبيض. مناسب للمشروبات الساخنة أو الباردة، ويُنصح بغسله يدوياً." },
    priceKwd: 4.5,
    category: "comfort",
    image: require("@/assets/images/store/world-landmark-travel-mug.jpg"),
  },
  {
    id: "travel-luggage-tag-set-3pc",
    name: { en: "Travel Luggage Tag Set - 3 Pieces", ar: "طقم بطاقات تعريف للأمتعة - 3 قطع" },
    desc: { en: "Set of three colorful PVC luggage tags with travel-themed designs, flexible attachment loops, and writable name, address, and telephone cards. Each tag measures approximately 10.5 × 6.5 cm.", ar: "طقم من ثلاث بطاقات تعريف ملونة للأمتعة مصنوعة من PVC، بتصاميم سفر وحلقات تثبيت مرنة وبطاقات قابلة للكتابة للاسم والعنوان ورقم الهاتف. مقاس كل بطاقة تقريباً 10.5 × 6.5 سم." },
    priceKwd: 2.25,
    category: "bags",
    image: require("@/assets/images/store/travel-luggage-tag-set-3pc-v2.jpg"),
  }
];
