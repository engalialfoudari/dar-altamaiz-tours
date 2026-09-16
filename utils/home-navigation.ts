/**
 * Home is deliberately native even though the other booking destinations use
 * the embedded web shell. Keeping this policy pure makes it easy to regress-
 * test both native and web shell implementations.
 */
export function usesNativeDashboard(tabKey: string): boolean {
  return tabKey === "home";
}