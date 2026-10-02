export function isPrivateEsimTestEnabled(isDevelopment: boolean, publicFlag: string | undefined): boolean {
  return isDevelopment || publicFlag === "true";
}

export const PRIVATE_ESIM_TRIAL = {
  slug: "world",
  packageId: "discover-in-3days-300mb",
  paymentMethods: ["knet", "cc", "apple-pay", "samsung-pay"],
  maxAmountFils: 321,
} as const;

export function isPrivateEsimTrialPackage(slug: string, packageId: string): boolean {
  return slug === PRIVATE_ESIM_TRIAL.slug && packageId === PRIVATE_ESIM_TRIAL.packageId;
}

export function isPrivateEsimTrialQuote(
  slug: string,
  packageId: string,
  paymentMethod: string,
  promoCode: string,
  amountFils: number,
): boolean {
  return isPrivateEsimTrialPackage(slug, packageId)
    && (PRIVATE_ESIM_TRIAL.paymentMethods as readonly string[]).includes(paymentMethod)
    && promoCode === ""
    && Number.isSafeInteger(amountFils)
    && amountFils > 0
    && amountFils <= PRIVATE_ESIM_TRIAL.maxAmountFils;
}