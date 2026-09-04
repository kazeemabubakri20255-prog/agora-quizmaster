import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Grid2x2,
  Loader2,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { submitExam, syncExam, type AnswerLetterT, type ExamState } from "@/lib/exam.functions";
import { Button, Logo, formatClock } from "@/components/agora/primitives";
import { cn } from "@/lib/utils";

const LETTERS: AnswerLetterT[] = ["A", "B", "C", "D"];

type Props = {
  exam: ExamState;
  onFinished: (submissionId: string) => void;
};

export function ExamRunner({ exam, onFinished }: Props) {
  const sync = useServerFn(syncExam);
  const submit = useServerFn(submitExam);

  const [answers, setAnswers] = useState<Record<string, AnswerLetterT>>(exam.answers);
  const [marked, setMarked] = useState<string[]>(exam.marked);
  const [index, setIndex] = useState(Math.min(exam.currentIndex, exam.questions.length - 1));
  const [navOpen, setNavOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [offline, setOffline] = useState(false);

  const dirty = useRef<Map<string, AnswerLetterT | null>>(new Map());
  const submittedOnce = useRef(false);
  const clockOffset = useRef(new Date(exam.serverNow).getTime() - Date.now());
  const deadline = useMemo(() => new Date(exam.expiresAt).getTime(), [exam.expiresAt]);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.round((deadline - (Date.now() + clockOffset.current)) / 1000)),
  );

  const total = exam.questions.length;
  const current = exam.questions[index]!;
  const answeredCount = Object.keys(answers).length;

  /* ----------------------------- local backup ---------------------------- */
  useEffect(() => {
    try {
      localStorage.setItem(
        `agora.answers.${exam.sessionId}`,
        JSON.stringify({ answers, marked, index }),
      );
    } catch {
      /* storage full or blocked — server sync is the source of truth */
    }
  }, [answers, marked, index, exam.sessionId]);

  /* ------------------------------- submission ---------------------------- */
  const doSubmit = useCallback(
    async (auto: boolean) => {
      if (submittedOnce.current) return;
      submittedOnce.current = true;
      setSubmitting(true);
      try {
        const pending = [...dirty.current.entries()].map(([questionId, selected]) => ({
          questionId,
          selected,
        }));
        const res = await submit({
          data: { sessionId: exam.sessionId, token: exam.token, answers: pending, auto },
        });
        dirty.current.clear();
        localStorage.removeItem(`agora.answers.${exam.sessionId}`);
        onFinished(res.submissionId);
      } catch {
        submittedOnce.current = false;
        setSubmitting(false);
        toast.error("Submission failed. Check your connection and try again.");
      }
    },
    [exam.sessionId, exam.token, onFinished, submit],
  );

  /* --------------------------------- timer -------------------------------- */
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - (Date.now() + clockOffset.current)) / 1000));
      setRemaining(left);
      if (left <= 0) void doSubmit(true);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deadline, doSubmit]);

  /* ------------------------------ background sync ------------------------- */
  const flush = useCallback(
    async (extra?: { marked?: string[]; index?: number }) => {
      if (submittedOnce.current) return;
      const batch = [...dirty.current.entries()].map(([questionId, selected]) => ({
        questionId,
        selected,
      }));
      try {
        const res = await sync({
          data: {
            sessionId: exam.sessionId,
            token: exam.token,
            answers: batch,
            marked: extra?.marked ?? marked,
            currentIndex: extra?.index ?? index,
          },
        });
        batch.forEach((b) => {
          if (dirty.current.get(b.questionId) === b.selected) dirty.current.delete(b.questionId);
        });
        setOffline(false);
        if (!res.ok && res.reason === "expired") void doSubmit(true);
        if (res.ok) clockOffset.current = new Date(res.serverNow).getTime() - Date.now();
      } catch {
        setOffline(true);
      }
    },
    [exam.sessionId, exam.token, index, marked, sync, doSubmit],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      if (dirty.current.size > 0 || offline) void flush();
    }, 4000);
    return () => window.clearInterval(id);
  }, [flush, offline]);

  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  /* -------------------------------- actions ------------------------------- */
  const select = useCallback(
    (letter: AnswerLetterT) => {
      const qid = exam.questions[index]!.id;
      setAnswers((prev) => ({ ...prev, [qid]: letter }));
      dirty.current.set(qid, letter);
      void flush();
    },
    [exam.questions, index, flush],
  );

  const goto = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), total - 1);
      setIndex(clamped);
      void flush({ index: clamped });
    },
    [total, flush],
  );

  const toggleMark = useCallback(() => {
    const qid = exam.questions[index]!.id;
    setMarked((prev) => {
      const next = prev.includes(qid) ? prev.filter((m) => m !== qid) : [...prev, qid];
      void flush({ marked: next });
      return next;
    });
  }, [exam.questions, index, flush]);

  /* ------------------------------- keyboard ------------------------------- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (LETTERS.includes(key as AnswerLetterT)) {
        e.preventDefault();
        select(key as AnswerLetterT);
      } else if (e.key === "ArrowRight") {
        goto(index + 1);
      } else if (e.key === "ArrowLeft") {
        goto(index - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [select, goto, index]);

  const progress = ((index + 1) / total) * 100;
  const lowTime = remaining <= 300;

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-30">
        <div className="mx-auto max-w-3xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Logo className="hidden sm:inline-flex" />
              <span className="hidden h-4 w-px bg-border sm:block" />
              <p className="truncate type-caption font-semibold text-foreground">
                {exam.quiz.title}
              </p>
            </div>
            <div
              role="timer"
              aria-live="off"
              className={cn(
                "type-mono rounded-lg border px-2.5 py-1.5 text-sm font-semibold tabular-nums",
                lowTime
                  ? "border-destructive/40 bg-destructive/10 text-destructive pulse-soft"
                  : "border-border bg-surface-2/60 text-foreground",
              )}
            >
              {formatClock(remaining)}
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-3">
            <p className="type-meta shrink-0 text-muted-foreground">
              Q {index + 1} / {total}
            </p>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 220, damping: 30 }}
              />
            </div>
            <p className="type-meta shrink-0 text-muted-foreground">{answeredCount} answered</p>
          </div>
        </div>
      </header>

      {offline ? (
        <div className="mx-auto mt-3 flex max-w-3xl items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2 text-warning">
          <WifiOff className="h-4 w-4" aria-hidden />
          <p className="type-caption">
            Connection lost — your answers are saved on this device and will sync automatically.
          </p>
        </div>
      ) : null}

      {/* Question */}
      <main className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={current.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            aria-labelledby="question-text"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="type-meta text-primary">
                {current.topic ?? "Question"} · {current.difficulty}
              </p>
              <button
                type="button"
                onClick={toggleMark}
                aria-pressed={marked.includes(current.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 type-caption transition-colors",
                  marked.includes(current.id)
                    ? "border-warning/50 bg-warning/10 text-warning"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <Flag className="h-3.5 w-3.5" aria-hidden />
                {marked.includes(current.id) ? "Marked" : "Mark"}
              </button>
            </div>

            <h1
              id="question-text"
              className="mt-4 text-[1.35rem] font-medium leading-snug tracking-[-0.01em] sm:text-[1.6rem]"
            >
              {current.question_text}
            </h1>

            <div role="radiogroup" aria-labelledby="question-text" className="mt-6 space-y-3">
              {LETTERS.map((letter) => {
                const text = current[`option_${letter.toLowerCase()}` as "option_a"];
                const active = answers[current.id] === letter;
                return (
                  <motion.button
                    key={letter}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => select(letter)}
                    whileTap={{ scale: 0.99 }}
                    className={cn(
                      "group relative flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-colors duration-200 sm:p-5",
                      active
                        ? "border-primary/70 bg-primary/10 shadow-[0_0_40px_-14px_var(--color-primary)]"
                        : "border-border bg-surface/50 hover:border-primary/30 hover:bg-surface-2/60",
                    )}
                  >
                    <span
                      className={cn(
                        "type-mono grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-sm font-semibold transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground group-hover:text-foreground",
                      )}
                      aria-hidden
                    >
                      {active ? <Check className="h-4 w-4" /> : letter}
                    </span>
                    <span className="pt-1.5 text-[15px] leading-relaxed sm:text-base">{text}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.section>
        </AnimatePresence>
      </main>

      {/* Bottom bar */}
      <nav className="glass-strong fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 sm:px-6">
          <Button
            variant="outline"
            onClick={() => goto(index - 1)}
            disabled={index === 0}
            aria-label="Previous question"
            className="flex-1 sm:flex-none"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          <Button
            variant="subtle"
            onClick={() => setNavOpen(true)}
            aria-label="Open question navigator"
          >
            <Grid2x2 className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Navigator</span>
          </Button>
          {index === total - 1 ? (
            <Button className="flex-1" onClick={() => setConfirmOpen(true)}>
              Submit exam
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => goto(index + 1)} aria-label="Next question">
              <span>Next</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      </nav>

      {/* Navigator sheet */}
      <AnimatePresence>
        {navOpen ? (
          <motion.div
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setNavOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-label="Question navigator"
              className="glass-strong max-h-[75vh] w-full max-w-3xl overflow-y-auto scrollbar-slim rounded-t-3xl p-5 sm:mb-6 sm:rounded-3xl"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="type-h3">Questions</h2>
                <Button variant="ghost" size="sm" onClick={() => setNavOpen(false)} aria-label="Close navigator">
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 type-caption text-muted-foreground">
                <Legend className="bg-primary" label="Answered" />
                <Legend className="bg-surface-2" label="Unanswered" />
                <Legend className="bg-warning" label="Marked" />
              </div>
              <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-10">
                {exam.questions.map((q, i) => {
                  const isAnswered = Boolean(answers[q.id]);
                  const isMarked = marked.includes(q.id);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        goto(i);
                        setNavOpen(false);
                      }}
                      aria-label={`Go to question ${i + 1}${isAnswered ? ", answered" : ""}`}
                      className={cn(
                        "type-mono h-10 rounded-lg border text-sm font-medium transition-colors",
                        i === index && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                        isMarked
                          ? "border-warning/50 bg-warning/15 text-warning"
                          : isAnswered
                            ? "border-primary/50 bg-primary/20 text-foreground"
                            : "border-border bg-surface-2/50 text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <Button className="mt-5 w-full" onClick={() => { setNavOpen(false); setConfirmOpen(true); }}>
                Submit exam
              </Button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Submit confirmation */}
      <AnimatePresence>
        {confirmOpen ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="alertdialog"
              aria-labelledby="confirm-title"
              className="glass-strong w-full max-w-md rounded-3xl p-6"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-warning/15 text-warning">
                  <AlertTriangle className="h-5 w-5" aria-hidden />
                </span>
                <h2 id="confirm-title" className="type-h3">
                  Submit this examination?
                </h2>
              </div>
              <p className="type-body mt-3 text-sm text-muted-foreground">
                You have answered <span className="text-foreground">{answeredCount}</span> of{" "}
                <span className="text-foreground">{total}</span> questions
                {total - answeredCount > 0
                  ? ` — ${total - answeredCount} will be marked unanswered.`
                  : "."}{" "}
                This action cannot be undone.
              </p>
              <div className="mt-6 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmOpen(false)}
                  disabled={submitting}
                >
                  Keep working
                </Button>
                <Button className="flex-1" onClick={() => void doSubmit(false)} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Submit
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-[3px]", className)} aria-hidden />
      {label}
    </span>
  );
}
