import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteQuiz,
  duplicateQuiz,
  listQuizzes,
  saveQuiz,
  setQuizActive,
} from "@/lib/admin.functions";
import { Button, EmptyState, Field, Input, Toggle } from "@/components/agora/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/quizzes")({
  component: QuizzesPage,
});

type QuizRow = Awaited<ReturnType<typeof listQuizzes>>[number];

type Draft = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  duration_minutes: number;
  question_limit: number;
  status: "draft" | "active" | "inactive" | "archived";
  is_active: boolean;
  show_leaderboard: boolean;
  shuffle_questions: boolean;
  whatsapp_url: string;
};

const emptyDraft: Draft = {
  title: "",
  slug: "",
  description: "",
  duration_minutes: 30,
  question_limit: 20,
  status: "draft",
  is_active: false,
  show_leaderboard: false,
  shuffle_questions: true,
  whatsapp_url: "",
};

function QuizzesPage() {
  const list = useServerFn(listQuizzes);
  const save = useServerFn(saveQuiz);
  const toggle = useServerFn(setQuizActive);
  const remove = useServerFn(deleteQuiz);
  const duplicate = useServerFn(duplicateQuiz);
  const qc = useQueryClient();

  const [draft, setDraft] = useState<Draft | null>(null);
  const { data: quizzes, isPending } = useQuery({ queryKey: ["admin-quizzes"], queryFn: () => list() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-quizzes"] });

  const saveMutation = useMutation({
    mutationFn: (d: Draft) =>
      save({
        data: {
          id: d.id,
          title: d.title,
          slug: d.slug,
          description: d.description || null,
          duration_seconds: Math.round(d.duration_minutes * 60),
          question_limit: d.question_limit,
          status: d.status,
          is_active: d.is_active,
          show_leaderboard: d.show_leaderboard,
          shuffle_questions: d.shuffle_questions,
          whatsapp_url: d.whatsapp_url || null,
        },
      }),
    onSuccess: () => {
      toast.success("Quiz saved");
      setDraft(null);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save the quiz."),
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-h1">Quizzes</h1>
          <p className="type-caption mt-1 text-muted-foreground">
            Configure duration, access and publication.
          </p>
        </div>
        <Button onClick={() => setDraft({ ...emptyDraft })}>
          <Plus className="h-4 w-4" aria-hidden />
          New quiz
        </Button>
      </div>

      {isPending ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface/60" />
          ))}
        </div>
      ) : (quizzes ?? []).length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No examinations yet"
            description="Create a quiz, add questions, then activate it to share the public link."
            action={<Button className="mt-2" onClick={() => setDraft({ ...emptyDraft })}>Create a quiz</Button>}
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {(quizzes ?? []).map((quiz: QuizRow) => (
            <li key={quiz.id} className="panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="type-h3 truncate">{quiz.title}</h2>
                    <StatusPill status={quiz.status} />
                    {quiz.is_demo ? (
                      <span className="type-meta rounded-md border border-border px-1.5 py-0.5 text-muted-foreground">
                        Demo
                      </span>
                    ) : null}
                  </div>
                  <p className="type-caption mt-1 text-muted-foreground">
                    /quiz/{quiz.slug} · {Math.round(quiz.duration_seconds / 60)} min ·{" "}
                    {quiz.question_limit} served of {quiz.questionCount} in bank ·{" "}
                    {quiz.show_leaderboard ? "leaderboard on" : "leaderboard off"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle
                    checked={quiz.is_active}
                    label={`Activate ${quiz.title}`}
                    onChange={async (v) => {
                      await toggle({ data: { id: quiz.id, isActive: v } });
                      void invalidate();
                    }}
                  />
                  <Button
                    variant="subtle"
                    size="sm"
                    aria-label="Edit quiz"
                    onClick={() =>
                      setDraft({
                        id: quiz.id,
                        title: quiz.title,
                        slug: quiz.slug,
                        description: quiz.description ?? "",
                        duration_minutes: Math.round(quiz.duration_seconds / 60),
                        question_limit: quiz.question_limit,
                        status: quiz.status,
                        is_active: quiz.is_active,
                        show_leaderboard: quiz.show_leaderboard,
                        shuffle_questions: quiz.shuffle_questions,
                        whatsapp_url: quiz.whatsapp_url ?? "",
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    variant="subtle"
                    size="sm"
                    aria-label="Duplicate quiz"
                    onClick={async () => {
                      await duplicate({ data: { id: quiz.id } });
                      toast.success("Quiz duplicated");
                      void invalidate();
                    }}
                  >
                    <Copy className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    aria-label="Delete quiz"
                    onClick={async () => {
                      if (!confirm(`Delete "${quiz.title}" and all of its questions?`)) return;
                      await remove({ data: { id: quiz.id } });
                      toast.success("Quiz deleted");
                      void invalidate();
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
          <div className="glass-strong w-full max-w-lg rounded-3xl p-6">
            <h2 className="type-h2">{draft.id ? "Edit quiz" : "New quiz"}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Title">
                  <Input
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        title: e.target.value,
                        slug:
                          draft.id || draft.slug
                            ? draft.slug
                            : e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, "-")
                                .replace(/^-|-$/g, ""),
                      })
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Public slug" hint={`Link: /quiz/${draft.slug || "…"}`}>
                  <Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Description">
                  <Input
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Duration (minutes)">
                <Input
                  type="number"
                  min={1}
                  max={720}
                  value={draft.duration_minutes}
                  onChange={(e) => setDraft({ ...draft, duration_minutes: Number(e.target.value) })}
                />
              </Field>
              <Field label="Questions served">
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={draft.question_limit}
                  onChange={(e) => setDraft({ ...draft, question_limit: Number(e.target.value) })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="WhatsApp channel URL" hint="Shown on the access gate">
                  <Input
                    value={draft.whatsapp_url}
                    placeholder="https://whatsapp.com/channel/…"
                    onChange={(e) => setDraft({ ...draft, whatsapp_url: e.target.value })}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Status">
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}
                    className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </Field>
              </div>

              <SwitchRow
                label="Published (accepting attempts)"
                checked={draft.is_active}
                onChange={(v) => setDraft({ ...draft, is_active: v, status: v ? "active" : draft.status })}
              />
              <SwitchRow
                label="Show leaderboard to students"
                checked={draft.show_leaderboard}
                onChange={(v) => setDraft({ ...draft, show_leaderboard: v })}
              />
              <SwitchRow
                label="Shuffle question order"
                checked={draft.shuffle_questions}
                onChange={(v) => setDraft({ ...draft, shuffle_questions: v })}
              />
            </div>

            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate(draft)}
              >
                Save quiz
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 sm:col-span-2">
      <span className="type-caption">{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "type-meta rounded-md border px-1.5 py-0.5",
        status === "active"
          ? "border-success/40 bg-success/10 text-success"
          : status === "draft"
            ? "border-border text-muted-foreground"
            : "border-warning/40 bg-warning/10 text-warning",
      )}
    >
      {status}
    </span>
  );
}
