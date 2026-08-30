import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { riseItem } from "@/lib/motion";
import { AnimatedNumber } from "./AnimatedNumber";

export interface StatCardProps {
  label: string;
  value: number | string;
  suffix?: string;
  decimals?: number;
  icon?: React.ReactNode;
  delta?: { value: number; label?: string } | undefined;
  hint?: string;
  live?: boolean;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  suffix = "",
  decimals = 0,
  icon,
  delta,
  hint,
  live,
  loading,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="surface-card rounded-2xl p-5">
        <div className="shimmer h-3 w-24 rounded-full" />
        <div className="shimmer mt-4 h-8 w-20 rounded-lg" />
        <div className="shimmer mt-4 h-3 w-16 rounded-full" />
      </div>
    );
  }

  return (
    <motion.div
      variants={riseItem}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className="group surface-card relative overflow-hidden rounded-2xl p-5 transition-shadow hover:shadow-lift"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(circle, oklch(0.8 0.11 202 / 0.35), transparent 70%)" }}
      />
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        {icon ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[30px] font-semibold leading-none tracking-[-0.035em]">
          {typeof value === "number" ? (
            <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
          ) : (
            value
          )}
        </span>
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-primary-deep">
            <span className="live-dot size-1.5 rounded-full bg-primary" />
            Live
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium",
              delta.value >= 0
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {delta.value >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta.value)}%
          </span>
        ) : null}
        <span className="truncate">{delta?.label ?? hint}</span>
      </div>
    </motion.div>
  );
}
