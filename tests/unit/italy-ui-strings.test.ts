import { describe, expect, it } from "vitest";
import { ITU } from "../../src/content/italy/ui";
import { IT_INCROCI, IT_INCROCI_GROUPS } from "../../src/content/italy/incroci";
import type { ItText } from "../../src/content/italy/types";

/**
 * Language isolation (owner rule, 2026-11-26) for the wording the new Italian screens use: every
 * string exists in Italian, Sorani and Badini, each stays in its own language and script, and no
 * screen can fall back to another language. Proper names, codes and technical identifiers are
 * excluded from the checks, as the rule says.
 */
const TECHNICAL = /RegaDRIVE|Rega24|Cloudflare|CdS|STOP|Patente B|\bB\b/g;
const strip = (s: string) => s.replace(TECHNICAL, " ");

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿]/;
const LATIN_SCRIPT = /[A-Za-zÀ-ÿ]/;
const GERMAN_ONLY = /[ßäöüÄÖÜ]|\b(der|die|das|und|nicht|oder|mit|für|wird|werden|kann|bitte|dein|deine|Konto|Fragen|Impressum)\b/;
const SORANI_MARKERS = /\b(تۆ|ئێمە|ئێوە|لەگەڵ|چۆن|چۆنی|کام|بۆچی)\b|دەکات|دەبێت|دەچێت|\bدێت\b|بخوێنەوە|دەڕوات|دەپەڕێت/;
const HAWAR_MARKERS = /[şŞçÇêÊîÎûÛ]/;

/** Every ItText the new screens can show, with the place it comes from. */
const texts = (): { where: string; t: ItText }[] => [
  ...Object.entries(ITU).flatMap(([group, entries]) =>
    Object.entries(entries as Record<string, ItText>).map(([key, t]) => ({ where: `ITU.${group}.${key}`, t }))),
  ...IT_INCROCI.flatMap((s) => [
    { where: `${s.id}.title`, t: s.title },
    { where: `${s.id}.rule`, t: s.rule },
    { where: `${s.id}.why`, t: s.why },
  ]),
  ...IT_INCROCI_GROUPS.flatMap((g) => [
    { where: `group-${g.id}.title`, t: g.title },
    { where: `group-${g.id}.subtitle`, t: g.subtitle },
  ]),
];

describe("wording of the new Italian screens", () => {
  it("exists in Italian, Sorani and Badini for every entry", () => {
    const gaps = texts().filter(({ t }) => !t.it?.trim() || !t.ckb?.trim() || !t.kmrArab?.trim()).map(({ where }) => where);
    expect(gaps).toEqual([]);
  });

  it("keeps the Italian wording Italian: no Arabic script, no German-only words", () => {
    const leaks = texts().filter(({ t }) => ARABIC_SCRIPT.test(strip(t.it)) || GERMAN_ONLY.test(strip(t.it))).map(({ where }) => where);
    expect(leaks).toEqual([]);
  });

  it("keeps Sorani and Badini in Arabic script, beyond names and codes", () => {
    const leaks = texts().flatMap(({ where, t }) => {
      const out: string[] = [];
      if (LATIN_SCRIPT.test(strip(t.ckb))) out.push(`${where}.ckb`);
      if (t.kmrArab && LATIN_SCRIPT.test(strip(t.kmrArab))) out.push(`${where}.kmrArab`);
      return out;
    });
    expect(leaks).toEqual([]);
  });

  it("writes Badini in Badini, not in Sorani and not in Latin-script Kurmanji", () => {
    const leaks = texts()
      .filter(({ t }) => t.kmrArab && (SORANI_MARKERS.test(t.kmrArab) || HAWAR_MARKERS.test(t.kmrArab)))
      .map(({ where }) => `${where}.kmrArab`);
    expect(leaks).toEqual([]);
  });

  it("never repeats the Italian source as the wording of another language", () => {
    const dup = texts().filter(({ t }) => t.ckb === t.it || t.kmrArab === t.it).map(({ where }) => where);
    expect(dup).toEqual([]);
  });
});
