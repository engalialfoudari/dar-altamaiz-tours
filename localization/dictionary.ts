import p0 from "./tr/part-0.json";
import p1 from "./tr/part-1.json";
import p2 from "./tr/part-2.json";
import p3 from "./tr/part-3.json";
import p4 from "./tr/part-4.json";
import p5 from "./tr/part-5.json";
import p6 from "./tr/part-6.json";
import p7 from "./tr/part-7.json";
import p8 from "./tr/part-8.json";
import p9 from "./tr/part-9.json";
import p10 from "./tr/part-10.json";
import p11 from "./tr/part-11.json";
import p12 from "./tr/part-12.json";
import p13 from "./tr/part-13.json";
import p14 from "./tr/part-14.json";
import p15 from "./tr/part-15.json";
import p16 from "./tr/part-16.json";
import p17 from "./tr/part-17.json";
import p18 from "./tr/part-18.json";
import p19 from "./tr/part-19.json";

export const turkishCopy: Record<string, string> = Object.assign(
  {}, p0, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19,
  {
    English: "İngilizce", Arabic: "Arapça", Turkish: "Türkçe", EN: "İngilizce", عربي: "Arapça",
    completed: "Tamamlandı", payment_pending: "Ödeme bekleniyor", fulfillment_pending: "Hazırlanıyor",
    pending_review: "İnceleme gerekiyor", payment_failed: "Ödeme başarısız", confirmed: "Onaylandı",
    cancelled: "İptal edildi", pending: "Bekliyor", failed: "Başarısız",
    OK: "Tamam", DONE: "Bitti", YES: "Evet", NO: "Hayır", AI: "Yapay zekâ",
    ECONOMY: "Ekonomi", BUSINESS: "İş sınıfı", FIRST: "Birinci sınıf",
    PAID: "Ödendi", PENDING: "Bekliyor", CANCELLED: "İptal edildi", COMPLETED: "Tamamlandı",
    FAILED: "Başarısız", FREE: "Ücretsiz", PREMIUM: "Üst paket", UNLIMITED: "Sınırsız",
    day: "gün", days: "gün", night: "gece", nights: "gece", hour: "saat", hours: "saat",
    minute: "dakika", minutes: "dakika", unlimited: "sınırsız",
    Su: "Paz", Mo: "Pzt", Tu: "Sal", We: "Çar", Th: "Per", Fr: "Cum", Sa: "Cmt",
  },
);