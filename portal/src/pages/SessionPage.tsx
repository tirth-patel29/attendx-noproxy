import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { portalApi } from '../services/portalApi';
import ClassroomProjector from '../components/ClassroomProjector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  QrCode,
  Download,
  RefreshCw,
  ArrowLeft,
  Users,
  CheckCircle,
  Radio,
} from 'lucide-react';

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) {
      navigate('/dashboard');
      return;
    }
    loadSession();
    loadAttendance();
    const interval = setInterval(loadAttendance, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const loadSession = async () => {
    setLoading(true);
    try {
      const res = await portalApi.getSession(sessionId!);
      setSession(res.data);
    } catch (err) {
      setError('Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async () => {
    try {
      const res = await portalApi.getSessionAttendance(sessionId!);
      setAttendance(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = () => {
    const headers = ['Roll No', 'Email', 'Time', 'Status'];
    const rows = attendance.map((a: any) => [
      a.student_roll_no || '',
      a.student_email || '',
      new Date(a.client_claimed_time).toLocaleString(),
      a.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${session?.course_code}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!session) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Session not found</AlertDescription>
      </Alert>
    );
  }

  const presentCount = attendance.filter(a => a.status === 'PRESENT').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={loadAttendance}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => setQrDialogOpen(true)}>
            <QrCode className="mr-2 h-4 w-4" />
            Show QR
          </Button>
        </div>
      </div>

      {/* Session Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{session.course_code}</CardTitle>
              <CardDescription>
                Session started {new Date(session.created_at).toLocaleString()}
              </CardDescription>
            </div>
            {session.is_active && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Radio className="h-5 w-5 animate-pulse" />
                <span className="font-semibold">Live</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{presentCount}</p>
                <p className="text-xs text-muted-foreground">Students present</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{attendance.length}</p>
                <p className="text-xs text-muted-foreground">Total scans</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Log</CardTitle>
          <CardDescription>Real-time attendance updates (refreshes every 5 seconds)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roll No</TableHead>
                <TableHead>Name/Email</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No attendance records yet. Students will appear here after scanning.
                  </TableCell>
                </TableRow>
              ) : (
                attendance.map((a: any) => (
                  <TableRow key={a.ledger_uuid}>
                    <TableCell className="font-mono">{a.student_roll_no}</TableCell>
                    <TableCell>{a.student_email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(a.client_claimed_time).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          a.status === 'PRESENT'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}
                      >
                        {a.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* QR Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Classroom Projector - QR Display</DialogTitle>
          </DialogHeader>
          <div className="aspect-video">
            <ClassroomProjector sessionId={sessionId!} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}