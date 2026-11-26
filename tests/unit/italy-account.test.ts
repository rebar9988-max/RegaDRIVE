import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ITU } from "../../src/content/italy/ui";
import type { ItText } from "../../src/content/italy/types";

/**
 * The Italian account: free for ever (owner rule) and self-contained in Italy's own languages.
 *
 * The wording lives in ITU.account, so tests/unit/italy-ui-strings.test.ts already checks that each
 * entry exists in Italian, Sorani and Badini and stays in its own script. What is checked here is
 * what that test cannot see: that the screen never offers a purchase, and that every error the
 * student API can answer with has wording of its own instead of falling back to a generic sentence.
 */
const PAGE = readFileSync(new URL("../../src/pages/ItalyAccount.tsx", import.meta.url), "utf8");
const HANDLER = readFileSync(new URL("../../worker/students/handler.ts", import.meta.url), "utf8");

const entries = Object.entries(ITU.account) as [string, ItText][];
/** "nessun pagamento" is a promise, not an offer: the denial is removed before the words are looked for. */
const WITHOUT_DENIALS = /nessun[ao]?\s+\S+|senza\s+\S+|bê\s+\S+/gi;

describe("the Italian account screen is free", () => {
  it("never offers a price, a plan or a purchase in the Italian source wording", () => {
    const offers = entries.flatMap(([key, t]) =>
      (/prezzo|abbonament|acquist|paga(re|mento)|premium/i.test(t.it.replace(WITHOUT_DENIALS, " ")) ? [key] : []));
    expect(offers).toEqual([]);
  });

  it("shows no amount of money in any of the three languages", () => {
    const priced = entries.flatMap(([key, t]) =>
      (/[€$£]|\d+[.,]\d{2}/.test(`${t.it} ${t.ckb} ${t.kmrArab ?? ""}`) ? [key] : []));
    expect(priced).toEqual([]);
  });

  it("states plainly that the account costs nothing", () => {
    expect(ITU.account.free.it.toLowerCase()).toContain("gratis");
    expect(ITU.account.noCard.it.toLowerCase()).toContain("nessun");
  });

  it("promises that the course is open without an account", () => {
    expect(ITU.account.openNow.it.length).toBeGreaterThan(10);
    expect(ITU.account.keepsLocal.it.length).toBeGreaterThan(10);
  });
});

describe("the Italian account screen answers every error the API can return", () => {
  it("maps each error code of the student API to its own wording", () => {
    const codes = [...HANDLER.matchAll(/error:\s*"([A-Z_]+)"/g)].map((m) => m[1]!);
    const ignored = new Set(["METHOD_NOT_ALLOWED", "NOT_FOUND", "BAD_REQUEST", "FORBIDDEN"]);
    const missing = [...new Set(codes)].filter((c) => !ignored.has(c) && !PAGE.includes(`${c}:`));
    expect(missing).toEqual([]);
  });

  it("never sends the session token through JavaScript", () => {
    expect(PAGE).not.toMatch(/document\.cookie/);
    expect(PAGE).toContain('credentials: "same-origin"');
    expect(PAGE).toContain('"x-rd-request": "1"');
  });
});
