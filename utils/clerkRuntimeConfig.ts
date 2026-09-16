export type ClerkRuntimeConfig = {
  publishableKey: string;
  proxyUrl: string;
};

export function parseClerkRuntimeConfig(value: unknown): ClerkRuntimeConfig {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid authentication configuration");
  }

  const publishableKey = Reflect.get(value, "publishableKey");
  const proxyUrl = Reflect.get(value, "proxyUrl");

  if (
    typeof publishableKey !== "string" ||
    !publishableKey.startsWith("pk_") ||
    typeof proxyUrl !== "string" ||
    !proxyUrl.startsWith("https://") ||
    !proxyUrl.endsWith("/api/__clerk")
  ) {
    throw new Error("Invalid authentication configuration");
  }

  return { publishableKey, proxyUrl };
}