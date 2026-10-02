/**
 * Tracks quote requests separately from order creation. Editing checkout inputs
 * invalidates the old quote immediately, so an outdated network response cannot
 * hold the Pay button hostage or clear the state of a newer quote.
 */
export class EsimQuoteSequence {
  sequence = 0;
  private running: number | null = null;

  invalidate(): void {
    this.sequence += 1;
    this.running = null;
  }

  begin(): number | null {
    if (this.running === this.sequence) return null;
    const token = ++this.sequence;
    this.running = token;
    return token;
  }

  isCurrent(token: number): boolean {
    return this.sequence === token;
  }

  finish(token: number): boolean {
    if (this.running !== token) return false;
    this.running = null;
    return true;
  }
}