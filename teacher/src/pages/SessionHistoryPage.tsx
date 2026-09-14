import { motion } from 'framer-motion';
import { Calendar, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/attendx/PageHeader';
import { GlassCard } from '@/components/attendx/GlassCard';
import { staggerContainer, riseItem } from '@/lib/motion';
import { useSessions } from '@/hooks/useTeacherDashboard';
import { format } from 'date-fns';

export default function SessionHistoryPage() {
  const { data: sessions, isLoading, error } = useSessions();

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-6xl space-y-8"
      >
        <PageHeader
          title={<span className="text-gradient-cyan">Session History</span>}
          subtitle="View past attendance sessions and records."
        />

        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="size-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          </div>
        ) : error ? (
          <GlassCard className="p-6 text-center text-red-400">
            Failed to load sessions. Please try again.
          </GlassCard>
        ) : sessions?.length === 0 ? (
          <GlassCard className="p-12 text-center text-muted-foreground">
            No past sessions found.
          </GlassCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions?.map((session) => (
              <motion.div key={session.id} variants={riseItem}>
                <GlassCard className="flex flex-col p-5 hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold text-lg">{session.course_code}</span>
                    {session.is_active ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
                        <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-400">
                        <CheckCircle className="size-3" />
                        Completed
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground flex-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4" />
                      {format(new Date(session.created_at), "MMM d, yyyy • h:mm a")}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-sm">
                    <div className="text-slate-300">
                      <span className="font-medium text-white">{session.present_count || 0}</span> / {session.total_students || 0} Present
                    </div>
                    <div className="text-primary font-medium">
                      {Math.round(((session.present_count || 0) / Math.max(1, session.total_students || 1)) * 100)}%
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
