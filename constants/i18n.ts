export type LangCode = "en" | "ar" | "hi" | "ur" | "tl";

export const RTL_LANGS: LangCode[] = ["ar", "ur"];
export const isRTL = (lang: LangCode) => RTL_LANGS.includes(lang);

type Translations = {
  tabs: {
    home: string;
    trips: string;
    bookings: string;
    settings: string;
    requests: string;
    profile: string;
  };
  infoModal: {
    title: string;
    whatsapp: string;
    mainTitle: string;
    sections: Array<{ heading: string; body: string }>;
  };
  specialRequests: {
    screenTitle: string;
    fullName: string;
    phone: string;
    email: string;
    requestType: string;
    requestTypes: string[];
    departure: string;
    return: string;
    passengers: string;
    adults: string;
    children: string;
    infants: string;
    notes: string;
    notesPlaceholder: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successBody: string;
    done: string;
    pickDate: string;
    day: string;
    month: string;
    year: string;
    confirm: string;
    validationName: string;
    validationPhone: string;
    validationRequest: string;
    validationDate: string;
  };
  chatbot: {
    placeholder: string;
    thinking: string;
    errorRetry: string;
  };
};

const EN: Translations = {
  tabs: {
    home: "Home",
    trips: "Packages",
    bookings: "Bookings",
    settings: "Contact",
    requests: "Requests",
    profile: "Account",
  },
  infoModal: {
    title: "Search Guide",
    whatsapp: "Contact Us on WhatsApp",
    mainTitle: "Search Guidelines & Support",
    sections: [
      {
        heading: "Flights",
        body: "For more accurate and faster flight results, it is highly recommended to enter the official three-letter airport IATA code (e.g., KWI for Kuwait, DXB for Dubai, LHR for London).",
      },
      {
        heading: "Hotels",
        body: "You can type the exact hotel name directly if known, or simply enter the city name and utilize the internal search filters to narrow down and find your preferred accommodation easily.",
      },
      {
        heading: "Search Language",
        body: "To ensure real-time live price matching and 100% precise results, we always recommend typing cities, airports, and hotel names in English.",
      },
      {
        heading: "Passport Validity",
        body: "Please ensure that your passport validity is not less than 6 months from your planned travel date to avoid any issues or restrictions during airport check-in.",
      },
      {
        heading: "Flexible Dates",
        body: "If your travel dates are flexible, try searching 2 days before or after your selected date. Better flight and hotel rates are often available during mid-week departures.",
      },
      {
        heading: "Technical Support & Inquiries",
        body: "If you encounter any difficulties while using the application or have any further inquiries, you can directly connect with the D.T. Tours support team via WhatsApp by clicking the button below.",
      },
    ],
  },
  specialRequests: {
    screenTitle: "Special Requests",
    fullName: "Full Name",
    phone: "Phone Number",
    email: "Email Address",
    requestType: "Request Type",
    requestTypes: [
      "Flight Booking",
      "Hotel Booking",
      "Travel Package",
      "Visa Assistance",
      "Airport Transfer",
      "Other",
    ],
    departure: "Departure Date",
    return: "Return Date",
    passengers: "Passengers",
    adults: "Adults",
    children: "Children",
    infants: "Infants",
    notes: "Additional Notes",
    notesPlaceholder: "Describe your request in detail...",
    submit: "Submit Request",
    submitting: "Submitting...",
    successTitle: "Request Submitted!",
    successBody: "Our team will contact you within 24 hours.",
    done: "Done",
    pickDate: "Select Date",
    day: "Day",
    month: "Month",
    year: "Year",
    confirm: "Confirm",
    validationName: "Please enter your full name.",
    validationPhone: "Please enter your phone number.",
    validationRequest: "Please select a request type.",
    validationDate: "Please select a departure date.",
  },
  chatbot: {
    placeholder: "Ask me anything about travel...",
    thinking: "Thinking...",
    errorRetry: "Something went wrong. Please try again.",
  },
};

const AR: Translations = {
  tabs: {
    home: "الرئيسية",
    trips: "الباقات",
    bookings: "حجوزاتي",
    settings: "تواصل",
    requests: "طلبات",
    profile: "حسابي",
  },
  infoModal: {
    title: "دليل البحث",
    whatsapp: "تواصل معنا عبر الواتساب",
    mainTitle: "دليل إرشادات البحث والمساعدة",
    sections: [
      {
        heading: "رحلات الطيران",
        body: "للحصول على نتائج أدق وأسرع لرحلات الطيران، يُفضل كتابة رمز المطار الدولي المكون من ثلاثة أحرف (مثال: للكويت اكتب KWI، لدبي اكتب DXB، للندن اكتب LHR).",
      },
      {
        heading: "حجوزات الفنادق",
        body: "يمكنك كتابة اسم الفندق مباشرة إذا كنت تحفظه، أو اكتفِ بكتابة اسم المدينة ثم استخدم خانة التصفية (الفلتر) بالداخل لتضييق النتائج والوصول إلى فندقك المفضل بسهولة.",
      },
      {
        heading: "لغة البحث",
        body: "لضمان مطابقة الأسعار الحية والحصول على نتائج دقيقة بنسبة مئة بالمئة، نوصي دائماً بكتابة أسماء المدن والمطارات والفنادق باللغة الإنجليزية.",
      },
      {
        heading: "صلاحية جواز السفر",
        body: "يرجى التأكد من أن صلاحية جواز سفرك لا تقل عن 6 أشهر من تاريخ السفر المخطط له، وذلك لتفادي أي عوائق أو قيود أثناء إنهاء إجراءات المطار.",
      },
      {
        heading: "مرونة التواريخ",
        body: "إذا كانت تواريخ سفرك مرنة وغير ثابتة، يفضل تجربة البحث قبل أو بعد التاريخ المحدد بيومين، حيث تتوفر غالباً أسعار طيران وفنادق أفضل في منتصف الأسبوع.",
      },
      {
        heading: "الدعم الفني والاستفسارات",
        body: "إذا واجهتك أي صعوبة أثناء استخدام التطبيق أو كان لديك أي استفسار إضافي، يمكنك التواصل مباشرة مع فريق دعم دار التميز للسفريات عبر الواتساب بالضغط على الزر أدناه.",
      },
    ],
  },
  specialRequests: {
    screenTitle: "الطلبات الخاصة",
    fullName: "الاسم الكامل",
    phone: "رقم الهاتف",
    email: "البريد الإلكتروني",
    requestType: "نوع الطلب",
    requestTypes: [
      "حجز طيران",
      "حجز فندق",
      "باقة سياحية",
      "مساعدة تأشيرة",
      "نقل مطار",
      "أخرى",
    ],
    departure: "تاريخ المغادرة",
    return: "تاريخ العودة",
    passengers: "عدد المسافرين",
    adults: "بالغين",
    children: "أطفال",
    infants: "رضّع",
    notes: "ملاحظات إضافية",
    notesPlaceholder: "اشرح طلبك بالتفصيل...",
    submit: "إرسال الطلب",
    submitting: "جاري الإرسال...",
    successTitle: "تم إرسال الطلب!",
    successBody: "سيتواصل معك فريقنا خلال 24 ساعة.",
    done: "إنهاء",
    pickDate: "اختر التاريخ",
    day: "يوم",
    month: "شهر",
    year: "سنة",
    confirm: "تأكيد",
    validationName: "يرجى إدخال اسمك الكامل.",
    validationPhone: "يرجى إدخال رقم هاتفك.",
    validationRequest: "يرجى اختيار نوع الطلب.",
    validationDate: "يرجى اختيار تاريخ المغادرة.",
  },
  chatbot: {
    placeholder: "اسألني أي شيء عن السفر...",
    thinking: "جاري التفكير...",
    errorRetry: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
  },
};

const HI: Translations = {
  tabs: {
    home: "होम",
    trips: "पैकेज",
    bookings: "बुकिंग",
    settings: "संपर्क",
    requests: "अनुरोध",
    profile: "खाता",
  },
  infoModal: {
    title: "खोज गाइड",
    whatsapp: "WhatsApp पर संपर्क करें",
    mainTitle: "खोज दिशानिर्देश और सहायता",
    sections: [
      {
        heading: "उड़ानें",
        body: "सटीक और तेज़ उड़ान परिणामों के लिए, तीन अक्षरों वाला IATA कोड दर्ज करें (जैसे KWI कुवैत, DXB दुबई, LHR लंदन के लिए)।",
      },
      {
        heading: "होटल",
        body: "होटल का नाम सीधे टाइप करें या शहर का नाम दर्ज करें और फ़िल्टर का उपयोग करके अपना पसंदीदा होटल खोजें।",
      },
      {
        heading: "खोज भाषा",
        body: "सटीक परिणामों के लिए हमेशा शहरों, हवाई अड्डों और होटलों के नाम अंग्रेज़ी में टाइप करें।",
      },
      {
        heading: "पासपोर्ट वैधता",
        body: "कृपया सुनिश्चित करें कि आपके पासपोर्ट की वैधता यात्रा तिथि से कम से कम 6 महीने हो।",
      },
      {
        heading: "लचीली तिथियाँ",
        body: "यदि आपकी यात्रा तिथियाँ लचीली हैं, तो चुनी गई तिथि से 2 दिन पहले या बाद में खोजें — मध्य-सप्ताह में बेहतर दरें मिल सकती हैं।",
      },
      {
        heading: "तकनीकी सहायता",
        body: "किसी भी समस्या के लिए नीचे दिए गए बटन से WhatsApp पर D.T. Tours की सहायता टीम से संपर्क करें।",
      },
    ],
  },
  specialRequests: {
    screenTitle: "विशेष अनुरोध",
    fullName: "पूरा नाम",
    phone: "फ़ोन नंबर",
    email: "ईमेल पता",
    requestType: "अनुरोध का प्रकार",
    requestTypes: [
      "उड़ान बुकिंग",
      "होटल बुकिंग",
      "यात्रा पैकेज",
      "वीज़ा सहायता",
      "एयरपोर्ट ट्रांसफर",
      "अन्य",
    ],
    departure: "प्रस्थान तिथि",
    return: "वापसी तिथि",
    passengers: "यात्री",
    adults: "वयस्क",
    children: "बच्चे",
    infants: "शिशु",
    notes: "अतिरिक्त नोट्स",
    notesPlaceholder: "अपना अनुरोध विस्तार से बताएं...",
    submit: "अनुरोध भेजें",
    submitting: "भेजा जा रहा है...",
    successTitle: "अनुरोध सबमिट हो गया!",
    successBody: "हमारी टीम 24 घंटे में आपसे संपर्क करेगी।",
    done: "ठीक है",
    pickDate: "तिथि चुनें",
    day: "दिन",
    month: "महीना",
    year: "वर्ष",
    confirm: "पुष्टि करें",
    validationName: "कृपया अपना पूरा नाम दर्ज करें।",
    validationPhone: "कृपया फ़ोन नंबर दर्ज करें।",
    validationRequest: "कृपया अनुरोध का प्रकार चुनें।",
    validationDate: "कृपया प्रस्थान तिथि चुनें।",
  },
  chatbot: {
    placeholder: "यात्रा के बारे में कुछ भी पूछें...",
    thinking: "सोच रहा हूँ...",
    errorRetry: "कुछ गड़बड़ हुई। फिर से प्रयास करें।",
  },
};

const UR: Translations = {
  tabs: {
    home: "ہوم",
    trips: "پیکیجز",
    bookings: "بکنگز",
    settings: "رابطہ",
    requests: "درخواستیں",
    profile: "اکاؤنٹ",
  },
  infoModal: {
    title: "تلاش رہنما",
    whatsapp: "واٹس ایپ پر رابطہ کریں",
    mainTitle: "تلاش کی ہدایات اور مدد",
    sections: [
      {
        heading: "پروازیں",
        body: "درست اور تیز نتائج کے لیے تین حرفی IATA کوڈ درج کریں (مثلاً KWI کویت، DXB دبئی، LHR لندن کے لیے)۔",
      },
      {
        heading: "ہوٹل",
        body: "ہوٹل کا نام براہ راست ٹائپ کریں یا شہر کا نام درج کریں اور فلٹر سے اپنا پسندیدہ ہوٹل تلاش کریں۔",
      },
      {
        heading: "تلاش کی زبان",
        body: "درست نتائج کے لیے شہروں، ہوائی اڈوں اور ہوٹلوں کے نام ہمیشہ انگریزی میں ٹائپ کریں۔",
      },
      {
        heading: "پاسپورٹ کی میعاد",
        body: "براہ کرم یقینی بنائیں کہ آپ کے پاسپورٹ کی میعاد سفر کی تاریخ سے کم از کم 6 ماہ ہو۔",
      },
      {
        heading: "لچکدار تاریخیں",
        body: "اگر سفر کی تاریخیں لچکدار ہیں تو منتخب تاریخ سے 2 دن پہلے یا بعد تلاش کریں — ہفتے کے وسط میں بہتر نرخ مل سکتے ہیں۔",
      },
      {
        heading: "تکنیکی مدد",
        body: "کسی بھی پریشانی کی صورت میں نیچے دیے گئے بٹن سے WhatsApp پر D.T. Tours کی ٹیم سے رابطہ کریں۔",
      },
    ],
  },
  specialRequests: {
    screenTitle: "خصوصی درخواستیں",
    fullName: "پورا نام",
    phone: "فون نمبر",
    email: "ای میل پتہ",
    requestType: "درخواست کی قسم",
    requestTypes: [
      "پرواز بکنگ",
      "ہوٹل بکنگ",
      "سفری پیکیج",
      "ویزا معاونت",
      "ایئرپورٹ ٹرانسفر",
      "دیگر",
    ],
    departure: "روانگی کی تاریخ",
    return: "واپسی کی تاریخ",
    passengers: "مسافر",
    adults: "بالغ",
    children: "بچے",
    infants: "شیرخوار",
    notes: "اضافی نوٹس",
    notesPlaceholder: "اپنی درخواست تفصیل سے بیان کریں...",
    submit: "درخواست بھیجیں",
    submitting: "بھیجا جا رہا ہے...",
    successTitle: "درخواست جمع ہو گئی!",
    successBody: "ہماری ٹیم 24 گھنٹوں میں آپ سے رابطہ کرے گی۔",
    done: "ٹھیک ہے",
    pickDate: "تاریخ منتخب کریں",
    day: "دن",
    month: "مہینہ",
    year: "سال",
    confirm: "تصدیق کریں",
    validationName: "براہ کرم اپنا پورا نام درج کریں۔",
    validationPhone: "براہ کرم فون نمبر درج کریں۔",
    validationRequest: "براہ کرم درخواست کی قسم منتخب کریں۔",
    validationDate: "براہ کرم روانگی کی تاریخ منتخب کریں۔",
  },
  chatbot: {
    placeholder: "سفر کے بارے میں کچھ بھی پوچھیں...",
    thinking: "سوچ رہا ہوں...",
    errorRetry: "کچھ غلط ہوا۔ دوبارہ کوشش کریں۔",
  },
};

const TL: Translations = {
  tabs: {
    home: "Home",
    trips: "Pakete",
    bookings: "Booking",
    settings: "Makipag-ugnayan",
    requests: "Hiling",
    profile: "Account",
  },
  infoModal: {
    title: "Gabay sa Paghahanap",
    whatsapp: "Makipag-ugnayan sa WhatsApp",
    mainTitle: "Mga Alituntunin sa Paghahanap at Suporta",
    sections: [
      {
        heading: "Mga Lipad",
        body: "Para sa mas tumpak na resulta, ilagay ang tatlong-titik na IATA code ng paliparan (hal. KWI para Kuwait, DXB para Dubai, LHR para London).",
      },
      {
        heading: "Mga Hotel",
        body: "I-type ang pangalan ng hotel nang direkta o ang pangalan ng lungsod at gamitin ang mga filter upang mahanap ang iyong nais na tirahan.",
      },
      {
        heading: "Wika ng Paghahanap",
        body: "Para sa tumpak na resulta, palaging i-type ang mga lungsod, paliparan, at hotel sa Ingles.",
      },
      {
        heading: "Bisa ng Pasaporte",
        body: "Tiyaking ang bisa ng iyong pasaporte ay hindi bababa sa 6 na buwan mula sa iyong plano na petsa ng paglalakbay.",
      },
      {
        heading: "Mga Mahulugang Petsa",
        body: "Kung nababago ang iyong mga petsa, subukan ang paghahanap 2 araw bago o pagkatapos ng iyong napiling petsa — may mas murang presyo sa kalagitnaan ng linggo.",
      },
      {
        heading: "Teknikal na Suporta",
        body: "Para sa anumang katanungan, makipag-ugnayan sa aming D.T. Tours support team sa pamamagitan ng WhatsApp sa pindutan sa ibaba.",
      },
    ],
  },
  specialRequests: {
    screenTitle: "Mga Espesyal na Hiling",
    fullName: "Buong Pangalan",
    phone: "Numero ng Telepono",
    email: "Email Address",
    requestType: "Uri ng Hiling",
    requestTypes: [
      "Booking ng Lipad",
      "Booking ng Hotel",
      "Travel Package",
      "Tulong sa Visa",
      "Airport Transfer",
      "Iba pa",
    ],
    departure: "Petsa ng Pag-alis",
    return: "Petsa ng Pagbabalik",
    passengers: "Mga Pasahero",
    adults: "Matatanda",
    children: "Mga Bata",
    infants: "Mga Sanggol",
    notes: "Karagdagang Tala",
    notesPlaceholder: "Ilarawan ang iyong hiling nang detalyado...",
    submit: "Isumite ang Hiling",
    submitting: "Isinusumite...",
    successTitle: "Naisumite ang Hiling!",
    successBody: "Makikipag-ugnayan ang aming koponan sa loob ng 24 na oras.",
    done: "Tapos",
    pickDate: "Pumili ng Petsa",
    day: "Araw",
    month: "Buwan",
    year: "Taon",
    confirm: "Kumpirmahin",
    validationName: "Mangyaring ilagay ang iyong buong pangalan.",
    validationPhone: "Mangyaring ilagay ang iyong numero ng telepono.",
    validationRequest: "Mangyaring pumili ng uri ng hiling.",
    validationDate: "Mangyaring pumili ng petsa ng pag-alis.",
  },
  chatbot: {
    placeholder: "Magtanong tungkol sa paglalakbay...",
    thinking: "Nag-iisip...",
    errorRetry: "May nangyaring mali. Subukan muli.",
  },
};

export const TRANSLATIONS: Record<LangCode, Translations> = {
  en: EN,
  ar: AR,
  hi: HI,
  ur: UR,
  tl: TL,
};

export function t(lang: LangCode): Translations {
  return TRANSLATIONS[lang] ?? TRANSLATIONS.en;
}
