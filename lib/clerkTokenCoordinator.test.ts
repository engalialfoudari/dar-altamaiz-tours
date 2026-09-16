import { requestClerkToken } from "./clerkTokenCoordinator";

describe("requestClerkToken", () => {
  it("reuses an in-flight token request for the same Clerk session", async () => {
    let resolveToken!: (token: string | null) => void;
    const getToken = jest.fn(() => new Promise<string | null>((resolve) => {
      resolveToken = resolve;
    }));

    const first = requestClerkToken({ sessionId: "session-a", getToken });
    const second = requestClerkToken({ sessionId: "session-a", getToken });

    expect(first).toBe(second);
    expect(getToken).toHaveBeenCalledTimes(0);
    await Promise.resolve();
    expect(getToken).toHaveBeenCalledTimes(1);

    resolveToken("token-a");
    await expect(Promise.all([first, second])).resolves.toEqual(["token-a", "token-a"]);
  });

  it("cleans up a rejected request so the session can retry", async () => {
    const getToken = jest.fn()
      .mockRejectedValueOnce(new Error("provider unavailable"))
      .mockResolvedValueOnce("recovered-token");

    await expect(requestClerkToken({
      sessionId: "session-retry",
      getToken,
    })).rejects.toThrow("provider unavailable");

    await expect(requestClerkToken({
      sessionId: "session-retry",
      getToken,
    })).resolves.toBe("recovered-token");
    expect(getToken).toHaveBeenCalledTimes(2);
  });

  it("never shares requests across sessions", async () => {
    const resolvers: Array<(token: string | null) => void> = [];
    const getToken = jest.fn(() => new Promise<string | null>((resolve) => {
      resolvers.push(resolve);
    }));

    const first = requestClerkToken({ sessionId: "session-a", getToken });
    const switchedSession = requestClerkToken({ sessionId: "session-b", getToken });
    await Promise.resolve();

    expect(getToken).toHaveBeenCalledTimes(2);
    resolvers[0]("token-a");
    resolvers[1]("token-b");
    await expect(Promise.all([first, switchedSession])).resolves.toEqual([
      "token-a",
      "token-b",
    ]);
  });

  it("shares the same session request while Clerk user state catches up", async () => {
    let resolveToken!: (token: string | null) => void;
    const getToken = jest.fn(() => new Promise<string | null>((resolve) => {
      resolveToken = resolve;
    }));

    const duringActivation = requestClerkToken({ sessionId: "activated-session", getToken });
    const afterUserLoaded = requestClerkToken({ sessionId: "activated-session", getToken });
    await Promise.resolve();

    expect(duringActivation).toBe(afterUserLoaded);
    expect(getToken).toHaveBeenCalledTimes(1);
    resolveToken("activated-token");
    await expect(Promise.all([duringActivation, afterUserLoaded])).resolves.toEqual([
      "activated-token",
      "activated-token",
    ]);
  });
});