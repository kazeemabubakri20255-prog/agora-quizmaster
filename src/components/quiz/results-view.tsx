import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Circle, Minus, X } from "lucide-react";

import type { ReviewItem } from "@/lib/exam.functions";
import { Button, Logo, formatDuration } from "@/components/agora/primitives";
import { cn } from "@/lib/utils";

type Summary = {
  studentName: string;
  score: number;
  percentage: number;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  answered: number;
  durationSeconds: number;
  autoSubmitted: boolean;
};

const PAGE = 15;

export function ResultsView({
  quizTitle,
  summary,
  review,
}: {
  quizTitle: string;
  summary: Summary;
  review: ReviewItem[];
}) {
  const [visible, setVisible] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  const verdict = useMemo(() => {
    const p = summary.percentage;
    if (p >= 85) return "Excellent performance.";
    if (p >= 70) return "Strong performance.";
    if (p >= 50) return "Solid effort — room to sharpen.";
    return "Keep practising — review the explanations below.";
  }, [summary.percentage]);

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-strong sticky top-0 z-20">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <p className="truncate type-caption text-muted-foreground">{quizTitle}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6">
        <div className="ambient-blue relative overflow-hidden rounded-3xl panel p-8 text-center sm:p-12">
          <div className="ambient-blue-glow" aria-hidden />
          <p className="type-meta relative text-primary">Exam complete</p>
          <motion.p
            className="type-mono relative mt-4 text-6xl font-semibold tracking-tight sm:text-7xl"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 22 }}
          >
            {summary.score}
            <span className="text-3xl text-muted-foreground"> / {summary.totalQuestions}</span>
          </motion.p>
          <motion.p
            className="type-mono relative mt-2 text-2xl font-medium text-primary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            {summary.percentage}%
          </motion.p>
          <p className="type-body relative mt-3 text-muted-foreground">{verdict}</p>
          {summary.autoSubmitted ? (
            <p className="type-caption relative mt-2 text-warning">
              Time expired — this attempt was finalised automatically.
            </p>
          ) : null}

          <div className="relative mt-8 h-2 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${summary.percentage}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="Questions" value={summary.totalQuestions} />
          <Metric label="Answered" value={summary.answered} />
          <Metric label="Unanswered" value={summary.unanswered} />
          <Metric label="Correct" value={summary.correct} tone="success" />
          <Metric label="Incorrect" value={summary.incorrect} tone="destructive" />
          <Metric label="Time used" value={formatDuration(summary.durationSeconds)} />
        </div>

        <h2 className="type-h2 mt-12">Review</h2>
        <p className="type-caption mt-1 text-muted-foreground">
          Expand any question to see the correct answer and explanation.
        </p>

        <ul className="mt-5 space-y-2">
          {review.slice(0, visible).map((item, i) => {
            const state = item.selected === null ? "unanswered" : item.isCorrect ? "correct" : "incorrect";
            const expanded = open === item.questionId;
            return (
              <li key={item.questionId} className="panel overflow-hidden rounded-2xl">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : item.questionId)}
                  className="flex w-full items-start gap-3 p-4 text-left"
                >
                  <StateIcon state={state} />
                  <span className="min-w-0 flex-1">
                    <span className="type-meta block text-muted-foreground">Question {i + 1}</span>
                    <span className="mt-1 block text-[15px] leading-snug">{item.question}</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      expanded && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {expanded ? (
                  <div className="hairline-t space-y-2 px-4 py-4">
                    {(["A", "B", "C", "D"] as const).map((letter) => {
                      const isCorrect = item.correct === letter;
                      const isPicked = item.selected === letter;
                      return (
                        <div
                          key={letter}
                          className={cn(
                            "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm",
                            isCorrect
                              ? "border-success/50 bg-success/10"
                              : isPicked
                                ? "border-destructive/50 bg-destructive/10"
                                : "border-border/60",
                          )}
                        >
                          <span className="type-mono w-4 shrink-0 font-semibold text-muted-foreground">
                            {letter}
                          </span>
                          <span className="flex-1">{item.options[letter]}</span>
                          {isPicked ? (
                            <span className="type-meta shrink-0 text-muted-foreground">Your answer</span>
                          ) : null}
                        </div>
                      );
                    })}
                    {item.explanation ? (
                      <p className="type-caption pt-2 text-muted-foreground">
                        <span className="text-foreground">Explanation. </span>
                        {item.explanation}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        {visible < review.length ? (
          <Button variant="outline" className="mt-4 w-full" onClick={() => setVisible((v) => v + PAGE)}>
            Show {Math.min(PAGE, review.length - visible)} more
          </Button>
        ) : null}

        <div className="mt-10 flex justify-center">
          <Link to="/">
            <Button variant="ghost">Back to Agora Quiz</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "destructive";
}) {
  return (
    <div className="panel rounded-2xl p-4">
      <p className="type-meta text-muted-foreground">{label}</p>
      <p
        className={cn(
          "type-mono mt-1.5 text-xl font-semibold",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StateIcon({ state }: { state: "correct" | "incorrect" | "unanswered" }) {
  const map = {
    correct: { Icon: Check, cls: "border-success/50 bg-success/15 text-success" },
    incorrect: { Icon: X, cls: "border-destructive/50 bg-destructive/15 text-destructive" },
    unanswered: { Icon: Minus, cls: "border-border bg-surface-2 text-muted-foreground" },
  } as const;
  const { Icon, cls } = map[state] ?? { Icon: Circle, cls: "" };
  return (
    <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border", cls)}>
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}
