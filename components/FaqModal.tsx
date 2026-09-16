import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HotelPortalIcon } from "@/components/HotelPortalIcon";
import { CUSTOMER_BOOKING_GUIDANCE } from "@/lib/bookingRules";

export type Language = "en" | "ar";

export type FaqItem = {
  category: FaqCategory;
  question: string;
  answer: string;
};

type FaqCategory = "flights" | "hotels" | "packages" | "payments" | "account" | "support";

const colors = {
  navy: "#003580",
  navySoft: "#EAF2FF",
  ink: "#1E293B",
  muted: "#64748B",
  border: "#D9E0E8",
  canvas: "#F2F2F2",
  card: "#FFFFFF",
};

export const FAQS: Record<Language, FaqItem[]> = {
  en: [
    {
      category: "packages",
      question: "What can I arrange through the DT Tours app?",
      answer:
        "You can search for flights and hotels, explore travel packages and destinations, build an AI-assisted trip idea, view your bookings, and send a special travel request to our consultants.",
    },
    {
      category: "flights",
      question: "Who operates flight services and issues airline tickets?",
      answer:
        "All aviation-related services and ticket issuance through this platform are operated by Max Travel & Tourism Co., DGCA License No. 2021/20304 and IATA Code 42228745.",
    },
    {
      category: "packages",
      question: "Who operates tours, packages, and concierge services?",
      answer:
        "Tour operations, travel packages, and concierge services are operated by Dar AlTamaiz Tours under Commercial License No. 7517/2024.",
    },
    {
      category: "support",
      question: "Does the platform comply with Kuwait regulations?",
      answer:
        "This website and app are designed as a digital service channel for the licensed entities shown above, with processes intended to support applicable Kuwait electronic-transactions, consumer, privacy, commercial, and aviation requirements. The terms for each service and any mandatory legal rights continue to apply.",
    },
    {
      category: "payments",
      question: "Does a search guarantee the displayed price or availability?",
      answer:
        "No. Flight seats, hotel rooms, package availability, and prices can change until the supplier confirms the booking. Always review the final details and total before paying.",
    },
    {
      category: "flights",
      question: "How do I book a flight?",
      answer:
        "Choose your route, dates, passengers, and cabin class in Flight Search. The app then continues to the flight booking service. Ticket issuance is completed through Max Travel & Tourism Co.",
    },
    {
      category: "hotels",
      question: "How do I book a hotel?",
      answer:
        "Search by destination and dates, select a hotel and room, review the room, meal, refund, and price details, then continue to payment. Your booking is confirmed only when an explicit confirmation is shown.",
    },
    {
      category: "hotels",
      question: "Are hotel bookings refundable?",
      answer:
        "Refundability depends on the selected room rate and supplier terms. Check the cancellation deadline and any penalty shown for that specific room before booking. Non-refundable rates may not qualify for a refund.",
    },
    {
      category: "payments",
      question: "How do cancellations and refunds work?",
      answer:
        "Contact DT Tours with your booking details. Eligibility, fees, and timing depend on the airline, hotel, package, and supplier rules. A cancellation or refund is not guaranteed until it is approved and confirmed.",
    },
    {
      category: "payments",
      question: "How do payments and deposits work?",
      answer:
        "The app may offer online payment or a stated deposit option for eligible services. Review the amount, currency, remaining balance, and booking conditions before paying. Keep the payment and booking confirmation for reference.",
    },
    {
      category: "payments",
      question: "What should I do if payment succeeds but confirmation is pending?",
      answer:
        "Do not pay again immediately. Open My Bookings to check the latest status, then contact DT Tours with the payment reference if the booking remains pending.",
    },
    {
      category: "flights",
      question: "What passport and travel documents do I need?",
      answer:
        "Document and visa requirements depend on your nationality and destination. As general travel guidance, check that your passport is valid for at least six months and verify visa, transit, baggage, and entry rules before travel.",
    },
    {
      category: "packages",
      question: "Can I request a custom trip or group arrangement?",
      answer:
        "Yes. Open Contact and choose Start a special request. Add your destination, dates, group needs, budget, and notes so a travel consultant can review them.",
    },
    {
      category: "support",
      question: "How can I contact DT Tours?",
      answer:
        "Use the phone, WhatsApp, email, or map buttons in Contact. You can also visit the office at AlRihab Mall, Hawally, Kuwait, first floor, office 32.",
    },
    {
      category: "support",
      question: "How is information in a special request used?",
      answer:
        "The details you submit are used to review and process your travel request and to contact you about it. Only provide information needed for the request; passport fields are optional where marked.",
    },
    {
      category: "account",
      question: "What can I manage in My Account?",
      answer:
        "You can view your hotel bookings and their latest status, continue an eligible pending payment, review loyalty points shown on your account, and manage your hotel price-display settings.",
    },
    {
      category: "account",
      question: "How do the hotel price-display settings work?",
      answer:
        "In My Account, open Settings to choose Per night or Total stay and KWD or USD. USD uses the fixed display rate of 1 KWD = 3.2 USD. These choices change presentation only and do not change the booking or payment amount.",
    },
    {
      category: "flights",
      question: "Which flight types can I search for?",
      answer:
        "Flight Search supports one-way, round-trip, and multi-city journeys. Enter valid airports, dates, passenger counts, and cabin class before continuing to the airline booking service.",
    },
    {
      category: "flights",
      question: "Must passenger names match the passport?",
      answer:
        "Yes. Enter every passenger's name exactly as it appears on the passport or accepted travel document. Airlines may refuse travel or charge a correction fee when names do not match, and some tickets do not permit name changes.",
    },
    {
      category: "flights",
      question: "What baggage is included with my flight?",
      answer:
        "Baggage allowance depends on the airline, route, cabin, and fare family. Review the allowance and restrictions shown by the flight provider before payment. Extra, oversized, sports, and special baggage may require separate airline approval and fees.",
    },
    {
      category: "flights",
      question: "Can I change or cancel an airline ticket?",
      answer:
        "It depends on the fare rules and airline approval. Changes may involve a fare difference, airline penalties, service fees, or may not be permitted. Contact DT Tours before the departure or check-in deadline and do not assume a request is accepted until confirmed.",
    },
    {
      category: "flights",
      question: "What happens if the airline changes or cancels my flight?",
      answer:
        "Airline schedules can change after ticketing. The available options depend on the airline's policy and applicable passenger rights. Check messages from the airline and DT Tours, verify your flight before leaving for the airport, and contact us if you need help reviewing the offered options.",
    },
    {
      category: "flights",
      question: "Can I book for children or infants?",
      answer:
        "Yes, when the flight service offers the required passenger type. At least one adult must travel, and the number of infants cannot exceed the number of accompanying adults. Airline age rules, documents, seats, and infant services vary.",
    },
    {
      category: "flights",
      question: "How do I request meals, seats, or special assistance?",
      answer:
        "Contact DT Tours as early as possible with your booking reference. Seats, meals, wheelchairs, medical assistance, and other requests are subject to airline confirmation and may involve conditions or fees. A request is not guaranteed until confirmed.",
    },
    {
      category: "flights",
      question: "What if I miss my flight or arrive late?",
      answer:
        "Contact the airline and DT Tours immediately. A missed segment may be treated as a no-show and can cancel later segments on the same ticket. Rebooking, refunds, and fees depend on the airline and fare rules.",
    },
    {
      category: "hotels",
      question: "What do I need at hotel check-in?",
      answer:
        "The lead guest should carry the booking confirmation, a valid passport or accepted ID, and the payment card if the hotel requests it. The hotel may also require a refundable security deposit and documents for accompanying guests.",
    },
    {
      category: "hotels",
      question: "Are taxes and hotel charges included?",
      answer:
        "Review the final price details before payment. Some destinations or properties collect city taxes, resort fees, security deposits, or optional charges directly at the hotel. Any separately payable amount depends on the property's and destination's rules.",
    },
    {
      category: "hotels",
      question: "Can children stay in the selected room?",
      answer:
        "Room occupancy and child policies depend on the property, room, and rate. Enter the correct number and ages of guests when searching. Extra beds, cots, meals, or additional occupants may require hotel approval and extra payment.",
    },
    {
      category: "hotels",
      question: "Are room photos, facilities, and star ratings guaranteed?",
      answer:
        "Hotel descriptions, photos, facilities, and ratings are supplied by properties or content providers and may change. Room layout can differ within the same category. Review current details and contact DT Tours before booking if a specific facility is essential.",
    },
    {
      category: "hotels",
      question: "Can I request a specific bed, room, or early check-in?",
      answer:
        "You can ask DT Tours to pass a special request to the property. Bed type, connecting rooms, floor, view, early check-in, and late check-out remain subject to hotel availability and may involve a fee. They are not guaranteed unless confirmed.",
    },
    {
      category: "hotels",
      question: "Can I change the guest name or hotel dates?",
      answer:
        "Changes depend on the selected rate and supplier approval. A change may require cancellation and rebooking at the current price or may not be allowed. Contact DT Tours before making another booking or payment.",
    },
    {
      category: "hotels",
      question: "What happens if I do not arrive at the hotel?",
      answer:
        "The property may treat this as a no-show and charge part or all of the booking according to the rate conditions. Tell DT Tours promptly if you expect a late arrival or cannot travel; contacting us does not itself waive the supplier's penalty.",
    },
    {
      category: "hotels",
      question: "Who confirms and supplies the hotel room?",
      answer:
        "Hotel inventory and confirmation come from the property or accommodation supplier. DT Tours facilitates the booking and support. Payment alone does not mean the room is confirmed; rely on the explicit booking confirmation and confirmation number.",
    },
    {
      category: "packages",
      question: "Does the AI trip builder make a confirmed booking?",
      answer:
        "No. It helps create a travel idea based on the information you provide. Suggested destinations, schedules, hotels, activities, and estimated prices are planning guidance until a DT Tours consultant reviews the request and you receive an official quotation or confirmation.",
    },
    {
      category: "packages",
      question: "What is included in a travel package?",
      answer:
        "Inclusions vary by package. Review the stated flights, accommodation, transfers, meals, tours, insurance, visa assistance, and exclusions in the quotation. Anything not expressly listed as included should not be assumed to be part of the package.",
    },
    {
      category: "packages",
      question: "Can a package itinerary or price change?",
      answer:
        "Yes. Availability, exchange rates, supplier prices, schedules, and local operating conditions can change before confirmation. After confirmation, changes are handled according to the booking conditions, supplier rules, and applicable law.",
    },
    {
      category: "packages",
      question: "Are package deposits refundable?",
      answer: CUSTOMER_BOOKING_GUIDANCE.packageDepositFaq.en,
    },
    {
      category: "packages",
      question: "Are visas included or guaranteed with a package?",
      answer:
        "Only if visa assistance is expressly listed. Embassies and government authorities decide applications, processing times, entry, and permitted stay. DT Tours cannot guarantee approval, and customers remain responsible for accurate documents and meeting entry requirements.",
    },
    {
      category: "packages",
      question: "Can packages be arranged for families and children?",
      answer:
        "Yes. Provide the number of adults and each child's age so the consultant can check suitable rooms, transport, activities, and supplier rules. Child prices and eligibility vary by service and are confirmed in the quotation.",
    },
    {
      category: "packages",
      question: "When is a custom trip request confirmed?",
      answer:
        "Submitting a request starts consultant review; it is not a booking. The trip is confirmed only after the services and final price are agreed, required traveller details and payment are received, and DT Tours issues an official confirmation.",
    },
    {
      category: "payments",
      question: "Which payment methods can I use?",
      answer:
        "Available methods are shown at checkout and may vary by service, amount, or payment provider. Select only a method displayed in the official DT Tours checkout and review the final amount and currency before authorizing payment.",
    },
    {
      category: "payments",
      question: "Why can the checkout total differ from a search result?",
      answer:
        "Search results are not a final quotation. Supplier prices and availability may change, and the final total may include applicable service charges, taxes, fees, or a payment-method commission shown before payment. Do not continue if the final details are not acceptable.",
    },
    {
      category: "payments",
      question: "What should I do if I may have paid twice?",
      answer:
        "Do not make another payment. Check your bank and My Bookings, keep both transaction references, and contact DT Tours promptly. A pending bank authorization is not always a completed charge; any refund or reversal follows verification and the payment provider's timing.",
    },
    {
      category: "payments",
      question: "Will I receive a payment and booking record?",
      answer:
        "Keep the payment result, booking confirmation, and any email or message sent for the transaction. Electronic records and confirmations may be used for service and support purposes under Kuwait's electronic-transactions framework. Contact DT Tours if expected confirmation is missing.",
    },
    {
      category: "payments",
      question: "Is it safe to share my card details with support?",
      answer:
        "Never send a full card number, PIN, CVV, one-time password, or online-banking password by phone, chat, WhatsApp, or email. Enter payment details only on the authorized checkout page. DT Tours support does not need your secret banking credentials.",
    },
    {
      category: "payments",
      question: "How long does an approved refund take?",
      answer:
        "Timing starts after the supplier and DT Tours approve and process the refund. Banks and payment providers may need additional business days to return funds. The timing varies by payment method and is not guaranteed until the refund is completed.",
    },
    {
      category: "account",
      question: "How can I sign in to My Account?",
      answer:
        "Use the available email/password or Google sign-in option. Use the same verified email connected to your bookings where possible. Never share your password or Google verification codes with anyone.",
    },
    {
      category: "account",
      question: "Why is a booking missing from My Account?",
      answer:
        "Confirm that you signed in with the same verified email used for the booking. Some supplier or guest bookings may need support assistance to link correctly. Contact DT Tours with the booking reference without sending card passwords or one-time codes.",
    },
    {
      category: "account",
      question: "What if my Google email is already linked to another account?",
      answer:
        "For security, the app may stop automatic linking when the verified email is already connected elsewhere. Sign in using the original method or contact DT Tours support so the account can be reviewed safely.",
    },
    {
      category: "account",
      question: "Can I access, correct, or delete my personal data?",
      answer:
        "Authenticated customers can submit privacy requests for access, correction, or deletion from the app. Identity or email verification may be required. Some records may still be retained where needed for bookings, legal obligations, fraud prevention, disputes, or accounting.",
    },
    {
      category: "account",
      question: "What happens when I request account deletion?",
      answer:
        "Deletion requires a one-time email verification and review. It is not immediate or automatic. DT Tours will process the verified request subject to applicable Kuwait law and any required retention of transaction, booking, security, or legal records.",
    },
    {
      category: "account",
      question: "How do loyalty points work?",
      answer:
        "Your available points and relevant account activity are shown in My Account. Points may be usable for eligible features such as hotel price holds when offered. Earning, expiry, eligibility, and redemption depend on the current program rules shown by DT Tours.",
    },
    {
      category: "account",
      question: "How do hotel price holds work?",
      answer: CUSTOMER_BOOKING_GUIDANCE.hotelPriceHoldFaq.en,
    },
    {
      category: "account",
      question: "Does a hotel price hold guarantee every room detail?",
      answer:
        "It protects only the eligible quoted room, board, cancellation identity, and price for the stated period after supplier confirmation. It does not extend availability beyond expiry or cover a different room, dates, guests, or conditions.",
    },
    {
      category: "support",
      question: "How do I make a complaint?",
      answer:
        "Contact DT Tours with your booking or payment reference, a clear description, and supporting records. We will review the issue with the relevant licensed operator or supplier. Where applicable, consumers may also use the official complaint channels of Kuwait's Ministry of Commerce and Industry.",
    },
    {
      category: "support",
      question: "What should I do during an urgent travel disruption?",
      answer:
        "For immediate airport, flight, or hotel action, contact the airline, airport, hotel, or local emergency service first, then notify DT Tours. Chat and email may not be monitored instantly and should not replace emergency assistance.",
    },
    {
      category: "support",
      question: "How can I verify that a message or payment link is genuine?",
      answer:
        "Use contact details shown inside the official DT Tours app or website. Be cautious of unexpected links, changed bank details, pressure to share an OTP, or requests for payment outside the authorized checkout. Contact DT Tours through a known channel before paying.",
    },
    {
      category: "support",
      question: "Which terms apply to my booking?",
      answer:
        "The final service details, price, cancellation conditions, DT Tours Booking Conditions, supplier or airline terms, and applicable Kuwait law govern the transaction. This FAQ is general guidance and does not replace the conditions shown for your specific booking.",
    },
    {
      category: "support",
      question: "How does DT Tours protect personal information?",
      answer:
        "DT Tours uses personal information to provide travel services, manage accounts and payments, support customers, and meet legal obligations. Customers should provide only necessary information and use the app's privacy-request options. Processing is subject to the published Privacy Policy and applicable Kuwait requirements.",
    },
    {
      category: "support",
      question: "What laws are relevant to online bookings in Kuwait?",
      answer:
        "Online records and payments may be governed by Kuwait Electronic Transactions Law No. 20/2014. Consumer matters may also fall under Consumer Protection Law No. 39/2014 and its regulations, while privacy and communications services may involve CITRA requirements. Specific rights depend on the service and facts.",
    },
    {
      category: "support",
      question: "Who should I contact about an airline-specific issue?",
      answer:
        "Contact DT Tours for booking assistance. Operational decisions such as schedules, boarding, baggage acceptance, denied travel, and airline-approved remedies remain with the operating airline and the licensed aviation service provider.",
    },
    {
      category: "support",
      question: "Does this FAQ provide legal, visa, or immigration advice?",
      answer:
        "No. It provides general customer guidance. Rules can change and depend on nationality, destination, itinerary, and individual circumstances. Confirm current requirements with the relevant embassy, immigration authority, airline, or official government source.",
    },
  ],
  ar: [
    {
      category: "packages",
      question: "ما الخدمات التي يمكنني ترتيبها عبر تطبيق DT Tours؟",
      answer:
        "يمكنك البحث عن الرحلات الجوية والفنادق، واستكشاف الباقات والوجهات، وإنشاء فكرة رحلة بمساعدة الذكاء الاصطناعي، ومتابعة حجوزاتك، وإرسال طلب سفر خاص إلى مستشارينا.",
    },
    {
      category: "flights",
      question: "من المسؤول عن خدمات الطيران وإصدار التذاكر؟",
      answer:
        "جميع الخدمات المتعلقة بالطيران وإصدار التذاكر عبر هذه المنصة تُدار من خلال شركة ماكس للسياحة والسفر، ترخيص الإدارة العامة للطيران المدني رقم 2021/20304 ورمز IATA رقم 42228745.",
    },
    {
      category: "packages",
      question: "من المسؤول عن الرحلات السياحية والباقات وخدمات الكونسيرج؟",
      answer:
        "تُدار الرحلات السياحية والباقات وخدمات الكونسيرج من خلال دار التميز تورز بموجب الترخيص التجاري رقم 7517/2024.",
    },
    {
      category: "support",
      question: "هل تعمل المنصة وفق قوانين دولة الكويت؟",
      answer:
        "صُمم الموقع والتطبيق كقناة خدمات رقمية للجهات المرخصة المذكورة أعلاه، مع إجراءات تهدف إلى دعم متطلبات الكويت المعمول بها في المعاملات الإلكترونية وحماية المستهلك والخصوصية والتجارة والطيران. وتظل شروط كل خدمة وأي حقوق قانونية إلزامية سارية.",
    },
    {
      category: "payments",
      question: "هل نتيجة البحث تضمن السعر أو التوفر المعروض؟",
      answer:
        "لا. قد تتغير مقاعد الطيران والغرف والباقات والأسعار إلى أن يؤكد المورد الحجز. راجع دائماً التفاصيل النهائية والمبلغ الإجمالي قبل الدفع.",
    },
    {
      category: "flights",
      question: "كيف أحجز رحلة طيران؟",
      answer:
        "اختر خط السير والتواريخ والمسافرين ودرجة السفر في شاشة البحث عن الرحلات. ينتقل التطبيق بعد ذلك إلى خدمة الحجز، ويتم إصدار التذاكر من خلال شركة ماكس للسياحة والسفر.",
    },
    {
      category: "hotels",
      question: "كيف أحجز فندقاً؟",
      answer:
        "ابحث بالوجهة والتواريخ، ثم اختر الفندق والغرفة وراجع تفاصيل الغرفة والوجبات والاسترداد والسعر قبل متابعة الدفع. لا يُعد الحجز مؤكداً إلا عند ظهور تأكيد صريح.",
    },
    {
      category: "hotels",
      question: "هل حجوزات الفنادق قابلة للاسترداد؟",
      answer:
        "يعتمد ذلك على سعر الغرفة وشروط المورد. تحقق من مهلة الإلغاء وأي غرامة معروضة للغرفة المحددة قبل الحجز. قد لا تكون الأسعار غير القابلة للاسترداد مؤهلة للاسترجاع.",
    },
    {
      category: "payments",
      question: "كيف تتم عمليات الإلغاء والاسترداد؟",
      answer:
        "تواصل مع دار التميز تورز وأرسل تفاصيل الحجز. تعتمد الأهلية والرسوم والمدة على شروط شركة الطيران أو الفندق أو الباقة والمورد. لا يُضمن الإلغاء أو الاسترداد حتى تتم الموافقة والتأكيد.",
    },
    {
      category: "payments",
      question: "كيف يعمل الدفع أو العربون؟",
      answer:
        "قد يوفر التطبيق الدفع الإلكتروني أو خيار عربون محدد للخدمات المؤهلة. راجع المبلغ والعملة والرصيد المتبقي وشروط الحجز قبل الدفع، واحتفظ بتأكيد الدفع والحجز للرجوع إليه.",
    },
    {
      category: "payments",
      question: "ماذا أفعل إذا نجح الدفع وبقي الحجز قيد المعالجة؟",
      answer:
        "لا تدفع مرة أخرى مباشرة. افتح حجوزاتي للتحقق من أحدث حالة، ثم تواصل مع دار التميز تورز وأرسل مرجع الدفع إذا استمر ظهور الحجز قيد المعالجة.",
    },
    {
      category: "flights",
      question: "ما متطلبات جواز السفر ووثائق السفر؟",
      answer:
        "تختلف متطلبات الوثائق والتأشيرات حسب الجنسية والوجهة. كإرشاد عام، تحقق من صلاحية جواز السفر لمدة لا تقل عن ستة أشهر، ومن متطلبات التأشيرة والترانزيت والأمتعة والدخول قبل السفر.",
    },
    {
      category: "packages",
      question: "هل يمكنني طلب رحلة مخصصة أو ترتيب لمجموعة؟",
      answer:
        "نعم. افتح صفحة تواصل معنا واختر ابدأ طلباً خاصاً، ثم أضف الوجهة والتواريخ واحتياجات المجموعة والميزانية والملاحظات ليتمكن مستشار السفر من مراجعتها.",
    },
    {
      category: "support",
      question: "كيف أتواصل مع دار التميز تورز؟",
      answer:
        "استخدم أزرار الهاتف أو واتساب أو البريد الإلكتروني أو الخريطة في صفحة تواصل معنا. ويمكنك زيارة المكتب في مجمع الرحاب، حولي، دولة الكويت، الطابق الأول، مكتب 32.",
    },
    {
      category: "support",
      question: "كيف تُستخدم المعلومات المرسلة في الطلب الخاص؟",
      answer:
        "تُستخدم التفاصيل التي ترسلها لمراجعة طلب السفر ومعالجته والتواصل معك بشأنه. أرسل فقط المعلومات اللازمة للطلب، وحقول جواز السفر اختيارية حيثما تم توضيح ذلك.",
    },
    {
      category: "account",
      question: "ما الذي يمكنني إدارته في حسابي؟",
      answer:
        "يمكنك عرض حجوزات الفنادق وأحدث حالاتها، ومتابعة عملية دفع معلقة مؤهلة، ومراجعة نقاط الولاء الظاهرة في حسابك، وإدارة إعدادات عرض أسعار الفنادق.",
    },
    {
      category: "account",
      question: "كيف تعمل إعدادات عرض أسعار الفنادق؟",
      answer:
        "من حسابي، افتح الإعدادات لاختيار السعر لكل ليلة أو إجمالي الإقامة، واختيار الدينار الكويتي أو الدولار الأمريكي. يستخدم الدولار سعر العرض الثابت 1 د.ك = 3.2 دولار. تؤثر هذه الخيارات على العرض فقط ولا تغيّر مبلغ الحجز أو الدفع.",
    },
    {
      category: "flights",
      question: "ما أنواع رحلات الطيران التي يمكنني البحث عنها؟",
      answer:
        "يدعم البحث رحلات الذهاب فقط والذهاب والعودة والرحلات متعددة المدن. أدخل مطارات وتواريخ وأعداد مسافرين ودرجة سفر صحيحة قبل الانتقال إلى خدمة حجز الطيران.",
    },
    {
      category: "flights",
      question: "هل يجب أن يطابق اسم المسافر جواز السفر؟",
      answer:
        "نعم. أدخل اسم كل مسافر تماماً كما يظهر في جواز السفر أو وثيقة السفر المقبولة. قد ترفض شركة الطيران السفر أو تفرض رسوماً للتصحيح عند عدم التطابق، وبعض التذاكر لا تسمح بتغيير الاسم.",
    },
    {
      category: "flights",
      question: "ما الأمتعة المشمولة في تذكرة الطيران؟",
      answer:
        "يعتمد وزن وعدد الأمتعة على شركة الطيران وخط السير والدرجة وفئة السعر. راجع التفاصيل المعروضة من مزود الرحلة قبل الدفع. وقد تتطلب الأمتعة الإضافية أو كبيرة الحجم أو الرياضية موافقة ورسومًا منفصلة.",
    },
    {
      category: "flights",
      question: "هل يمكنني تغيير تذكرة الطيران أو إلغاؤها؟",
      answer:
        "يعتمد ذلك على شروط السعر وموافقة شركة الطيران. قد يترتب على التغيير فرق سعر أو غرامات أو رسوم خدمة، وقد لا يكون مسموحاً. تواصل مع دار التميز قبل موعد المغادرة أو إغلاق إجراءات السفر، ولا تعتبر الطلب مقبولاً حتى يتم تأكيده.",
    },
    {
      category: "flights",
      question: "ماذا يحدث إذا غيّرت شركة الطيران الرحلة أو ألغتها؟",
      answer:
        "قد تتغير الجداول بعد إصدار التذكرة. تعتمد الخيارات على سياسة شركة الطيران وحقوق المسافر المعمول بها. راجع رسائل شركة الطيران ودار التميز، وتحقق من الرحلة قبل التوجه للمطار، وتواصل معنا للمساعدة في مراجعة الخيارات المتاحة.",
    },
    {
      category: "flights",
      question: "هل يمكن الحجز للأطفال أو الرضع؟",
      answer:
        "نعم، عندما توفر خدمة الطيران فئة المسافر المطلوبة. يجب وجود بالغ واحد على الأقل، ولا يجوز أن يزيد عدد الرضع عن عدد البالغين المرافقين. تختلف قواعد العمر والوثائق والمقاعد وخدمات الرضع حسب شركة الطيران.",
    },
    {
      category: "flights",
      question: "كيف أطلب وجبة أو مقعداً أو مساعدة خاصة؟",
      answer:
        "تواصل مع دار التميز مبكراً وأرسل مرجع الحجز. تخضع المقاعد والوجبات والكراسي المتحركة والمساعدة الطبية والطلبات الأخرى لموافقة شركة الطيران وقد تكون لها شروط أو رسوم. لا يُضمن الطلب حتى يتم تأكيده.",
    },
    {
      category: "flights",
      question: "ماذا أفعل إذا فاتتني الرحلة أو تأخرت عن المطار؟",
      answer:
        "تواصل فوراً مع شركة الطيران ودار التميز. قد تعتبر الرحلة فائتة وقد تُلغى المقاطع اللاحقة في التذكرة نفسها. تعتمد إعادة الحجز والاسترداد والرسوم على شروط شركة الطيران والسعر.",
    },
    {
      category: "hotels",
      question: "ما المطلوب عند تسجيل الدخول إلى الفندق؟",
      answer:
        "ينبغي أن يحمل النزيل الرئيسي تأكيد الحجز وجواز سفر أو هوية مقبولة وبطاقة الدفع إذا طلبها الفندق. وقد يطلب الفندق أيضاً مبلغ تأمين قابل للاسترداد ووثائق للنزلاء المرافقين.",
    },
    {
      category: "hotels",
      question: "هل الضرائب ورسوم الفندق مشمولة؟",
      answer:
        "راجع تفاصيل السعر النهائي قبل الدفع. قد تفرض بعض الوجهات أو الفنادق ضريبة مدينة أو رسوم منتجع أو مبلغ تأمين أو خدمات اختيارية تُدفع مباشرة في الفندق. يعتمد أي مبلغ منفصل على قواعد الفندق والوجهة.",
    },
    {
      category: "hotels",
      question: "هل يمكن للأطفال الإقامة في الغرفة المختارة؟",
      answer:
        "تعتمد سعة الغرفة وسياسة الأطفال على الفندق والغرفة والسعر. أدخل العدد الصحيح للنزلاء وأعمار الأطفال عند البحث. قد تحتاج الأسرّة الإضافية أو أسرّة الأطفال أو الوجبات أو النزلاء الإضافيون إلى موافقة ورسوم.",
    },
    {
      category: "hotels",
      question: "هل صور الغرف والمرافق وتصنيف النجوم مضمونة؟",
      answer:
        "توفر الفنادق أو مزودو المحتوى الأوصاف والصور والمرافق والتصنيفات وقد تتغير. وقد يختلف تصميم الغرف ضمن الفئة نفسها. راجع التفاصيل الحالية وتواصل مع دار التميز قبل الحجز إذا كانت منشأة محددة ضرورية لك.",
    },
    {
      category: "hotels",
      question: "هل يمكنني طلب سرير أو غرفة محددة أو دخول مبكر؟",
      answer:
        "يمكنك طلب تمرير ملاحظة إلى الفندق. يظل نوع السرير والغرف المتصلة والطابق والإطلالة والدخول المبكر والخروج المتأخر خاضعاً لتوفر الفندق وقد يتطلب رسوماً. لا يُضمن إلا إذا تم تأكيده.",
    },
    {
      category: "hotels",
      question: "هل يمكن تغيير اسم النزيل أو تواريخ الفندق؟",
      answer:
        "تعتمد التغييرات على السعر المختار وموافقة المورد. قد يتطلب التغيير إلغاء الحجز وإعادته بالسعر الحالي أو قد لا يكون مسموحاً. تواصل مع دار التميز قبل إجراء حجز أو دفع آخر.",
    },
    {
      category: "hotels",
      question: "ماذا يحدث إذا لم أصل إلى الفندق؟",
      answer:
        "قد يعتبر الفندق الحالة عدم حضور ويفرض جزءاً من قيمة الحجز أو كاملها وفق شروط السعر. أخبر دار التميز سريعاً إذا توقعت الوصول المتأخر أو تعذر السفر؛ ولا يؤدي التواصل وحده إلى إلغاء غرامة المورد.",
    },
    {
      category: "hotels",
      question: "من يؤكد ويوفر غرفة الفندق؟",
      answer:
        "تأتي الغرف والتأكيد من الفندق أو مورد الإقامة، بينما تسهّل دار التميز الحجز والدعم. لا يعني الدفع وحده أن الغرفة مؤكدة؛ اعتمد على تأكيد الحجز الصريح ورقم التأكيد.",
    },
    {
      category: "packages",
      question: "هل منشئ الرحلات بالذكاء الاصطناعي ينشئ حجزاً مؤكداً؟",
      answer:
        "لا. يساعدك في إعداد فكرة سفر وفق المعلومات التي تقدمها. تظل الوجهات والجداول والفنادق والأنشطة والأسعار التقديرية إرشادات للتخطيط إلى أن يراجع المستشار الطلب وتستلم عرضاً أو تأكيداً رسمياً.",
    },
    {
      category: "packages",
      question: "ما الذي تشمله باقة السفر؟",
      answer:
        "تختلف المكونات حسب الباقة. راجع الرحلات والإقامة والتنقلات والوجبات والجولات والتأمين ومساعدة التأشيرة والاستثناءات المذكورة في العرض. لا تفترض أن أي خدمة غير مذكورة صراحةً ضمن الباقة.",
    },
    {
      category: "packages",
      question: "هل يمكن أن يتغير برنامج الباقة أو سعرها؟",
      answer:
        "نعم. قد يتغير التوفر وأسعار الصرف وأسعار الموردين والجداول والظروف التشغيلية المحلية قبل التأكيد. وبعد التأكيد تُعالج التغييرات وفق شروط الحجز وقواعد المورد والقانون المعمول به.",
    },
    {
      category: "packages",
      question: "هل عربون الباقة قابل للاسترداد؟",
      answer: CUSTOMER_BOOKING_GUIDANCE.packageDepositFaq.ar,
    },
    {
      category: "packages",
      question: "هل التأشيرة مشمولة أو مضمونة مع الباقة؟",
      answer:
        "فقط إذا ذُكرت مساعدة التأشيرة صراحةً. تقرر السفارات والجهات الحكومية الطلبات ومدة المعالجة والدخول والإقامة. لا تستطيع دار التميز ضمان الموافقة، ويبقى العميل مسؤولاً عن صحة الوثائق واستيفاء متطلبات الدخول.",
    },
    {
      category: "packages",
      question: "هل يمكن ترتيب باقات للعائلات والأطفال؟",
      answer:
        "نعم. أرسل عدد البالغين وعمر كل طفل ليتمكن المستشار من التحقق من الغرف والنقل والأنشطة وقواعد المورد المناسبة. تختلف أسعار الأطفال وأهليتهم حسب الخدمة ويتم تأكيدها في العرض.",
    },
    {
      category: "packages",
      question: "متى يصبح طلب الرحلة المخصصة مؤكداً؟",
      answer:
        "إرسال الطلب يبدأ مراجعته ولا يُعد حجزاً. تتأكد الرحلة فقط بعد الاتفاق على الخدمات والسعر النهائي، واستلام بيانات المسافرين والدفع المطلوب، وإصدار دار التميز تأكيداً رسمياً.",
    },
    {
      category: "payments",
      question: "ما طرق الدفع المتاحة؟",
      answer:
        "تظهر الطرق المتاحة عند الدفع وقد تختلف حسب الخدمة أو المبلغ أو مزود الدفع. اختر فقط طريقة تظهر في صفحة الدفع الرسمية لدار التميز وراجع المبلغ النهائي والعملة قبل الموافقة.",
    },
    {
      category: "payments",
      question: "لماذا قد يختلف مبلغ الدفع عن نتيجة البحث؟",
      answer:
        "نتيجة البحث ليست عرضاً نهائياً. قد تتغير أسعار المورد والتوفر، وقد يشمل الإجمالي النهائي رسوم الخدمة والضرائب والرسوم الأخرى أو عمولة طريقة الدفع المعروضة قبل الدفع. لا تتابع إذا لم تناسبك التفاصيل النهائية.",
    },
    {
      category: "payments",
      question: "ماذا أفعل إذا اعتقدت أنني دفعت مرتين؟",
      answer:
        "لا تُجرِ دفعة أخرى. تحقق من البنك ومن حجوزاتي، واحتفظ بمرجعي العمليتين، وتواصل مع دار التميز سريعاً. حجز المبلغ المعلق لدى البنك ليس دائماً خصماً مكتملاً، وأي استرداد أو عكس للعملية يخضع للتحقق ومدة مزود الدفع.",
    },
    {
      category: "payments",
      question: "هل سأحصل على سجل للدفع والحجز؟",
      answer:
        "احتفظ بنتيجة الدفع وتأكيد الحجز وأي بريد أو رسالة تخص العملية. يمكن استخدام السجلات والتأكيدات الإلكترونية للخدمة والدعم وفق إطار المعاملات الإلكترونية في الكويت. تواصل مع دار التميز إذا لم يصلك التأكيد المتوقع.",
    },
    {
      category: "payments",
      question: "هل من الآمن مشاركة بيانات البطاقة مع الدعم؟",
      answer:
        "لا ترسل أبداً رقم البطاقة كاملاً أو الرقم السري أو رمز CVV أو رمز التحقق لمرة واحدة أو كلمة مرور البنك عبر الهاتف أو المحادثة أو واتساب أو البريد. أدخل بيانات الدفع فقط في صفحة الدفع المعتمدة.",
    },
    {
      category: "payments",
      question: "كم يستغرق وصول المبلغ المسترد بعد الموافقة؟",
      answer:
        "تبدأ المدة بعد موافقة المورد ودار التميز ومعالجة الاسترداد. وقد تحتاج البنوك ومزودو الدفع أيام عمل إضافية لإعادة المبلغ. تختلف المدة حسب طريقة الدفع ولا تُضمن حتى اكتمال الاسترداد.",
    },
    {
      category: "account",
      question: "كيف أسجل الدخول إلى حسابي؟",
      answer:
        "استخدم البريد الإلكتروني وكلمة المرور أو خيار تسجيل الدخول عبر Google المتاح. استخدم قدر الإمكان البريد الموثق نفسه المرتبط بحجوزاتك، ولا تشارك كلمة المرور أو رموز التحقق مع أي شخص.",
    },
    {
      category: "account",
      question: "لماذا لا يظهر أحد حجوزاتي في حسابي؟",
      answer:
        "تأكد من تسجيل الدخول بالبريد الموثق نفسه المستخدم في الحجز. قد تحتاج بعض حجوزات الموردين أو الضيوف إلى مساعدة الدعم لربطها. تواصل مع دار التميز وأرسل مرجع الحجز دون إرسال كلمات مرور البطاقة أو رموز التحقق.",
    },
    {
      category: "account",
      question: "ماذا لو كان بريد Google مرتبطاً بحساب آخر؟",
      answer:
        "لأسباب أمنية قد يوقف التطبيق الربط التلقائي عندما يكون البريد الموثق مرتبطاً مسبقاً. سجل الدخول بالطريقة الأصلية أو تواصل مع دعم دار التميز لمراجعة الحساب بأمان.",
    },
    {
      category: "account",
      question: "هل يمكنني الوصول إلى بياناتي الشخصية أو تصحيحها أو حذفها؟",
      answer:
        "يمكن للعملاء المسجلين إرسال طلبات خصوصية للوصول أو التصحيح أو الحذف من التطبيق. قد يلزم التحقق من الهوية أو البريد. وقد تُحتفظ بعض السجلات اللازمة للحجوزات أو الالتزامات القانونية أو منع الاحتيال أو النزاعات أو المحاسبة.",
    },
    {
      category: "account",
      question: "ماذا يحدث عند طلب حذف الحساب؟",
      answer:
        "يتطلب الحذف رمز تحقق لمرة واحدة عبر البريد ومراجعة، ولا يتم فوراً أو تلقائياً. تعالج دار التميز الطلب الموثق وفق قانون الكويت وأي التزام بالاحتفاظ بسجلات المعاملات أو الحجوزات أو الأمن أو السجلات القانونية.",
    },
    {
      category: "account",
      question: "كيف تعمل نقاط الولاء؟",
      answer:
        "تظهر النقاط المتاحة والنشاط ذي الصلة في حسابي. وقد يمكن استخدامها للميزات المؤهلة مثل تثبيت سعر الفندق عند توفره. يعتمد الكسب والانتهاء والأهلية والاستبدال على قواعد البرنامج الحالية المعروضة من دار التميز.",
    },
    {
      category: "account",
      question: "كيف يعمل تثبيت سعر الفندق؟",
      answer: CUSTOMER_BOOKING_GUIDANCE.hotelPriceHoldFaq.ar,
    },
    {
      category: "account",
      question: "هل يضمن تثبيت السعر جميع تفاصيل الغرفة؟",
      answer:
        "يحمي فقط الغرفة والوجبة وهوية شروط الإلغاء والسعر المؤهل في العرض خلال المدة المحددة وبعد تأكيد المورد. ولا يمدد التوفر بعد الانتهاء ولا يشمل غرفة أو تواريخ أو نزلاء أو شروطاً مختلفة.",
    },
    {
      category: "support",
      question: "كيف أقدم شكوى؟",
      answer:
        "تواصل مع دار التميز وأرسل مرجع الحجز أو الدفع ووصفاً واضحاً والمستندات المؤيدة. سنراجع المشكلة مع المشغل المرخص أو المورد المعني. ويمكن للمستهلك عند انطباق ذلك استخدام قنوات الشكاوى الرسمية لوزارة التجارة والصناعة الكويتية.",
    },
    {
      category: "support",
      question: "ماذا أفعل عند حدوث مشكلة سفر عاجلة؟",
      answer:
        "لإجراء فوري في المطار أو الرحلة أو الفندق، تواصل أولاً مع شركة الطيران أو المطار أو الفندق أو خدمة الطوارئ المحلية، ثم أخبر دار التميز. قد لا تتم مراقبة المحادثة والبريد فوراً ولا يحلان محل المساعدة الطارئة.",
    },
    {
      category: "support",
      question: "كيف أتحقق من صحة رسالة أو رابط دفع؟",
      answer:
        "استخدم بيانات التواصل الظاهرة داخل تطبيق أو موقع دار التميز الرسمي. احذر الروابط غير المتوقعة أو تغيير البيانات البنكية أو الضغط لمشاركة رمز التحقق أو الدفع خارج صفحة الدفع المعتمدة. تحقق عبر قناة معروفة قبل الدفع.",
    },
    {
      category: "support",
      question: "ما الشروط التي تنطبق على حجزي؟",
      answer:
        "تحكم العملية تفاصيل الخدمة والسعر وشروط الإلغاء النهائية وشروط الحجز لدار التميز وشروط المورد أو شركة الطيران وقانون الكويت المعمول به. هذه الأسئلة إرشادات عامة ولا تحل محل الشروط المعروضة لحجزك المحدد.",
    },
    {
      category: "support",
      question: "كيف تحمي دار التميز المعلومات الشخصية؟",
      answer:
        "تستخدم دار التميز المعلومات لتقديم خدمات السفر وإدارة الحسابات والمدفوعات ودعم العملاء والوفاء بالالتزامات القانونية. ينبغي تقديم المعلومات الضرورية فقط واستخدام خيارات طلبات الخصوصية في التطبيق. تخضع المعالجة لسياسة الخصوصية المنشورة ومتطلبات الكويت المعمول بها.",
    },
    {
      category: "support",
      question: "ما القوانين ذات الصلة بالحجوزات الإلكترونية في الكويت؟",
      answer:
        "قد تخضع السجلات والمدفوعات الإلكترونية لقانون المعاملات الإلكترونية الكويتي رقم 20 لسنة 2014. وقد تخضع مسائل المستهلك أيضاً لقانون حماية المستهلك رقم 39 لسنة 2014 ولائحته، بينما قد تشمل الخصوصية وخدمات الاتصالات متطلبات هيئة الاتصالات وتقنية المعلومات. تعتمد الحقوق المحددة على الخدمة والوقائع.",
    },
    {
      category: "support",
      question: "بمن أتواصل بشأن مشكلة تخص شركة الطيران؟",
      answer:
        "تواصل مع دار التميز للمساعدة في الحجز. وتبقى القرارات التشغيلية مثل الجداول والصعود وقبول الأمتعة ومنع السفر والحلول المعتمدة من اختصاص شركة الطيران المشغلة ومزود خدمة الطيران المرخص.",
    },
    {
      category: "support",
      question: "هل تقدم هذه الأسئلة استشارة قانونية أو استشارة تأشيرة وهجرة؟",
      answer:
        "لا. هي إرشادات عامة للعملاء. قد تتغير القواعد وتختلف حسب الجنسية والوجهة وخط السير والظروف الفردية. تحقق من المتطلبات الحالية لدى السفارة أو جهة الهجرة أو شركة الطيران أو المصدر الحكومي الرسمي المعني.",
    },
  ],
};

const CATEGORY_LABELS: Record<Language, Record<FaqCategory, string>> = {
  en: {
    flights: "Flights",
    hotels: "Hotels",
    packages: "Packages",
    payments: "Payments",
    account: "Account",
    support: "Support",
  },
  ar: {
    flights: "الطيران",
    hotels: "الفنادق",
    packages: "الباقات",
    payments: "الدفع",
    account: "الحساب",
    support: "الدعم",
  },
};

const CATEGORIES: FaqCategory[] = ["flights", "hotels", "packages", "payments", "account", "support"];

export function FaqModal({
  visible,
  lang,
  onClose,
}: {
  visible: boolean;
  lang: Language;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isRtl = lang === "ar";
  const title = isRtl ? "الأسئلة الشائعة" : "Frequently asked questions";
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<FaqCategory>("flights");
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleFaqs = useMemo(
    () =>
      FAQS[lang].filter(
        (item) =>
          (normalizedQuery.length > 0 || item.category === activeCategory) &&
          (normalizedQuery.length === 0 ||
            `${item.question} ${item.answer}`.toLocaleLowerCase().includes(normalizedQuery)),
      ),
    [activeCategory, lang, normalizedQuery],
  );

  return (
    <Modal
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
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
            accessibilityLabel={isRtl ? "إغلاق الأسئلة الشائعة" : "Close frequently asked questions"}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            testID="faq-close"
          >
            <HotelPortalIcon name={isRtl ? "arrow-forward" : "arrow-back"} size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.searchArea}>
          <View style={[styles.searchBox, isRtl && styles.rowRtl]}>
            <HotelPortalIcon name="search" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setExpandedQuestion(null);
              }}
              placeholder={isRtl ? "كيف يمكننا مساعدتك؟" : "How can we help you?"}
              placeholderTextColor="#94A3B8"
              style={[styles.searchInput, isRtl && styles.rtlText]}
              accessibilityLabel={isRtl ? "البحث في الأسئلة الشائعة" : "Search frequently asked questions"}
              testID="faq-search"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => {
                  setQuery("");
                  setExpandedQuestion(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={isRtl ? "مسح البحث" : "Clear search"}
                style={styles.clearSearch}
                testID="faq-search-clear"
              >
                <HotelPortalIcon name="close" size={16} color={colors.muted} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.tabsBorder}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.tabs, isRtl && styles.tabsRtl]}
          >
            {CATEGORIES.map((category) => {
              const selected = activeCategory === category && normalizedQuery.length === 0;
              return (
                <Pressable
                  key={category}
                  onPress={() => {
                    setActiveCategory(category);
                    setQuery("");
                    setExpandedQuestion(null);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={[styles.tab, selected && styles.tabActive]}
                  testID={`faq-tab-${category}`}
                >
                  <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                    {CATEGORY_LABELS[lang][category]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 24) + 20 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {visibleFaqs.map((item) => {
            const expanded = expandedQuestion === item.question;
            return (
              <Pressable
                key={item.question}
                onPress={() => setExpandedQuestion(expanded ? null : item.question)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={({ pressed }) => [styles.faqRow, pressed && styles.pressed]}
                testID={`faq-question-${item.category}`}
              >
                <View style={[styles.questionRow, isRtl && styles.rowRtl]}>
                  <Text style={[styles.question, isRtl && styles.rtlText]}>
                    {item.question}
                  </Text>
                  <HotelPortalIcon
                    name={expanded ? "chevron-up" : isRtl ? "chevron-back" : "chevron-forward"}
                    size={20}
                    color={colors.muted}
                  />
                </View>
                {expanded && (
                  <Text style={[styles.answer, isRtl && styles.rtlText]}>
                    {item.answer}
                  </Text>
                )}
              </Pressable>
            );
          })}
          {visibleFaqs.length === 0 && (
            <View style={styles.emptyState}>
              <HotelPortalIcon name="search" size={32} color={colors.muted} />
              <Text style={[styles.emptyTitle, isRtl && styles.rtlText]}>
                {isRtl ? "لم نعثر على سؤال مطابق" : "No matching question found"}
              </Text>
              <Text style={[styles.emptyText, isRtl && styles.rtlText]}>
                {isRtl ? "جرّب كلمات أخرى أو اختر فئة مختلفة." : "Try different words or choose another category."}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.card,
    flex: 1,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.card,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  headerSpacer: { height: 40, width: 40 },
  closeButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
    borderRadius: 20,
  },
  title: {
    color: colors.ink,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    textAlign: "center",
  },
  searchArea: {
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
  },
  searchBox: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.canvas,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.ink,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingVertical: 8,
  },
  clearSearch: {
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsBorder: {
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  tabs: {
    paddingHorizontal: 8,
  },
  tabsRtl: {
    flexDirection: "row-reverse",
  },
  tab: {
    minHeight: 46,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.navy,
  },
  tabText: {
    color: colors.muted,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  tabTextActive: {
    color: colors.navy,
    fontFamily: "Inter_600SemiBold",
  },
  content: {
    backgroundColor: colors.card,
    paddingHorizontal: 16,
  },
  faqRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
  },
  questionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  question: {
    color: colors.ink,
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 22,
  },
  answer: {
    color: colors.ink,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 22,
    backgroundColor: colors.navySoft,
    borderRadius: 8,
    marginTop: 12,
    padding: 14,
  },
  rowRtl: {
    flexDirection: "row-reverse",
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  pressed: {
    opacity: 0.7,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  emptyText: {
    color: colors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
});