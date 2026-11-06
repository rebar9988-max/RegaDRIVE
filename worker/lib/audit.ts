/** Structured audit log for administrative actions. Never contains secrets, tokens or file contents. */
export interface AuditEvent {
  at: string;
  actor: string;
  action: string;
  outcome: "allowed" | "denied" | "failed";
  detail?: Record<string, string | number | boolean | null>;
}
export interface AuditSink { write(e: AuditEvent): void | Promise<void> }

/** Default sink: one JSON line per event in Workers Logs (observability is enabled in wrangler.jsonc). */
export const consoleAuditSink: AuditSink = { write: (e) => console.log(JSON.stringify({ type: "audit", ...e })) };

export async function audit(sink: AuditSink, actor: string, action: string, outcome: AuditEvent["outcome"], detail?: AuditEvent["detail"]) {
  await sink.write({ at: new Date().toISOString(), actor, action, outcome, detail });
}
