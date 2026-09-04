import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { X } from "lucide-react";

import { getSubmissionDetail, listQuizzes, listSubmissions } from "@/lib/admin.functions";
import { Button, EmptyState, formatDuration } from "@/components/agora/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/submissions")({
  component: SubmissionsPage,
});

function SubmissionsPage() {
  const quizzesFn = useServerFn(listQuizzes);
  const listFn = useServerFn(listSubmissions);
  const detailFn = useServerFn(getSubmissionDetail);
  const [quizId, setQuizId] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: quizzes } = useQuery({ queryKey: ["admin-quizzes"], queryFn: () => quizzesFn() });
  const { data: rows, isPending } = useQuery({
    queryKey: ["admin-submissions", quizId],
    queryFn: () => listFn({ data: quizId ? { quizId } : {} }),
  });
  const { data: detail } = useQuery({
    queryKey: ["admin-submission", openId],
    queryFn: () => detailFn({ data: { id: openId! } }),
    enabled: Boolean(openId),
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-h1">Submissions</h1>
          <p className="type-caption mt-1 text-muted-foreground">Every completed attempt.</p>
        </div>
        <select
          value={quizId}
          onChange={(e) => setQuizId(e.target.value)}
          aria-label="Filter by quiz"
          className="h-11 rounded-xl border border-input bg-surface px-3 text-sm"
        >
          <option value="">All quizzes</option>
          {(quizzes ?? []).map((q) => (
            <option key={q.id} value={q.id}>
              {q.title}
            </option>
          ))}
        </select>
      </div>

      {isPending ? (
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-surface/60" />
      ) : (rows ?? []).length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No submissions yet" description="Attempts appear here as soon as students submit." />
        </div>
      ) : (
        <div className="scrollbar-slim mt-8 overflow-x-auto rounded-2xl panel">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="type-meta text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Quiz</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3">{r.student_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.quizTitle}</td>
                  <td className="type-mono px-4 py-3">
                    {r.score}/{r.total_questions}{" "}
                    <span className="text-muted-foreground">({Number(r.percentage)}%)</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDuration(r.duration_seconds)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.submitted_at).toLocaleString()}
                    {r.auto_submitted ? <span className="ml-2 text-warning">auto</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="subtle" size="sm" onClick={() => setOpenId(r.id)}>
                      Inspect
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
          <div className="glass-strong max-h-[85vh] w-full max-w-2xl overflow-y-auto scrollbar-slim rounded-3xl p-6">
            <div className="flex items-start justify-between">
              <h2 className="type-h2">Attempt detail</h2>
              <Button variant="ghost" size="sm" onClick={() => setOpenId(null)} aria-label="Close">
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            {!detail ? (
              <div className="mt-6 h-40 animate-pulse rounded-2xl bg-surface/60" />
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Mini label="Student" value={detail.submission.student_name} />
                  <Mini label="Score" value={`${detail.submission.score}/${detail.submission.total_questions}`} />
                  <Mini label="Percentage" value={`${Number(detail.submission.percentage)}%`} />
                  <Mini label="Duration" value={formatDuration(detail.submission.duration_seconds)} />
                  <Mini label="Correct" value={detail.submission.correct_count} />
                  <Mini label="Incorrect" value={detail.submission.incorrect_count} />
                  <Mini label="Unanswered" value={detail.submission.unanswered_count} />
                  <Mini label="Status" value={detail.session?.status ?? "—"} />
                </div>
                <ul className="mt-6 space-y-2">
                  {detail.answers.map((a, i) => (
                    <li key={a.question_id} className="rounded-xl border border-border/60 p-3">
                      <p className="type-meta text-muted-foreground">Question {i + 1}</p>
                      <p className="mt-1 text-sm">{a.question}</p>
                      <p className="type-caption mt-2">
                        <span
                          className={cn(
                            a.is_correct ? "text-success" : a.selected_answer ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          Selected: {a.selected_answer ?? "—"}
                        </span>
                        <span className="ml-3 text-muted-foreground">Correct: {a.correct}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p className="type-meta text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm">{value}</p>
    </div>
  );
}
