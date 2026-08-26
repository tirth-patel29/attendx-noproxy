import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { adminApi, Stats } from '../services/adminApi';
import { MinimalCarousel, CarouselCard } from '@/components/ui/minimal-carousel';
import {
  Users,
  GraduationCap,
  Network,
  BookOpen,
  Calendar,
  Radio,
} from 'lucide-react';

function buildCards(stats: Stats): CarouselCard[] {
  return [
    {
      id: 'teachers',
      title: 'Teachers',
      value: String(stats.teachers),
      color: 'bg-gradient-to-br from-blue-500 to-blue-700',
      icon: Users,
    },
    {
      id: 'students',
      title: 'Students',
      value: String(stats.students),
      color: 'bg-gradient-to-br from-pink-500 to-rose-600',
      icon: GraduationCap,
    },
    {
      id: 'divisions',
      title: 'Divisions',
      value: String(stats.divisions),
      color: 'bg-gradient-to-br from-green-500 to-emerald-600',
      icon: Network,
    },
    {
      id: 'courses',
      title: 'Courses',
      value: String(stats.courses),
      color: 'bg-gradient-to-br from-amber-500 to-orange-600',
      icon: BookOpen,
    },
    {
      id: 'timetable',
      title: 'Timetable Entries',
      value: String(stats.assignments),
      color: 'bg-gradient-to-br from-purple-500 to-violet-700',
      icon: Calendar,
    },
    {
      id: 'active-sessions',
      title: 'Active Sessions',
      value: String(stats.active_sessions),
      color: 'bg-gradient-to-br from-red-500 to-rose-700',
      icon: Radio,
    },
  ];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .stats()
      .then((r) => {
        setStats(r.data);
        setLoading(false);
      })
      .catch(() => {
        setStats(null);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">College Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time institution statistics</p>
        </div>
        <div className="grid gap-3 grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 sm:h-32 rounded-[22px] sm:rounded-[28px]" />
          ))}
        </div>
      </div>
    );
  }

  const cards = stats ? buildCards(stats) : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">College Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time institution statistics</p>
      </div>

      <MinimalCarousel cards={cards} />
    </motion.div>
  );
}
