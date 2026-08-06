// src/pages/SessionPage.tsx
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { portalApi } from '../services/portalApi';
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
  DialogTitle,
  DialogContent,
  DialogActions,
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

  useEffect(() => {
    if (!sessionId) {
      navigate('/dashboard');
      return;
    }
    loadSession();
    loadAttendance();
    startTokenPolling();
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
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

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onClose={() => setQrDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Session QR Code</Typography>
          <IconButton onClick={() => setQrDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
            <Typography variant="h6" gutterBottom>{session.course_code}</Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Session: {session.session_date.split('T')[0]}
            </Typography>
            
            {currentToken ? (
              <Box sx={{ mt: 2, p: 3, bgcolor: 'grey.50', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="h2" fontFamily="monospace" fontWeight={700} letterSpacing="0.3em" color="primary.main">
                  {currentToken}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Refreshes every 3 seconds
                </Typography>
              </Box>
            ) : (
              <CircularProgress />
            )}

            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefreshToken}
              disabled={qrRefreshing}
              sx={{ mt: 2 }}
            >
              Refresh Token
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrDialogOpen(false)}>Close</Button>
        </DialogActions>
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
                    <TableCell sx={{ fontFamily: 'monospace' }}>
                      {record.verification_delta_ms}ms
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.status}
                        color={record.status === 'PRESENT' ? 'success' : 'error'}
                        size="small"
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