export const ADMIN_SESSION_EXPIRED_MARKER = "انتهت جلسة الأدمن";

export function isAdminSessionExpiredMessage(content: string): boolean {
  return content.includes(ADMIN_SESSION_EXPIRED_MARKER);
}

export function getAdminTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[0];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = globalThis.atob(padded);
    const parsed = JSON.parse(decoded) as { exp?: unknown };

    return typeof parsed.exp === "number" && Number.isFinite(parsed.exp)
      ? parsed.exp
      : null;
  } catch {
    return null;
  }
}