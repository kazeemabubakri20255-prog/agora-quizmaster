import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getAnalytics, listQuizzes } from "@/lib/admin.functions";
import { EmptyState, Stat, formatDuration } from "@/components/agora/primitives";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const quizzesFn = useServerFn(listQuizzes);
  const analyticsFn = useServerFn(getAnalytics);
  const [quizId, setQuizId] = useState("");

  const { data: quizzes } = useQuery({ queryKey: ["admin-quizzes"], queryFn: () => quizzesFn() });
  const { data, isPending } = useQuery({
    queryKey: ["admin-analytics", quizId],
    queryFn: () => analyticsFn({ data: quizId ? { quizId } : {} }),
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-h1">Analytics</h1>
          <p className="type-caption mt-1 text-muted-foreground">Performance across attempts.</p>
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
      ) : !data || data.attempts === 0 ? (
        <div className="mt-8">
          <EmptyState title="No data yet" description="Analytics populate once students submit attempts." />
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Attempts" value={data.attempts} />
            <Stat label="Average" value={`${data.average}%`} />
            <Stat label="Highest" value={`${data.highest}%`} />
            <Stat label="Lowest" value={`${data.lowest}%`} />
            <Stat label="Completion rate" value={`${data.completionRate}%`} />
            <Stat label="Avg. duration" value={formatDuration(data.averageDuration)} />
          </div>

          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <Panel title="Most difficult questions" rows={data.hardest.map((q) => [q.question, `${q.accuracy}%`])} />
            <Panel title="Easiest questions" rows={data.easiest.map((q) => [q.question, `${q.accuracy}%`])} />
            <Panel
              title="Topic performance"
              rows={data.topics.map((t) => [t.topic, `${t.accuracy}% · ${t.attempts} answers`])}
            />
            <div className="panel rounded-2xl p-5">
              <h2 className="type-h3">Score distribution</h2>
              <ul className="mt-4 space-y-2">
                {data.distribution.map((band) => {
                  const max = Math.max(...data.distribution.map((b) => b.count), 1);
                  return (
                    <li key={band.band} className="flex items-center gap-3">
                      <span className="type-mono w-20 shrink-0 text-muted-foreground">{band.band}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${(band.count / max) * 100}%` }}
                        />
                      </span>
                      <span className="type-mono w-8 text-right">{band.count}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Panel({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="panel rounded-2xl p-5">
      <h2 className="type-h3">{title}</h2>
      {rows.length === 0 ? (
        <p className="type-caption mt-3 text-muted-foreground">Not enough data.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map(([label, value], i) => (
            <li key={i} className="flex items-start justify-between gap-3">
              <span className="line-clamp-2 text-sm text-muted-foreground">{label}</span>
              <span className="type-mono shrink-0 text-sm">{value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
