import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/utils";
import { riseItem } from "@/lib/motion";

type CardProps = HTMLMotionProps<"div"> & {
  variant?: "solid" | "glass";
  hover?: boolean;
  padded?: boolean;
};

/** Layered premium surface. Use `glass` for floating panels over ambient light. */
export function GlassCard({
  className,
  variant = "solid",
  hover = false,
  padded = true,
  children,
  ...props
}: CardProps) {
  return (
    <motion.div
      variants={riseItem}
      {...(hover ? { whileHover: { y: -3 } } : {})}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className={cn(
        "relative rounded-2xl",
        variant === "glass" ? "glass-panel" : "surface-card",
        hover && "transition-shadow hover:shadow-lift",
        padded && "p-5 sm:p-6",
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function CardHead({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold tracking-[-0.02em]">{title}</h3>
        {description ? (
          <p className="mt-1 text-[12.5px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
