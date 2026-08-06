// src/pages/NewSessionPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { portalApi, Professor } from '../services/portalApi';
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  MenuItem,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Add as AddIcon } from '@mui/icons-material';

export default function NewSessionPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [courseCode, setCourseCode] = useState('');
  const [professorId, setProfessorId] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await portalApi.getProfessors();
        setProfessors(res.data);
        // Default to logged-in professor if they are one
        if (user?.id) {
          setProfessorId(user.id);
        } else if (res.data.length > 0) {
          setProfessorId(res.data[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleSubmit = async () => {
    if (!courseCode.trim()) {
      setError('Course code is required');
      return;
    }
    if (!professorId) {
      setError('Please select a professor');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const session = await portalApi.startSession({
        course_code: courseCode.trim(),
        prof_uuid: professorId,
        session_date: sessionDate,
      });
      navigate(`/sessions/${session.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create session');
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/dashboard')}
        sx={{ mb: 2, color: 'text.secondary' }}
      >
        Back to Dashboard
      </Button>

      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        Start New Session
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 4, borderRadius: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TextField
              fullWidth
              label="Course Code"
              placeholder="e.g. CS101"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              sx={{ mb: 3 }}
            />

            <TextField
              fullWidth
              select
              label="Professor"
              value={professorId}
              onChange={(e) => setProfessorId(e.target.value)}
              sx={{ mb: 3 }}
              helperText="Who is conducting this session?"
            >
              {professors.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name} — {p.department}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Session Date"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              sx={{ mb: 4 }}
              InputLabelProps={{ shrink: true }}
            />

            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<AddIcon />}
              onClick={handleSubmit}
              disabled={submitting}
              sx={{ py: 1.5 }}
            >
              {submitting ? <CircularProgress size={24} color="inherit" /> : 'Start Session'}
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}