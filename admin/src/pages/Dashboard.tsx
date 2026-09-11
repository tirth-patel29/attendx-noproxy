import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, GraduationCap, BookOpen, Radio, ChevronRight } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { PageHeader } from '@/components/attendx/PageHeader';
import { StatCard } from '@/components/attendx/StatCard';
import { GlassCard, CardHead } from '@/components/attendx/GlassCard';
import { StatusBadge } from '@/components/attendx/StatusBadge';
import { ChartCard } from '@/components/attendx/ChartCard';
import { staggerContainer, riseItem } from '@/lib/motion';
import { adminApi, Stats, TrendData, SplitData, DeptStats, SessionActivityData, ActiveSessionData, ActivityData } from '../services/adminApi';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const CYAN = "oklch(0.72 0.14 206)";
const COLORS = [CYAN, "oklch(0.6 0.13 250)", "oklch(0.66 0.14 158)", "oklch(0.8 0.1 120)"];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [attendanceTrend, setAttendanceTrend] = useState<TrendData[]>([]);
  const [verificationSplit, setVerificationSplit] = useState<SplitData[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DeptStats[]>([]);
  const [sessionActivity, setSessionActivity] = useState<SessionActivityData[]>([]);
  const [sessions, setSessions] = useState<ActiveSessionData[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityData[]>([]);

  useEffect(() => {
    adminApi.stats().then(r => setStats(r.data)).catch(console.error);
    adminApi.attendanceTrend().then(r => setAttendanceTrend(r.data)).catch(console.error);
    adminApi.verificationSplit().then(r => setVerificationSplit(r.data)).catch(console.error);
    adminApi.departmentStats().then(r => setDepartmentStats(r.data)).catch(console.error);
    adminApi.sessionActivity().then(r => setSessionActivity(r.data)).catch(console.error);
    adminApi.activeSessions().then(r => setSessions(r.data)).catch(console.error);
    adminApi.recentActivity().then(r => setRecentActivity(r.data)).catch(console.error);
  }, []);

  const liveCount = stats?.active_sessions || 0;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-7xl space-y-8"
      >
        <PageHeader
          title={<>{getGreeting()}, <span className="text-gradient-cyan">{user?.email?.split('@')[0] || "Admin"}</span></>}
          subtitle="Overview of your institution."
        />

        {/* Stats */}
        <motion.div variants={staggerContainer} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Students" value={stats?.students || 0} icon={<Users />} />
          <StatCard label="Total Faculty" value={stats?.teachers || 0} icon={<GraduationCap />} />
          <StatCard label="Active Subjects" value={stats?.courses || 0} icon={<BookOpen />} />
          <StatCard label="Total Divisions" value={stats?.divisions || 0} icon={<Radio />} />
        </motion.div>

        {/* Charts row 1 */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChartCard title="Attendance Overview" description="Daily attendance rate — this week">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={attendanceTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CYAN} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={CYAN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.55 0.02 250)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.55 0.02 250)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 240)", borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [`${v}%`, "Rate"]} />
                  <Area type="monotone" dataKey="rate" stroke={CYAN} strokeWidth={2} fill="url(#adminGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: CYAN }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Verification Split" description="Today's scan results">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={verificationSplit} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="value">
                  {verificationSplit.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 240)", borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 text-[11.5px]">
              {verificationSplit.map((d, i) => (
                <span key={d.name} className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  {d.name}: {d.value}
                </span>
              ))}
            </div>
          </ChartCard>
        </div>

        {/* Charts row 2 */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Department Statistics" description="Total Students by department">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={departmentStats} layout="vertical" margin={{ top: 4, right: 4, left: 60, bottom: 0 }} barSize={12}>
                <XAxis type="number" tick={{ fontSize: 11, fill: "oklch(0.55 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="department" tick={{ fontSize: 10, fill: "oklch(0.55 0.02 250)" }} axisLine={false} tickLine={false} width={58} />
                <Tooltip contentStyle={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 240)", borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [`${v}`, "Students"]} />
                <Bar dataKey="students" radius={[0, 5, 5, 0]} fill={CYAN} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Session Activity" description="Sessions by hour of day">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={sessionActivity} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={22}>
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "oklch(0.55 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}:00`} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.55 0.02 250)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 240)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="sessions" radius={[5, 5, 0, 0]} fill="oklch(0.87 0.01 235)">
                  <Cell fill={CYAN} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Recent activity + live sessions */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent activity */}
          <motion.div variants={riseItem}>
            <GlassCard>
              <CardHead title="Recent Activity" action={
                <Link to="/api-keys" className="text-[12px] text-primary-deep hover:underline flex items-center gap-1">
                  View audit <ChevronRight className="h-3 w-3" />
                </Link>
              } />
              <div className="mt-4 space-y-1">
                {recentActivity.map((a, i) => {
                  let tone = "neutral";
                  if (a.event_type.includes("ERROR") || a.event_type.includes("FAIL")) tone = "danger";
                  else if (a.event_type.includes("SUCCESS") || a.event_type.includes("CREATE")) tone = "success";
                  else if (a.event_type.includes("LOGIN") || a.event_type.includes("ADMIN")) tone = "primary";
                  
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-canvas/60">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${
                        tone === "primary" ? "bg-primary" :
                        tone === "danger" ? "bg-destructive" :
                        tone === "success" ? "bg-success" :
                        "bg-muted-foreground/40"
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium">{a.event_type}</p>
                        <p className="text-[11.5px] text-muted-foreground truncate">{JSON.stringify(a.payload)}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </motion.div>

          {/* Live sessions */}
          <motion.div variants={riseItem}>
            <GlassCard>
              <CardHead title="Live Sessions" description={`${liveCount} active right now`} action={
                <Link to="/timetable" className="text-[12px] text-primary-deep hover:underline flex items-center gap-1">
                  All sessions <ChevronRight className="h-3 w-3" />
                </Link>
              } />
              <div className="mt-4 space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-canvas/60">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium truncate">{s.subject}</p>
                      <p className="text-[11.5px] text-muted-foreground">{s.faculty} · {s.division}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[12px] tabular-nums text-muted-foreground">{s.present}/{s.total}</span>
                      <StatusBadge status={s.status as any} />
                    </div>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <p className="text-[12px] text-muted-foreground p-3 text-center">No active sessions right now.</p>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

