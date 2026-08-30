import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { riseItem } from "@/lib/motion";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      variants={riseItem}
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <div className="max-w-xs space-y-1">
        <p className="text-[14px] font-semibold tracking-[-0.01em]">{title}</p>
        {description ? (
          <p className="text-[12.5px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </motion.div>
  );
}
