import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  FileQuestion,
  LayoutDashboard,
  ListChecks,
  LogOut,
  ScrollText,
} from "lucide-react";

import { claimFirstAdmin, getAdminIdentity } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button, Logo } from "@/components/agora/primitives";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/quizzes", label: "Quizzes", icon: ListChecks, exact: false },
  { to: "/admin/questions", label: "Questions", icon: FileQuestion, exact: false },
  { to: "/admin/submissions", label: "Submissions", icon: ScrollText, exact: false },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, exact: false },
] as const;

function AdminLayout() {
  const identity = useServerFn(getAdminIdentity);
  const claim = useServerFn(claimFirstAdmin);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data, isPending, refetch } = useQuery({
    queryKey: ["admin-identity"],
    queryFn: () => identity(),
  });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data?.isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-5">
        <div className="glass w-full max-w-sm rounded-3xl p-8 text-center">
          <h1 className="type-h2">Administrator access required</h1>
          <p className="type-caption mt-2 text-muted-foreground">
            This account does not hold the administrator role.
          </p>
          <Button
            className="mt-6 w-full"
            onClick={async () => {
              const res = await claim();
              if (res.granted) void refetch();
              else toast.error("This account is not authorised for administrator access.");
            }}
          >
            Claim administrator role
          </Button>

          <p className="type-caption mt-2 text-muted-foreground/60">
            Only available while no administrator exists yet.
          </p>
          <Button variant="ghost" className="mt-4 w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-strong sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/admin">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink key={item.to} {...item} pathname={pathname} />
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>

        </div>
        <nav className="scrollbar-slim flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
          {NAV.map((item) => (
            <NavLink key={item.to} {...item} pathname={pathname} />
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  exact,
  pathname,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact: boolean;
  pathname: string;
}) {
  const active = exact ? pathname === to : pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 type-caption transition-colors",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}
