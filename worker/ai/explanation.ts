import { isLang } from "../../src/app/i18n";
import { sourceText, textLines, type AnyText } from "../../src/app/anyText";
import { isQuestionVisible, type ContentMode } from "../../src/content/access";
import { itQuestionHash } from "../../src/content/italy/hash";
import { IT_QUESTIONS } from "../../src/content/italy/questions";
import { questionById } from "../../src/content/questions";
import { approvedContent } from "../dr/reviews";
import type { D1Like } from "../dr/db";
import { SYSTEM_PROMPT } from "./gateway";

const LANGUAGE_NAMES = {
  ckb: "Kurdish Sorani", kmr: "Kurdish Kurmanji (Latin script)", "kmr-arab": "Kurdish Badini (Arabic script)",
  ar: "Arabic", de: "German", it: "Italian",
};
const IT_QUESTION_BY_ID = new Map(IT_QUESTIONS.map((question) => [question.id, question]));

export function parseExplanationRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.keys(value).some((key) => key !== "questionId" && key !== "lang")) return null;
  const { questionId, lang = "ckb" } = value as { questionId?: unknown; lang?: unknown };
  if (typeof questionId !== "string" || !questionId || questionId.length > 40 || !isLang(lang)) return null;
  return { questionId, lang };
}

export async function explanationFor(request: NonNullable<ReturnType<typeof parseExplanationRequest>>, mode: ContentMode, db?: D1Like) {
  const { questionId, lang } = request;
  const it = IT_QUESTION_BY_ID.get(questionId);
  const de = questionById(questionId);
  if (!it && !de) return { error: "UNKNOWN_CONTENT" } as const;
  let source: string;
  let prompt: string;
  let correct: string;
  let explanation: AnyText;
  if (it) {
    if (it.publicationStatus !== "published" || (mode === "production" && (await approvedContent(db)).itQuestions[it.id] !== itQuestionHash(it))) {
      return { error: "CONTENT_NOT_APPROVED" } as const;
    }
    source = "Italy (Patente B)";
    prompt = it.prompt.it;
    correct = it.answer ? "VERO" : "FALSO";
    explanation = it.explanation;
  } else {
    if (!de || !isQuestionVisible(questionId, mode)) return { error: "CONTENT_NOT_APPROVED" } as const;
    source = "Germany (Klasse B)";
    prompt = de.prompt.de;
    correct = de.answerType === "number" ? String(de.numericAnswer ?? "") : de.options.filter((option) => de.correct.includes(option.id)).map((option) => option.text.de).join(" | ");
    explanation = de.explanation;
  }
  const fallback = textLines(explanation, lang, false).primary;
  const original = sourceText(explanation);
  return {
    fallback,
    chat: {
      system: SYSTEM_PROMPT,
      user: JSON.stringify({
        course: source,
        question: prompt,
        correctAnswer: correct,
        originalExplanation: original,
        explanationInAnswerLanguage: fallback.text,
        answerLanguage: LANGUAGE_NAMES[fallback.lang],
      }),
      maxTokens: 350,
    },
  };
}
