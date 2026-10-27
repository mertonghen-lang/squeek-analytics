import { SqueekApiError } from "@squeek-analytics/client";
import type { ReactNode } from "react";
import { Button } from "./ui/button.tsx";

export function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface surface-hover rounded-3xl p-4 sm:p-6 ${className}`}>
      {title || action ? (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            {eyebrow ? <p className="text-xs tracking-[0.16em] text-amber uppercase">{eyebrow}</p> : null}
            {title ? <h2 className="font-serif text-2xl text-ink sm:text-[1.7rem]">{title}</h2> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="surface surface-hover rounded-2xl px-4 py-3.5">
      <p className="text-[0.7rem] tracking-[0.14em] text-muted uppercase">{label}</p>
      <p className="tabular mt-1 font-serif text-3xl text-ink sm:text-4xl">{value}</p>
      {detail ? <p className="mt-1 text-sm leading-5 text-muted">{detail}</p> : null}
    </div>
  );
}

export function Note({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "coral" | "amber" }) {
  const border = tone === "coral" ? "border-coral/50" : tone === "amber" ? "border-amber/50" : "border-line";
  return <p className={`rounded-2xl border ${border} bg-sunken/70 px-4 py-3 text-sm leading-6 text-muted`}>{children}</p>;
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-live="polite">
      <p className="text-sm text-muted">Loading {label} from the public API…</p>
      <div className="surface h-52 animate-pulse rounded-3xl" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="surface h-24 animate-pulse rounded-2xl" />
        <div className="surface h-24 animate-pulse rounded-2xl" />
        <div className="surface h-24 animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const code = error instanceof SqueekApiError ? error.code : null;
  const requestId = error instanceof SqueekApiError ? error.requestId : null;
  return (
    <div className="rounded-2xl border border-coral/50 bg-coral/10 px-4 py-4" role="alert">
      <p className="font-medium text-ink">The API did not return this view.</p>
      <p className="mt-1 text-sm text-muted">{error.message}</p>
      {code ? <p className="mt-2 text-xs text-muted">Code {code}{requestId ? ` · request ${requestId}` : ""}</p> : null}
      {onRetry ? (
        <Button className="mt-3" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Unavailable({ reason }: { reason?: string }) {
  return (
    <Note tone="amber">
      The API answered with status unavailable{reason ? ` (${reason})` : ""}. That is unknown, not zero.
    </Note>
  );
}
