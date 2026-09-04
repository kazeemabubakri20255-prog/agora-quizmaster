import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative grid h-7 w-7 place-items-center rounded-md border border-primary/40 bg-primary/10">
        <span className="h-2 w-2 rounded-[2px] bg-primary shadow-[0_0_12px_2px_var(--color-primary)]" />
      </span>
      <span className="type-meta text-foreground/90">Agora Quiz</span>
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "subtle";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-45",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-5 text-sm",
        size === "lg" && "h-13 px-7 text-base",
        variant === "primary" &&
          "bg-primary text-primary-foreground shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-primary)_60%,transparent),0_10px_40px_-12px_color-mix(in_oklch,var(--color-primary)_70%,transparent)] hover:brightness-110 active:scale-[0.985]",
        variant === "outline" &&
          "border border-border bg-surface/40 text-foreground hover:border-primary/50 hover:bg-surface-2/60",
        variant === "ghost" && "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
        variant === "subtle" && "bg-surface-2/70 text-foreground hover:bg-surface-2",
        variant === "danger" && "bg-destructive/15 text-destructive hover:bg-destructive/25",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="type-meta text-muted-foreground">{label}</span>
      {children}
      {error ? (
        <span className="block type-caption text-destructive">{error}</span>
      ) : hint ? (
        <span className="block type-caption text-muted-foreground/70">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-input bg-surface/60 px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/60 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200",
        checked ? "border-primary/60 bg-primary/80" : "border-border bg-surface-2",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200",
          checked ? "translate-x-6" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("glass rounded-2xl", className)}>{children}</div>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center">
      <h3 className="type-h3">{title}</h3>
      <p className="type-caption max-w-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="panel rounded-2xl p-5">
      <p className="type-meta text-muted-foreground">{label}</p>
      <p className="type-mono mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {sub ? <p className="type-caption mt-1 text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
