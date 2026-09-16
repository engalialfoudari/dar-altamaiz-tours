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
    desc: { en: "Compact, leak-resistant personal wash bottle with an angled travel nozzle and protective cap. Lightweight for carry-on luggage and easy to rinse after use. This hygiene item cannot be returned after opening unless defective.", ar: "عبوة تنظيف شخصية مدمجة ومقاومة للتسرب مع فوهة سفر مائلة وغطاء حماية. خفيفة ومناسبة لحقيبة المقصورة وسهلة الشطف بعد الاستخدام. لا يمكن استرجاع منتج النظافة هذا بعد فتحه إلا في حال وجود عيب." },
    priceKwd: 4.5,
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
  }
];
