import { useCallback, useEffect, useRef } from "react";

interface ClerkAccountState {
  isLoaded: boolean;
  isSignedIn?: boolean;
  sessionId?: string | null;
  userId?: string | null;
}

export function useAccountRequestGuard({
  isLoaded,
  isSignedIn,
  sessionId,
  userId,
}: ClerkAccountState) {
  const mountedRef = useRef(true);
  const accountGenerationRef = useRef(0);
  const accountKeyRef = useRef<string | null>(null);
  const accountKey = isLoaded
    ? `${isSignedIn ? "signed-in" : "signed-out"}:${sessionId ?? ""}:${userId ?? ""}`
    : null;

  if (accountKeyRef.current !== accountKey) {
    accountKeyRef.current = accountKey;
    accountGenerationRef.current += 1;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const getAccountGeneration = useCallback(
    () => accountGenerationRef.current,
    [],
  );

  const isCurrentRequest = useCallback(
    (generation: number) =>
      mountedRef.current && accountGenerationRef.current === generation,
    [],
  );

  return {
    accountKey,
    getAccountGeneration,
    isCurrentRequest,
  };
}