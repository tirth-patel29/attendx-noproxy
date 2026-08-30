import * as React from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

export type Tone = "primary" | "success" | "warning" | "danger" | "neutral" | "info";

const toneClass: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary-deep ring-primary/20",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/15 text-warning-foreground ring-warning/30",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  neutral: "bg-secondary text-muted-foreground ring-border",
  info: "bg-info/10 text-info ring-info/20",
};

const dotClass: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground/60",
  info: "bg-info",
};

export function Badge({
  children,
  tone = "neutral",
  dot,
  pulse,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.09em] ring-1 ring-inset",
        toneClass[tone],
        className,
      )}
    >
      {dot ? (
        <span className={cn("size-1.5 rounded-full", dotClass[tone], pulse && "live-dot")} />
      ) : null}
      {children}
    </motion.span>
  );
}

const statusTone: Record<string, Tone> = {
  VERIFIED: "success",
  PENDING: "warning",
  FAILED: "danger",
  LIVE: "primary",
  COMPLETED: "neutral",
  CANCELLED: "danger",
  ACTIVE: "success",
  INACTIVE: "neutral",
  ARCHIVED: "neutral",
  SUCCESS: "success",
  WARNING: "warning",
  UPCOMING: "info",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = statusTone[status] ?? "neutral";
  return (
    <Badge tone={tone} dot pulse={status === "LIVE"} className={className}>
      {status}
    </Badge>
  );
}
