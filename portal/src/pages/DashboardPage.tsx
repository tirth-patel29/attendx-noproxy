// src/pages/DashboardPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { portalApi, Session } from '../services/portalApi';
import {
  Box, Typography, Button, Chip, CircularProgress, IconButton, Tooltip,
  Alert, Grid, Card, CardContent, CardActions, LinearProgress, Paper, Stack, Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  QrCode as QRCodeIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckIcon,
  Groups as GroupsIcon,
  WifiTethering as LiveIcon,
} from '@mui/icons-material';

interface SessionWithCounts extends Session {
  total_students?: number;
  present_count?: number;
}

export default function DashboardPage() {
  const { loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionWithCounts[]>([]);
  const [professors, setProfessors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, profsRes] = await Promise.all([
        portalApi.getSessions(),
        portalApi.getProfessors(),
      ]);
      setSessions(sessionsRes.data as SessionWithCounts[]);
      setProfessors(profsRes.data);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleStopSession = async (sessionId: string) => {
    if (!window.confirm('Stop this session? The projector QR will stop rotating.')) return;
    try {
      await portalApi.stopSession(sessionId);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to stop session');
    }
  };

  const active = sessions.filter((s) => s.is_active);
  const completed = sessions.filter((s) => !s.is_active);
  const presentToday = sessions
    .filter((s) => s.is_active)
    .reduce((acc, s) => acc + (s.present_count || 0), 0);

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* ===== Header banner ===== */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 4,
          mb: 4,
          background: 'linear-gradient(135deg, #1E3A8A 0%, #1E1A5F 60%, #3B5BDB 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />
        <Box sx={{ position: 'absolute', right: 40, bottom: -80, width: 180, height: 180, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2}>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Professor Portal
            </Typography>
            <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>
              Welcome back, {user?.name?.split(' ')[0] || 'Professor'}
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.8)', mt: 0.5 }}>
              Start a live session to rotate the classroom token.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => navigate('/sessions/new')}
            sx={{ bgcolor: '#fff', color: '#1E3A8A', '&:hover': { bgcolor: '#EFF6FF' }, alignSelf: { xs: 'flex-start', md: 'center' } }}
          >
            New Session
          </Button>
        </Stack>

        <Grid container spacing={2} sx={{ mt: 3 }}>
          {[
            { label: 'Live now', value: active.length, icon: <LiveIcon />, accent: '#4ADE80' },
            { label: 'Present today', value: presentToday, icon: <CheckIcon />, accent: '#FBBF24' },
            { label: 'Completed', value: completed.length, icon: <ScheduleIcon />, accent: '#93C5FD' },
          ].map((s) => (
            <Grid item xs={4} key={s.label}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: s.accent }}>{s.icon}</Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={800} lineHeight={1}>{s.value}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>{s.label}</Typography>
                </Box>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      {/* ===== Section header ===== */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <GroupsIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Sessions</Typography>
        </Stack>
        <Tooltip title="Refresh">
          <IconButton onClick={loadData}><RefreshIcon /></IconButton>
        </Tooltip>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : sessions.length === 0 ? (
        <Paper elevation={0} sx={{ p: 8, textAlign: 'center', borderRadius: 4, border: '1px dashed rgba(0,0,0,0.12)' }}>
          <QRCodeIcon sx={{ fontSize: 56, color: 'text.disabled' }} />
          <Typography variant="h6" sx={{ mt: 2 }}>No sessions yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create your first session and project the live QR for your class.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/sessions/new')}>
            Start Attendance
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {sessions.map((session) => {
            const present = session.present_count || 0;
            const total = session.total_students || 0;
            const pct = total > 0 ? Math.round((present / total) * 100) : 0;
            const profName = professors.find((p) => p.id === session.professor_id)?.name;
            return (
              <Grid item xs={12} sm={6} lg={4} key={session.id}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 3,
                    border: `1px solid ${session.is_active ? '#4ADE8040' : 'rgba(0,0,0,0.08)'}`,
                    bgcolor: session.is_active ? 'rgba(74,222,128,0.03)' : 'background.paper',
                    transition: 'transform .15s, box-shadow .15s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
                  }}
                >
                  <CardContent sx={{ flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="h6" fontWeight={800} fontFamily="monospace">
                          {session.course_code}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {profName || 'Teacher'}
                        </Typography>
                      </Box>
                      <Chip
                        label={session.is_active ? 'LIVE' : 'Completed'}
                        size="small"
                        icon={session.is_active ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'inline-block', marginLeft: 6 }} /> : undefined}
                        sx={{
                          fontWeight: 700,
                          bgcolor: session.is_active ? '#DCFCE7' : '#F1F5F9',
                          color: session.is_active ? '#15803D' : '#475569',
                        }}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      {session.session_date.split('T')[0]}
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Attendance</Typography>
                        <Typography variant="caption" fontWeight={700}>{present} / {total} · {pct}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(0,0,0,0.06)' }}
                      />
                    </Box>
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                    <Button size="small" variant="outlined" startIcon={<QRCodeIcon />} onClick={() => navigate(`/sessions/${session.id}`)}>
                      Project QR
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    {session.is_active ? (
                      <Button size="small" color="error" startIcon={<StopIcon />} onClick={() => handleStopSession(session.id)}>
                        Stop
                      </Button>
                    ) : (
                      <Button size="small" color="success" startIcon={<PlayIcon />} onClick={() => navigate('/sessions/new')}>
                        Again
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}