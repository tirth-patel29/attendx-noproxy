import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { portalApi, Session } from '../services/portalApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import {
  Plus,
  Radio,
  Users,
  Calendar,
  RefreshCw,
  Play,
  QrCode,
  Clock,
  Sparkles,
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

  return (
    <div className="space-y-6">
      {/* ðŸŽ‰ ANIMATED WATERMELON UI BANNER */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-gradient-to-r from-green-500 via-teal-500 to-cyan-500 border-0 text-white overflow-hidden relative shadow-2xl shadow-green-500/50 animate-pulse-slow">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00em0wLTEwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMC0xMGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{
                  rotate: [0, 10, -10, 10, 0],
                  scale: [1, 1.1, 1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3,
                }}
              >
                <Sparkles className="h-8 w-8" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold">
                  ðŸ‰ Watermelon UI is Live!
                </h2>
                <p className="text-white/90">
                  Teacher Portal â€¢ Modern Design â€¢ Smooth Animations â€¢ Deployed Successfully
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
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
      </motion.div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Quick Stats - Animated */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: 'Active Sessions', value: active.length, icon: Radio, color: 'text-green-500', desc: 'Live attendance tracking' },
          { title: 'Today\'s Sessions', value: sessions.length, icon: Calendar, color: 'text-blue-500', desc: 'Total sessions conducted' },
          { title: 'Present Today', value: presentToday, icon: Users, color: 'text-purple-500', desc: 'Students marked present' },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <motion.div
                  className="text-2xl font-bold"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1, type: 'spring' }}
                >
                  {stat.value}
                </motion.div>
                <p className="text-xs text-muted-foreground">{stat.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Scheduled Lectures */}
      {timetable.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
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
                    transition={{ delay: 0.7 + index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
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
                          <span>â€¢</span>
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-green-500 animate-pulse" />
                Live Sessions
              </CardTitle>
              <CardDescription>Currently active attendance sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {active.map((s) => (
                  <motion.div
                    key={s.id}
                    whileHover={{ scale: 1.02 }}
                    className="flex items-center justify-between p-3 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                  >
                    <div>
                      <p className="font-semibold">{s.course_code}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{s.present_count || 0} present</span>
                        <span>â€¢</span>
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
    </div>
  );
}