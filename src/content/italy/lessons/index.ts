import { IT_LESSONS_1_4 } from "./part1.ts";
import { IT_LESSONS_5_8 } from "./part2.ts";
import { IT_LESSONS_9_12 } from "./part3.ts";
import { IT_LESSONS_13_16 } from "./part4.ts";
import type { ItLesson } from "./types.ts";

export type { ItLesson, ItLessonCheck, ItLessonPoint } from "./types.ts";

/**
 * The 16 lessons of the Italian section, one per syllabus chapter.
 *
 * Original RegaDRIVE teaching material, written for this app and referenced to the Codice della
 * Strada. It is not ministerial examination material and never claims to be: every lesson carries the
 * same "original content, under review" notice as the rest of the Italian section, and the examination
 * bank (src/content/italy/questions.ts) stays separate and separately gated.
 */
export const IT_LESSONS: ItLesson[] = [...IT_LESSONS_1_4, ...IT_LESSONS_5_8, ...IT_LESSONS_9_12, ...IT_LESSONS_13_16];

export const itLessonFor = (chapter: number): ItLesson | undefined => IT_LESSONS.find((l) => l.chapter === chapter);
