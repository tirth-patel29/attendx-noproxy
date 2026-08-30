import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { staggerContainer, riseItem, ease } from "@/lib/motion";

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <motion.h1
          variants={riseItem}
          className="text-[22px] font-semibold tracking-[-0.03em] sm:text-[26px]"
        >
          {title}
        </motion.h1>
        {subtitle ? (
          <motion.p
            variants={riseItem}
            className="mt-1 text-[13.5px] text-muted-foreground"
          >
            {subtitle}
          </motion.p>
        ) : null}
      </div>
      {action ? (
        <motion.div
          variants={riseItem}
          transition={ease}
          className="shrink-0"
        >
          {action}
        </motion.div>
      ) : null}
    </motion.div>
  );
}
