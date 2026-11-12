import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../app/state";
import { T } from "../app/strings";
import { Bi, useBiText } from "../components/Bi";
import { Icon } from "../components/Icon";
import { QuestionCard } from "../components/QuestionCard";
import { QuestionNavigator, type NavItem } from "../components/QuestionNavigator";
import { CONTENT } from "../app/content";
import { buildMockExam } from "../lib/mockExam";
import { EXAM_PRACTICE_LIMIT_MINUTES, KLASSE_B_RULES_2026, scoreExam, type ExamResult } from "../lib/shared/exam";
import { isQuestionAnswerCorrect } from "../lib/answers";
import { recordAnswer } from "../lib/progress";
import { kv } from "../lib/storage";
import { recordPlay } from "../lib/mediaPlays";
import { EXAM_SESSION_KEY, elapsedMs, formatClock, isAnswered, newExamSession, remainingMs, restoreExamSession, type ExamSession } from "../lib/examSession";

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
  // The official exam has no fixed time limit, so a limit is only used when the learner switches it on.
  const [timed, setTimed] = useState(false);
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
  const start = () => begin(newExamSession(Date.now() >>> 0, rules.version, timed ? EXAM_PRACTICE_LIMIT_MINUTES : null, Date.now()));

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

  // Clock. With a practice limit the exam is handed in automatically when the time is over; without one it only counts up.
  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (remainingMs(session, t) === 0) submit(session, true);
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
          <Bi t={{ ckb: "تاقیکردنەوەی فەرمی سنووری کاتی دیاریکراوی نییە؛ زۆربەی کات نزیکەی 30 بۆ 45 خولەک دەخایەنێت. وەڵامەکانت خۆکارانە پاشەکەوت دەکرێن.",
            de: "Die amtliche Prüfung hat keine feste Zeitbegrenzung; meist dauert sie etwa 30 bis 45 Minuten. Deine Antworten werden automatisch gespeichert.",
            kmr: "Ezmûna fermî sînorekî demê yê diyarkirî nîne; bi piranî nêzîkî 30 heta 45 deqeyan dikişîne. Bersivên te bixweber tên tomarkirin.",
            ar: "ليس للامتحان الرسمي حد زمني ثابت؛ ويستغرق غالبًا نحو 30 إلى 45 دقيقة. تُحفظ إجاباتك تلقائيًا." }} />
          <label className="option exam-limit">
            <input type="checkbox" className="q-check" checked={timed} onChange={(e) => setTimed(e.target.checked)} data-testid="exam-timed" />
            <Bi t={{ ckb: `ڕاهێنان لەگەڵ سنووری کاتی ${EXAM_PRACTICE_LIMIT_MINUTES} خولەک (ئارەزوومەندانە، فەرمی نییە)`,
              de: `Mit ${EXAM_PRACTICE_LIMIT_MINUTES} Minuten Zeitlimit üben (freiwillig, nicht amtlich)`,
              kmr: `Bi sînorê demê yê ${EXAM_PRACTICE_LIMIT_MINUTES} deqeyan rahênan bike (bi dilxwazî, ne fermî)`,
              ar: `تدرّب بحد زمني قدره ${EXAM_PRACTICE_LIMIT_MINUTES} دقيقة (اختياري وغير رسمي)` }} />
          </label>
          <p className="small muted"><Bi t={{ ckb: "یاساکانی خاڵدان لەگەڵ یاسای FeV (پاشکۆی 7) بەراورد کراون (وەشان: " + rules.version + "). بۆ وردەکاریی ڕۆژی تاقیکردنەوە لە قوتابخانەی شۆفێری یان TÜV/DEKRA بپرسە.", de: "Bewertungsregeln mit der FeV (Anlage 7) abgeglichen (Version: " + rules.version + "). Einzelheiten zum Prüfungstag bitte bei Fahrschule oder TÜV/DEKRA erfragen.",
            kmr: "Qaîdeyên xaldanê bi qanûna FeV (pêveka 7) re hatine berhevkirin (guherto: " + rules.version + "). Ji bo hûrgiliyên roja ezmûnê ji dibistana ajotinê an TÜV/DEKRA bipirse.",
            ar: "قواعد التقييم مطابقة للائحة FeV (الملحق 7) (الإصدار: " + rules.version + "). للاستفسار عن تفاصيل يوم الامتحان راجع مدرسة القيادة أو TÜV/DEKRA." }} /></p>
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
  const low = left !== null && left <= 5 * 60_000;
  const isFlagged = session.flagged.includes(q.id);
  const items: NavItem[] = questions.map((x) => ({ id: x.id, state: isAnswered(session.answers, x.id) ? "answered" : "open", flagged: session.flagged.includes(x.id) }));
  const go = (pos: number) => { setConfirming(false); patch({ pos }); };
  const handIn = () => { if (open > 0 && !confirming) setConfirming(true); else submit(session, false); };

  return (
    <div data-testid="exam-running">
      <header className="page-head exam-head">
        <h1><Bi t={T.mockExam} /></h1>
        <div className="exam-status">
          <span className={`exam-timer${low ? " is-low" : ""}`} role="timer" aria-label={label(left === null ? T.timeUsed : T.timeLeft)} data-testid="exam-timer" data-timed={left !== null}><Icon name="calendar" /><span className="num" dir="ltr">{left === null ? formatClock(elapsedMs(session, now), "down") : formatClock(left)}</span></span>
          <span className="small muted num-block"><span className="num" dir="ltr" data-testid="exam-answered">{answeredCount}/{questions.length}</span> <Bi t={T.answeredL} inline /></span>
        </div>
      </header>
      <QuestionCard key={q.id} question={q} mode="exam" sessionId={`exam-${session.seed}`} index={session.pos} total={questions.length}
        selected={session.answers[q.id] ?? []} onSelect={(ids) => patch({ answers: { ...session.answers, [q.id]: ids } })}
        plays={{ counts: session.plays ?? {}, onPlay: (key) => setSession((s) => (s ? { ...s, plays: recordPlay(s.plays ?? {}, key) } : s)) }} />
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
