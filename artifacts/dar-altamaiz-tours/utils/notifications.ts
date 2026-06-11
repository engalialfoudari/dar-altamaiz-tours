import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const MESSAGES = [
  {
    ar: "أهلاً بك مجدداً.. وجهاتنا السياحية الجديدة باتت جاهزة ومعدة بالكامل لأجلك.",
    en: "Welcome back! Discover our newly updated premium destinations.",
    emoji: "✨",
  },
  {
    ar: "يسعدنا تواصلك معنا.. هل تخطط لرحلتك القادمة؟ دار التميز في خدمتك دائماً.",
    en: "Ready for your next getaway? Dar AlTamaiz is at your service.",
    emoji: "✈️",
  },
  {
    ar: "رحلتك القادمة تبدأ من هنا.. تصفح أفضل خيارات الفنادق ورحلات الطيران المتوفرة الآن.",
    en: "Your next journey starts here.. Browse the best hotel and flight options available now.",
    emoji: "✈️",
  },
  {
    ar: "ندعوك لأخذ قسط من الراحة.. تصفح مقترحاتنا الفاخرة لرحلات السفر اليوم.",
    en: "Where to next? Open the app and explore our premium travel guides.",
    emoji: "🗺️",
  },
  {
    ar: "سافر براحة بال مطلقة.. خدماتنا المتكاملة بانتظار تشريفك بلمسة واحدة.",
    en: "Travel with peace of mind. Complete bespoke services are ready for you.",
    emoji: "💎",
  },
  {
    ar: "عطلتك الفاخرة القادمة بانتظارك.. احجز الآن واستمتع بمميزات الاسترداد النقدي.",
    en: "A premium holiday awaits. Book now and enjoy exclusive cashback.",
    emoji: "🌊",
  },
  {
    ar: "جدول أعمالك مزدحم؟ رتب رحلتك القادمة بثوانٍ معدودة ودع الباقي علينا.",
    en: "Busy schedule? Arrange your next luxury tour in seconds.",
    emoji: "🗓️",
  },
  {
    ar: "نتطلع لخدمتك دائماً.. تواصل مع مستشاري السفر لدينا لتخطيط رحلتك القادمة.",
    en: "Always honored to serve you. Connect with our experts for your next tour.",
    emoji: "👑",
  },
  {
    ar: "يسعدنا دائماً أن نكون جزءاً من ذكرياتك.. دار التميز، شريك سفرك الموثوق منذ 2008.",
    en: "We value your presence. Your trusted travel partner since 2008.",
    emoji: "🧳",
  },
  {
    ar: "خطط لرحلتك القادمة بتميز.. تواصل معنا الآن لترتيب برنامجك السياحي المتكامل.",
    en: "Plan with excellence. Connect with us to arrange your complete itinerary.",
    emoji: "✨",
  },
];

/**
 * Returns a Date set to a random minute between 4:00 PM and 6:59 PM local time,
 * exactly `daysFromNow` days from today. If that moment has already passed today
 * (e.g. we're scheduling for day 0 after 7 PM), rolls to the next day.
 */
function getWindowedDate(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const hour = 16 + Math.floor(Math.random() * 3); // 16, 17, or 18
  const minute = Math.floor(Math.random() * 60);
  date.setHours(hour, minute, 0, 0);
  // Safety: if calculated time is in the past, push to the next day's window
  if (date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
    const h2 = 16 + Math.floor(Math.random() * 3);
    const m2 = Math.floor(Math.random() * 60);
    date.setHours(h2, m2, 0, 0);
  }
  return date;
}

/**
 * Cancel all existing scheduled notifications and schedule the full 3-tier
 * retention sequence. Must be called on every app open (cold start).
 *
 * Tier 1:  Day 7  — single notification, 4–7 PM
 * Tier 2:  Day 21 — single notification, 4–7 PM (14 days after Tier 1)
 * Tier 3:  Days 51, 81, 111 … (every 30 days) — 12 notifications, each 4–7 PM
 */
export async function scheduleRetentionNotifications(): Promise<void> {
  if (Platform.OS === "web") return;

  // Expo Go on Android removed remote notification support in SDK 53+.
  // Attempting to register there throws an uncaught red-screen crash.
  // Detect Expo Go via executionEnvironment and bail out gracefully.
  const isExpoGo =
    (Constants.executionEnvironment as string) === "storeClient";
  if (Platform.OS === "android" && isExpoGo) {
    console.log(
      "[Notifications] Expo Go/Android detected — skipping (SDK 53+ limitation)",
    );
    return;
  }

  try {
    type PermResult = { granted: boolean; canAskAgain: boolean };
    const existing = (await Notifications.getPermissionsAsync()) as unknown as PermResult;
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const result = (await Notifications.requestPermissionsAsync()) as unknown as PermResult;
      granted = result.granted;
    }
    if (!granted) {
      console.log("[Notifications] Permission not granted — skipping schedule");
      return;
    }

    // Reset: cancel every previously scheduled notification
    await Notifications.cancelAllScheduledNotificationsAsync();

    const schedule = async (daysFromNow: number, msgIndex: number) => {
      const date = getWindowedDate(daysFromNow);
      const msg = MESSAGES[msgIndex % MESSAGES.length];
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `دار التميز للسياحة  ${msg.emoji}`,
          body: `${msg.ar}\n${msg.en}`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
        },
      });
      const timeStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      console.log(`[Notifications] Tier scheduled — day ${daysFromNow}, window ${timeStr} local, msg #${msgIndex + 1}`);
    };

    // ── Tier 1 ── 7 days from today
    await schedule(7, 0);

    // ── Tier 2 ── 21 days from today (14 days after Tier 1)
    await schedule(21, 1);

    // ── Tier 3 ── Monthly continuity: days 51, 81, 111 … (up to 12 cycles)
    for (let cycle = 0; cycle < 12; cycle++) {
      const day = 51 + cycle * 30;
      await schedule(day, 2 + cycle);
    }

    console.log(
      "[Notifications] ✅ Schedule complete: Tier1=day7, Tier2=day21, Tier3=days51-381 — all windows strictly 16:00–18:59 local time",
    );
  } catch (err) {
    console.warn("[Notifications] Error during scheduling:", err);
  }
}
