// src/pages/DashboardPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { portalApi, Session } from '../services/portalApi';
import {
  Box, Typography, Button, Chip, CircularProgress, IconButton, Tooltip,
  Alert, Grid, Card, CardContent, CardActions, LinearProgress, Paper, Stack,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Stop as StopIcon,
  QrCode as QRCodeIcon,
  Refresh as RefreshIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckIcon,
  Groups as GroupsIcon,
  WifiTethering as LiveIcon,
  CalendarMonth as CalendarIcon,
  PinDrop as DivIcon,
  PlayArrow as PlayIcon,
  School as SchoolIcon,
} from '@mui/icons-material';

interface SessionWithCounts extends Session {
  total_students?: number;
  present_count?: number;
}

const TODAY_DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DashboardPage() {
  const { loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionWithCounts[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, ttRes, sumRes] = await Promise.all([
        portalApi.getSessions(),
        portalApi.getTimetable(),
        portalApi.getSummary(),
      ]);
      setSessions(sessionsRes.data as SessionWithCounts[]);
      setTimetable(ttRes.data.today || []);
      setSummary(sumRes.data || []);
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

  const handleStop = async (id: string) => {
    if (!window.confirm('Stop this session? The projector QR will stop rotating.')) return;
    try { await portalApi.stopSession(id); loadData(); } catch (e: any) { setError(e?.response?.data?.error?.message || 'Stop failed'); }
  };

  const active = sessions.filter((s) => s.is_active);
  const presentToday = sessions.reduce((a, s) => a + (s.present_count || 0), 0);
  const now = new Date();
  const todayLabel = `${TODAY_DOW_NAMES[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;

  if (authLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      {/* ===== Header banner ===== */}
      <Paper elevation={0} sx={{
        p: { xs: 3, md: 4 }, borderRadius: 4, mb: 4,
        background: 'linear-gradient(135deg, #050a18 0%, #10131a 55%, #1a2a3f 100%)',
        border: '1px solid rgba(77, 142, 255, 0.15)',
        position: 'relative', overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent, #4d8eff, #5de6ff, transparent)',
        },
      }}>
        <Box sx={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', bgcolor: 'rgba(77, 142, 255, 0.07)' }} />
        <Box sx={{ position: 'absolute', right: 40, bottom: -80, width: 180, height: 180, borderRadius: '50%', bgcolor: 'rgba(93, 230, 255, 0.05)' }} />
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2}>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(194,198,214,0.9)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              {todayLabel}
            </Typography>
            <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>
              {user?.name?.split(' ')[0] ? `Ready, ${user.name.split(' ')[0]}` : 'Teacher Dashboard'}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {timetable.length > 0
                ? `You have ${timetable.length} lecture${timetable.length > 1 ? 's' : ''} scheduled today.`
                : 'No lectures scheduled today — you can still start a manual session.'}
            </Typography>
          </Box>
          <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={() => navigate('/sessions/new')}
            sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}>
            Manual Session
          </Button>
        </Stack>

        <Grid container spacing={3} sx={{ mt: 3 }}>
          {[
            { label: 'Lectures today', value: timetable.length, icon: <CalendarIcon />, accent: '#4d8eff' },
            { label: 'Live now', value: active.length, icon: <LiveIcon />, accent: '#4ade80' },
            { label: 'Present today', value: presentToday, icon: <CheckIcon />, accent: '#fbbf24' },
          ].map((s) => (
            <Grid item xs={4} key={s.label}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: s.accent }}>{s.icon}</Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={800} lineHeight={1}>{s.value}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{s.label}</Typography>
                </Box>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          {/* ===== Today's lectures ===== */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <CalendarIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>Today's lectures</Typography>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={loadData}><RefreshIcon /></IconButton>
            </Tooltip>
          </Stack>

          {timetable.length === 0 ? (
            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 4, border: '1px dashed rgba(139,163,184,0.3)', mb: 4 }}>
              <CalendarIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
              <Typography variant="body1" sx={{ mt: 1 }}>No lectures scheduled for today.</Typography>
              <Typography variant="body2" color="text.secondary">Ask the admin to assign you lectures in the Timetable, or start a manual session.</Typography>
            </Paper>
          ) : (
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {timetable.map((lec) => {
                const live = sessions.find((s) => s.is_active && s.course_code === lec.course_code);
                return (
                  <Grid item xs={12} sm={6} lg={4} key={lec.assignment_id}>
                    <Card elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3,
                      border: `1px solid ${live ? 'rgba(74,222,128,0.4)' : 'rgba(77, 142, 255, 0.15)'}` }}>
                      <CardContent sx={{ flex: 1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Box>
                            <Typography variant="h6" fontWeight={800} fontFamily="monospace">{lec.course_code}</Typography>
                            <Typography variant="body2" color="text.secondary">{lec.course_title}</Typography>
                          </Box>
                          {live && <Chip size="small" label="LIVE" sx={{ bgcolor: '#DCFCE7', color: '#15803D', fontWeight: 800 }} />}
                        </Stack>
                        <Stack direction="row" spacing={2} sx={{ mt: 2, color: 'text.secondary' }}>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <TimeIcon fontSize="small" />
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{lec.start_time}–{lec.end_time}</Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <DivIcon fontSize="small" />
                            <Typography variant="body2">{lec.division_name}</Typography>
                          </Stack>
                        </Stack>
                      </CardContent>
                      <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                        {live ? (
                          <Button size="small" color="error" startIcon={<StopIcon />} onClick={() => handleStop(live.id)}>Stop live</Button>
                        ) : (
                          <Button size="small" variant="contained" startIcon={<PlayIcon />} disabled={starting === lec.course_code} onClick={() => startLecture(lec.course_code)}>
                            {starting === lec.course_code ? 'Starting…' : 'Start attendance'}
                          </Button>
                        )}
                        {live && <Box sx={{ flex: 1 }} />}
                        {live && (
                          <Button size="small" startIcon={<QRCodeIcon />} onClick={() => navigate(`/sessions/${live.id}`)}>Project QR</Button>
                        )}
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}

          {/* ===== Subject analytics ===== */}
          {summary.length > 0 && (
            <>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <SchoolIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>My subjects — attendance</Typography>
              </Stack>
              <Grid container spacing={3} sx={{ mb: 4 }}>
                {summary.map((s) => {
                  const overall = s.total_students > 0 ? Math.round((s.present_count / (s.sessions_total * s.total_students || 1)) * 100) : 0;
                  return (
                    <Grid item xs={12} sm={6} lg={4} key={s.course_code}>
                      <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid rgba(77, 142, 255, 0.12)' }}>
                        <CardContent>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box>
                              <Typography variant="h6" fontWeight={800} fontFamily="monospace">{s.course_code}</Typography>
                              <Typography variant="body2" color="text.secondary">{s.title}</Typography>
                            </Box>
                            <Chip size="small" label={`${s.sessions_total} session${s.sessions_total !== 1 ? 's' : ''}`} variant="outlined" />
                          </Stack>
                          <Box sx={{ mt: 2 }}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">Present / roster</Typography>
                              <Typography variant="caption" fontWeight={700}>{s.present_count} / {s.sessions_total * s.total_students || '—'} · {overall}%</Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={Math.min(overall, 100)} sx={{ height: 8, borderRadius: 4 }} />
                          </Box>
                          <Stack direction="row" spacing={2} sx={{ mt: 2, color: 'text.secondary' }}>
                            <Typography variant="caption">Last session: <b>{s.last_session_date ?? '—'}</b></Typography>
                            <Typography variant="caption">Roster: <b>{s.total_students}</b></Typography>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </>
          )}

          {/* ===== Recent sessions ===== */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <GroupsIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>Recent sessions</Typography>
          </Stack>
          {sessions.length === 0 ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: '1px dashed rgba(139,163,184,0.3)' }}>
              <QRCodeIcon sx={{ fontSize: 52, color: 'text.disabled' }} />
              <Typography variant="h6" sx={{ mt: 1 }}>No sessions yet</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Start attendance from a lecture above or create a manual session.</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/sessions/new')}>Start Attendance</Button>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {sessions.slice(0, 6).map((s) => {
                const pct = s.total_students ? Math.round(((s.present_count || 0) / s.total_students) * 100) : 0;
                return (
                  <Grid item xs={12} sm={6} lg={4} key={s.id}>
                    <Card elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, border: '1px solid rgba(139,163,184,0.12)' }}>
                      <CardContent sx={{ flex: 1 }}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="h6" fontWeight={800} fontFamily="monospace">{s.course_code}</Typography>
                          <Chip size="small" label={s.is_active ? 'LIVE' : 'Completed'}
                            sx={{ bgcolor: s.is_active ? '#DCFCE7' : '#1e293b', color: s.is_active ? '#15803D' : '#8ba3b8', fontWeight: 700 }} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">{s.session_date.split('T')[0]}</Typography>
                        <Box sx={{ mt: 1.5 }}>
                          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Attendance</Typography>
                            <Typography variant="caption" fontWeight={700}>{s.present_count || 0} / {s.total_students || 0} · {pct}%</Typography>
                          </Stack>
                          <LinearProgress variant="determinate" value={pct} sx={{ height: 7, borderRadius: 4 }} />
                        </Box>
                      </CardContent>
                      <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                        <Button size="small" variant="outlined" startIcon={<QRCodeIcon />} onClick={() => navigate(`/sessions/${s.id}`)}>Open</Button>
                        {s.is_active && (
                          <>
                            <Box sx={{ flex: 1 }} />
                            <Button size="small" color="error" startIcon={<StopIcon />} onClick={() => handleStop(s.id)}>Stop</Button>
                          </>
                        )}
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </>
      )}
    </Box>
  );
}