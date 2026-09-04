import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getOverview } from "@/lib/admin.functions";
import { Button, EmptyState, Stat, formatDuration } from "@/components/agora/primitives";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Overview,
});

function Overview() {
  const fn = useServerFn(getOverview);
  const { data, isPending } = useQuery({ queryKey: ["admin-overview"], queryFn: () => fn() });

  return (
    <div>
      <h1 className="type-h1">Overview</h1>
      <p className="type-caption mt-1 text-muted-foreground">
        Live health of your examination platform.
      </p>

      {isPending ? (
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface/60" />
          ))}
        </div>
      ) : !data ? null : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total quizzes" value={data.totalQuizzes} />
            <Stat label="Active quizzes" value={data.activeQuizzes} />
            <Stat label="Total attempts" value={data.totalAttempts} />
            <Stat label="Average score" value={`${data.averageScore}%`} />
            <Stat label="Highest score" value={`${data.highestScore}%`} />
            <Stat label="Lowest score" value={`${data.lowestScore}%`} />
            <Stat label="Avg. duration" value={formatDuration(data.averageDuration)} />
            <Stat label="Recent attempts" value={data.recent.length} sub="last 8 submissions" />
          </div>

          {data.totalQuizzes === 0 ? (
            <div className="mt-8">
              <EmptyState
                title="Your platform is empty"
                description="Create your first examination to start collecting attempts."
                action={
                  <Link to="/admin/quizzes">
                    <Button className="mt-2">Create a quiz</Button>
                  </Link>
                }
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
