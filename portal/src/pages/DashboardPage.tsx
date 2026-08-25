import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { portalApi, Session } from '../services/portalApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
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

  return (
    <div className="space-y-6">
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

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Radio className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{active.length}</div>
            <p className="text-xs text-muted-foreground">Live attendance tracking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
            <p className="text-xs text-muted-foreground">Total sessions conducted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Today</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{presentToday}</div>
            <p className="text-xs text-muted-foreground">Students marked present</p>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Lectures */}
      {timetable.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
            <CardDescription>Start attendance for your scheduled lectures</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {timetable.map((tt: any) => (
                <div
                  key={tt.course_code}
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Sessions */}
      {active.length > 0 && (
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
                <div
                  key={s.id}
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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