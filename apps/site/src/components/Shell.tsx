import { tryUint } from "@squeek-analytics/client";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSqueek } from "../data.tsx";
import { ageLabel, formatUint, formatWhen } from "../lib/format.ts";
import { cn } from "../lib/cn.ts";
import { Badge } from "./ui/badge.tsx";
import { Button } from "./ui/button.tsx";

const links = [
  { to: "/", label: "Work" },
  { to: "/blocks", label: "Blocks" },
  { to: "/settlement", label: "Settlement" },
  { to: "/hamster", label: "Hamster" },
  { to: "/sources", label: "Sources" },
];

export function Shell({ children }: { children: ReactNode }) {
  const { status, refresh } = useSqueek();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"dark" | "light">(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  const reading = status.data?.measurement;
  const pill = statusPill(status.loading, status.error, reading?.freshness);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counter = reading ? tryUint(reading.cumulativeWorkUnits) : null;
  const openRound = tryUint(status.data?.builder.queued?.openRoundWorkUnits);
  const distance = reading ? BigInt(Math.round(reading.distanceMm)) : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <NavLink to="/" className="flex min-w-0 items-center gap-2.5 rounded-xl text-ink" end>
            <Mark />
            <span className="min-w-0">
              <span className="block font-serif text-xl leading-none">Squeek Analytics</span>
              <span className="mt-1 hidden text-xs text-muted sm:block">Unofficial charts for the public work record.</span>
            </span>
          </NavLink>
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Views">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "rounded-full px-3 py-2 text-sm",
                    isActive ? "bg-amber text-[#1c1404]" : "text-muted hover:bg-raised hover:text-ink",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-3">
            <Button
              variant="outline"
              size="sm"
              aria-pressed={mode === "light"}
              onClick={() => {
                const next = mode === "dark" ? "light" : "dark";
                document.documentElement.dataset.theme = next;
                localStorage.setItem("squeek-theme", next);
                setMode(next);
              }}
            >
              {mode === "dark" ? "Light" : "Dark"}
            </Button>
            <Button variant="outline" size="sm" onClick={refresh}>
              Refresh
            </Button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink md:hidden"
              aria-expanded={open}
              aria-controls="mobile-views"
              onClick={() => setOpen((value) => !value)}
            >
              <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
              <MenuIcon open={open} />
            </button>
          </div>
        </div>
        {open ? (
          <nav id="mobile-views" className="grid gap-1 border-t border-line px-4 py-3 md:hidden" aria-label="Views">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "rounded-2xl px-3 py-3 text-sm",
                    isActive ? "bg-amber text-[#1c1404]" : "text-ink hover:bg-raised",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6">
        <section className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-xs tracking-[0.16em] text-amber uppercase">Community work record</p>
              <p className="mt-1 font-serif text-4xl leading-none text-ink sm:text-5xl">Read the wheel. Leave the chain alone.</p>
              <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
                Public Sepolia measurements, charted without a wallet. Not the console.
              </p>
            </div>
            <Badge tone={pill.tone} title={reading ? `Reading ${ageLabel(reading.receivedAt)}` : undefined}>
              <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
              {pill.label}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Headline label="Wheel counter" value={formatUint(counter)} detail={reading ? `Observed ${formatWhen(reading.observedAt)}` : "From /v1/status"} />
            <Headline label="Open round" value={formatUint(openRound)} detail="Not accepted, not settled" />
            <Headline label="Day distance" value={distance == null ? "—" : `${formatUint(distance)} mm`} detail="Device day, not animal travel" />
          </div>
        </section>
        <main>{children}</main>
        <footer className="mt-4 grid gap-3 border-t border-line pt-5 text-sm text-muted sm:flex sm:flex-wrap sm:items-center sm:gap-x-5">
          <p>Unofficial community project.</p>
          <a className="text-ink underline decoration-line underline-offset-4 hover:decoration-amber" href="https://github.com/mertonghen-lang/squeek-analytics">
            GitHub repository
          </a>
          <a className="text-ink underline decoration-line underline-offset-4 hover:decoration-amber" href="https://api.squeekchain.com/v1">
            Data source
          </a>
          <p>
            Open source under the{" "}
            <a className="text-ink underline decoration-line underline-offset-4 hover:decoration-amber" href="https://github.com/mertonghen-lang/squeek-analytics/blob/main/LICENSE">
              MIT license
            </a>
            .
          </p>
          <p className="sm:ml-auto">Installation {status.data?.installationId ?? "…"}</p>
        </footer>
      </div>
    </div>
  );
}

function Headline({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="surface surface-hover rounded-2xl px-4 py-3">
      <p className="text-[0.7rem] tracking-[0.14em] text-muted uppercase">{label}</p>
      <p className="tabular mt-1 font-serif text-3xl text-ink">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
    </div>
  );
}

function statusPill(
  loading: boolean,
  error: Error | null,
  freshness: string | undefined,
): { label: string; tone: "sage" | "amber" | "coral" | "muted"; dot: string } {
  if (loading && freshness == null && !error) return { label: "Checking /v1/status", tone: "muted", dot: "bg-muted" };
  if (error && freshness == null) return { label: "Status unreachable", tone: "coral", dot: "bg-coral" };
  if (freshness === "online") return { label: "Reading online", tone: "sage", dot: "bg-sage" };
  if (freshness === "stale") return { label: "Reading stale", tone: "amber", dot: "bg-amber" };
  if (freshness) return { label: `Reading ${freshness}`, tone: "amber", dot: "bg-amber" };
  return { label: "No live reading", tone: "muted", dot: "bg-muted" };
}

function Mark() {
  return (
    <svg width="36" height="36" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="9" fill="var(--sunken)" stroke="var(--line)" />
      <circle cx="16" cy="17" r="8" fill="none" stroke="var(--amber)" strokeWidth="2" />
      <circle cx="16" cy="17" r="2" fill="var(--ink)" />
      <path d="M16 17 L22.2 12.4" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.2 8.6c1.4-2.1 3.6-2.2 4.5-.2" fill="none" stroke="var(--amber)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M22.8 8.6c-1.4-2.1-3.6-2.2-4.5-.2" fill="none" stroke="var(--amber)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      {open ? (
        <path d="M4 4 L14 14 M14 4 L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path d="M3 5 H15 M3 9 H15 M3 13 H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}
