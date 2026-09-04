import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import Papa from "papaparse";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import {
  deleteQuestion,
  importQuestions,
  listQuestions,
  listQuizzes,
  reorderQuestion,
  saveQuestion,
} from "@/lib/admin.functions";
import { Button, EmptyState, Field, Input } from "@/components/agora/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/questions")({
  component: QuestionsPage,
});

type Letter = "A" | "B" | "C" | "D";
type Draft = {
  id?: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: Letter;
  explanation: string;
  topic: string;
  subtopic: string;
  difficulty: "easy" | "medium" | "hard";
  is_active: boolean;
};

const emptyDraft: Draft = {
  question_text: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_answer: "A",
  explanation: "",
  topic: "",
  subtopic: "",
  difficulty: "medium",
  is_active: true,
};

type ImportResult = Awaited<ReturnType<typeof importQuestions>>;

function QuestionsPage() {
  const quizzesFn = useServerFn(listQuizzes);
  const listFn = useServerFn(listQuestions);
  const saveFn = useServerFn(saveQuestion);
  const deleteFn = useServerFn(deleteQuestion);
  const reorderFn = useServerFn(reorderQuestion);
  const importFn = useServerFn(importQuestions);
  const qc = useQueryClient();

  const [quizId, setQuizId] = useState<string>("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: quizzes } = useQuery({ queryKey: ["admin-quizzes"], queryFn: () => quizzesFn() });
  const activeQuizId = quizId || quizzes?.[0]?.id || "";

  const { data: questions, isPending } = useQuery({
    queryKey: ["admin-questions", activeQuizId],
    queryFn: () => listFn({ data: { quizId: activeQuizId } }),
    enabled: Boolean(activeQuizId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-questions", activeQuizId] });

  const saveMutation = useMutation({
    mutationFn: (d: Draft) =>
      saveFn({
        data: {
          id: d.id,
          quiz_id: activeQuizId,
          question_text: d.question_text,
          option_a: d.option_a,
          option_b: d.option_b,
          option_c: d.option_c,
          option_d: d.option_d,
          correct_answer: d.correct_answer,
          explanation: d.explanation || null,
          topic: d.topic || null,
          subtopic: d.subtopic || null,
          difficulty: d.difficulty,
          is_active: d.is_active,
        },
      }),
    onSuccess: () => {
      toast.success("Question saved");
      setDraft(null);
      void invalidate();
    },
    onError: () => toast.error("The question could not be saved. Check every field."),
  });

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Only .csv files are accepted.");
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: async (result) => {
        if (result.errors.length) {
          toast.error(`Malformed CSV: ${result.errors[0]?.message ?? "unable to parse"}`);
          return;
        }
        const parsed = result.data.map((r) =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "")])),
        );
        setRows(parsed);
        try {
          const res = await importFn({ data: { quizId: activeQuizId, rows: parsed, confirm: false } });
          setPreview(res);
        } catch {
          toast.error("The file could not be validated.");
        }
      },
      error: () => toast.error("The file could not be read."),
    });
  };

  const commitImport = async () => {
    if (!rows) return;
    try {
      const res = await importFn({ data: { quizId: activeQuizId, rows, confirm: true } });
      if (res.committed) {
        toast.success(`${res.imported} questions imported`);
        setRows(null);
        setPreview(null);
        void invalidate();
      } else {
        setPreview(res);
        toast.error("Resolve the errors before importing.");
      }
    } catch {
      toast.error("The import could not be completed. No questions were added.");
    }
  };

  if ((quizzes ?? []).length === 0) {
    return (
      <EmptyState
        title="Your question bank is empty"
        description="Create a quiz first, then add or import its questions."
      />
    );
  }

  const errors = (preview?.issues ?? []).filter((i) => i.level === "error");
  const warnings = (preview?.issues ?? []).filter((i) => i.level === "warning");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-h1">Questions</h1>
          <p className="type-caption mt-1 text-muted-foreground">
            Author, import and order your question bank.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={activeQuizId}
            onChange={(e) => setQuizId(e.target.value)}
            aria-label="Select quiz"
            className="h-11 rounded-xl border border-input bg-surface px-3 text-sm"
          >
            {(quizzes ?? []).map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </select>
          <Button onClick={() => setDraft({ ...emptyDraft })}>
            <Plus className="h-4 w-4" aria-hidden />
            New
          </Button>
        </div>
      </div>

      {/* CSV import */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={cn(
          "mt-6 rounded-2xl border border-dashed p-6 text-center transition-colors",
          dragging ? "border-primary bg-primary/10" : "border-border bg-surface/40",
        )}
      >
        <Upload className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden />
        <p className="type-caption mt-2">
          Drag a <span className="type-mono">.csv</span> here, or{" "}
          <button
            type="button"
            className="text-primary underline underline-offset-4"
            onClick={() => fileRef.current?.click()}
          >
            choose a file
          </button>
        </p>
        <p className="type-meta mt-1 text-muted-foreground">
          Columns: question, option_a…option_d, correct_answer, explanation, topic, subtopic, difficulty · max 180 rows
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {preview ? (
        <div className="panel mt-4 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="type-h3">Import preview</h2>
              <p className="type-caption mt-1 text-muted-foreground">
                {preview.validCount} valid rows · {errors.length} errors · {warnings.length} warnings
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Discard import"
              onClick={() => {
                setPreview(null);
                setRows(null);
              }}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>

          {preview.issues.length ? (
            <ul className="scrollbar-slim mt-4 max-h-60 space-y-1 overflow-y-auto">
              {preview.issues.map((issue, i) => (
                <li key={i} className="type-caption">
                  <span className="type-mono text-muted-foreground">Row {issue.row}</span>{" "}
                  <span className={issue.level === "error" ? "text-destructive" : "text-warning"}>
                    {issue.level === "error" ? "✕" : "!"} {issue.message}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-caption mt-3 text-success">Every row passed validation.</p>
          )}

          <Button className="mt-5" disabled={errors.length > 0 || preview.validCount === 0} onClick={() => void commitImport()}>
            Import {preview.validCount} questions
          </Button>
        </div>
      ) : null}

      {/* question list */}
      {isPending ? (
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-surface/60" />
      ) : (questions ?? []).length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No questions in this quiz"
            description="Add one manually or import a CSV batch."
            action={<Button className="mt-2" onClick={() => setDraft({ ...emptyDraft })}>Add a question</Button>}
          />
        </div>
      ) : (
        <ol className="mt-8 space-y-2">
          {(questions ?? []).map((q, index) => (
            <li key={q.id} className="panel rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="type-meta text-muted-foreground">
                    #{index + 1} · {q.difficulty} · {q.topic ?? "Uncategorised"} · answer {q.correct_answer}
                    {q.is_active ? "" : " · inactive"}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm">{q.question_text}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={async () => {
                      const prev = (questions ?? [])[index - 1]!;
                      await reorderFn({ data: { id: q.id, position: prev.position } });
                      await reorderFn({ data: { id: prev.id, position: q.position } });
                      void invalidate();
                    }}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Move down"
                    disabled={index === (questions ?? []).length - 1}
                    onClick={async () => {
                      const next = (questions ?? [])[index + 1]!;
                      await reorderFn({ data: { id: q.id, position: next.position } });
                      await reorderFn({ data: { id: next.id, position: q.position } });
                      void invalidate();
                    }}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    variant="subtle"
                    size="sm"
                    aria-label="Edit question"
                    onClick={() =>
                      setDraft({
                        id: q.id,
                        question_text: q.question_text,
                        option_a: q.option_a,
                        option_b: q.option_b,
                        option_c: q.option_c,
                        option_d: q.option_d,
                        correct_answer: q.correct_answer as Letter,
                        explanation: q.explanation ?? "",
                        topic: q.topic ?? "",
                        subtopic: q.subtopic ?? "",
                        difficulty: (q.difficulty ?? "medium") as Draft["difficulty"],
                        is_active: q.is_active,
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    aria-label="Delete question"
                    onClick={async () => {
                      if (!confirm("Delete this question?")) return;
                      await deleteFn({ data: { id: q.id } });
                      void invalidate();
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {draft ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
          <div className="glass-strong max-h-[88vh] w-full max-w-xl overflow-y-auto scrollbar-slim rounded-3xl p-6">
            <h2 className="type-h2">{draft.id ? "Edit question" : "New question"}</h2>
            <div className="mt-5 space-y-4">
              <Field label="Question">
                <textarea
                  value={draft.question_text}
                  onChange={(e) => setDraft({ ...draft, question_text: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-input bg-surface p-3 text-sm"
                />
              </Field>
              {(["a", "b", "c", "d"] as const).map((k) => (
                <Field key={k} label={`Option ${k.toUpperCase()}`}>
                  <Input
                    value={draft[`option_${k}` as const]}
                    onChange={(e) => setDraft({ ...draft, [`option_${k}`]: e.target.value } as Draft)}
                  />
                </Field>
              ))}
              <Field label="Correct answer">
                <div className="flex gap-2">
                  {(["A", "B", "C", "D"] as Letter[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setDraft({ ...draft, correct_answer: l })}
                      className={cn(
                        "h-11 flex-1 rounded-xl border text-sm transition-colors",
                        draft.correct_answer === l
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-input bg-surface text-muted-foreground",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Explanation">
                <textarea
                  value={draft.explanation}
                  onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-input bg-surface p-3 text-sm"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Topic">
                  <Input value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} />
                </Field>
                <Field label="Subtopic">
                  <Input value={draft.subtopic} onChange={(e) => setDraft({ ...draft, subtopic: e.target.value })} />
                </Field>
                <Field label="Difficulty">
                  <select
                    value={draft.difficulty}
                    onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as Draft["difficulty"] })}
                    className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </Field>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button className="flex-1" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(draft)}>
                Save question
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
