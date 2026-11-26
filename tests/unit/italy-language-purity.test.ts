import { describe, expect, it } from "vitest";
import { italianInterface, badiniInterface } from "../../src/app/italyInterface";
import { IT_QUESTIONS } from "../../src/content/italy/questions";
import { IT_CHAPTERS } from "../../src/content/italy/chapters";
import { IT_SIGNS } from "../../src/content/italy/signs";
import { IT_LESSONS } from "../../src/content/italy/lessons";
import type { ItText } from "../../src/content/italy/types";

/**
 * Language purity of the Italian section (owner rule, 2026-11-26):
 * every language is self-contained, nothing mixes, and no screen may fall back to another language.
 * Proper names, codes and technical identifiers are excluded from the text checks, as the rule says.
 */

/** Brand names, codes and official sign legends (STOP) that belong to no single language. */
const TECHNICAL =
  /RegaDRIVE|Rega24|Cloudflare|IndexedDB|Resend|JSON|API|StVO|D1|DM 27\.10\.2021|Patente B|IA\b|ID\b|STOP|\bB\b/g;
const strip = (s: string) => s.replace(TECHNICAL, " ");

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿]/;
const LATIN_SCRIPT = /[A-Za-zÀ-ÿ]/;

/** Words and letters that only German has; they must never appear in Italian text. */
const GERMAN_ONLY = /[ßäöüÄÖÜ]|\b(der|die|das|und|nicht|oder|mit|für|wird|werden|kann|bitte|dein|deine|Konto|Fragen|Impressum)\b/;

/**
 * Markers of Sorani morphology that Duhok Badini never uses: Sorani pronouns and prepositions and the
 * Sorani present tense (دە‑, against Badini د‑). Only grammar is checked, never single words: "من" is
 * the Badini oblique pronoun too ("هەژمارا من"), and nouns such as خزمەتگوزاری are current in Duhok.
 */
const SORANI_MARKERS =
  /\b(تۆ|ئێمە|ئێوە|لەگەڵ|چۆن|چۆنی|کام|بۆچی)\b|دەکات|دەبێت|دەچێت|\bدێت\b|بخوێنەوە/;

/** Markers of Latin-script Kurmanji (Hawar); Badini is Arabic script only. */
const HAWAR_MARKERS = /[şŞçÇêÊîÎûÛ]/;

const itTexts = (): { where: string; t: ItText }[] => [
  ...IT_QUESTIONS.flatMap((q) => [
    { where: `${q.id}.prompt`, t: q.prompt },
    { where: `${q.id}.explanation`, t: q.explanation },
  ]),
  ...IT_CHAPTERS.map((c) => ({ where: `chapter-${c.id}.title`, t: c.title })),
  ...IT_SIGNS.map((s) => ({ where: `sign-${s.id}.name`, t: s.name })),
];

/**
 * Lesson texts are checked for coverage and for Badini wording, but not for Latin letters: a lesson
 * teaches the Italian terms of the Codice della Strada (carreggiata, corsia, banchina), so the Italian
 * word stands inside the Kurdish sentence on purpose.
 */
const lessonTexts = (): { where: string; t: ItText }[] =>
  IT_LESSONS.flatMap((l) => [
    { where: `lesson-${l.chapter}.intro`, t: l.intro },
    { where: `lesson-${l.chapter}.example`, t: l.example },
    ...l.points.map((p, i) => ({ where: `lesson-${l.chapter}.point-${i + 1}`, t: p.text })),
    ...l.checks.flatMap((c) => [
      { where: `lesson-${l.chapter}.${c.id}.statement`, t: c.statement },
      { where: `lesson-${l.chapter}.${c.id}.why`, t: c.why },
    ]),
  ]);

describe("Italian interface strings", () => {
  it("cover every key Badini covers, so no Italian screen falls back to another language", () => {
    const missing = Object.keys(badiniInterface).filter((k) => !(k in italianInterface));
    expect(missing).toEqual([]);
  });

  it("are Italian only: no Arabic script, no German-only wording", () => {
    const leaks = Object.entries(italianInterface).filter(([, v]) => {
      const text = strip(v);
      return ARABIC_SCRIPT.test(text) || GERMAN_ONLY.test(text);
    });
    expect(leaks).toEqual([]);
  });

  it("leave no value empty or untranslated", () => {
    // Words Italian and German spell the same way; Italian dictionaries carry them as loanwords.
    const SHARED_LOANWORDS = new Set(["Offline"]);
    const bad = Object.entries(italianInterface).filter(
      ([k, v]) => !v.trim() || (v === k && !SHARED_LOANWORDS.has(k)),
    );
    expect(bad).toEqual([]);
  });
});

describe("Badini interface strings", () => {
  it("cover every key Italian covers", () => {
    const missing = Object.keys(italianInterface).filter((k) => !(k in badiniInterface));
    expect(missing).toEqual([]);
  });

  it("are Arabic-script Badini: no Latin-script Kurmanji, no Sorani forms", () => {
    const leaks = Object.entries(badiniInterface).filter(([, v]) => {
      const text = strip(v);
      return HAWAR_MARKERS.test(text) || SORANI_MARKERS.test(text);
    });
    expect(leaks).toEqual([]);
  });

  it("carry no Latin letters beyond names, codes and technical identifiers", () => {
    const leaks = Object.entries(badiniInterface).filter(([, v]) => LATIN_SCRIPT.test(strip(v)));
    expect(leaks).toEqual([]);
  });
});

describe("Italian content", () => {
  it("has Italian, Sorani and Badini wording for every item, so nothing falls back", () => {
    const gaps = [...itTexts(), ...lessonTexts()]
      .filter(({ t }) => !t.it?.trim() || !t.ckb?.trim() || !t.kmrArab?.trim())
      .map(({ where }) => where);
    expect(gaps).toEqual([]);
  });

  it("keeps each language in its own script", () => {
    const leaks = itTexts().flatMap(({ where, t }) => {
      const out: string[] = [];
      if (ARABIC_SCRIPT.test(strip(t.it))) out.push(`${where}.it`);
      if (LATIN_SCRIPT.test(strip(t.ckb))) out.push(`${where}.ckb`);
      if (t.kmrArab && LATIN_SCRIPT.test(strip(t.kmrArab))) out.push(`${where}.kmrArab`);
      return out;
    });
    expect(leaks).toEqual([]);
  });

  it("writes Badini in Badini, not Sorani or Latin Kurmanji", () => {
    const leaks = [...itTexts(), ...lessonTexts()]
      .filter(({ t }) => t.kmrArab && (SORANI_MARKERS.test(t.kmrArab) || HAWAR_MARKERS.test(t.kmrArab)))
      .map(({ where }) => `${where}.kmrArab`);
    expect(leaks).toEqual([]);
  });

  it("does not repeat the Italian source as another language's wording", () => {
    const dup = [...itTexts(), ...lessonTexts()]
      .filter(({ t }) => t.ckb === t.it || t.kmrArab === t.it)
      .map(({ where }) => where);
    expect(dup).toEqual([]);
  });
});
