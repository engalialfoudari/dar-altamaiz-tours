/**
 * The auth browser and Expo Router can receive the same one-use OAuth nonce.
 * Share its completion so a second receiver cannot consume it a second time.
 * This cache contains only short-lived in-memory promises, never persistent data.
 */
type SessionResource = {
  firstFactorVerification?: { status?: string | null } | null;
  createdSessionId?: string | null;
  existingSession?: { sessionId?: string } | null;
  create?: (params: { transfer: true }) => Promise<{ error?: unknown }>;
  finalize?: (params: { navigate: () => Promise<void> }) => Promise<{ error?: unknown }>;
};

type Dependencies = {
  rotatingTokenNonce: string;
  reloadSignIn: (params: { rotatingTokenNonce: string }) => Promise<{
    __internal_future: SessionResource;
  }>;
  signUp: SessionResource;
  setActive: (params: { session: string }) => Promise<unknown>;
};

const completions = new Map<string, { expiresAt: number; promise: Promise<string> }>();

export function clearNativeGoogleSessionCompletions(): void {
  completions.clear();
}

export function completeNativeGoogleSession({
  rotatingTokenNonce, reloadSignIn, signUp, setActive,
}: Dependencies): Promise<string> {
  if (!rotatingTokenNonce) {
    return Promise.reject(new Error("Google did not return a valid sign-in response."));
  }
  const now = Date.now();
  for (const [nonce, entry] of completions) {
    if (entry.expiresAt <= now) completions.delete(nonce);
  }
  const existing = completions.get(rotatingTokenNonce);
  if (existing) return existing.promise;
  while (completions.size >= 16) completions.delete(completions.keys().next().value!);
  const promise = (async () => {
    const signIn = (await reloadSignIn({ rotatingTokenNonce })).__internal_future;
    const needsSignUp = signIn.firstFactorVerification?.status === "transferable";
    if (needsSignUp) {
      if (!signUp.create) throw new Error("Google account creation is unavailable.");
      const { error } = await signUp.create({ transfer: true });
      if (error) throw error;
    }
    const resource = needsSignUp ? signUp : signIn;
    const sessionId = resource.createdSessionId ?? resource.existingSession?.sessionId;
    if (!sessionId) throw new Error("Google sign-in could not be completed.");
    // Core 3 may return an existing session without a new createdSessionId.
    // Existing sessions are activated, not finalized as a new sign-in.
    if (resource.createdSessionId) {
      if (!resource.finalize) throw new Error("Google session completion is unavailable.");
      const { error } = await resource.finalize({ navigate: async () => {} });
      if (error) throw error;
    }
    await setActive({ session: sessionId });
    return sessionId;
  })();
  completions.set(rotatingTokenNonce, { expiresAt: now + 120_000, promise });
  void promise.catch(() => {
    if (completions.get(rotatingTokenNonce)?.promise === promise) completions.delete(rotatingTokenNonce);
  });
  return promise;
}
