import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@clerk/expo";

type ConsentLocale = "ar" | "en" | "tr";
export type ConsentResult = "accepted" | "declined" | "stale";
export const AI_CONSENT_VERSION = "2026-10-09";

export function aiConsentFailure(body: { error?: string; requiredVersion?: string }): "consent" | "update" | null {
  if (body.error !== "ai_consent_required") return null;
  return body.requiredVersion === AI_CONSENT_VERSION ? "consent" : "update";
}

export const aiConsentErrorCopy = {
  en: {
    consent: "Your AI request could not be verified. Tap Retry to build your package using the sharing notice shown below.",
    update: "This app needs an update to show the latest AI privacy notice. Update DT Tours and reopen it, then allow AI sharing. Ordinary travel search and booking are still available.",
  },
  ar: {
    consent: "تعذر التحقق من طلب الذكاء الاصطناعي. اضغط «إعادة المحاولة» لإنشاء باقتك وفق إشعار المشاركة أدناه.",
    update: "يحتاج التطبيق إلى تحديث لعرض أحدث إشعار لخصوصية الذكاء الاصطناعي. حدّث تطبيق دار التميز تورز وأعد فتحه، ثم وافق على المشاركة. يظل البحث والحجز العاديان متاحين.",
  },
  tr: {
    consent: "Yapay zekâ isteğiniz doğrulanamadı. Aşağıdaki paylaşım bildirimiyle paketinizi oluşturmak için Tekrar Dene’ye dokunun.",
    update: "En güncel yapay zekâ gizlilik bildirimini göstermek için uygulama güncellenmelidir. DT Tours’u güncelleyip yeniden açın ve veri paylaşımına izin verin. Normal seyahat arama ve rezervasyon kullanılabilir.",
  },
};

/** Send only after an explicit Build/Send action beside the inline sharing notice. */
export function aiConsentHeaders(locale: ConsentLocale) {
  return {
    "x-ai-consent-version": AI_CONSENT_VERSION,
    "x-ai-consent-locale": locale,
  };
}

export const aiConsentCopy = {
  en: {
    title: "Allow AI data sharing?",
    body: "AI responses use Google Gemini through Replit. Your display name (if provided), up to 20 recent chat messages, or trip-builder preferences are sent to these providers to generate the response. Do not include passwords, passport numbers or payment details. You can decline and still use ordinary travel search and booking. Permission lasts for this feature session; closing the feature or switching accounts resets it.",
    allow: "Allow AI",
    decline: "Not now",
  },
  ar: {
    title: "هل تسمح بمشاركة البيانات مع الذكاء الاصطناعي؟",
    body: "تستخدم الإجابات الذكية \u2066Google Gemini\u2069 عبر \u2066Replit\u2069. يُرسل اسم العرض إن أدخلته، وما يصل إلى 20 رسالة حديثة، أو تفضيلات منشئ الرحلات إلى هذين المزوّدين لإنشاء الإجابة. لا تُدخل كلمات مرور أو أرقام جوازات أو تفاصيل دفع. يمكنك الرفض والاستمرار في البحث والحجز العاديين. الإذن لهذه الجلسة فقط؛ يُعاد طلبه بعد إغلاق الميزة أو تغيير الحساب.",
    allow: "السماح بالذكاء الاصطناعي",
    decline: "ليس الآن",
  },
  tr: {
    title: "Yapay zekâ ile veri paylaşımına izin verilsin mi?",
    body: "Yapay zekâ yanıtları Replit üzerinden Google Gemini kullanır. Yanıt oluşturmak için görünen adınız (belirttiyseniz), son 20 sohbet mesajına kadar olan içerik veya seyahat oluşturucu tercihleriniz bu sağlayıcılara gönderilir. Şifre, pasaport numarası veya ödeme bilgisi paylaşmayın. Reddedip normal seyahat arama ve rezervasyon özelliklerini kullanabilirsiniz. İzin yalnızca bu özellik oturumu içindir; özelliği kapatmak veya hesap değiştirmek izni sıfırlar.",
    allow: "İzin ver",
    decline: "Şimdi değil",
  },
};

/** Non-modal disclosure: Build/Send is the user's sharing action, never opening a feature. */
export const aiSharingNotice = {
  en: {
    builder: "By tapping Build or Retry, you agree to share your trip preferences with Google Gemini via Replit to create your package. Do not enter sensitive information.",
    chat: "By sending, you agree to share your display name and up to 20 recent messages with Google Gemini via Replit for AI replies. Do not send sensitive information.",
  },
  ar: {
    builder: "بالضغط على إنشاء أو إعادة المحاولة، توافق على مشاركة تفضيلات رحلتك مع Google Gemini عبر Replit لإنشاء باقتك. لا تُدخل معلومات حساسة.",
    chat: "بإرسال رسالتك، توافق على مشاركة اسم العرض وما يصل إلى 20 رسالة حديثة مع Google Gemini عبر Replit للرد بالذكاء الاصطناعي. لا ترسل معلومات حساسة.",
  },
  tr: {
    builder: "Oluştur veya Tekrar Dene’ye dokunarak paketinizi hazırlamak için seyahat tercihlerinizi Replit üzerinden Google Gemini ile paylaşmayı kabul edersiniz. Hassas bilgi girmeyin.",
    chat: "Göndererek yapay zekâ yanıtları için görünen adınızı ve en son 20 mesajınızı Replit üzerinden Google Gemini ile paylaşmayı kabul edersiniz. Hassas bilgi göndermeyin.",
  },
};

/** Memory-only permission: never reuse another account's or closed session's consent. */
export class AiConsentGate {
  private scope: string | null = null;
  private generation = 0;
  private accepted = false;
  private pending = false;

  constructor(private readonly prompt: (locale: ConsentLocale) => Promise<boolean>) {}

  setScope(scope: string | null) {
    if (scope === this.scope) return;
    this.scope = scope;
    this.generation++;
    this.accepted = false;
    this.pending = false;
  }

  /** A rejected assertion must be reviewed again, only in its original session. */
  renew(expectedScope: string | null) {
    if (!expectedScope || expectedScope !== this.scope) return;
    this.generation++;
    this.accepted = false;
    this.pending = false;
  }

  async request(locale: ConsentLocale, expectedScope: string | null): Promise<ConsentResult> {
    if (!expectedScope || expectedScope !== this.scope || this.pending) return "stale";
    if (this.accepted) return "accepted";
    const generation = this.generation;
    this.pending = true;
    try {
      const accepted = await this.prompt(locale);
      if (generation !== this.generation || expectedScope !== this.scope) return "stale";
      this.accepted = accepted;
      return accepted ? "accepted" : "declined";
    } catch {
      return generation === this.generation ? "declined" : "stale";
    } finally {
      if (generation === this.generation) this.pending = false;
    }
  }
}

export function useAiConsent(visible: boolean, locale: ConsentLocale, subject = "") {
  const { sessionId, userId } = useAuth();
  const gateRef = useRef<AiConsentGate | null>(null);
  // Called only from Build/Send handlers whose controls display aiSharingNotice.
  // Never show an Alert/confirm, including after reopening, account changes or retries.
  if (!gateRef.current) gateRef.current = new AiConsentGate(async () => true);
  const gate = gateRef.current;
  const scope = visible ? JSON.stringify([userId ?? "guest", sessionId ?? "", subject]) : null;
  gate.setScope(scope);
  useEffect(() => {
    gate.setScope(scope);
    return () => gate.setScope(null);
  }, [gate, scope]);
  return useCallback((renew = false) => {
    if (renew) gate.renew(scope);
    return gate.request(locale, scope);
  }, [gate, locale, scope]);
}
