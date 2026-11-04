export interface FlightProgress { status: "searching"; provisionalCount: number; correlationId: string; message: string; messageAr: string; sequence?: number; flights?: Record<string, any>[] }
export function readFlightResponse<T = any>(response: Response, onProgress?: (progress: FlightProgress) => void): Promise<T>;
export function markFlightPaint(correlationId: string, stage: "provisional" | "final"): () => void;
