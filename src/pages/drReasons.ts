/**
 * Why an item is not published, in Sorani, for the /dr review screens. Every reason the fail-closed
 * publication gate (src/content/pipeline.ts) or the review evaluation (worker/dr/reviews.ts) can give is
 * mapped; the original English code is kept beside it so nothing is hidden or reworded away.
 */
const STAGE: Record<string, string> = {
  SOURCE_CHECK: "پشکنینی سەرچاوە",
  LICENSE_CHECK: "پشکنینی مۆڵەت",
  TRANSLATION_REVIEW: "پێداچوونەوەی وەرگێڕان (وەرگێڕی سۆرانی)",
  EDUCATIONAL_REVIEW: "پێداچوونەوەی فێرکاری (مامۆستای شۆفێری)",
  APPROVED: "پەسەندکردنی کۆتایی (خاوەن)",
};
const stage = (s: string) => STAGE[s] ?? s;

const FIXED: Record<string, string> = {
  "no content record": "تۆماری ناوەڕۆک نییە",
  "incomplete provenance": "سەرچاوەی دروستکردن (نووسەر و بەروار) تەواو نییە",
  "no source references": "سەرچاوەی یاسایی تۆمار نەکراوە",
  "licensed content without licence record": "ناوەڕۆکی مۆڵەتدار بەبێ تۆماری مۆڵەت",
  "an unresolved failed review exists": "بڕیارێکی ڕەتکردنەوە هەیە و هێشتا چارەسەر نەکراوە",
  "original question carries an official code": "پرسیاری ڕەسەن کۆدی فەرمیی هەیە",
  "official question without code or licence": "پرسیاری فەرمی بەبێ کۆد یان مۆڵەت",
  "licence class does not match source type": "جۆری مۆڵەت لەگەڵ جۆری سەرچاوە ناگونجێت",
  "answer mapping invalid": "وەڵامی دروست بە هەڵە دیاری کراوە",
  "automatic validation failed": "پشکنینی خۆکار سەرنەکەوت",
  "approval without both reviews": "پەسەندکردن بەبێ هەردوو پێداچوونەوەکە",
  "Italian question not found": "پرسیاری ئیتاڵی نەدۆزرایەوە",
  "Italian content must be original": "ناوەڕۆکی ئیتاڵی دەبێت ڕەسەن بێت",
  "question is hidden": "پرسیارەکە شاراوەیە (بڵاوکردنەوەی داخراوە)",
};

/** Sorani text for one gate reason; the English code is returned unchanged when it is not known. */
export function reasonCkb(reason: string): string {
  if (FIXED[reason]) return FIXED[reason];
  let m = /^missing passed (\w+)$/.exec(reason);
  if (m) return `${stage(m[1]!)} هێشتا تێنەپەڕیوە`;
  m = /^stage (\w+) is before APPROVED$/.exec(reason);
  if (m) return `قۆناغی ئێستا (${stage(m[1]!)}) پێش پەسەندکردنی کۆتاییە`;
  m = /^(\w+) needs a named human reviewer$/.exec(reason);
  if (m) return `${stage(m[1]!)} پێویستی بە پشکنەرێکی مرۆیی بە ناوە`;
  m = /^(\w+) has no evidence reference$/.exec(reason);
  if (m) return `${stage(m[1]!)} بەڵگەی نییە`;
  m = /^not revalidated against exam rules (.+)$/.exec(reason);
  if (m) return `لەگەڵ یاساکانی تاقیکردنەوەی ${m[1]} دووبارە پشتڕاست نەکراوەتەوە`;
  return reason;
}

/**
 * Reason shown for every Italian question in the editorial workbench: approving the wording here is a
 * decision about the text, not a release to learners (by design since #108).
 */
export const EDITORIAL_ONLY_CKB =
  "پەسەندکردنی ئەم پانێڵە بڕیاری دەقەکەیە و پرسیار بۆ فێرخوازان بڵاو ناکاتەوە؛ بڵاوکردنەوەی پرسیاری ئیتاڵی هەنگاوێکی جیای خاوەنە.";
