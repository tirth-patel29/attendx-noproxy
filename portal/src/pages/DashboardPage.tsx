// src/pages/DashboardPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { portalApi, Session } from '../services/portalApi';
import {
  Box,
  Typography,
  Button,
  CardHeader,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Paper,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  QrCode as QRCodeIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface SessionWithCounts extends Session {
  total_students?: number;
  present_count?: number;
}

export default function DashboardPage() {
  const { loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionWithCounts[]>([]);
  const [professors, setProfessors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, profsRes] = await Promise.all([
        portalApi.getSessions(),
        portalApi.getProfessors(),
      ]);
      setSessions(sessionsRes.data as SessionWithCounts[]);
      setProfessors(profsRes.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStopSession = async (sessionId: string) => {
    try {
      await portalApi.stopSession(sessionId);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewAttendance = (sessionId: string) => {
    navigate(`/sessions/${sessionId}`);
  };

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Professor Dashboard
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/sessions/new')}
          size="large"
        >
          New Session
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper sx={{ mb: 3 }}>
          <CardHeader
            title="Active Sessions"
            subheader={`${sessions.filter(s => s.is_active).length} active, ${sessions.filter(s => !s.is_active).length} completed`}
            action={
              <Tooltip title="Refresh">
                <IconButton onClick={loadData}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            }
          />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Course</TableCell>
                  <TableCell>Professor</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Attendance</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      No sessions yet. Create your first session!
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session) => (
                    <TableRow key={session.id} hover>
                      <TableCell>
                        <Typography variant="body1" fontWeight={500}>
                          {session.course_code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {professors.find(p => p.id === session.professor_id)?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>{session.session_date.split('T')[0]}</TableCell>
                      <TableCell>
                        <Chip
                          label={session.is_active ? 'Active' : 'Completed'}
                          color={session.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {session.present_count || 0} / {session.total_students || 0}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Attendance">
                          <IconButton onClick={() => handleViewAttendance(session.id)}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={session.is_active ? 'Stop Session' : 'Start New Session'}>
                          <IconButton
                            onClick={session.is_active ? () => handleStopSession(session.id) : () => navigate('/sessions/new')}
                            color={session.is_active ? 'error' : 'success'}
                          >
                            {session.is_active ? <StopIcon /> : <PlayIcon />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="QR Code">
                          <IconButton onClick={() => navigate(`/sessions/${session.id}`)}>
                            <QRCodeIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}