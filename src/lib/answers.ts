import type { Question } from "../content/types";
import { isAnswerCorrect, isNumericAnswerCorrect } from "./shared/exam";

/** One correctness rule for every answer type. `answer` holds option ids, or [typedValue] for number questions. */
export function isQuestionAnswerCorrect(q: Question, answer: readonly string[]): boolean {
  if (q.answerType === "number") return q.numericAnswer !== undefined && answer.length === 1 && isNumericAnswerCorrect(answer[0]!, q.numericAnswer);
  return isAnswerCorrect(answer, q.correct);
}
