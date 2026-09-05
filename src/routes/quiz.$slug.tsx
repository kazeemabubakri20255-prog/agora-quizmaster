import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import {
  getQuizPublic,
  getResult,
  resumeExam,
  startExam,
  type ExamState,
  type ReviewItem,
} from "@/lib/exam.functions";
import { ExamRunner } from "@/components/quiz/exam-runner";
import { ResultsView } from "@/components/quiz/results-view";
import { Button, Field, Input, Logo } from "@/components/agora/primitives";
import { clearSession, markGateVisited, readGate, readSession, writeSession } from "@/lib/exam-storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/quiz/$slug")({
  loader: ({ params }) => getQuizPublic({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    const title = loaderData?.found ? `${loaderData.quiz.title} — Agora Quiz` : "Examination — Agora Quiz";
    const description = loaderData?.found
      ? (loaderData.quiz.description ?? "Timed examination on Agora Quiz.")
      : "This examination is currently unavailable.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  errorComponent: () => (
    <Shell>
      <Notice
        title="Something went wrong"
        body="We couldn't load this examination. Please refresh and try again."
      />
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <Notice title="Examination not found" body="This link does not point to an examination." />
    </Shell>
  ),
  component: QuizPage,
});

type Phase =
  | { kind: "loading" }
  | { kind: "gate" }
  | { kind: "exam"; exam: ExamState }
  | { kind: "result"; submissionId: string };

function QuizPage() {
  const data = Route.useLoaderData();
  const { slug } = Route.useParams();
  const start = useServerFn(startExam);
  const resume = useServerFn(resumeExam);
  const fetchResult = useServerFn(getResult);

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [gateOpen, setGateOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    quizTitle: string;
    summary: Parameters<typeof ResultsView>[0]["summary"];
    review: ReviewItem[];
  } | null>(null);

  /* recover an in-flight attempt */
  useEffect(() => {
    let cancelled = false;
    setGateOpen(readGate());
    const stored = readSession(slug);
    if (!stored) {
      setPhase({ kind: "gate" });
      return;
    }
    void resume({ data: { sessionId: stored.sessionId, token: stored.token } })
      .then((res) => {
        if (cancelled) return;
        if (res.state === "active") setPhase({ kind: "exam", exam: res.exam });
        else if (res.state === "finished") {
          writeSession(slug, { ...stored, submissionId: res.submissionId });
          setPhase({ kind: "result", submissionId: res.submissionId });
        } else {
          clearSession(slug);
          setPhase({ kind: "gate" });
        }
      })
      .catch(() => {
        if (!cancelled) setPhase({ kind: "gate" });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, resume]);

  /* load result payload */
  useEffect(() => {
    if (phase.kind !== "result") return;
    const stored = readSession(slug);
    if (!stored) return;
    let cancelled = false;
    void fetchResult({ data: { submissionId: phase.submissionId, token: stored.token } })
      .then((res) => {
        if (!cancelled) setResult({ quizTitle: res.quiz.title, summary: res.summary, review: res.review });
      })
      .catch(() => {
        if (!cancelled) toast.error("We couldn't load your result. Please refresh.");
      });
    return () => {
      cancelled = true;
    };
  }, [phase, slug, fetchResult]);

  const beginExam = useCallback(async () => {
    if (name.trim().length < 2) {
      setError("Enter your full name to continue.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const exam = await start({ data: { slug, studentName: name.trim() } });
      writeSession(slug, { sessionId: exam.sessionId, token: exam.token });
      setPhase({ kind: "exam", exam });
    } catch {
      setBusy(false);
      toast.error("This examination could not be started. Please try again.");
    }
  }, [name, slug, start]);

  if (!data.found) {
    return (
      <Shell>
        <Notice title="Examination not found" body="This link does not point to an examination." />
      </Shell>
    );
  }

  if (!data.available && phase.kind !== "result") {
    return (
      <Shell>
        <Notice
          title="This examination is currently unavailable."
          body="Please check back later or contact your administrator."
        />
      </Shell>
    );
  }

  if (phase.kind === "exam") {
    return (
      <ExamRunner
        exam={phase.exam}
        onFinished={(submissionId) => {
          const stored = readSession(slug);
          if (stored) writeSession(slug, { ...stored, submissionId });
          setPhase({ kind: "result", submissionId });
        }}
      />
    );
  }

  if (phase.kind === "result") {
    if (!result) {
      return (
        <Shell>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <p className="type-caption">Preparing your result…</p>
          </div>
        </Shell>
      );
    }
    return <ResultsView quizTitle={result.quizTitle} summary={result.summary} review={result.review} />;
  }

  const channel = data.quiz.whatsappUrl || "https://whatsapp.com/channel/0029VbCjPlqA89MqBRDzm80Z";

  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass w-full max-w-md rounded-3xl p-6 sm:p-8"
      >
        <p className="type-meta text-primary">{data.quiz.durationSeconds / 60} minutes</p>
        <h1 className="type-h1 mt-2">{data.quiz.title}</h1>
        {data.quiz.description ? (
          <p className="type-caption mt-2 text-muted-foreground">{data.quiz.description}</p>
        ) : null}

        <div className="mt-6 space-y-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-xl border",
                gateOpen
                  ? "border-success/50 bg-success/15 text-success"
                  : "border-border bg-surface-2 text-muted-foreground",
              )}
            >
              {gateOpen ? <Check className="h-4 w-4" aria-hidden /> : <LockKeyhole className="h-4 w-4" aria-hidden />}
            </span>
            <div className="flex-1">
              <p className="type-h3">Join the Agora channel</p>
              <p className="type-caption mt-1 text-muted-foreground">
                Required before starting. Opens in a new tab.
              </p>
              <Button
                variant={gateOpen ? "outline" : "primary"}
                size="sm"
                className="mt-3"
                onClick={() => {
                  markGateVisited();
                  const opened = window.open(channel, "_blank", "noopener,noreferrer");
                  if (!opened) window.location.href = channel;
                  setGateOpen(true);
                }}
              >
                Join channel
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>

          <Field label="Your full name" error={error ?? undefined}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amina Bello"
              maxLength={80}
              autoComplete="name"
            />
          </Field>

          <Button
            size="lg"
            className="w-full"
            disabled={!gateOpen || busy || phase.kind === "loading"}
            onClick={() => void beginExam()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Start examination
          </Button>
          {!gateOpen ? (
            <p className="type-caption text-center text-muted-foreground/70">
              Join the channel to unlock this examination.
            </p>
          ) : null}
        </div>
      </motion.div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center bg-background px-5 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-14rem] h-[28rem] w-[40rem] -translate-x-1/2 rounded-full opacity-60 blur-[110px]"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, var(--color-primary) 26%, transparent), transparent 70%)",
        }}
      />
      <div className="relative flex w-full max-w-md items-center justify-between">
        <Link to="/" className="inline-flex">
          <Logo />
        </Link>
        <ThemeToggle />
      </div>

      <div className="relative flex flex-1 items-center justify-center py-10">{children}</div>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass w-full max-w-md rounded-3xl p-8 text-center">
      <h1 className="type-h2">{title}</h1>
      <p className="type-caption mt-3 text-muted-foreground">{body}</p>
      <Link to="/" className="mt-6 inline-block">
        <Button variant="outline">Back to Agora Quiz</Button>
      </Link>
    </div>
  );
}
