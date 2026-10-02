/**
 * Home is deliberately native even though the other booking destinations use
 * the embedded web shell. Keeping this policy pure makes it easy to regress-
 * test both native and web shell implementations.
 */
export function usesNativeDashboard(tabKey: string): boolean {
  return tabKey === "home";
}

export type EsimDeepLink = {
  open: boolean;
  privateTest: boolean;
  destination: string | null;
};

export function resolveEsimDeepLink(
  search: string,
  isEsimReleased: boolean,
  privateTestEnabled: boolean,
): EsimDeepLink {
  const params = new URLSearchParams(search);
  const destination = params.get("esimDestination");
  const validDestination = destination && /^[a-z0-9-]{1,100}$/.test(destination) ? destination : null;
  const privateTest = privateTestEnabled && params.get("esimPrivateTest") === "1";
  const publicLink = isEsimReleased && (
    params.get("esim") === "1" || validDestination !== null
  );

  if (!privateTest && !publicLink) {
    return { open: false, privateTest: false, destination: null };
  }

  return {
    open: true,
    privateTest,
    destination: privateTest ? validDestination ?? "united-arab-emirates" : validDestination,
  };
}