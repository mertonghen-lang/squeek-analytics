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
    <section className={`rounded-3xl border border-line bg-raised/90 p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)] sm:p-5 ${className}`}>
      {title || action ? (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            {eyebrow ? <p className="text-xs tracking-[0.16em] text-muted uppercase">{eyebrow}</p> : null}
            {title ? <h2 className="font-serif text-xl text-ink sm:text-2xl">{title}</h2> : null}
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
    <div className="rounded-2xl border border-line bg-sunken/70 px-4 py-3">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="tabular mt-1 font-serif text-2xl text-ink sm:text-3xl">{value}</p>
      {detail ? <p className="mt-1 text-sm text-muted">{detail}</p> : null}
    </div>
  );
}

export function Note({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "coral" | "amber" }) {
  const border = tone === "coral" ? "border-coral/40" : tone === "amber" ? "border-amber/40" : "border-line";
  return <p className={`rounded-2xl border ${border} bg-sunken/50 px-4 py-3 text-sm leading-6 text-muted`}>{children}</p>;
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-live="polite">
      <p className="text-sm text-muted">Loading {label} from the public API…</p>
      <div className="h-24 animate-pulse rounded-2xl bg-sunken" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-20 animate-pulse rounded-2xl bg-sunken" />
        <div className="h-20 animate-pulse rounded-2xl bg-sunken" />
        <div className="h-20 animate-pulse rounded-2xl bg-sunken" />
      </div>
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const code = error instanceof SqueekApiError ? error.code : null;
  const requestId = error instanceof SqueekApiError ? error.requestId : null;
  return (
    <div className="rounded-2xl border border-coral/40 bg-coral/10 px-4 py-4" role="alert">
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
