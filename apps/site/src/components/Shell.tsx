import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useSqueek } from "../data.tsx";
import { ageLabel, formatWhen, shortAddress } from "../lib/format.ts";
import { cn } from "../lib/cn.ts";
import { Badge } from "./ui/badge.tsx";
import { Button } from "./ui/button.tsx";

const links = [
  { to: "/", label: "Work history" },
  { to: "/blocks", label: "Block milestones" },
  { to: "/settlement", label: "Settlement lag" },
  { to: "/hamster", label: "Hamster" },
];

export function Shell({ children }: { children: ReactNode }) {
  const { status, core, refresh } = useSqueek();
  const [mode, setMode] = useState<"dark" | "light">(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  const reading = status.data?.measurement;
  const freshness = reading?.freshness;
  const coreAddress = core.data?.identities?.core;

  return (
    <div className="mx-auto grid min-h-screen min-w-0 max-w-6xl gap-6 overflow-x-hidden px-4 py-5 sm:px-6 lg:grid-cols-[13rem_1fr] lg:px-8">
      <header className="min-w-0 lg:sticky lg:top-5 lg:self-start">
        <NavLink to="/" className="flex items-center gap-2 text-ink">
          <Wheel />
          <span className="font-serif text-xl">Squeek Analytics</span>
        </NavLink>
        <p className="mt-2 text-sm leading-5 text-muted">Community charts for the public work record. Not the console.</p>
        <nav className="mt-4 flex min-w-0 gap-2 overflow-x-auto lg:flex-col" aria-label="Views">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-3 py-1.5 text-sm whitespace-nowrap",
                  isActive ? "bg-amber text-[#1c1304]" : "text-muted hover:bg-raised hover:text-ink",
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {freshness ? <Badge tone={freshness === "online" ? "sage" : "amber"}>{freshness}</Badge> : <Badge>measurement unknown</Badge>}
          <Badge tone="sky">{core.data?.chain?.safeThroughBlock ? `safe ${core.data.chain.safeThroughBlock}` : "safe block …"}</Badge>
          {coreAddress ? <Badge>{shortAddress(coreAddress)}</Badge> : null}
          <span className="text-xs text-muted">
            {reading ? `reading ${ageLabel(reading.receivedAt)}` : status.loading ? "loading status" : "no reading"}
            {status.updatedAt ? ` · fetched ${formatWhen(Math.floor(status.updatedAt / 1000))}` : ""}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
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
          </div>
        </div>
        <main>{children}</main>
        <footer className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-xs text-muted">
          <NavLink className="hover:text-ink" to="/sources">Sources and limits</NavLink>
          <span>Unofficial. No wallet, no writes, Sepolia data only.</span>
          <span>Installation {status.data?.installationId ?? "…"}</span>
        </footer>
      </div>
    </div>
  );
}

function Wheel() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-amber" />
      <circle cx="16" cy="16" r="2" fill="currentColor" className="text-ink" />
      <path d="M16 16 L23 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-sage" />
    </svg>
  );
}
