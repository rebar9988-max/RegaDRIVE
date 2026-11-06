import { useMemo, useState } from "react";
import { useApp } from "../app/state";
import { T } from "../app/strings";
import { Bi } from "../components/Bi";
import { QuestionCard } from "../components/QuestionCard";
import { ContentStatus } from "../components/ContentStatus";
import { CONTENT } from "../app/content";
import { buildMockExam } from "../lib/mockExam";
import { KLASSE_B_RULES_2026, scoreExam, type ExamResult } from "../lib/shared/exam";
import { isQuestionAnswerCorrect } from "../lib/answers";
import { recordAnswer } from "../lib/progress";

export function Exam() {
  const { update } = useApp();
  const [seed, setSeed] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [pos, setPos] = useState(0);
  const [result, setResult] = useState<ExamResult | null>(null);
  const questions = useMemo(() => (seed === null ? [] : buildMockExam(CONTENT.questions, seed)), [seed]);
  const session = `exam-${seed}`;
  const rules = KLASSE_B_RULES_2026;
  const canRun = CONTENT.questions.filter((q) => q.categoryType === "Grundstoff").length >= rules.grundstoffCount
    && CONTENT.questions.filter((q) => q.categoryType === "Zusatzstoff").length >= rules.zusatzstoffCount;

  const start = () => { setSeed(Date.now() >>> 0); setAnswers({}); setPos(0); setResult(null); };
  const submit = () => {
    if (result) return;
    const scored = questions.map((q) => ({ questionId: q.id, points: q.points ?? 0, correct: isQuestionAnswerCorrect(q, answers[q.id] ?? []) }));
    const r = scoreExam(scored, rules);
    setResult(r);
    update((p) => {
      let s = p;
      for (const a of scored) s = recordAnswer(s, session, a.questionId, a.correct, Date.now());
      return { ...s, examHistory: [...s.examHistory, { at: Date.now(), passed: r.passed, errorPoints: r.errorPoints, totalPoints: r.totalPoints, rulesVersion: r.rulesVersion }].slice(-50) };
    });
  };

  if (seed === null) {
    return (
      <div>
        <header className="page-head"><h1><Bi t={T.mockExam} /></h1></header>
        <section className="card stack">
          <p className="notice" role="note"><Bi t={T.simulationNotice} /></p>
          <Bi t={{ ckb: `${rules.grundstoffCount} پرسیاری بنەڕەتی (Grundstoff) + ${rules.zusatzstoffCount} پرسیاری زیادە (Zusatzstoff). زۆرترین خاڵی هەڵەی ڕێگەپێدراو: ${rules.maxErrorPoints}. دوو پرسیاری ٥ خاڵی هەڵە = سەرکەوتوو نەبوون.`,
            de: `${rules.grundstoffCount} Grundstoff- + ${rules.zusatzstoffCount} Zusatzstofffragen. Höchstens ${rules.maxErrorPoints} Fehlerpunkte. Zwei falsche 5-Punkte-Fragen = nicht bestanden.` }} />
          <p className="small muted"><Bi t={{ ckb: "یاساکانی خاڵدان لەگەڵ سەرچاوەکان بەراورد کراون (وەشان: " + rules.version + "). کاتی فەرمی لەگەڵ قوتابخانەی شۆفێری یان TÜV/DEKRA دڵنیا بکەرەوە.", de: "Bewertungsregeln mit Quellen abgeglichen (Version: " + rules.version + "). Die amtliche Bearbeitungszeit bitte bei Fahrschule oder TÜV/DEKRA bestätigen." }} /></p>
          {canRun && <button type="button" className="btn btn-primary" onClick={start} data-testid="exam-start"><Bi t={T.startExam} /></button>}
        </section>
        {!canRun && <div className="section"><ContentStatus testId="exam-status" /></div>}
      </div>
    );
  }

  if (result) {
    const wrong = questions.filter((q) => !isQuestionAnswerCorrect(q, answers[q.id] ?? []));
    return (
      <div data-testid="exam-result">
        <header className="page-head"><h1><Bi t={result.passed ? T.passed : T.failed} /></h1></header>
        <section className="card stack">
          <div className="grid grid-3">
            <div className="stat card"><span className="stat-value">{result.errorPoints}</span><span className="stat-label muted"><Bi t={T.errorPoints} /></span></div>
            <div className="stat card"><span className="stat-value">{result.totalPoints}</span><span className="stat-label muted"><Bi t={T.points} /></span></div>
            <div className="stat card"><span className="stat-value">{questions.length - wrong.length}/{questions.length}</span><span className="stat-label muted"><Bi t={T.correct} /></span></div>
          </div>
          {result.failReason === "five_point_rule" && <p className="feedback bad"><Bi t={T.fivePointRule} /></p>}
          <p className="small muted"><Bi t={T.simulationNotice} /></p>
          <div className="q-actions">
            <button type="button" className="btn btn-primary" onClick={start}><Bi t={T.startExam} /></button>
          </div>
        </section>
        {wrong.length > 0 && (
          <section className="section stack">
            <h2 className="section-title"><Bi t={T.reviewMistakes} /></h2>
            {wrong.map((q) => (
              <div key={q.id} className="card stack">
                <Bi t={q.prompt} />
                <div className="feedback ok"><div className="feedback-title"><Bi t={T.correctAnswers} inline /></div>
                  {q.options.filter((o) => q.correct.includes(o.id)).map((o) => <Bi key={o.id} t={o.text} />)}
                </div>
                <p className="small"><Bi t={q.explanation} /></p>
              </div>
            ))}
          </section>
        )}
      </div>
    );
  }

  const q = questions[pos]!;
  const answeredCount = Object.values(answers).filter((a) => a.length > 0).length;
  return (
    <div data-testid="exam-running">
      <header className="page-head"><h1><Bi t={T.mockExam} /></h1><p className="small muted num-block"><span className="num">{answeredCount}/{questions.length}</span></p></header>
      <QuestionCard key={q.id} question={q} mode="exam" sessionId={session} index={pos} total={questions.length}
        selected={answers[q.id] ?? []} onSelect={(ids) => setAnswers((a) => ({ ...a, [q.id]: ids }))} />
      <div className="q-actions">
        <button type="button" className="btn btn-secondary" disabled={pos === 0} onClick={() => setPos(pos - 1)}><Bi t={T.previous} /></button>
        {pos + 1 < questions.length
          ? <button type="button" className="btn btn-primary" onClick={() => setPos(pos + 1)} data-testid="exam-next"><Bi t={T.next} /></button>
          : <button type="button" className="btn btn-success" onClick={submit} data-testid="exam-submit"><Bi t={T.submitExam} /></button>}
      </div>
    </div>
  );
}
