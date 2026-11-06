export function retry<T>(fn: (attempt: number) => Promise<T>, opts?: { attempts?: number; baseMs?: number; maxMs?: number; isRecoverable?: (e: unknown) => boolean; onRetry?: (e: unknown, attempt: number, waitMs: number) => void }): Promise<T>;
export function isNetworkError(e: unknown): boolean;
