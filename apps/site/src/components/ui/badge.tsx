import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn.ts";

const tones = {
  amber: "bg-amber/15 text-amber border-amber/30",
  sage: "bg-sage/15 text-sage border-sage/30",
  coral: "bg-coral/15 text-coral border-coral/40",
  sky: "bg-sky/15 text-sky border-sky/30",
  muted: "bg-sunken text-muted border-line",
} as const;

export function Badge({
  tone = "muted",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}
