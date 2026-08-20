// src/pages/NewSessionPage.tsx
// Manual session creation. NOTE: there is NO professor selector — the backend
// derives the professor from the JWT, so a teacher can only ever start
// sessions as themselves (fundamental auth fix).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { portalApi } from '../services/portalApi';
import {
  Box, Typography, Button, TextField, Alert, CircularProgress, Paper, Stack, Avatar, Chip,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Bolt as BoltIcon, Lock as LockIcon } from '@mui/icons-material';

export default function NewSessionPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [courseCode, setCourseCode] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!courseCode.trim()) { setError('Course code is required'); return; }
    setError(''); setSubmitting(true);
    try {
      const session = await portalApi.startSession({ course_code: courseCode.trim(), session_date: sessionDate });
      navigate(`/sessions/${session.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create session');
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: 2, color: 'text.secondary' }}>
        Back to Dashboard
      </Button>

      <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>Start a session</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Point the smartboard at this screen after starting — the QR is your dumb-terminal projector.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      <Paper sx={{ p: 4, borderRadius: 3, border: '1px solid rgba(139,163,184,0.15)' }}>
        {/* Who is conducting — locked from the JWT */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <Avatar sx={{ bgcolor: 'primary.main', color: '#002e6a', fontWeight: 800 }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'P'}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>{user?.name}</Typography>
            <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
          </Box>
          <Chip size="small" icon={<LockIcon />} label="You — from your login" sx={{ color: '#4d8eff' }} variant="outlined" />
        </Stack>

        <TextField fullWidth label="Course code" placeholder="e.g. CS201" value={courseCode}
          onChange={(e) => setCourseCode(e.target.value.toUpperCase())} sx={{ mb: 3 }} />

        <TextField fullWidth label="Session date" type="date" value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)} sx={{ mb: 4 }} InputLabelProps={{ shrink: true }} />

        <Button variant="contained" size="large" fullWidth startIcon={<BoltIcon />} onClick={handleSubmit} disabled={submitting} sx={{ py: 1.5 }}>
          {submitting ? <CircularProgress size={24} color="inherit" /> : 'Start session'}
        </Button>
      </Paper>
    </Box>
  );
}