// src/pages/SessionPage.tsx
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { portalApi } from '../services/portalApi';
import ClassroomProjector from '../components/ClassroomProjector';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Paper,
  Dialog,
  Button,
  IconButton,
  Tooltip,
  Grid,
  Alert,
} from '@mui/material';
import {
  QrCode as QRCodeIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [qrRefreshing, setQrRefreshing] = useState(false);
  const [error, setError] = useState('');

  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const attendanceInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionId) {
      navigate('/dashboard');
      return;
    }
    loadSession();
    loadAttendance();
    startTokenPolling();
    // Live attendance refresh while the session is projected
    attendanceInterval.current = setInterval(loadAttendance, 4000);
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      if (attendanceInterval.current) clearInterval(attendanceInterval.current);
    };
  }, [sessionId]);

  const loadSession = async () => {
    setLoading(true);
    try {
      const res = await portalApi.getSession(sessionId!);
      setSession(res.data);
    } catch (err) {
      console.error(err);
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

  const fetchToken = async () => {
    if (!sessionId) return;
    try {
      const res = await portalApi.getSessionTokens(sessionId);
      const tokens = res.data.tokens;
      if (tokens.length > 0) {
        setCurrentToken(tokens[tokens.length - 1].token_val);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startTokenPolling = () => {
    fetchToken();
    pollingInterval.current = setInterval(fetchToken, 1500);
  };

  const handleRefreshToken = async () => {
    setQrRefreshing(true);
    await fetchToken();
    setQrRefreshing(false);
  };

  const handleExport = () => {
    const headers = ['Student Roll No', 'Student Email', 'Claimed Time', 'Delta (ms)', 'Status'];
    const rows = attendance.map((a: any) => [
      a.student_roll_no || '',
      a.student_email || '',
      new Date(a.client_claimed_time).toISOString(),
      a.verification_delta_ms,
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

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <Typography>Session not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {session.course_code}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {session.session_date.split('T')[0]} • {session.is_active ? 'Active' : 'Completed'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Refresh QR">
            <IconButton onClick={handleRefreshToken} disabled={qrRefreshing}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export CSV">
            <IconButton onClick={handleExport}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<QRCodeIcon />}
            onClick={() => setQrDialogOpen(true)}
          >
            Show QR Code
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" fontWeight={700} color="success.main">
                {attendance.filter(a => a.status === 'PRESENT').length}
              </Typography>
              <Typography color="text.secondary">Present</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" fontWeight={700} color="error.main">
                {attendance.filter(a => a.status !== 'PRESENT').length}
              </Typography>
              <Typography color="text.secondary">Absent / Failed</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" fontWeight={700} color="primary.main">
                {session.total_students || attendance.length}
              </Typography>
              <Typography color="text.secondary">Total Students</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" fontWeight={700} color={session.is_active ? 'success' : 'default'}>
                {session.is_active ? 'Active' : 'Completed'}
              </Typography>
              <Typography color="text.secondary">Session Status</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* QR Code — fullscreen photonic projector (smartboard) */}
      <Dialog open={qrDialogOpen} onClose={() => setQrDialogOpen(false)} fullScreen>
        <Box
          sx={{
            height: '100vh',
            bgcolor: '#050b18',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <IconButton
            onClick={() => setQrDialogOpen(false)}
            sx={{ position: 'absolute', top: 16, right: 16, color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' }}
          >
            <CloseIcon />
          </IconButton>

          <Chip
            label={session.is_active ? 'LIVE · token rotates every 3s' : 'SESSION ENDED'}
            sx={{
              mb: 2, fontWeight: 800, letterSpacing: '0.18em',
              bgcolor: session.is_active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.1)',
              color: session.is_active ? '#4ADE80' : '#94A3B8',
            }}
          />

          <Typography variant="h5" fontWeight={800} letterSpacing="0.3em" sx={{ mb: 0.5 }}>
            {session.course_code}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
            {session.session_date.split('T')[0]} — scan with the Attendance app
          </Typography>

          {currentToken ? (
            <ClassroomProjector sessionId={sessionId!} courseCode={session.course_code} size={460} />
          ) : (
            <CircularProgress sx={{ color: '#4cc9f0' }} />
          )}

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefreshToken}
            disabled={qrRefreshing}
            sx={{ mt: 2, color: '#94A3B8', borderColor: 'rgba(255,255,255,0.25)' }}
          >
            {qrRefreshing ? 'Refreshing…' : 'Force refresh'}
          </Button>
        </Box>
      </Dialog>

      {/* Attendance Table */}
      <Paper sx={{ mt: 3 }}>
        <CardHeader
          title="Attendance Records"
          subheader={`${attendance.filter(a => a.status === 'PRESENT').length} present out of ${session.total_students || attendance.length} students`}
          action={
            <Tooltip title="Refresh">
              <IconButton onClick={loadAttendance}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          }
        />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Roll No</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Claimed Time</TableCell>
                <TableCell>Delta (ms)</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {attendance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    No attendance records yet
                  </TableCell>
                </TableRow>
              ) : (
                attendance.map((record: any) => (
                  <TableRow key={record.id} hover>
                    <TableCell>
                      <Typography variant="body1" fontWeight={500} fontFamily="monospace">
                        {record.student_roll_no || record.student_uuid?.slice(0, 8)}
                      </Typography>
                    </TableCell>
                    <TableCell>{record.student_email}</TableCell>
                    <TableCell>
                      {new Date(record.client_claimed_time).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${record.verification_delta_ms}ms`}
                        size="small"
                        sx={{
                          fontFamily: 'monospace',
                          bgcolor: record.verification_delta_ms <= 100 ? '#DCFCE7' : record.verification_delta_ms <= 250 ? '#FEF9C3' : '#FEE2E2',
                          color: record.verification_delta_ms <= 100 ? '#15803D' : record.verification_delta_ms <= 250 ? '#A16207' : '#B91C1C',
                          fontWeight: 700,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.status}
                        color={record.status === 'PRESENT' ? 'success' : 'error'}
                        size="small"
                        variant={record.status === 'PRESENT' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}