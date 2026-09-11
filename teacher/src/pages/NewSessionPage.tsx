import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Play, CalendarDays, Clock, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/attendx/PageHeader";
import { GlassCard } from "@/components/attendx/GlassCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { staggerContainer, riseItem } from "@/lib/motion";
import { useTeacherTimetable } from "@/hooks/useTeacherDashboard";
import { useStartSession } from "@/hooks/useSessions";

export default function NewSessionPage() {
  const navigate = useNavigate();
  const [courseCode, setCourseCode] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = React.useState(new Date().toTimeString().slice(0, 5));
  const [error, setError] = React.useState("");
  
  const { data: timetable } = useTeacherTimetable();
  const startSession = useStartSession();

  // Extract unique courses from timetable week
  const uniqueCourses = React.useMemo(() => {
    if (!timetable?.week) return [];
    const map = new Map();
    timetable.week.forEach(t => {
      if (!map.has(t.course_code)) {
        map.set(t.course_code, t);
      }
    });
    return Array.from(map.values());
  }, [timetable]);

  const selectedCourse = uniqueCourses.find((c) => c.course_code === courseCode);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!courseCode) {
      setError("Please select a course to start the session for.");
      return;
    }
    
    try {
      const res = await startSession.mutateAsync({ course_code: courseCode, session_date: date });
      navigate(`/sessions/${res.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || "Failed to start session");
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-2xl space-y-6"
      >
        <PageHeader
          title="Start a Secure Session"
          subtitle="Create a live attendance session for your classroom."
        />

        <motion.div variants={riseItem}>
          <GlassCard>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {error && (
                <div className="rounded-xl bg-destructive/10 px-4 py-2.5 text-[12.5px] text-destructive ring-1 ring-inset ring-destructive/20" role="alert">
                  {error}
                </div>
              )}

              {/* Subject */}
              <div className="space-y-1.5">
                <Label htmlFor="start-subject" className="flex items-center gap-1.5 text-[12.5px] font-medium">
                  <BookOpen className="size-3.5 text-muted-foreground" />
                  Course
                </Label>
                <Select value={courseCode} onValueChange={setCourseCode}>
                  <SelectTrigger id="start-subject" className="h-10">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueCourses.map((c) => (
                      <SelectItem key={c.course_code} value={c.course_code}>
                        {c.course_code} — {c.course_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCourse && (
                  <p className="text-[11.5px] text-muted-foreground">
                    Division: {selectedCourse.division_name}
                  </p>
                )}
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="start-date" className="flex items-center gap-1.5 text-[12.5px] font-medium">
                    <CalendarDays className="size-3.5 text-muted-foreground" />
                    Date
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="start-time" className="flex items-center gap-1.5 text-[12.5px] font-medium">
                    <Clock className="size-3.5 text-muted-foreground" />
                    Time
                  </Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>

              {/* Security info */}
              <div className="rounded-xl bg-primary-soft px-4 py-3 text-[12px] text-primary-deep ring-1 ring-inset ring-primary/20">
                <strong>Zero-trust QR session:</strong> Each QR token is cryptographically signed
                and refreshes automatically. Students must be on the campus network to verify.
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <Button
                  id="start-cancel"
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                >
                  Cancel
                </Button>
                <Button
                  id="start-submit"
                  type="submit"
                  disabled={startSession.isPending}
                >
                  {startSession.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Starting…
                    </span>
                  ) : (
                    <>
                      <Play className="size-4" />
                      Start Session
                    </>
                  )}
                </Button>
              </div>
            </form>
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
