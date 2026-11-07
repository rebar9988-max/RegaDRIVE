import type { Bilingual, Question } from "../content/types";
import { VOCABULARY } from "../content/vocabulary";
import { topicById } from "../content/topics";
import { questionStatus, type ProgressState } from "./progress";

export type StatusFilter = "all" | "unanswered" | "incorrect" | "mastered";
export interface QuestionFilter {
  text: string;
  status: StatusFilter;
  points: (2 | 3 | 4 | 5)[];
  category: "all" | "Grundstoff" | "Zusatzstoff";
  topicId: string | "all";
  bookmarkedOnly: boolean;
}
export const defaultFilter = (): QuestionFilter => ({ text: "", status: "all", points: [], category: "all", topicId: "all", bookmarkedOnly: false });

/** Normalizes script variants so Sorani, Arabic and Kurmanji search is forgiving (ي/ى/ی, ك/ک, ة/ە, hamza and diacritics, ê/î/û/ç/ş, digits). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/ة/g, "ە")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .trim();
}

const texts = (t: Bilingual) => [t.ckb, t.de, t.kmr ?? "", t.ar ?? ""];

export function haystack(q: Question): string {
  const vocab = q.vocabularyIds.map((id) => VOCABULARY.find((v) => v.id === id)).filter(Boolean).map((v) => `${v!.de} ${v!.ckb} ${v!.kmr ?? ""} ${v!.ar ?? ""}`);
  const topic = topicById(q.topicId);
  return normalize([
    ...texts(q.prompt), ...q.options.flatMap((o) => texts(o.text)),
    ...texts(q.explanation), ...(topic ? texts(topic.title) : []), ...vocab, q.questionCode ?? "",
  ].join(" "));
}

export function filterQuestions(all: Question[], f: QuestionFilter, progress: ProgressState, threshold: number): Question[] {
  const terms = normalize(f.text).split(/\s+/).filter(Boolean);
  return all.filter((q) => {
    if (f.category !== "all" && q.categoryType !== f.category) return false;
    if (f.topicId !== "all" && q.topicId !== f.topicId) return false;
    if (f.points.length && (q.points === null || !f.points.includes(q.points))) return false;
    if (f.bookmarkedOnly && !progress.bookmarks.includes(q.id)) return false;
    if (f.status !== "all") {
      const st = questionStatus(progress.questions[q.id], threshold);
      if (f.status !== st) return false;
    }
    if (terms.length) {
      const h = haystack(q);
      if (!terms.every((t) => h.includes(t))) return false;
    }
    return true;
  });
}
