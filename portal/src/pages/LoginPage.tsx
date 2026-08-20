// src/pages/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
  Paper,
  Link,
  InputAdornment,
  IconButton,
  Divider,
  Grid,
  useTheme,
} from '@mui/material';
import {
  LockOutlined,
  EmailOutlined,
  Visibility,
  VisibilityOff,
  School,
  Security,
  VerifiedUser,
  ArrowForward,
} from '@mui/icons-material';

interface LoginFormData {
  email: string;
  password: string;
}

export default function LoginPage() {
  const theme = useTheme();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    setLoading(true);
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 8, mb: 8 }}>
      {/* Background Aurora Glows */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -1,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -150,
            right: -150,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            opacity: 0.08,
            filter: 'blur(100px)',
            animation: 'float 6s ease-in-out infinite',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -200,
            left: -200,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.warning.main} 100%)`,
            opacity: 0.06,
            filter: 'blur(120px)',
            animation: 'float 8s ease-in-out infinite reverse',
          }}
        />
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 4, sm: 5 },
          borderRadius: 3,
          background: 'rgba(16, 19, 26, 0.9)',
          backdropFilter: 'blur(20px)',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4), 0 0 40px rgba(77, 142, 255, 0.1)',
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(90deg, #4d8eff, #5de6ff, #fbbf24)',
            opacity: 0.6,
          },
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              borderRadius: '24px',
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              mb: 3,
              boxShadow: `0 16px 40px ${alpha(theme.palette.primary.main, 0.4)}`,
              animation: 'pulse-glow 3s ease-in-out infinite',
            }}
          >
            <School sx={{ fontSize: 40, color: '#002e6a' }} />
          </Box>
          <Typography variant="h3" fontWeight={800} color="text.primary" gutterBottom letterSpacing={-0.5}>
            Attendance Gateway
          </Typography>
          <Typography variant="h6" fontWeight={400} color="text.secondary">
            Teacher Portal — Zero-Trust Attendance
          </Typography>
        </Box>

        {/* Feature Indicators */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center', p: 1 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: '14px',
                  background: `${theme.palette.primary.main}15`,
                  color: theme.palette.primary.main,
                  mb: 1,
                }}
              >
                <Security fontSize="small" />
              </Box>
              <Typography variant="caption" fontWeight={600} color="text.primary">
                Hardware Lock
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Device binding
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center', p: 1 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: '14px',
                  background: `${theme.palette.secondary.main}15`,
                  color: theme.palette.secondary.main,
                  mb: 1,
                }}
              >
                <VerifiedUser fontSize="small" />
              </Box>
              <Typography variant="caption" fontWeight={600} color="text.primary">
                Biometric
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Fingerprint/FaceID
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center', p: 1 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: '14px',
                  background: `${theme.palette.warning.main}15`,
                  color: theme.palette.warning.main,
                  mb: 1,
                }}
              >
                <ArrowForward fontSize="small" />
              </Box>
              <Typography variant="caption" fontWeight={600} color="text.primary">
                Crypto Seal
              </Typography>
              <Typography variant="caption" color="text.secondary">
                250ms window
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ mb: 4 }} />

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 3, borderRadius: 2, border: `1px solid ${theme.palette.error.light}` }}
              onClose={() => setError('')}
            >
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Email Address"
            type="email"
            placeholder="professor@college.edu"
            autoComplete="email"
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
            error={!!errors.email}
            helperText={errors.email?.message}
            margin="normal"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailOutlined color="primary" sx={{ color: 'inherit', opacity: 0.7 }} />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
            inputProps={{
              style: { fontSize: 16 },
            }}
          />

          <TextField
            fullWidth
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            autoComplete="current-password"
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: 6,
                message: 'Password must be at least 6 characters',
              },
            })}
            error={!!errors.password}
            helperText={errors.password?.message}
            margin="normal"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined color="primary" sx={{ color: 'inherit', opacity: 0.7 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    sx={{ color: 'inherit', opacity: 0.7 }}
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 3 }}
            inputProps={{
              style: { fontSize: 16 },
            }}
          />

          <Button
            type="submit"
            fullWidth
            size="large"
            variant="contained"
            disabled={loading}
            sx={{
              py: 1.5,
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 12,
              boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.4)}`,
              '&:hover': {
                boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.5)}`,
                transform: 'translateY(-2px)',
              },
              '&:active': {
                transform: 'translateY(0)',
              },
              '&:disabled': {
                background: theme.palette.action.disabledBackground,
                boxShadow: 'none',
                transform: 'none',
              },
              transition: 'all 0.2s ease',
            }}
          >
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <CircularProgress size={24} color="inherit" />
                <span>Signing in...</span>
              </Box>
            ) : (
              'Sign In'
            )}
          </Button>

          <Typography variant="body2" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
            <Link href="#" variant="body2" sx={{ fontWeight: 500 }}>
              Forgot password?
            </Link>
          </Typography>

          <Box sx={{ mt: 4, p: 3, borderRadius: 2, background: `${theme.palette.primary.main}08`, border: `1px solid ${theme.palette.primary.main}20` }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Sign in with your professor email
            </Typography>
            <Typography variant="caption" color="text.primary" display="block">
              Use the credentials issued by your administrator. Need a reset? Ask an admin to
              reset your password in the Admin console.
            </Typography>
          </Box>
        </form>

        {/* Footer */}
        <Box sx={{ mt: 5, pt: 3, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            Zero-Trust Cryptographic Attendance Gateway
          </Typography>
          <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ mt: 0.5 }}>
            4-Gate Verification • Hardware • Biometric • Visual • Cryptographic
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

// Helper for alpha function
import { alpha } from '@mui/material';