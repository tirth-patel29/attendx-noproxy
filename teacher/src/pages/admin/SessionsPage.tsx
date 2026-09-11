import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "../../components/attendx/PageHeader";
import { GlassCard } from "../../components/attendx/GlassCard";
import { StatusBadge } from "../../components/attendx/StatusBadge";
import { DataTable, type Column } from "../../components/attendx/DataTable";
import { staggerContainer, riseItem } from "../../lib/motion";
import api from "../../services/api";
import { toast } from "sonner";

export default function SessionsPage() {
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/sessions');
      setSessionsList(res.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // API doesn't exist yet, just keep empty list
      } else {
        toast.error(err.response?.data?.error || 'Failed to fetch sessions');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const liveCount = sessionsList.filter((s) => s.status === "LIVE" || s.is_active).length;

  const columns: Column<any>[] = [
    { key: "id", header: "Session ID", className: "font-mono text-[11px] text-muted-foreground" },
    { key: "subject", header: "Subject", render: (r) => (
      <div>
        <p className="font-medium">{r.course_title || r.subject}</p>
        <p className="text-[11px] text-muted-foreground">{r.course_code || r.subjectCode}</p>
      </div>
    )},
    { key: "faculty", header: "Faculty", render: (r) => (
      <span className="text-[12.5px]">{r.prof_name || r.faculty || "Unknown"}</span>
    )},
    { key: "division", header: "Division", render: (r) => r.division_name || r.division || "N/A" },
    { key: "date", header: "Date/Time", render: (r) => (
      <span className="tabular-nums text-muted-foreground">
        {r.created_at ? new Date(r.created_at).toLocaleString() : (r.date + " " + r.time)}
      </span>
    )},
    { key: "present", header: "Attendance", render: (r) => (
      <span className="tabular-nums">
        {r.attendance_count || r.present || 0}
      </span>
    )},
    { key: "status", header: "Status", render: (r) => (
      <div className="flex items-center gap-2">
        <StatusBadge status={(r.is_active || r.status === "LIVE") ? "LIVE" : "COMPLETED"} />
        {(r.is_active || r.status === "LIVE") && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
        )}
      </div>
    )}
  ];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-7xl space-y-6"
      >
        <PageHeader
          title="Sessions"
          subtitle={`${sessionsList.length} sessions · ${liveCount} live right now`}
        />

        <motion.div variants={riseItem}>
          <GlassCard padded={false}>
            <div className="p-5">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground">Loading...</div>
              ) : (
                <DataTable
                  data={sessionsList}
                  columns={columns}
                  keyExtractor={(r) => r.id || r.session_uuid}
                  searchPlaceholder="Search by subject, faculty, or division…"
                  searchKeys={["subject", "faculty", "division", "subjectCode", "course_title", "course_code"]}
                  pageSize={10}
                  emptyTitle="No sessions found"
                  emptyDescription="Admin sessions endpoint may not be supported in this API version."
                />
              )}
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
