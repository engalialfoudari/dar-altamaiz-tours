export type BillingFields = {
  country: string;
};
export const EMPTY_BILLING: BillingFields = {
  country: "",
};
export function serializeBilling(fields: BillingFields) {
  return fields.country.trim() ? `Country: ${fields.country.trim()}` : "";
}
export function parseBilling(value: string | null | undefined): BillingFields {
  if (!value) return { ...EMPTY_BILLING };
  const countries = value.split(/\r?\n/).filter((line) => line.startsWith("Country: "));
  if (countries.length !== 1) return { ...EMPTY_BILLING };
  const country = countries[0].slice("Country: ".length).trim();
  return country ? { country } : { ...EMPTY_BILLING };
}

export function normalizeNationalPhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidE164(dialCode: string, nationalNumber: string): boolean {
  const digits = `${dialCode}${normalizeNationalPhone(nationalNumber)}`;
  return /^\d{7,15}$/.test(digits);
}