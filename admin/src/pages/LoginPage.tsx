import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, Paper } from '@mui/material';
import { Security, Lock } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@atmyhome.tech');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 20% 20%, #12263a, #0d1b2a 60%)',
      }}
    >
      <Card sx={{ width: 400, maxWidth: '92vw' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Security color="primary" sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h5" fontWeight={800}>Admin Console</Typography>
              <Typography variant="caption" color="text.secondary">
                Zero-Trust Cryptographic Attendance Gateway
              </Typography>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Paper component="form" onSubmit={submit} elevation={0} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth autoFocus />
            <TextField
              label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth
              InputProps={{ startAdornment: <Lock fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
            />
            <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.2 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </Paper>
        </CardContent>
      </Card>
    </Box>
  );
}
