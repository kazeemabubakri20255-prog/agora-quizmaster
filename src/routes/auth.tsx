import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button, Field, Input, Logo } from "@/components/agora/primitives";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Administrator sign in — Agora Quiz" },
      { name: "description", content: "Secure sign in for Agora Quiz administrators." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Administrator sign in — Agora Quiz" },
      { property: "og:description", content: "Secure sign in for Agora Quiz administrators." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fn =
        mode === "signin"
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: `${window.location.origin}/admin` },
            });
      const { error } = await fn;
      if (error) {
        toast.error(error.message);
        return;
      }
      navigate({ to: "/admin", replace: true });
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in is unavailable right now.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/admin", replace: true });
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-5">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/4 h-[26rem] w-[36rem] -translate-x-1/2 rounded-full opacity-50 blur-[110px]"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, var(--color-primary) 24%, transparent), transparent 70%)",
        }}
      />
      <div className="glass relative w-full max-w-sm rounded-3xl p-7">
        <Logo />
        <h1 className="type-h2 mt-5">Administrator access</h1>
        <p className="type-caption mt-1 text-muted-foreground">
          Restricted area. Student accounts are not required to sit examinations.
        </p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <Field label="Email">
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password" hint={mode === "signup" ? "Minimum 8 characters" : undefined}>
            <Input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <Button variant="outline" className="mt-3 w-full" onClick={() => void google()}>
          Continue with Google
        </Button>

        <button
          type="button"
          className="type-caption mt-5 w-full text-muted-foreground hover:text-foreground"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Need an account? Create one" : "Already registered? Sign in"}
        </button>

        <Link to="/" className="type-caption mt-4 block text-center text-muted-foreground/70 hover:text-foreground">
          Back to Agora Quiz
        </Link>
      </div>
    </div>
  );
}
