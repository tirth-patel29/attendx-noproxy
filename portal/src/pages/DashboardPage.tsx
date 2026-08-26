import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { portalApi, Session } from '../services/portalApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { MinimalCarousel, CarouselCard } from '@/components/ui/minimal-carousel';
import {
  Plus,
  Radio,
  Users,
  Calendar,
  RefreshCw,
  Play,
  QrCode,
  Clock,
} from 'lucide-react';

interface SessionWithCounts extends Session {
  total_students?: number;
  present_count?: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionWithCounts[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, ttRes] = await Promise.all([
        portalApi.getSessions(),
        portalApi.getTimetable(),
      ]);
      setSessions(sessionsRes.data as SessionWithCounts[]);
      setTimetable(ttRes.data.today || []);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const startLecture = async (courseCode: string) => {
    setStarting(courseCode);
    try {
      const res = await portalApi.startSession({ course_code: courseCode });
      navigate(`/sessions/${res.data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to start session');
      setStarting(null);
    }
  };

  const active = sessions.filter((s) => s.is_active);
  const presentToday = sessions.reduce((a, s) => a + (s.present_count || 0), 0);

  const statCards: CarouselCard[] = [
    {
      id: 'active',
      title: 'Active Sessions',
      value: String(active.length),
      color: 'bg-gradient-to-br from-green-500 to-emerald-600',
      icon: Radio,
    },
    {
      id: 'today',
      title: "Today's Sessions",
      value: String(sessions.length),
      color: 'bg-gradient-to-br from-blue-500 to-blue-700',
      icon: Calendar,
    },
    {
      id: 'present',
      title: 'Present Today',
      value: String(presentToday),
      color: 'bg-gradient-to-br from-purple-500 to-violet-700',
      icon: Users,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome, {user?.name?.split(' ')[0] || 'Professor'}
          </h1>
          <p className="text-muted-foreground">
            {timetable.length > 0
              ? `${timetable.length} lecture${timetable.length > 1 ? 's' : ''} scheduled today`
              : 'No lectures scheduled today'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => navigate('/sessions/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Start Session
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Quick Stats — MinimalCarousel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <MinimalCarousel cards={statCards} />
      </motion.div>

      {/* Scheduled Lectures */}
      {timetable.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Today's Schedule</CardTitle>
              <CardDescription>Start attendance for your scheduled lectures</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {timetable.map((tt: any, index: number) => (
                  <motion.div
                    key={tt.course_code}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    whileHover={{ scale: 1.01 }}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold">
                        {tt.course_code?.substring(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold">{tt.course_code}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{tt.start_time} - {tt.end_time}</span>
                          <span>•</span>
                          <span>{tt.division_name}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => startLecture(tt.course_code)}
                      disabled={starting === tt.course_code}
                    >
                      {starting === tt.course_code ? (
                        'Starting...'
                      ) : (
                        <>
                          <Play className="mr-2 h-3 w-3" />
                          Start
                        </>
                      )}
                    </Button>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Active Sessions */}
      {active.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-green-500" />
                Live Sessions
              </CardTitle>
              <CardDescription>Currently active attendance sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {active.map((s, index) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    whileHover={{ scale: 1.01 }}
                    className="flex items-center justify-between p-3 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                  >
                    <div>
                      <p className="font-semibold">{s.course_code}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{s.present_count || 0} present</span>
                        <span>•</span>
                        <span>Started {new Date(s.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/sessions/${s.id}`)}
                    >
                      <QrCode className="mr-2 h-3 w-3" />
                      View
                    </Button>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}
    </motion.div>
  );
}
