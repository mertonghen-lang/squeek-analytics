import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn.ts";

const tones = {
  amber: "bg-amber/15 text-amber border-amber/40",
  sage: "bg-sage/15 text-sage border-sage/40",
  coral: "bg-coral/15 text-coral border-coral/45",
  sky: "bg-sky/15 text-sky border-sky/40",
  muted: "bg-sunken text-muted border-line",
} as const;

export function Badge({
  tone = "muted",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
