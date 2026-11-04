/** Consume progress without ever promoting provisional fares to bookable results. */
export async function readFlightResponse(response, onProgress = () => {}) {
  if (!response.headers?.get("content-type")?.includes("text/event-stream")) return response.json();
  let pending = "";
  let final;
  let correlationId;
  let sequence = -1;
  const consume = (text) => {
    pending = (pending + text).replace(/\r\n/g, "\n");
    if (pending.length > 16 * 1024 * 1024) throw new Error("Flight event too large");
    let boundary;
    while ((boundary = pending.indexOf("\n\n")) >= 0) {
      const block = pending.slice(0, boundary);
      pending = pending.slice(boundary + 2);
      const event = block.split("\n").find(line => line.startsWith("event:"))?.slice(6).trim();
      const data = block.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
      if (!data) continue;
      const value = JSON.parse(data);
      if (event !== "progress" && event !== "complete") continue;
      if (final) throw new Error("Flight event after completion");
      if (typeof value.correlationId === "string") {
        if (correlationId && correlationId !== value.correlationId) throw new Error("Cross-search flight event");
        correlationId = value.correlationId;
      }
      if (typeof value.sequence === "number") {
        if (!Number.isSafeInteger(value.sequence) || value.sequence <= sequence) throw new Error("Stale flight event");
        sequence = value.sequence;
      }
      if (event === "progress") onProgress({ ...value,
        // A progress event can never grant booking authority, even if malformed.
        flights: Array.isArray(value.flights) ? value.flights.map(({ quoteToken, ...f }) => ({ ...f, provisional: true })) : [],
      });
      if (event === "complete") final = value;
    }
  };
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        consume(decoder.decode(value, { stream: true }));
      }
      consume(decoder.decode());
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally { reader.releaseLock(); }
  } else {
    // Some native fetch implementations buffer the body. No second search is sent.
    consume(await response.text());
  }
  if (!final) throw new Error("Flight search ended before a final response");
  return final;
}

/** Called from a React post-commit effect. Two frames include the paint between
 * them; unlike provider callbacks this records the visible client stage.
 * No network or customer data is collected here.
 */
export function markFlightPaint(correlationId, stage) {
  if (typeof requestAnimationFrame !== "function" || typeof performance?.mark !== "function") return () => {};
  let second;
  const first = requestAnimationFrame(() => {
    second = requestAnimationFrame(() => performance.mark(`flight:${correlationId}:${stage}:paint`));
  });
  return () => { cancelAnimationFrame(first); if (second) cancelAnimationFrame(second); };
}
