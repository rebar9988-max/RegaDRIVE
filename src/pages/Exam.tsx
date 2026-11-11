import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { Icon } from "../components/Icon";
import { QuestionCard } from "../components/QuestionCard";
import { QuestionNavigator, type NavItem } from "../components/QuestionNavigator";
import { CONTENT } from "../app/content";
import { buildMockExam } from "../lib/mockExam";
import { EXAM_SIMULATION_MINUTES, KLASSE_B_RULES_2026, scoreExam, type ExamResult } from "../lib/shared/exam";
import { isQuestionAnswerCorrect } from "../lib/answers";
import { recordAnswer } from "../lib/progress";
import { kv } from "../lib/storage";
import { EXAM_SESSION_KEY, formatClock, isAnswered, newExamSession, remainingMs, restoreExamSession, type ExamSession } from "../lib/examSession";

const rules = KLASSE_B_RULES_2026;
const examQuestions = (seed: number) => buildMockExam(CONTENT.questions, seed, rules);

export function Exam() {
  const { update } = useApp();
  const label = useBiText();
  // undefined: stored session not read yet. null: no exam running.
  const [session, setSession] = useState<ExamSession | null | undefined>(undefined);
  const [paused, setPaused] = useState<ExamSession | null>(null);
  const [finished, setFinished] = useState<{ session: ExamSession; result: ExamResult; timedOut: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [onlyWrong, setOnlyWrong] = useState(true);
  const [reviewPos, setReviewPos] = useState(0);
  const submitted = useRef(false);

  const activeSeed = session?.seed ?? finished?.session.seed ?? null;
  const questions = useMemo(() => (activeSeed === null ? [] : examQuestions(activeSeed)), [activeSeed]);
  const canRun = CONTENT.questions.filter((q) => q.categoryType === "Grundstoff").length >= rules.grundstoffCount
    && CONTENT.questions.filter((q) => q.categoryType === "Zusatzstoff").length >= rules.zusatzstoffCount;

  // Offer an unfinished exam again after a reload or a closed tab.
  useEffect(() => {
    let alive = true;
    kv.get<unknown>(EXAM_SESSION_KEY)
      .then((raw) => { if (alive) { setPaused(restoreExamSession(raw, rules.version, (seed) => examQuestions(seed).map((q) => q.id))); setSession(null); } })
      .catch(() => { if (alive) setSession(null); });
    return () => { alive = false; };
  }, []);

  // Every change is saved immediately; a failed write must never interrupt the exam.
  useEffect(() => { if (session) kv.set(EXAM_SESSION_KEY, session).catch(() => undefined); }, [session]);

  const patch = (p: Partial<ExamSession>) => setSession((s) => (s ? { ...s, ...p } : s));

  const begin = (s: ExamSession) => {
    submitted.current = false;
    setFinished(null); setPaused(null); setConfirming(false); setOnlyWrong(true); setReviewPos(0);
    setNow(Date.now());
    setSession(s);
  };
  const start = () => begin(newExamSession(Date.now() >>> 0, rules.version, EXAM_SIMULATION_MINUTES, Date.now()));

  const submit = useCallback((s: ExamSession, timedOut: boolean) => {
    if (submitted.current) return; // an exam is scored exactly once
    submitted.current = true;
    const qs = examQuestions(s.seed);
    const at = Date.now();
    // Correctness comes from the stored answer key only: the exact set of correct options, no partial credit.
    const scored = qs.map((q) => ({ questionId: q.id, points: q.points ?? 0, correct: isQuestionAnswerCorrect(q, s.answers[q.id] ?? []) }));
    const result = scoreExam(scored, rules);
    update((p) => {
      let next = p;
      for (const a of scored) next = recordAnswer(next, `exam-${s.seed}`, a.questionId, a.correct, at);
      return { ...next, examHistory: [...next.examHistory, { at, passed: result.passed, errorPoints: result.errorPoints, totalPoints: result.totalPoints, rulesVersion: result.rulesVersion }].slice(-50) };
    });
    kv.del(EXAM_SESSION_KEY).catch(() => undefined);
    setSession(null);
    setFinished({ session: s, result, timedOut });
    window.scrollTo(0, 0);
  }, [update]);

  // Countdown. When the time is over the exam is handed in automatically with the answers given so far.
  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (remainingMs(session, t) <= 0) submit(session, true);
    };
    const id = window.setInterval(tick, 1000);
    const first = window.setTimeout(tick, 0);
    return () => { window.clearInterval(id); window.clearTimeout(first); };
  }, [session, submit]);

  if (session === undefined) return <div aria-busy="true" />;

  if (finished) {
    const { result, session: s } = finished;
    const right = new Set(questions.filter((x) => isQuestionAnswerCorrect(x, s.answers[x.id] ?? [])).map((x) => x.id));
    const wrong = questions.filter((x) => !right.has(x.id));
    const shown = onlyWrong ? wrong : questions;
    const pos = Math.min(reviewPos, Math.max(0, shown.length - 1));
    const q = shown[pos];
    const items: NavItem[] = shown.map((x) => ({ id: x.id, state: right.has(x.id) ? "correct" : "wrong" }));
    return (
      <div data-testid="exam-result">
        <header className="page-head"><h1><Bi t={result.passed ? T.passed : T.failed} /></h1></header>
        <section className={`card stack exam-verdict ${result.passed ? "is-passed" : "is-failed"}`}>
          {finished.timedOut && <p className="notice" role="status"><Bi t={T.timeUp} /></p>}
          <div className="grid grid-3">
            <div className="stat card"><span className="stat-value" data-testid="result-error-points">{result.errorPoints}</span><span className="stat-label muted"><Bi t={T.errorPoints} /></span></div>
            <div className="stat card"><span className="stat-value">{rules.maxErrorPoints}</span><span className="stat-label muted"><Bi t={{ ckb: "زۆرترین خاڵی هەڵەی ڕێگەپێدراو", de: "Erlaubte Fehlerpunkte", kmr: "Xalên şaş ên destûrdayî", ar: "نقاط الخطأ المسموح بها" }} /></span></div>
            <div className="stat card"><span className="stat-value" dir="ltr">{right.size}/{questions.length}</span><span className="stat-label muted"><Bi t={T.correct} /></span></div>
          </div>
          {result.failReason === "five_point_rule" && <p className="feedback bad" data-testid="five-point-fail"><Bi t={T.fivePointRule} /></p>}
          <p className="small muted"><Bi t={T.simulationNotice} /></p>
          <div className="q-actions">
            <button type="button" className="btn btn-primary" onClick={start} data-testid="exam-restart"><Bi t={T.startExam} /></button>
          </div>
        </section>

        <section className="section stack" aria-labelledby="exam-review-title">
          <h2 id="exam-review-title" className="section-title"><Bi t={T.examReview} /></h2>
          <div className="chip-row" role="group" aria-label={label(T.examReview)}>
            <button type="button" className="chip" aria-pressed={onlyWrong} onClick={() => { setOnlyWrong(true); setReviewPos(0); }} data-testid="review-wrong">{label(T.onlyWrong)} <span dir="ltr">({wrong.length})</span></button>
            <button type="button" className="chip" aria-pressed={!onlyWrong} onClick={() => { setOnlyWrong(false); setReviewPos(0); }} data-testid="review-all">{label(T.reviewAll)} <span dir="ltr">({questions.length})</span></button>
          </div>
          {q ? <>
            <QuestionNavigator items={items} current={pos} onGo={setReviewPos} />
            <QuestionCard key={q.id} question={q} mode="review" sessionId={`exam-${s.seed}`} index={pos} total={shown.length} selected={s.answers[q.id] ?? []} />
            <div className="q-actions">
              <button type="button" className="btn btn-secondary" disabled={pos === 0} onClick={() => setReviewPos(pos - 1)}><Bi t={T.previous} /></button>
              <button type="button" className="btn btn-primary" disabled={pos + 1 >= shown.length} onClick={() => setReviewPos(pos + 1)} data-testid="review-next"><Bi t={T.next} /></button>
            </div>
          </> : <p className="card muted" data-testid="review-empty"><Bi t={T.noMistakes} /></p>}
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div>
        <header className="page-head"><h1><Bi t={T.mockExam} /></h1></header>
        <section className="card stack">
          <p className="notice" role="note"><Bi t={T.simulationNotice} /></p>
          <Bi t={{ ckb: `${rules.grundstoffCount} پرسیاری بنەڕەتی (Grundstoff) + ${rules.zusatzstoffCount} پرسیاری زیادە (Zusatzstoff). زۆرترین خاڵی هەڵەی ڕێگەپێدراو: ${rules.maxErrorPoints}. دوو پرسیاری ٥ خاڵی هەڵە = سەرکەوتوو نەبوون.`,
            de: `${rules.grundstoffCount} Grundstoff- + ${rules.zusatzstoffCount} Zusatzstofffragen. Höchstens ${rules.maxErrorPoints} Fehlerpunkte. Zwei falsche 5-Punkte-Fragen = nicht bestanden.`,
            kmr: `${rules.grundstoffCount} pirsên bingehîn (Grundstoff) + ${rules.zusatzstoffCount} pirsên zêde (Zusatzstoff). Herî zêde ${rules.maxErrorPoints} xalên şaş. Du pirsên 5 xalî yên şaş = ne serkeftî.`,
            ar: `أسئلة أساسية (Grundstoff): ${rules.grundstoffCount} + أسئلة إضافية (Zusatzstoff): ${rules.zusatzstoffCount}. الحد الأقصى لنقاط الخطأ: ${rules.maxErrorPoints}. الخطأ في سؤالين من فئة 5 نقاط = راسب.` }} />
          <Bi t={{ ckb: `کاتی ئەم ڕاهێنانە: ${EXAM_SIMULATION_MINUTES} خولەک. وەڵامەکانت خۆکارانە پاشەکەوت دەکرێن.`,
            de: `Zeit für diese Übung: ${EXAM_SIMULATION_MINUTES} Minuten. Deine Antworten werden automatisch gespeichert.`,
            kmr: `Dema vê rahênanê: ${EXAM_SIMULATION_MINUTES} deqe. Bersivên te bixweber tên tomarkirin.`,
            ar: `مدة هذا التدريب: ${EXAM_SIMULATION_MINUTES} دقيقة. تُحفظ إجاباتك تلقائيًا.` }} />
          <p className="small muted"><Bi t={{ ckb: "یاساکانی خاڵدان لەگەڵ سەرچاوەکان بەراورد کراون (وەشان: " + rules.version + "). کاتی فەرمی لەگەڵ قوتابخانەی شۆفێری یان TÜV/DEKRA دڵنیا بکەرەوە.", de: "Bewertungsregeln mit Quellen abgeglichen (Version: " + rules.version + "). Die amtliche Bearbeitungszeit bitte bei Fahrschule oder TÜV/DEKRA bestätigen.",
            kmr: "Qaîdeyên xaldanê bi çavkaniyan re hatine berhevkirin (guherto: " + rules.version + "). Dema fermî ya ezmûnê ji kerema xwe li dibistana ajotinê an li TÜV/DEKRA piştrast bike.",
            ar: "قواعد التقييم مطابقة للمصادر (الإصدار: " + rules.version + "). يرجى التأكد من مدة الامتحان الرسمية لدى مدرسة القيادة أو TÜV/DEKRA." }} /></p>
          {!canRun && <p className="notice"><Bi t={T.contentInReview} /></p>}
          {paused && canRun ? <>
            <p className="notice" role="status" data-testid="exam-paused"><Bi t={T.examInProgress} /></p>
            <div className="q-actions">
              <button type="button" className="btn btn-primary" onClick={() => begin(paused)} data-testid="exam-resume"><Bi t={T.resumeExam} /></button>
              <button type="button" className="btn btn-secondary" onClick={start} data-testid="exam-start"><Bi t={T.discardExam} /></button>
            </div>
          </> : <button type="button" className="btn btn-primary" onClick={start} disabled={!canRun} data-testid="exam-start"><Bi t={T.startExam} /></button>}
        </section>
      </div>
    );
  }

  const q = questions[session.pos]!;
  const answeredCount = questions.filter((x) => isAnswered(session.answers, x.id)).length;
  const open = questions.length - answeredCount;
  const left = remainingMs(session, now);
  const isFlagged = session.flagged.includes(q.id);
  const items: NavItem[] = questions.map((x) => ({ id: x.id, state: isAnswered(session.answers, x.id) ? "answered" : "open", flagged: session.flagged.includes(x.id) }));
  const go = (pos: number) => { setConfirming(false); patch({ pos }); };
  const handIn = () => { if (open > 0 && !confirming) setConfirming(true); else submit(session, false); };

  return (
    <div data-testid="exam-running">
      <header className="page-head exam-head">
        <h1><Bi t={T.mockExam} /></h1>
        <div className="exam-status">
          <span className={`exam-timer${left <= 5 * 60_000 ? " is-low" : ""}`} role="timer" aria-label={label(T.timeLeft)} data-testid="exam-timer"><Icon name="calendar" /><span className="num" dir="ltr">{formatClock(left)}</span></span>
          <span className="small muted num-block"><span className="num" dir="ltr" data-testid="exam-answered">{answeredCount}/{questions.length}</span> <Bi t={T.answeredL} inline /></span>
        </div>
      </header>
      <QuestionCard key={q.id} question={q} mode="exam" sessionId={`exam-${session.seed}`} index={session.pos} total={questions.length}
        selected={session.answers[q.id] ?? []} onSelect={(ids) => patch({ answers: { ...session.answers, [q.id]: ids } })} />
      <div className="q-actions">
        <button type="button" className="btn btn-secondary" disabled={session.pos === 0} onClick={() => go(session.pos - 1)} data-testid="exam-prev"><Bi t={T.previous} /></button>
        <button type="button" className="btn btn-secondary" aria-pressed={isFlagged} data-testid="exam-flag"
          onClick={() => patch({ flagged: isFlagged ? session.flagged.filter((id) => id !== q.id) : [...session.flagged, q.id] })}><Bi t={isFlagged ? T.flagged : T.flag} /></button>
        {session.pos + 1 < questions.length
          ? <button type="button" className="btn btn-primary" onClick={() => go(session.pos + 1)} data-testid="exam-next"><Bi t={T.next} /></button>
          : <button type="button" className="btn btn-success" onClick={handIn} data-testid="exam-submit"><Bi t={confirming ? T.submitAnyway : T.submitExam} /></button>}
      </div>
      {confirming && open > 0 && (
        <p className="notice" role="alert" data-testid="exam-confirm"><Bi t={{ ckb: `${open} پرسیار هێشتا وەڵام نەدراوەتەوە. پرسیاری وەڵامنەدراو بە هەڵە دەژمێردرێت.`, de: `${open} Fragen sind noch nicht beantwortet. Unbeantwortete Fragen zählen als falsch.`, kmr: `${open} pirs hê nehatine bersivandin. Pirsên bêbersiv wek şaş tên hesibandin.`, ar: `عدد الأسئلة غير المُجاب عنها: ${open}. الأسئلة غير المُجاب عنها تُحسب خطأ.` }} /></p>
      )}
      <section className="card exam-overview" aria-labelledby="exam-overview-title">
        <h2 id="exam-overview-title" className="section-title"><Bi t={T.questionList} /></h2>
        <QuestionNavigator items={items} current={session.pos} onGo={go} />
        {session.pos + 1 < questions.length && <button type="button" className="btn btn-secondary btn-sm" onClick={() => go(questions.length - 1)} data-testid="exam-to-end"><Bi t={{ ckb: "بڕۆ بۆ کۆتایی و ناردن", de: "Zum Ende und abgeben", kmr: "Here dawiyê û bişîne", ar: "انتقل إلى النهاية للتسليم" }} /></button>}
      </section>
    </div>
  );
}
