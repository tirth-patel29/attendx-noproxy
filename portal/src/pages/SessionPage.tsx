import * as React from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import ClassroomProjector from "../components/ClassroomProjector";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Radio,
  QrCode,
  Square,
  Download,
  RefreshCw,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/attendx/PageHeader";
import { StatCard } from "@/components/attendx/StatCard";
import { GlassCard, CardHead } from "@/components/attendx/GlassCard";
import { StatusBadge } from "@/components/attendx/StatusBadge";
import { DataTable, type Column } from "@/components/attendx/DataTable";
import { ConfirmDialog } from "@/components/attendx/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { staggerContainer, riseItem } from "@/lib/motion";
import { useTeacherSummary } from "@/hooks/useTeacherDashboard";
import { useSessionAttendance, useStopSession, useSession, type AttendanceRecord } from "@/hooks/useSessions";

function useElapsedTime(start: string) {
  const [elapsed, setElapsed] = React.useState("00:00");
  React.useEffect(() => {
    function tick() {
      const [h, m] = start.split(":").map(Number);
      const now = new Date();
      const startMs = new Date().setHours(h!, m!, 0, 0);
      const diffMs = Math.max(0, now.getTime() - startMs);
      const diffMin = Math.floor(diffMs / 60000);
      const diffSec = Math.floor((diffMs % 60000) / 1000);
      setElapsed(`${String(diffMin).padStart(2, "0")}:${String(diffSec).padStart(2, "0")}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [start]);
  return elapsed;
}

const columns: Column<AttendanceRecord>[] = [
  { key: "student_roll_no", header: "Roll No", className: "font-mono text-[12px]" },
  { key: "student_email", header: "Email" },
  { 
    key: "server_logged_time", 
    header: "Time", 
    className: "tabular-nums text-muted-foreground",
    render: (row) => new Date(row.server_logged_time).toLocaleTimeString()
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: "verification_delta_ms",
    header: "Latency",
    className: "text-muted-foreground text-[12px]",
    render: (row) => `${row.verification_delta_ms}ms`,
  },
];

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { data: activeSession } = useSession(sessionId);
  const { data: summary } = useTeacherSummary();
  
  const { data: attendanceData = [] } = useSessionAttendance(sessionId);
  const stopSession = useStopSession();

  const startedAt = activeSession?.created_at ? new Date(activeSession.created_at).toTimeString().slice(0, 5) : "00:00";
  const elapsed = useElapsedTime(startedAt);
  const [stopOpen, setStopOpen] = React.useState(false);
  const [qrDialogOpen, setQrDialogOpen] = React.useState(false);

  const stopped = !activeSession?.is_active;

  const verified = attendanceData.filter((r) => r.status === "PRESENT").length;
  const pending = 0; // Not applicable for the API
  const failed = 0; // Not applicable directly in ledger
  
  const totalStudents = summary?.find(s => s.course_code === activeSession?.course_code)?.total_students || 0;

  async function handleStop() {
    if (sessionId) {
      await stopSession.mutateAsync(sessionId);
      toast.success("Session stopped successfully");
    }
    setStopOpen(false);
  }

  const handleExport = () => {
    try {
      const headers = ['Roll No', 'Email', 'Time', 'Status'];
      const rows = attendanceData.map((a) => [
        a.student_roll_no || '',
        a.student_email || '',
        new Date(a.server_logged_time || a.client_claimed_time).toLocaleString(),
        a.status,
      ]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${activeSession?.course_code}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported', { description: `${attendanceData.length} records exported` });
    } catch (err) {
      toast.error('Export failed', { description: 'Could not generate CSV file' });
    }
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-6xl space-y-6"
      >
        {/* Header */}
        <PageHeader
          title={
            <span className="flex items-center gap-3">
              {activeSession?.course_code || "Session Ended"}
              {!stopped ? (
                <StatusBadge status="LIVE" />
              ) : (
                <StatusBadge status="COMPLETED" />
              )}
            </span>
          }
          subtitle={`Started ${startedAt}`}
          action={
            <div className="flex items-center gap-2">
              <Button id="live-export" variant="outline" size="sm" onClick={handleExport}>
                <Download className="size-4" />
                Export
              </Button>
              <Button id="live-qr" variant="outline" size="sm" onClick={() => setQrDialogOpen(true)}>
                <QrCode className="size-4" />
                Project QR
              </Button>
              {!stopped && (
                <Button
                  id="live-stop"
                  variant="destructive"
                  size="sm"
                  onClick={() => setStopOpen(true)}
                >
                  <Square className="size-4" />
                  Stop Session
                </Button>
              )}
            </div>
          }
        />

        {/* Timer */}
        <motion.div variants={riseItem} className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Clock className="size-3.5" />
          <span className="tabular-nums font-medium text-foreground">{elapsed}</span>
          <span>elapsed</span>
          {!stopped && <span className="flex items-center gap-1.5 ml-3">
            <RefreshCw className="size-3 text-primary animate-spin [animation-duration:3s]" />
            <span className="text-[11.5px]">QR refreshing automatically</span>
          </span>}
        </motion.div>

        {/* Stats */}
        <motion.div variants={staggerContainer} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Verified Present" value={verified} icon={<Radio />} live={!stopped} />
          <StatCard label="Pending" value={pending} icon={<RefreshCw />} />
          <StatCard label="Failed" value={failed} icon={<Square />} />
          <StatCard label="Total Students" value={totalStudents} />
        </motion.div>

        {/* Table */}
        <motion.div variants={riseItem}>
          <GlassCard padded={false}>
            <div className="border-b border-border p-5">
              <CardHead
                title="Attendance Records"
                description={`${attendanceData.length} students scanned`}
              />
            </div>
            <div className="p-5">
              <DataTable
                data={attendanceData}
                columns={columns}
                keyExtractor={(r) => r.id}
                searchPlaceholder="Search by roll no or email…"
                searchKeys={["student_email", "student_roll_no"]}
                pageSize={10}
                emptyTitle="No records yet"
                emptyDescription="Students will appear here once they scan the QR code."
              />
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>

      <ConfirmDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        title="Stop Live Session?"
        description="This will end the session and lock attendance records. This action cannot be undone."
        confirmLabel="Stop Session"
        cancelLabel="Keep running"
        destructive
        onConfirm={handleStop}
      />

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Classroom Projector - QR Display</DialogTitle>
          </DialogHeader>
          <div className="w-full h-[95vh]">
            {sessionId && activeSession?.course_code && (
              <ClassroomProjector sessionId={sessionId} courseCode={activeSession.course_code} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
