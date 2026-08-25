import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { adminApi, Stats } from '../services/adminApi';
import {
  Users,
  GraduationCap,
  Network,
  BookOpen,
  Calendar,
  Radio,
} from 'lucide-react';

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

  const cards = stats
    ? [
        { label: 'Teachers', value: stats.teachers, icon: Users, color: 'text-blue-500' },
        { label: 'Students', value: stats.students, icon: GraduationCap, color: 'text-pink-500' },
        { label: 'Divisions', value: stats.divisions, icon: Network, color: 'text-green-500' },
        { label: 'Courses', value: stats.courses, icon: BookOpen, color: 'text-amber-500' },
        { label: 'Timetable entries', value: stats.assignments, icon: Calendar, color: 'text-purple-500' },
        { label: 'Active sessions', value: stats.active_sessions, icon: Radio, color: 'text-rose-500' },
      ]
    : [];

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">College Overview</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">College Overview</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">Total registered</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}