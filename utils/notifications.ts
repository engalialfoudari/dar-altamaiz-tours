import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

// expo-notifications is intentionally NOT imported at the top level.
// A static import crashes Android Expo Go (SDK 53+) before any try/catch runs.
// All usage is via guarded dynamic require() inside the function body only.
import type * as NotificationsType from "expo-notifications";

/**
 * Returns true when running inside Expo Go (the store client).
 * In Expo Go SDK 53+, expo-notifications remote push is fully removed —
 * even a dynamic require() fires a native-level warning before any JS
 * try/catch can intercept it. Skip the require entirely in this env.
 */
function isExpoGo(): boolean {
  return Constants.executionEnvironment === "storeClient";
}

/**
 * AsyncStorage key that tracks when we last ran cancel+reschedule.
 * We throttle rescheduling to once per 12 hours so that normal app
 * use (switching tabs, backgrounding briefly) does NOT reset the
 * 3-day inactivity timer.
 */
const LAST_SCHEDULED_KEY = "push_last_scheduled_v1";
const RESCHEDULE_THROTTLE_MS = 12 * 60 * 60 * 1000; // 12 hours

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
  {
    ar: "حافظ على وقتك واستخدم ذكائنا الصناعي في البحث عن رحلاتكم القادمة",
    en: "Save your time and use our Artificial Intelligence to search for your upcoming trips",
  },
  {
    ar: "استخدم ذكائنا الصناعي في تخطيط رحلتك القادمة بكل سهولة",
    en: "Use our AI to plan your next trip with ease",
  },
  {
    ar: "استفسر عن اخر اخبار السفر والقوانين مع مساعدك الشخصي ( DT. Tours Ai )",
    en: "Ask about the latest travel news and regulations with your personal assistant ( DT. Tours Ai )",
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
export async function requestNotificationPermissions(): Promise<void> {
  if (Platform.OS === "web") return;
  if (isExpoGo()) return;
  let N: typeof NotificationsType | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    N = require("expo-notifications") as typeof NotificationsType;
  } catch { return; }
  if (!N) return;
  type PermResult = { granted: boolean; canAskAgain: boolean };
  const existing = (await N.getPermissionsAsync()) as unknown as PermResult;
  if (!existing.granted && existing.canAskAgain) {
    await N.requestPermissionsAsync();
  }
}

export async function scheduleRetentionNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  if (isExpoGo()) return;

  // ── Throttle ────────────────────────────────────────────────────────────────
  // cancelAllScheduledNotificationsAsync() + reschedule resets the 3-day timer.
  // Without this guard, every foreground transition or tab navigation would
  // wipe pending notifications and restart the countdown from zero, meaning
  // the "inactive for 3 days" notification could never fire while the user
  // keeps the app installed.
  // Allow rescheduling at most once every 12 hours.
  try {
    const lastRaw = await AsyncStorage.getItem(LAST_SCHEDULED_KEY);
    if (lastRaw) {
      const elapsed = Date.now() - parseInt(lastRaw, 10);
      if (elapsed < RESCHEDULE_THROTTLE_MS) return; // skip — notifications intact
    }
  } catch { /* AsyncStorage failure is non-fatal; continue to schedule */ }

  // Dynamically load the module so that if expo-notifications throws on
  // initialisation (Expo Go / Android SDK 53+) the error is caught here
  // and the rest of the app continues running normally.
  let N: typeof NotificationsType | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    N = require("expo-notifications") as typeof NotificationsType;
  } catch {
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
    if (!granted) return;

    await N.cancelAllScheduledNotificationsAsync();

    const schedule = async (daysFromNow: number, msgIndex: number): Promise<void> => {
      const date = getWindowedDate(daysFromNow);
      const msg = MESSAGES[msgIndex % MESSAGES.length];
      await N!.scheduleNotificationAsync({
        content: {
          title: "رحلات دار التميز",
          body: `${msg.ar}\n${msg.en}`,
          sound: true,
        },
        trigger: {
          type: N!.SchedulableTriggerInputTypes.DATE,
          date,
        },
      });
    };

    await schedule(3, 10);
    await schedule(6, 11);
    await schedule(9, 12);
    await schedule(7, 0);
    await schedule(21, 1);
    for (let i = 0; i < 12; i++) {
      await schedule(51 + i * 30, 2 + i);
    }

    // Save the timestamp so the throttle check above works next time.
    await AsyncStorage.setItem(LAST_SCHEDULED_KEY, String(Date.now()));

  } catch (err) {
    // Log the error so it shows in Expo logs / crash reports.
    // Don't rethrow — a notification failure must never crash the app.
    console.error("[notifications] scheduleRetentionNotifications failed:", err);
  }
}
