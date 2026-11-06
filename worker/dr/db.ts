/** Minimal structural view of a Cloudflare D1 database (also satisfied by the test adapter over node:sqlite). */
export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface D1Like {
  prepare(query: string): D1Stmt;
}

import type { FeatureState, Overrides } from "./features";

let cache: { at: number; db: D1Like; value: Overrides } | null = null;
const TTL_MS = 10_000;

/** Owner overrides, cached per isolate for 10 s. On any database error: no overrides (deploy configuration applies). */
export async function loadOverrides(db: D1Like | undefined, now = Date.now(), fresh = false): Promise<Overrides> {
  if (!db) return new Map();
  if (!fresh && cache && cache.db === db && now - cache.at < TTL_MS) return cache.value;
  try {
    const { results } = await db.prepare("SELECT key, state FROM dr_feature_states").all<{ key: string; state: FeatureState }>();
    const value: Overrides = new Map(results.map((r) => [r.key, r.state]));
    cache = { at: now, db, value };
    return value;
  } catch {
    return new Map();
  }
}
export function invalidateOverrides() { cache = null; }
