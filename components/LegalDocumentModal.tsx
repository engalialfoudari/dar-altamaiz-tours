import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HotelPortalIcon } from "@/components/HotelPortalIcon";

type Language = "en" | "ar";
export type LegalDocumentType = "privacy" | "terms";

type LegalSection = {
  title: string;
  body: string;
};

type LegalDocument = {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
  contact: string;
};

const colors = {
  navy: "#003580",
  navySoft: "#EAF2FF",
  ink: "#1E293B",
  muted: "#64748B",
  border: "#D9E0E8",
  canvas: "#F2F2F2",
  card: "#FFFFFF",
};

const isolateLtr = (value: string) => `\u2066${value}\u2069`;

const DOCUMENTS: Record<Language, Record<LegalDocumentType, LegalDocument>> = {
  en: {
    privacy: {
      title: "Privacy Policy",
      intro:
        "This policy explains how Dar AlTamaiz Tours and the licensed travel providers operating through this app handle your personal information.",
      updated: "Last updated: 4 September 2026",
      sections: [
        {
          title: "1. Information we collect",
          body:
            "We may collect your name, email address, phone number, account and authentication details, travel dates, routes, hotel choices, passenger and booking details, messages, and special requests. When needed for a booking, you may also provide passport names, passport numbers, nationality, or other travel-document information. The app may store contact details on your device to make future forms easier to complete.",
        },
        {
          title: "2. How we use information",
          body:
            "We use information to answer enquiries, prepare quotes, create and service bookings, verify payments, issue confirmations and travel documents, provide customer support, send service notifications, manage accounts and loyalty benefits, prevent fraud, secure the service, meet legal and accounting duties, and improve service reliability.",
        },
        {
          title: "3. Who receives information",
          body:
            "We share only the information reasonably needed with airlines, hotels, tour operators, booking and technology suppliers, payment processors, email and notification providers, professional advisers, regulators, and authorities where required. Suppliers may process information in other countries under their own privacy terms. Special-request details may also be sent to our authorised staff by email for review.",
        },
        {
          title: "4. Payments",
          body:
            "Online payments are processed through a third-party payment gateway. The gateway handles payment credentials under its own terms. We keep payment references, status, amount, and related booking details so we can verify payment and support the booking.",
        },
        {
          title: "5. Retention",
          body:
            "Special-request passport and traveler details are retained for 90 days after closure. Unfinished requests are retained for 12 months. Legally required booking, payment, refund, supplier, accounting, fraud, and loyalty records are retained for 10 years; nonessential personal information is anonymized after 90 days when safe. Active accounts are retained until deletion. Inactive accounts are reviewed after 3 years; accounts with bookings, balances, or holds are not deleted automatically. Device registrations are retained for 12 months of inactivity and until a deletion request. Chats and session identifiers are retained for 12 months. Raw search analytics are retained for 3 years. App and error logs are retained for 90 days, except security and fraud logs, which are retained for 12 months. Expired temporary authentication records are deleted within 24 hours. Legal holds pause deletion.",
        },
        {
          title: "6. Your choices and requests",
          body:
            "Please provide only information needed for your enquiry or booking. Subject to applicable law and necessary booking, legal, or record-keeping restrictions, you may ask to access, correct, or delete your personal information, or object to certain uses. Submit requests through your signed-in Account or email info@dt-tour.com; we verify identity before acting. We retain a non-identifying audit of requests for 6 years.",
        },
        {
          title: "7. Security and updates",
          body:
            "We use reasonable administrative and technical safeguards, but no internet or storage system can be guaranteed completely secure. We may update this policy when our services or legal obligations change; the date above shows the current version.",
        },
      ],
      contact:
        "info@dt-tour.com",
    },
    terms: {
      title: "Terms & Booking Conditions",
      intro:
        "These conditions apply when you search, request, reserve, or pay for travel services through the DT Tours app.",
      updated: "Last updated: 4 September 2026",
      sections: [
        {
          title: "1. Travel service providers",
          body:
            "Flight services and airline ticket issuance are operated by Max Travel & Tourism Co., DGCA License No. 2021/20304 and IATA Code 42228745. Tours, packages, and concierge services are operated by Dar AlTamaiz Tours under Commercial License No. 7517/2024. Airlines, hotels, tour operators, and other suppliers also apply their own conditions.",
        },
        {
          title: "2. Prices and availability",
          body:
            "Search results, descriptions, schedules, room features, prices, taxes, and availability may change until the supplier confirms the booking. Currency conversion and applicable service or payment charges may be included in the final total. Review the final itinerary, passenger details, rate rules, amount, currency, and included services before paying.",
        },
        {
          title: "3. When a booking is confirmed",
          body:
            "Submitting a request or payment does not by itself guarantee a reservation. A booking is confirmed only when we or the relevant supplier provide an explicit booking confirmation, confirmation number, voucher, or issued ticket. If payment succeeds but confirmation remains pending, do not pay again; check My Bookings and contact us with the payment reference.",
        },
        {
          title: "4. Payment",
          body:
            "You authorise the stated payment or deposit when you continue through checkout. A deposit may leave a balance payable by the stated deadline. We may verify payment status with the payment provider before processing a booking. A failed, declined, expired, cancelled, reversed, or unverifiable payment does not confirm a booking.",
        },
        {
          title: "5. Changes, cancellations, and refunds",
          body:
            "Eligibility, deadlines, fees, penalties, and refund timing depend on the selected airline fare, hotel rate, package, payment method, and supplier rules. Non-refundable services may not qualify for a refund. Contact us promptly with your booking details. No change, cancellation, or refund is final until approved and confirmed; supplier, fare difference, and service charges may apply.",
        },
        {
          title: "6. Traveller details and documents",
          body:
            "You are responsible for giving complete and accurate names exactly as shown on travel documents, passenger information, dates, contact details, and special requirements. You must check passport validity, visas, transit, health, baggage, and destination-entry rules. Costs or losses caused by incorrect details or missing documents may be your responsibility.",
        },
        {
          title: "7. Special requests",
          body:
            "Meal, accessibility, bedding, adjoining-room, celebration, group, and other special requests are passed on where possible but are not guaranteed unless the supplier confirms them. A custom-trip enquiry is a request for review and is not a booking or price guarantee.",
        },
        {
          title: "8. Supplier changes and responsibility",
          body:
            "Schedules, aircraft, rooms, facilities, and services may be changed or cancelled by suppliers or due to events outside reasonable control. We will provide reasonable assistance, but remedies and alternatives remain subject to applicable law and supplier conditions. Nothing in these terms excludes rights that cannot legally be excluded.",
        },
        {
          title: "9. Contact and acceptance",
          body:
            "By completing a booking or payment, you confirm that you reviewed and accepted the displayed service details, price, cancellation or refund rules, these conditions, and the relevant supplier terms for yourself and all travellers in the booking.",
        },
      ],
      contact:
        "info@dt-tour.com",
    },
  },
  ar: {
    privacy: {
      title: "سياسة الخصوصية",
      intro:
        "توضح هذه السياسة كيفية تعامل دار التميز تورز ومقدمي خدمات السفر المرخصين العاملين عبر هذا التطبيق مع معلوماتك الشخصية.",
      updated: "آخر تحديث: 4 سبتمبر 2026",
      sections: [
        {
          title: "1. المعلومات التي نجمعها",
          body:
            "قد نجمع اسمك وبريدك الإلكتروني ورقم هاتفك وبيانات الحساب وتسجيل الدخول وتواريخ السفر وخط السير واختيارات الفنادق وبيانات المسافرين والحجز والرسائل والطلبات الخاصة. وعند الحاجة لإتمام الحجز، قد تزودنا أيضاً بالأسماء حسب جواز السفر وأرقام الجوازات والجنسية أو معلومات وثائق سفر أخرى. وقد يحفظ التطبيق بيانات التواصل على جهازك لتسهيل تعبئة النماذج مستقبلاً.",
        },
        {
          title: "2. كيفية استخدام المعلومات",
          body:
            "نستخدم المعلومات للرد على الاستفسارات وإعداد العروض وإنشاء الحجوزات وخدمتها والتحقق من المدفوعات وإصدار التأكيدات ووثائق السفر وتقديم الدعم وإرسال إشعارات الخدمة وإدارة الحسابات ومزايا الولاء ومنع الاحتيال وحماية الخدمة والوفاء بالمتطلبات القانونية والمحاسبية وتحسين موثوقية الخدمة.",
        },
        {
          title: "3. الجهات التي تتلقى المعلومات",
          body:
            "نشارك فقط المعلومات اللازمة بصورة معقولة مع شركات الطيران والفنادق ومنظمي الرحلات وموردي الحجز والتقنية ومعالجي الدفع ومزودي البريد الإلكتروني والإشعارات والمستشارين والجهات التنظيمية والسلطات عند اللزوم. وقد يعالج الموردون المعلومات في دول أخرى وفق سياسات الخصوصية الخاصة بهم. كما قد تُرسل تفاصيل الطلبات الخاصة بالبريد الإلكتروني إلى موظفينا المخولين لمراجعتها.",
        },
        {
          title: "4. المدفوعات",
          body:
            "تتم معالجة المدفوعات الإلكترونية من خلال بوابة دفع خارجية تتعامل مع بيانات الدفع وفق شروطها. ونحتفظ بمراجع الدفع وحالته ومبلغه وبيانات الحجز المرتبطة به للتحقق من الدفع وخدمة الحجز.",
        },
        {
          title: "5. مدة الاحتفاظ",
          body:
            "تُحتفظ بتفاصيل جواز السفر والمسافر الخاصة بالطلبات الخاصة لمدة 90 يوماً بعد إغلاق الطلب. وتُحتفظ بالطلبات غير المكتملة لمدة 12 شهراً. وتُحتفظ بسجلات الحجز والدفع والاسترداد والموردين والمحاسبة والاحتيال والولاء المطلوبة قانوناً لمدة 10 سنوات، وتُخفى هوية المعلومات الشخصية غير الضرورية بعد 90 يوماً عندما يكون ذلك آمناً. تبقى الحسابات النشطة حتى طلب حذفها. وتُراجع الحسابات غير النشطة بعد 3 سنوات؛ ولا تُحذف الحسابات التي لها حجوزات أو أرصدة أو قيود تلقائياً. تُحتفظ بتسجيلات الأجهزة لمدة 12 شهراً من عدم النشاط وإلى حين طلب الحذف. وتُحتفظ بالمحادثات ومعرّفات الجلسات لمدة 12 شهراً. وتُحتفظ بتحليلات البحث الخام لمدة 3 سنوات. وتُحتفظ بسجلات التطبيق والأخطاء لمدة 90 يوماً، باستثناء سجلات الأمان والاحتيال التي تُحتفظ لمدة 12 شهراً. تُحذف سجلات المصادقة المؤقتة المنتهية خلال 24 ساعة. وتوقف القيود القانونية الحذف.",
        },
        {
          title: "6. خياراتك وطلباتك",
          body:
            "يرجى تقديم المعلومات اللازمة فقط للاستفسار أو الحجز. ووفقاً للقانون المعمول به وقيود الحجز أو المتطلبات القانونية وحفظ السجلات، يمكنك طلب الاطلاع على معلوماتك الشخصية أو تصحيحها أو حذفها أو الاعتراض على بعض أوجه استخدامها. قدّم الطلب من خلال الحساب المسجل الدخول أو عبر info@dt-tour.com؛ ونتحقق من الهوية قبل تنفيذ الطلب. ونحتفظ بسجل تدقيق غير معرّف للطلبات لمدة 6 سنوات.",
        },
        {
          title: "7. الأمان والتحديثات",
          body:
            "نستخدم إجراءات إدارية وتقنية معقولة للحماية، لكن لا يمكن ضمان الأمان الكامل لأي نظام عبر الإنترنت أو نظام تخزين. وقد نحدث هذه السياسة عند تغير خدماتنا أو التزاماتنا القانونية، ويبين التاريخ أعلاه النسخة الحالية.",
        },
      ],
      contact:
        isolateLtr("info@dt-tour.com"),
    },
    terms: {
      title: "الشروط وأحكام الحجز",
      intro:
        "تسري هذه الشروط عند البحث عن خدمات السفر أو طلبها أو حجزها أو دفع قيمتها عبر تطبيق DT Tours.",
      updated: "آخر تحديث: 4 سبتمبر 2026",
      sections: [
        {
          title: "1. مقدمو خدمات السفر",
          body:
            "تُدار خدمات الطيران وإصدار التذاكر من خلال شركة ماكس للسياحة والسفر، ترخيص الإدارة العامة للطيران المدني رقم 2021/20304 ورمز IATA رقم 42228745. وتُدار الرحلات السياحية والباقات وخدمات الكونسيرج من خلال دار التميز تورز بموجب الترخيص التجاري رقم 7517/2024. كما تطبق شركات الطيران والفنادق ومنظمو الرحلات والموردون الآخرون شروطهم الخاصة.",
        },
        {
          title: "2. الأسعار والتوفر",
          body:
            "قد تتغير نتائج البحث والأوصاف والمواعيد ومزايا الغرف والأسعار والضرائب والتوفر إلى أن يؤكد المورد الحجز. وقد يشمل المبلغ النهائي تحويل العملة ورسوم الخدمة أو الدفع المطبقة. راجع خط السير النهائي وبيانات المسافرين وشروط السعر والمبلغ والعملة والخدمات المشمولة قبل الدفع.",
        },
        {
          title: "3. متى يصبح الحجز مؤكداً",
          body:
            "لا يضمن تقديم الطلب أو الدفع وحده إتمام الحجز. لا يصبح الحجز مؤكداً إلا عند إصدار تأكيد صريح أو رقم تأكيد أو قسيمة أو تذكرة من جانبنا أو من المورد المعني. إذا نجح الدفع وبقي التأكيد قيد المعالجة، فلا تدفع مرة أخرى؛ تحقق من صفحة حجوزاتي وتواصل معنا بمرجع الدفع.",
        },
        {
          title: "4. الدفع",
          body:
            "عند متابعة الدفع فإنك تفوض سداد المبلغ أو العربون الموضح. وقد يترتب على العربون رصيد متبقٍ يجب سداده في الموعد المحدد. ويجوز لنا التحقق من حالة الدفع لدى مزود الدفع قبل معالجة الحجز. ولا يؤدي الدفع الفاشل أو المرفوض أو المنتهي أو الملغى أو المعكوس أو الذي يتعذر التحقق منه إلى تأكيد الحجز.",
        },
        {
          title: "5. التعديلات والإلغاءات والاسترداد",
          body:
            "تعتمد الأهلية والمواعيد والرسوم والغرامات ومدة الاسترداد على سعر تذكرة الطيران أو الغرفة أو الباقة المحددة وطريقة الدفع وشروط المورد. وقد لا تكون الخدمات غير القابلة للاسترداد مؤهلة للاسترجاع. تواصل معنا سريعاً وأرسل تفاصيل الحجز. ولا يصبح أي تعديل أو إلغاء أو استرداد نهائياً إلا بعد الموافقة والتأكيد، وقد تطبق رسوم المورد وفروق الأسعار ورسوم الخدمة.",
        },
        {
          title: "6. بيانات المسافر ووثائقه",
          body:
            "أنت مسؤول عن تقديم الأسماء الكاملة والدقيقة كما تظهر في وثائق السفر، وبيانات المسافرين والتواريخ والتواصل والمتطلبات الخاصة. وعليك التحقق من صلاحية الجوازات والتأشيرات والترانزيت والصحة والأمتعة وشروط دخول الوجهة. وقد تتحمل التكاليف أو الخسائر الناتجة عن بيانات غير صحيحة أو وثائق ناقصة.",
        },
        {
          title: "7. الطلبات الخاصة",
          body:
            "نقوم بإحالة طلبات الوجبات أو سهولة الوصول أو الأسرّة أو الغرف المتصلة أو المناسبات أو المجموعات وغيرها متى أمكن، لكنها لا تكون مضمونة ما لم يؤكدها المورد. ويُعد طلب الرحلة المخصصة طلباً للمراجعة وليس حجزاً أو ضماناً للسعر.",
        },
        {
          title: "8. تغييرات المورد والمسؤولية",
          body:
            "يجوز للموردين تغيير أو إلغاء المواعيد أو الطائرات أو الغرف أو المرافق أو الخدمات، كما قد تقع أحداث خارجة عن السيطرة المعقولة. سنقدم مساعدة معقولة، لكن الحلول والبدائل تخضع للقانون المعمول به وشروط المورد. ولا تستبعد هذه الشروط أي حقوق لا يجوز استبعادها قانوناً.",
        },
        {
          title: "9. التواصل والقبول",
          body:
            "بإتمام الحجز أو الدفع، فإنك تؤكد أنك راجعت وقبلت تفاصيل الخدمة والسعر وشروط الإلغاء أو الاسترداد المعروضة وهذه الأحكام وشروط المورد ذات الصلة، وذلك عن نفسك وعن جميع المسافرين المشمولين بالحجز.",
        },
      ],
      contact:
        isolateLtr("info@dt-tour.com"),
    },
  },
};

export function LegalDocumentModal({
  document,
  lang,
  onClose,
}: {
  document: LegalDocumentType | null;
  lang: Language;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isRtl = lang === "ar";
  const copy = document ? DOCUMENTS[lang][document] : null;

  return (
    <Modal
      animationType="slide"
      visible={document !== null}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {copy ? (
        <View style={styles.screen}>
          <View
            style={[
              styles.header,
              { paddingTop: Math.max(insets.top, 16) },
              isRtl && styles.rowRtl,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isRtl ? `إغلاق ${copy.title}` : `Close ${copy.title}`}
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              testID="legal-document-close"
            >
              <HotelPortalIcon name="close" size={21} color={colors.navy} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, isRtl && styles.rtlText]}>{copy.title}</Text>
              <Text style={[styles.updated, isRtl && styles.rtlText]}>{copy.updated}</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, 18) + 20 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.intro, isRtl && styles.rtlText]}>{copy.intro}</Text>
            {copy.sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={[styles.sectionTitle, isRtl && styles.rtlText]}>
                  {section.title}
                </Text>
                <Text style={[styles.body, isRtl && styles.rtlText]}>{section.body}</Text>
              </View>
            ))}
            <View style={styles.contactCard}>
              <Text
                style={[styles.contact, isRtl && styles.rtlText]}
                testID="legal-document-contact"
              >
                {copy.contact}
              </Text>
            </View>
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingBottom: 15,
    paddingHorizontal: 16,
  },
  rowRtl: { flexDirection: "row-reverse" },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.navySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: {
    color: colors.ink,
    fontFamily: "Inter_700Bold",
    fontSize: 21,
    lineHeight: 28,
  },
  updated: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 2,
  },
  content: { padding: 16 },
  intro: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 14,
  },
  section: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    padding: 15,
  },
  sectionTitle: {
    color: colors.navy,
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 7,
  },
  body: {
    color: colors.ink,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 21,
  },
  contactCard: {
    backgroundColor: colors.navySoft,
    borderRadius: 12,
    marginTop: 2,
    padding: 15,
  },
  contact: {
    color: colors.navy,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    lineHeight: 21,
  },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  pressed: { opacity: 0.72 },
});