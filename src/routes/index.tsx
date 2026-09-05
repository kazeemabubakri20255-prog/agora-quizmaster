import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Clock, ListChecks, Phone, ShieldCheck } from "lucide-react";

import heroImage from "@/assets/hero.jpg";
import { listActiveQuizzes } from "@/lib/exam.functions";
import { Button, Logo } from "@/components/agora/primitives";
import { markGateVisited, readGate } from "@/lib/exam-storage";
import { cn } from "@/lib/utils";

const CONTACT = "08132927734";
const FALLBACK_CHANNEL = "https://whatsapp.com/channel/0029VbCjPlqA89MqBRDzm80Z";

export const Route = createFileRoute("/")({
  loader: () => listActiveQuizzes(),
  head: () => ({
    meta: [
      { title: "Agora Quiz — Premium Online Examination Platform" },
      {
        name: "description",
        content:
          "Sit timed examinations on Agora Quiz: instant question navigation, server-verified timing, secure grading and detailed answer review.",
      },
      { property: "og:title", content: "Agora Quiz — Premium Online Examination Platform" },
      {
        property: "og:description",
        content: "Join the channel, then start your timed examination on Agora Quiz.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const quizzes = Route.useLoaderData();
  const navigate = useNavigate();
  const [gateOpen, setGateOpen] = useState(false);
  const [selected, setSelected] = useState(quizzes[0]?.slug ?? "");

  useEffect(() => {
    setGateOpen(readGate());
    const onFocus = () => setGateOpen(readGate());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const channelUrl = FALLBACK_CHANNEL;

  const joinChannel = () => {
    markGateVisited();
    const opened = window.open(channelUrl, "_blank", "noopener,noreferrer");
    if (!opened) window.location.href = channelUrl;
    setGateOpen(true);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-18rem] h-[36rem] w-[52rem] -translate-x-1/2 rounded-full opacity-70 blur-[120px]"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, var(--color-primary) 30%, transparent), transparent 70%)",
        }}
      />

      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Logo />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/auth" className="type-caption text-muted-foreground hover:text-foreground">
            Administrator
          </Link>
        </div>
      </header>


      <main className="relative mx-auto max-w-5xl px-5 pb-24">
        <section className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="type-display"
          >
            Agora Quiz
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="type-caption mx-auto mt-4 max-w-md text-muted-foreground"
          >
            Premium examination platform — engineered for speed, integrity and scale.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative mx-auto mt-10 max-w-2xl"
          >
            <img
              src={heroImage}
              alt="Agora Quiz — a glass examination monolith lit by electric blue light"
              width={1280}
              height={960}
              className="w-full rounded-3xl border border-border object-cover"
            />
          </motion.div>
        </section>

        <section className="mx-auto mt-12 max-w-xl">
          <div className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
            <p className="type-meta text-primary">Access required</p>

            <ol className="mt-6 space-y-6">
              <li>
                <div className="flex items-start gap-3">
                  <StepBadge done={gateOpen}>1</StepBadge>
                  <div className="flex-1">
                    <p className="type-h3">Join the Agora channel</p>
                    <p className="type-caption mt-1 text-muted-foreground">
                      Opens in a new tab. Return here afterwards to continue.
                    </p>
                    <Button variant={gateOpen ? "outline" : "primary"} className="mt-3" onClick={joinChannel}>
                      Join channel
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </li>

              <li>
                <div className="flex items-start gap-3">
                  <StepBadge done={false}>2</StepBadge>
                  <div className="flex-1">
                    <p className="type-h3">Return here and begin</p>
                    {quizzes.length > 1 ? (
                      <select
                        value={selected}
                        onChange={(e) => setSelected(e.target.value)}
                        aria-label="Choose an examination"
                        className="mt-3 h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm"
                      >
                        {quizzes.map((q) => (
                          <option key={q.slug} value={q.slug}>
                            {q.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="type-caption mt-1 text-muted-foreground">
                        {quizzes[0]?.title ?? "No examination is currently open."}
                      </p>
                    )}
                    <Button
                      className="mt-3 w-full"
                      size="lg"
                      disabled={!gateOpen || quizzes.length === 0}
                      onClick={() => navigate({ to: "/quiz/$slug", params: { slug: selected } })}
                    >
                      Start quiz
                    </Button>
                    {!gateOpen ? (
                      <p className="type-caption mt-2 text-muted-foreground/70">
                        Complete step 1 to unlock.
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            </ol>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Feature icon={Clock} label="Server timer" />
            <Feature icon={ShieldCheck} label="Secure grading" />
            <Feature icon={ListChecks} label="Instant navigation" />
          </div>

          <p className="type-caption mt-8 text-center text-muted-foreground">
            <Phone className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
            Contact us:{" "}
            <a href={`tel:${CONTACT}`} className="text-foreground hover:text-primary">
              {CONTACT}
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}

function StepBadge({ children, done }: { children: React.ReactNode; done: boolean }) {
  return (
    <span
      className={cn(
        "type-mono grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-sm font-semibold",
        done ? "border-success/50 bg-success/15 text-success" : "border-border bg-surface-2 text-muted-foreground",
      )}
    >
      {done ? <Check className="h-4 w-4" aria-hidden /> : children}
    </span>
  );
}

function Feature({ icon: Icon, label }: { icon: typeof Clock; label: string }) {
  return (
    <div className="panel flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center">
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      <span className="type-caption text-muted-foreground">{label}</span>
    </div>
  );
}
