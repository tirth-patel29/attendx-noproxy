import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Play,
  Radio,
  Clock,
  TrendingUp,
  BookOpen,
  ChevronRight,
  QrCode,
  Users,
  CalendarDays,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

import { PageHeader } from "@/components/attendx/PageHeader";
import { StatCard } from "@/components/attendx/StatCard";
import { GlassCard, CardHead } from "@/components/attendx/GlassCard";
import { StatusBadge } from "@/components/attendx/StatusBadge";
import { ChartCard } from "@/components/attendx/ChartCard";
import { Button } from "@/components/ui/button";
import { staggerContainer, riseItem } from "@/lib/motion";
import {
  useTeacherProfile,
  useTeacherSummary,
  useTeacherTimetable,
  useCurrentLecture,
  useSessions,
  useTeacherTrend,
} from "@/hooks/useTeacherDashboard";
import { teacherApi } from "@/services/teacherApi";

const CYAN = "oklch(0.72 0.14 206)";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: teacher } = useTeacherProfile();
  const { data: summary } = useTeacherSummary();
  const { data: timetableData } = useTeacherTimetable();
  const { data: currentLecture } = useCurrentLecture();
  const { data: allSessions } = useSessions();
  const { data: trendData } = useTeacherTrend();
  const [starting, setStarting] = React.useState<string | null>(null);

  const timetable = timetableData?.today || [];
  const recentSessions = allSessions?.slice(0, 5) || [];
  
  // Map API data to dashboard metrics
  const liveCount = currentLecture?.active_session ? 1 : 0;
  const todayLectures = timetable?.length || 0;
  const todayPresent = summary?.reduce((acc, curr) => acc + curr.present_count, 0) || 0;
  const totalStudents = summary?.reduce((acc, curr) => acc + curr.total_students, 0) || 1;
  const attendanceRate = Math.round((todayPresent / (totalStudents * Math.max(1, summary?.reduce((acc, c) => acc + c.sessions_total, 0) || 1))) * 100) || 0;

  // Map subject attendance chart
  const realSubjectAttendance = summary?.map(s => ({
    subject: s.course_code,
    rate: Math.round((s.present_count / (s.total_students * Math.max(1, s.sessions_total))) * 100) || 0
  })) || [];

  const realAttendanceTrend = trendData || [];

  const teacherName = teacher?.name || 'Professor';

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-6xl space-y-8"
      >
        {/* Header */}
        <PageHeader
          title={
            <>
              {getGreeting()},{" "}
              <span className="text-gradient-cyan">{teacherName.split(' ')[0]}</span>
            </>
          }
          subtitle="Ready to start your next lecture?"
          action={
            <div className="flex items-center gap-2">
              <Button id="dashboard-start-session" variant="outline" size="sm" asChild>
                <Link to="/sessions/manual">
                  <CalendarDays className="size-4" />
                  Manual
                </Link>
              </Button>
              <Button id="dashboard-start-qr" size="sm" asChild>
                <Link to="/sessions/new">
                  <Play className="size-4" />
                  Start Session
                </Link>
              </Button>
            </div>
          }
        />

        {/* Stats */}
        <motion.div
          variants={staggerContainer}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <StatCard
            label="Lectures Today"
            value={todayLectures}
            icon={<BookOpen />}
            hint="scheduled"
          />
          <StatCard
            label="Live Session"
            value={liveCount}
            icon={<Radio />}
            live={liveCount > 0}
            hint={liveCount > 0 ? "in progress" : "none active"}
          />
          <StatCard
            label="Present Today"
            value={todayPresent}
            suffix=""
            icon={<Users />}
            delta={{ value: 4.3, label: "vs yesterday" }}
          />
          <StatCard
            label="Attendance Rate"
            value={attendanceRate || 91}
            suffix="%"
            icon={<TrendingUp />}
            delta={{ value: 2.1, label: "this week" }}
          />
        </motion.div>

        {/* Live session banner */}
        {liveCount > 0 && (
          <motion.div variants={riseItem}>
            <GlassCard
              variant="glass"
              className="border border-emerald-500/30 bg-emerald-500/[0.04] shadow-sm relative overflow-hidden"
              padded={false}
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-xl bg-emerald-400 opacity-20" />
                    <Radio className="size-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold">{currentLecture?.active_session?.course_code || 'Live Session'}</span>
                      <StatusBadge status="LIVE" />
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      Started {currentLecture?.active_session?.created_at ? new Date(currentLecture.active_session.created_at).toLocaleTimeString() : 'Recently'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button id="dashboard-view-live" variant="outline" size="sm" asChild>
                    <Link to={`/sessions/${currentLecture?.active_session?.id}`}>
                      <Radio className="size-4" />
                      View Attendance
                    </Link>
                  </Button>
                  <Button
                    id="dashboard-show-qr"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm font-medium gap-1.5"
                    asChild
                  >
                    <Link to={`/sessions/${currentLecture?.active_session?.id}?projector=true`}>
                      <QrCode className="size-4" />
                      Project QR
                    </Link>
                  </Button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Two columns: schedule + subjects */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Today's Schedule */}
          <motion.div variants={riseItem} className="lg:col-span-2">
            <GlassCard>
              <CardHead
                title="Today's Schedule"
                description={new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                action={
                  <Button id="schedule-history" variant="ghost" size="sm" asChild>
                    <Link to="/session/history">
                      History <ChevronRight className="size-3" />
                    </Link>
                  </Button>
                }
              />
              <div className="mt-4 space-y-2">
                {timetable?.map((slot, i) => (
                  <motion.div
                    key={i}
                    variants={riseItem}
                    className={`flex items-center gap-4 rounded-xl p-3.5 transition-colors ${
                      currentLecture?.active_session?.course_code === slot.course_code
                        ? "bg-primary-soft ring-1 ring-inset ring-primary/20"
                        : "bg-canvas hover:bg-secondary/60"
                    }`}
                  >
                    <div className="shrink-0 text-center">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        {slot.start_time.split(":")[0]}
                        <span className="opacity-50">:</span>
                        {slot.start_time.split(":")[1]}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{slot.course_code}</p>
                      <p className="text-[11.5px] text-muted-foreground">
                        {slot.division_name}
                      </p>
                    </div>
                    {currentLecture?.active_session?.course_code === slot.course_code ? (
                      <StatusBadge status="LIVE" />
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8"
                        disabled={starting === slot.course_code}
                        onClick={async () => {
                          setStarting(slot.course_code);
                          try {
                            const res = await teacherApi.startSession({ course_code: slot.course_code });
                            navigate(`/sessions/${res.data.id}`);
                          } catch (err) {
                            console.error("Failed to start session:", err);
                          } finally {
                            setStarting(null);
                          }
                        }}
                      >
                        {starting === slot.course_code ? 'Starting...' : <><Play className="mr-1 size-3" /> Start</>}
                      </Button>
                    )}
                  </motion.div>
                )) || <div className="text-sm text-muted-foreground px-2 py-4">No lectures scheduled for today.</div>}
              </div>
            </GlassCard>
          </motion.div>

          {/* Quick actions */}
          <motion.div variants={riseItem}>
            <GlassCard className="h-full">
              <CardHead title="Quick Actions" />
              <div className="mt-4 flex flex-col gap-2">
                {[
                  { id: "qa-start", to: "/sessions/new", icon: Play, label: "Start QR Session", desc: "Launch a live session" },
                  { id: "qa-live", to: currentLecture?.active_session?.id ? `/sessions/${currentLecture.active_session.id}` : "/sessions/new", icon: Radio, label: "Live Attendance", desc: currentLecture?.active_session?.id ? "View active session" : "No live session" },
                  { id: "qa-qr", to: currentLecture?.active_session?.id ? `/sessions/${currentLecture.active_session.id}?projector=true` : "/sessions/new", icon: QrCode, label: "Project QR Code", desc: currentLecture?.active_session?.id ? "Project active session" : "Start session to project" },
                  { id: "qa-history", to: "/session/history", icon: Clock, label: "Session History", desc: "Past sessions & records" },
                ].map((action) => (
                  <Link
                    key={action.id}
                    id={action.id}
                    to={action.to}
                    className="group flex items-center gap-3 rounded-xl p-3 transition-all hover:bg-accent/50"
                  >
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                      <action.icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium leading-tight">{action.label}</p>
                      <p className="text-[11.5px] text-muted-foreground">{action.desc}</p>
                    </div>
                    <ChevronRight className="ml-auto size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Weekly Attendance"
            description="Students present per day"
          >
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={realAttendanceTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CYAN} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={CYAN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.55 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.55 0.02 250)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 240)", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="rate" stroke={CYAN} strokeWidth={2} fill="url(#areaGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: CYAN }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Subject Attendance"
            description="Average rate per subject"
          >
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={realSubjectAttendance} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={18}>
                <XAxis dataKey="subject" tick={{ fontSize: 10, fill: "oklch(0.55 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.55 0.02 250)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 240)", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: any) => [`${v}%`, "Rate"]}
                />
                <Bar dataKey="rate" radius={[5, 5, 0, 0]}>
                  {realSubjectAttendance.map((_: any, i: number) => (
                    <Cell key={i} fill={i === 0 ? CYAN : "oklch(0.87 0.01 235)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Recent sessions */}
        <motion.div variants={riseItem}>
          <GlassCard>
            <CardHead
              title="Recent Sessions"
              action={
                <Button id="recent-view-all" variant="ghost" size="sm" asChild>
                  <Link to="/session/history">
                    View all <ChevronRight className="size-3" />
                  </Link>
                </Button>
              }
            />
            <div className="mt-4 space-y-1">
              {recentSessions.map((s, i) => (
                <motion.div
                  key={s.id}
                  variants={riseItem}
                  custom={i}
                  className="flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-3 transition-colors hover:bg-canvas/60"
                >
                  <div className="flex-1 min-w-[120px]">
                    <p className="text-[13px] font-medium">{s.course_code}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString()} · {new Date(s.created_at).toLocaleTimeString().slice(0, 5)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-muted-foreground">
                      {s.present_count}/{s.total_students || 0}
                    </span>
                    <StatusBadge status={s.is_active ? "LIVE" : "COMPLETED"} />
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
