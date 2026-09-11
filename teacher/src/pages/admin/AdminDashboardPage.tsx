import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, GraduationCap, BookOpen, Radio, ChevronRight } from "lucide-react";
import { PageHeader } from "../../components/attendx/PageHeader";
import { StatCard } from "../../components/attendx/StatCard";
import { GlassCard, CardHead } from "../../components/attendx/GlassCard";

import { staggerContainer, riseItem } from "../../lib/motion";
import api from "../../services/api";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get('/admin/stats').then(res => setStats(res.data)).catch(console.error);
  }, []);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-7xl space-y-8"
      >
        <PageHeader
          title={<>{getGreeting()}, <span className="text-primary">Admin</span></>}
          subtitle="Overview of your institution."
        />

        <motion.div variants={staggerContainer} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Students" value={stats?.students || 0} icon={<Users />} />
          <StatCard label="Total Faculty" value={stats?.teachers || 0} icon={<GraduationCap />} />
          <StatCard label="Active Subjects" value={stats?.courses || 0} icon={<BookOpen />} />
          <StatCard label="Total Divisions" value={stats?.divisions || 0} icon={<Radio />} />
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Quick Links / Actions */}
          <motion.div variants={riseItem}>
            <GlassCard>
              <CardHead title="Quick Actions" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link to="/admin/students" className="p-4 border rounded-xl hover:bg-muted transition text-center flex flex-col items-center gap-2">
                  <Users className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Manage Students</span>
                </Link>
                <Link to="/admin/faculty" className="p-4 border rounded-xl hover:bg-muted transition text-center flex flex-col items-center gap-2">
                  <GraduationCap className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Manage Faculty</span>
                </Link>
                <Link to="/admin/divisions" className="p-4 border rounded-xl hover:bg-muted transition text-center flex flex-col items-center gap-2">
                  <Radio className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Hierarchy</span>
                </Link>
                <Link to="/admin/subjects" className="p-4 border rounded-xl hover:bg-muted transition text-center flex flex-col items-center gap-2">
                  <BookOpen className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Subjects</span>
                </Link>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div variants={riseItem}>
            <GlassCard>
              <CardHead title="Platform Status" action={
                <Link to="/admin/sessions" className="text-[12px] text-primary hover:underline flex items-center gap-1">
                  All sessions <ChevronRight className="size-3" />
                </Link>
              } />
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border">
                  <div>
                    <p className="font-medium">Active Live Sessions</p>
                    <p className="text-sm text-muted-foreground">Classes currently running</p>
                  </div>
                  <div className="text-2xl font-bold">{stats?.active_sessions || 0}</div>
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border">
                  <div>
                    <p className="font-medium">Total Timetable Assignments</p>
                    <p className="text-sm text-muted-foreground">Active schedule entries</p>
                  </div>
                  <div className="text-2xl font-bold">{stats?.assignments || 0}</div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
