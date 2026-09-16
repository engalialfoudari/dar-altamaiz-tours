import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HotelPortalIcon } from "@/components/HotelPortalIcon";

const TERMS = {
  en: [
    ["Orders and payment", "All items provided under this service are classified as complementary travel preparation accessories offered by Dar AlTamaiz Tours (DT Tours) to support and facilitate client travel experiences. An order is accepted only after payment is successfully verified. Product availability, final price, delivery charge, and payment fee are confirmed at checkout."],
    ["Delivery area and access", "Delivery is available only within Kuwait. You must provide a complete and accurate address, mobile number, and map pin. You are responsible for ensuring safe and reasonable driver access and answering delivery calls."],
    ["Delivery timing", "Standard and express times are estimates, not guarantees. Traffic, weather, stock handling, public holidays, incorrect details, and events outside our control may cause delays."],
    ["Failed delivery", "If delivery cannot be completed because the address, map pin, phone number, access instructions, or recipient availability is incorrect, a new delivery charge may apply. Repeated or abusive failed deliveries may be refused."],
    ["Returns and eligibility", "A return or exchange request must be made within 14 days of delivery. Items must be completely unused, undamaged, in their original factory-sealed packaging with all labels, seals, accessories, and proof of purchase intact."],
    ["Strict hygiene and food-contact exclusions", "For public health, hygiene, and consumer safety reasons, returns or exchanges are strictly prohibited for the following items once opened or unsealed:\n1. Food and beverage contact items (including insulated travel mugs, cups, and liquid containers).\n2. Personal care and hygiene travel items (including portable travel bidets and towels).\nExceptions are made solely for verified manufacturing defects upon delivery."],
    ["Inspection and refunds", "Returned items are inspected before approval. Refunds are issued to the original payment method after approval and may take the payment provider's processing time. Original delivery and payment fees are not refundable unless the item was defective or supplied incorrectly."],
    ["Defective or incorrect items", "Damaged or defective items must be reported within 48 hours of delivery with clear photographic proof and the order number. Approved defective items will be replaced or refunded."],
    ["Cancellations and misuse", "Cancellation is not guaranteed once preparation or dispatch begins. Fraud, abusive conduct, false claims, chargeback misuse, repeated refusal, or intentional obstruction may result in cancellation, refusal of future orders, and recovery of reasonable losses where permitted by law."],
    ["Legal rights", "Nothing in these terms excludes rights that cannot legally be excluded under Kuwait Consumer Protection Law No. 39/2014 or other applicable Kuwait law. DT Tours may update these Travel Prep Service terms for future orders; the version accepted at checkout applies to your order."],
  ],
  ar: [
    ["الطلبات والدفع", "تُقدّم جميع المنتجات والمستلزمات في هذه الخدمة كـ 'تجهيزات ومستلزمات سياحية تكميلية للمسافرين' عبر دار التميز للسياحة والسفر (DT Tours) لتسهيل وتجهيز رحلات العملاء. لا يُقبل الطلب إلا بعد التحقق من نجاح الدفع. يتم تأكيد توفر المنتجات والسعر النهائي ورسوم التوصيل ورسوم الدفع عند إتمام الطلب."],
    ["منطقة التوصيل والوصول", "التوصيل متاح داخل الكويت فقط. يجب تقديم عنوان كامل ودقيق ورقم هاتف وموقع صحيح على الخريطة، مع ضمان سهولة وصول السائق والرد على اتصالات التوصيل."],
    ["موعد التوصيل", "مواعيد التوصيل العادي والسريع تقديرية وليست ضماناً. قد يحدث تأخير بسبب الازدحام أو الطقس أو تجهيز المخزون أو العطل الرسمية أو البيانات غير الصحيحة أو أسباب خارجة عن السيطرة."],
    ["تعذر التوصيل", "إذا تعذر التوصيل بسبب خطأ في العنوان أو دبوس الخريطة أو الهاتف أو تعليمات الدخول أو عدم وجود المستلم، فقد تُفرض رسوم توصيل جديدة. يحق لنا رفض حالات التعذر المتكررة أو المسيئة."],
    ["سياسة الإرجاع", "يُسمح بطلب الإرجاع أو الاستبدال خلال 14 يوماً من تاريخ الاستلام بشرط أن يكون المنتج غير مستخدم إطلاقاً، وفي حالته الأصلية المغلقة تماماً داخل تغليف المصنع الأصلي مع وجود كافة الملصقات والإكسسوارات وكتيبات التعليمات وإثبات الشراء."],
    ["المنتجات غير القابلة للإرجاع", "لأسباب تتعلق بالصحة والسلامة العامة وقوانين حماية المستهلك، يُمنع منعاً باتاً إرجاع أو استبدال المنتجات المفتوحة التالية بمجرد إزالة الغلاف الأصلي أو نزع ختم الأمان:\n1. الأدوات الملامسة للأغذية والمشروبات (مثل المقات الحرارية، الأكواب، وحافظات السوائل).\n2. أدوات العناية الشخصية والعناية الصحية (مثل شطافات السفر المحمولة والمناشف).\nولا يُستثنى من ذلك إلا في حال وجود عيب مصنعي مثبت عند الاستلام."],
    ["الفحص والاسترداد", "تُفحص المنتجات المرتجعة قبل الموافقة. يُعاد المبلغ إلى وسيلة الدفع الأصلية بعد الموافقة وقد يستغرق مدة معالجة مزود الدفع. رسوم التوصيل والدفع الأصلية غير مستردة إلا إذا كان المنتج معيباً أو تم إرسال منتج غير صحيح."],
    ["الأجهزة والتلفيات", "في حال وصول منتج به عيب مصنعي أو تلف، يجب على العميل الإبلاغ فوراً خلال 48 ساعة من الاستلام مع توفير صور واضحة ورقم الطلب. يلتزم المتجر ببديل المنتج أو إرجاع قيمته بعد الفحص."],
    ["الإلغاء وسوء الاستخدام", "لا يمكن ضمان الإلغاء بعد بدء التجهيز أو الشحن. قد يؤدي الاحتيال أو الإساءة أو الادعاءات الكاذبة أو إساءة استخدام الاعتراض على الدفع أو الرفض المتكرر أو التعطيل المتعمد إلى إلغاء الطلب ورفض الطلبات المستقبلية والمطالبة بالخسائر المعقولة حيث يسمح القانون."],
    ["الحقوق القانونية", "لا تستبعد هذه الشروط أي حقوق لا يجوز استبعادها قانوناً وفق قانون حماية المستهلك الكويتي رقم 39 لسنة 2014 أو غيره من القوانين المعمول بها في دولة الكويت. يجوز لدار التميز تحديث شروط خدمة تجهيز المسافر للطلبات المستقبلية، وتطبق النسخة المقبولة عند الدفع على طلبك."],
  ],
} as const;

export function StoreTermsModal({ visible, lang, onClose }: { visible: boolean; lang: "en" | "ar"; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const rtl = lang === "ar";
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={[styles.header, rtl && styles.rowRtl]}>
          <Pressable style={styles.close} onPress={onClose}><HotelPortalIcon name="close" size={22} color="#003580" /></Pressable>
          <Text style={[styles.title, rtl && styles.rtl]}>{rtl ? "شروط وأحكام خدمة تجهيز المسافر" : "Travel Prep Service Terms & Conditions"}</Text>
          <View style={styles.close} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {TERMS[lang].map(([heading, body], index) => (
            <View key={heading} style={styles.section}>
              <Text style={[styles.heading, rtl && styles.rtl]}>{index + 1}. {heading}</Text>
              <Text style={[styles.body, rtl && styles.rtl]}>{body}</Text>
            </View>
          ))}
          <Text style={[styles.updated, rtl && styles.rtl]}>{rtl ? "آخر تحديث: 11 سبتمبر 2026" : "Last updated: 11 September 2026"}</Text>
        </ScrollView>
        <Pressable style={[styles.done, { marginBottom: Math.max(insets.bottom, 14) }]} onPress={onClose}>
          <Text style={styles.doneText}>{rtl ? "تم" : "Done"}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { height: 56, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { color: "#003580", fontSize: 18, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 24 },
  section: { backgroundColor: "#FFF", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", padding: 13, marginBottom: 9 },
  heading: { color: "#003580", fontSize: 14, fontWeight: "800", marginBottom: 5 },
  body: { color: "#475569", fontSize: 13, lineHeight: 20 },
  updated: { color: "#64748B", fontSize: 11, marginTop: 5 },
  done: { marginHorizontal: 16, minHeight: 48, borderRadius: 10, backgroundColor: "#003580", alignItems: "center", justifyContent: "center" },
  doneText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  rowRtl: { flexDirection: "row-reverse" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
});