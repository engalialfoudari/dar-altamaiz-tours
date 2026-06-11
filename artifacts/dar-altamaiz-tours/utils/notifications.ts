import { Platform } from "react-native";

// expo-notifications is intentionally NOT imported at the top level.
// A static import crashes Android Expo Go (SDK 53+) before any try/catch runs.
// All usage is via guarded dynamic require() inside the function body only.
import type * as NotificationsType from "expo-notifications";

const MESSAGES: Array<{ ar: string; en: string }> = [
  {
    ar: "تابع عروض دار التميز الحصرية، وخطط لرحلتك القادمة بأفضل الأسعار المتاحة",
    en: "Follow Dar AlTamaiz exclusive offers, and plan your next trip with the best available rates.",
  },
  {
    ar: "تصفح مقترحاتنا الفاخرة لرحلات السفر اليوم",
    en: "Where to next? Open the app and explore our luxury travel curation.",
  },
  {
    ar: "رحلتك القادمة تبدأ من هنا.. تصفح أفضل خيارات الفنادق ورحلات الطيران المتوفرة الآن",
    en: "Your next journey starts here. Browse the best hotel and flight options available now.",
  },
  {
    ar: "سافر براحة بال مطلقة.. خدماتنا المتكاملة بانتظار تشريفك بلمسة واحدة",
    en: "Travel with peace of mind. Our complete bespoke services are ready for you.",
  },
  {
    ar: "عطلتك الفاخرة القادمة بانتظارك.. احجز الآن واستمتع بمميزات الاسترداد النقدي",
    en: "A premium holiday awaits. Book now and enjoy exclusive cashback benefits.",
  },
  {
    ar: "نتطلع لخدمتك دائماً.. تواصل مع مستشاري السفر لدينا لتخطيط رحلتك القادمة",
    en: "Always honored to serve you. Connect with our travel experts for your next tour.",
  },
  {
    ar: "يسعدنا دائماً أن نكون جزءاً من ذكرياتك.. دار التميز، شريك سفرك الموثوق منذ 2008",
    en: "We are always proud to be part of your memories. Your trusted travel partner since 2008.",
  },
  {
    ar: "خطط لرحلتك القادمة بتميز.. تواصل معنا الآن لترتيب برنامجك السياحي المتكامل",
    en: "Plan with excellence. Connect with us now to arrange your complete travel itinerary.",
  },
  {
    ar: "هل تخطط لرحلتك القادمة؟ دار التميز في خدمتك دائماً بأفضل العروض والباقات السياحية",
    en: "Planning your next trip? Dar AlTamaiz is always at your service with the finest travel packages.",
  },
  {
    ar: "جدول أعمالك مزدحم؟ رتب رحلتك القادمة بثوانٍ معدودة ودع الباقي علينا",
    en: "Busy schedule? Arrange your next luxury tour in seconds and leave the rest to us.",
  },
];

/**
 * Returns a random Date between 4:00 PM and 6:59 PM local time,
 * exactly daysFromNow days from today. Rolls forward one day if already past.
 */
function getWindowedDate(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const hour = 16 + Math.floor(Math.random() * 3);
  const minute = Math.floor(Math.random() * 60);
  date.setHours(hour, minute, 0, 0);
  if (date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
    date.setHours(16 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0);
  }
  return date;
}

/**
 * Schedule the 3-tier retention notification sequence.
 * Tier 1 — Day 7   (single, 4–7 PM)
 * Tier 2 — Day 21  (single, 4–7 PM)
 * Tier 3 — Days 51, 81, 111 … every 30 days × 12 cycles (4–7 PM each)
 *
 * Safe to call on every cold start. Cancels any previously scheduled
 * notifications before re-scheduling.
 */
export async function scheduleRetentionNotifications(): Promise<void> {
  // Completely bypass on Android — expo-notifications crashes Expo Go on
  // Android (SDK 53+). Re-enable for production APK/AAB when using a
  // development build instead of Expo Go.
  if (Platform.OS === "android") return;
  if (Platform.OS === "web") return;

  // Dynamically load the module so that if expo-notifications throws on
  // initialisation (Expo Go / Android SDK 53+) the error is caught here
  // and the rest of the app continues running normally.
  let N: typeof NotificationsType | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    N = require("expo-notifications") as typeof NotificationsType;
  } catch (e) {
    console.log("[Notifications] expo-notifications not available in this environment — skipping schedule.");
    return;
  }
  if (!N) return;

  try {
    type PermResult = { granted: boolean; canAskAgain: boolean };

    const existing = (await N.getPermissionsAsync()) as unknown as PermResult;
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const asked = (await N.requestPermissionsAsync()) as unknown as PermResult;
      granted = asked.granted;
    }
    if (!granted) {
      console.log("[Notifications] Permission not granted — skipping schedule.");
      return;
    }

    await N.cancelAllScheduledNotificationsAsync();

    const schedule = async (daysFromNow: number, msgIndex: number): Promise<void> => {
      const date = getWindowedDate(daysFromNow);
      const msg = MESSAGES[msgIndex % MESSAGES.length];
      await N!.scheduleNotificationAsync({
        content: {
          title: "دار التميز للسياحة",
          body: `${msg.ar}\n${msg.en}`,
          sound: true,
        },
        trigger: {
          type: N!.SchedulableTriggerInputTypes.DATE,
          date,
        },
      });
      const ts =
        `${date.getFullYear()}-` +
        `${String(date.getMonth() + 1).padStart(2, "0")}-` +
        `${String(date.getDate()).padStart(2, "0")} ` +
        `${String(date.getHours()).padStart(2, "0")}:` +
        `${String(date.getMinutes()).padStart(2, "0")}`;
      console.log(`[Notifications] Scheduled — day ${daysFromNow}, ${ts} local, msg #${(msgIndex % MESSAGES.length) + 1}`);
    };

    await schedule(7, 0);
    await schedule(21, 1);
    for (let i = 0; i < 12; i++) {
      await schedule(51 + i * 30, 2 + i);
    }

    console.log("[Notifications] Complete: Tier1=day7, Tier2=day21, Tier3=days51-381 (16:00-18:59 local)");
  } catch (err) {
    console.warn("[Notifications] Scheduling error (non-fatal):", err);
  }
}
