import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
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
  const [refreshing, setRefreshing] = useState(false);
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
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error?.message || 'Failed to load session';
      setError(errorMsg);
      toast.error('Failed to load session', { description: errorMsg });
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadAttendance();
      toast.success('Attendance refreshed', { description: 'Latest records loaded' });
    } catch (err: any) {
      toast.error('Failed to refresh', { description: 'Could not load latest attendance' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = () => {
    try {
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
      toast.success('CSV exported', { description: `${attendance.length} records exported` });
    } catch (err) {
      toast.error('Export failed', { description: 'Could not generate CSV file' });
    }
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <motion.div
              animate={refreshing ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: refreshing ? Infinity : 0, ease: "linear" }}
            >
              <RefreshCw className="h-4 w-4" />
            </motion.div>
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
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
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
                <motion.div
                  className="flex items-center gap-2 text-green-600 dark:text-green-400"
                  animate={{ opacity: [1, 0.7, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Radio className="h-5 w-5" />
                  </motion.div>
                  <span className="font-semibold">Live</span>
                </motion.div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <motion.div
                className="flex items-center gap-2"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <motion.p
                    key={presentCount}
                    initial={{ scale: 1.2, color: "rgb(34, 197, 94)" }}
                    animate={{ scale: 1, color: "inherit" }}
                    transition={{ duration: 0.3 }}
                    className="text-2xl font-bold"
                  >
                    {presentCount}
                  </motion.p>
                  <p className="text-xs text-muted-foreground">Students present</p>
                </div>
              </motion.div>
              <motion.div
                className="flex items-center gap-2"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <CheckCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <motion.p
                    key={attendance.length}
                    initial={{ scale: 1.2, color: "rgb(59, 130, 246)" }}
                    animate={{ scale: 1, color: "inherit" }}
                    transition={{ duration: 0.3 }}
                    className="text-2xl font-bold"
                  >
                    {attendance.length}
                  </motion.p>
                  <p className="text-xs text-muted-foreground">Total scans</p>
                </div>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Attendance Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Attendance Log</CardTitle>
            <CardDescription>Real-time attendance updates (auto-refreshes every 5 seconds)</CardDescription>
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
                <AnimatePresence mode="popLayout">
                  {attendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No attendance records yet. Students will appear here after scanning.
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendance.map((a: any) => (
                      <motion.tr
                        key={a.ledger_uuid}
                        initial={{ opacity: 0, x: -20, backgroundColor: "hsl(var(--accent))" }}
                        animate={{ opacity: 1, x: 0, backgroundColor: "transparent" }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="font-mono">{a.student_roll_no}</TableCell>
                        <TableCell>{a.student_email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(a.client_claimed_time).toLocaleTimeString()}
                        </TableCell>
                        <TableCell>
                          <motion.span
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              a.status === 'PRESENT'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                            }`}
                          >
                            {a.status}
                          </motion.span>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* QR Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Classroom Projector - QR Display</DialogTitle>
          </DialogHeader>
          <div className="w-full h-[95vh]">
            <ClassroomProjector sessionId={sessionId!} courseCode={session.course_code} />
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}