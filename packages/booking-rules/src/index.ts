const PACKAGE_DEPOSIT_RATE = 0.25;

export const BOOKING_RULES = {
  hotelPriceHold: {
    feeKwdByHours: { 24: 1, 48: 2 },
    pointsByHours: { 24: 200, 48: 350 },
  },
  packageDeposit: {
    rate: PACKAGE_DEPOSIT_RATE,
    percent: PACKAGE_DEPOSIT_RATE * 100,
    remainingRate: 1 - PACKAGE_DEPOSIT_RATE,
    remainingPercent: (1 - PACKAGE_DEPOSIT_RATE) * 100,
    refundableBeforeDepartureHours: 72,
    refundableBeforeDepartureDays: 3,
  },
} as const;

export function calculatePackageDeposit(total: number): number {
  return Math.round(total * BOOKING_RULES.packageDeposit.rate * 1000) / 1000;
}

export function calculatePackageBalance(total: number): number {
  return Math.round(total * BOOKING_RULES.packageDeposit.remainingRate * 1000) / 1000;
}

const priceHold = BOOKING_RULES.hotelPriceHold;
const packageDeposit = BOOKING_RULES.packageDeposit;

export const CUSTOMER_BOOKING_GUIDANCE = {
  hotelPriceHoldFaq: {
    en: `An eligible signed hotel quote may offer a 24-hour hold for KWD ${priceHold.feeKwdByHours[24]} or ${priceHold.pointsByHours[24]} points, or a 48-hour hold for KWD ${priceHold.feeKwdByHours[48]} or ${priceHold.pointsByHours[48]} points. The hold fee is non-refundable. A hold is active only after supplier confirmation; payment may show as processing while confirmation is pending.`,
    ar: `قد يتيح عرض فندق مؤهل وموقّع تثبيت السعر 24 ساعة مقابل ${priceHold.feeKwdByHours[24]} د.ك أو ${priceHold.pointsByHours[24]} نقطة، أو 48 ساعة مقابل ${priceHold.feeKwdByHours[48]} د.ك أو ${priceHold.pointsByHours[48]} نقطة. رسوم التثبيت غير قابلة للاسترداد، ولا يصبح التثبيت فعالاً إلا بعد تأكيد المورد وقد يظهر الدفع قيد المعالجة أثناء الانتظار.`,
  },
  packageDepositFaq: {
    en: `The app's package deposit is ${packageDeposit.percent}%. It is fully refundable when cancellation is made at least ${packageDeposit.refundableBeforeDepartureHours} hours (${packageDeposit.refundableBeforeDepartureDays} days) before departure and non-refundable within ${packageDeposit.refundableBeforeDepartureDays} days of departure. Paying the deposit accepts the shown terms, but the booking is confirmed only after DT Tours issues an official confirmation document.`,
    ar: `عربون الباقة في التطبيق هو ${packageDeposit.percent}%. يُسترد بالكامل عند الإلغاء قبل موعد المغادرة بما لا يقل عن ${packageDeposit.refundableBeforeDepartureHours} ساعة (${packageDeposit.refundableBeforeDepartureDays} أيام)، ولا يُسترد عند الإلغاء خلال أقل من ${packageDeposit.refundableBeforeDepartureDays} أيام من المغادرة. دفع العربون يعني قبول الشروط المعروضة، لكن الحجز لا يصبح مؤكداً إلا بعد إصدار دار التميز وثيقة تأكيد رسمية.`,
  },
  packageTerms: {
    cancellation: {
      concise: {
        en: `Clients may cancel and receive a full refund of the deposit provided cancellation is made at least ${packageDeposit.refundableBeforeDepartureHours} hours (${packageDeposit.refundableBeforeDepartureDays} days) before departure. Deposits are non-refundable for cancellations within ${packageDeposit.refundableBeforeDepartureDays} days of departure.`,
        ar: "يحق للعميل إلغاء الحجز والحصول على استرداد كامل للعربون المدفوع بشرط أن يكون الإلغاء قبل ٧٢ ساعة (٣ أيام) من تاريخ بدء الرحلة. لا يُسترد العربون في حال الإلغاء خلال أقل من ٣ أيام من تاريخ المغادرة.",
      },
      detailed: {
        en: `Clients may cancel and receive a full refund of the deposit provided cancellation is made at least ${packageDeposit.refundableBeforeDepartureHours} hours (${packageDeposit.refundableBeforeDepartureDays} days) before the trip departure date. Deposits are non-refundable for cancellations made within ${packageDeposit.refundableBeforeDepartureDays} days of departure.`,
        ar: "يحق للعميل إلغاء الحجز والحصول على استرداد كامل للعربون المدفوع بشرط أن يكون الإلغاء قبل ٧٢ ساعة (٣ أيام) من تاريخ بدء الرحلة. لا يُسترد العربون في حال الإلغاء خلال أقل من ٣ أيام من تاريخ المغادرة.",
      },
    },
    confirmation: {
      concise: {
        en: "Payment of the deposit constitutes acceptance of these Terms. A booking is confirmed only after our team issues an official confirmation document.",
        ar: "دفع العربون قبول صريح لهذه الشروط. يُعتبر الحجز مؤكداً فقط بعد تواصل فريقنا مع العميل وإصدار وثيقة التأكيد الرسمية.",
      },
      detailed: {
        en: "Payment of the deposit constitutes explicit acceptance of these Terms & Conditions. A booking is considered confirmed only after our team contacts the client and issues an official booking confirmation document. All bookings are subject to seat and room availability at the time of confirmation.",
        ar: "يُعدّ دفع العربون قبولاً صريحاً لهذه الشروط والأحكام. يُعتبر الحجز مؤكداً فقط بعد تواصل فريقنا مع العميل وإصدار وثيقة تأكيد الحجز الرسمية. تخضع جميع الحجوزات لتوفر المقاعد والغرف وقت التأكيد.",
      },
    },
  },
} as const;