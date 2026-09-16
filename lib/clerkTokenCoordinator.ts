export type ClerkGetToken = () => Promise<string | null>;

const inFlightTokenRequests = new Map<string, Promise<string | null>>();

export function requestClerkToken({
  sessionId,
  getToken,
}: {
  sessionId: string | null | undefined;
  getToken: ClerkGetToken;
}): Promise<string | null> {
  if (!sessionId) {
    return Promise.resolve().then(() => getToken());
  }

  const existing = inFlightTokenRequests.get(sessionId);
  if (existing) return existing;

  const request = Promise.resolve().then(() => getToken());
  inFlightTokenRequests.set(sessionId, request);
  void request.finally(() => {
    if (inFlightTokenRequests.get(sessionId) === request) {
      inFlightTokenRequests.delete(sessionId);
    }
  }).catch(() => {});
  return request;
}