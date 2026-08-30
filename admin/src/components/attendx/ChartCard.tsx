import * as React from "react";
import { motion } from "framer-motion";
import { GlassCard, CardHead } from "./GlassCard";
import { riseItem } from "@/lib/motion";

interface ChartCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, description, action, children, className }: ChartCardProps) {
  return (
    <GlassCard className={className}>
      <div className="flex flex-col gap-4">
        <CardHead title={title} description={description} action={action} />
        <motion.div
          variants={riseItem}
          className="w-full"
        >
          {children}
        </motion.div>
      </div>
    </GlassCard>
  );
}
