// src/App.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SessionPage from './pages/SessionPage';
import NewSessionPage from './pages/NewSessionPage';
import Layout from './components/Layout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// Aurora Glass Theme — Midnight Navy foundation with Electric Blue/Cyan/Violet accents
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4d8eff',       // Electric Blue
      light: '#7bb3ff',
      dark: '#005ac2',
      contrastText: '#002e6a',
    },
    secondary: {
      main: '#5de6ff',       // Cyan
      light: '#a2eeff',
      dark: '#00cbe6',
      contrastText: '#00363e',
    },
    error: {
      main: '#ffb4ab',       // Coral
      light: '#ffdad6',
      dark: '#93000a',
      contrastText: '#690005',
    },
    success: {
      main: '#4ade80',       // Emerald
      light: '#86efac',
      dark: '#166534',
    },
    warning: {
      main: '#fbbf24',       // Amber
      light: '#fde68a',
      dark: '#b45309',
    },
    background: {
      default: '#020617',    // Midnight Navy
      paper: '#10131a',      // Surface
    },
    text: {
      primary: '#e1e2ec',    // On-surface
      secondary: '#c2c6d6',  // On-surface-variant
      disabled: '#8c909f',   // Outline
    },
    divider: '#424754',      // Outline-variant
    action: {
      active: '#e1e2ec',
      hover: 'rgba(225, 226, 236, 0.08)',
      selected: 'rgba(77, 142, 255, 0.16)',
      disabled: 'rgba(140, 144, 159, 0.38)',
      disabledBackground: 'rgba(140, 144, 159, 0.12)',
    },
  },
  typography: {
    fontFamily: '"Geist", "Inter", "Segoe UI", Roboto, sans-serif',
    h1: { fontFamily: '"Geist", sans-serif', fontWeight: 700, fontSize: '3rem', lineHeight: 1.1, letterSpacing: '-0.02em' },
    h2: { fontFamily: '"Geist", sans-serif', fontWeight: 700, fontSize: '2.25rem', lineHeight: 1.2, letterSpacing: '-0.01em' },
    h3: { fontFamily: '"Geist", sans-serif', fontWeight: 700, fontSize: '1.75rem', lineHeight: 1.2, letterSpacing: '-0.01em' },
    h4: { fontFamily: '"Geist", sans-serif', fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.2, letterSpacing: '-0.01em' },
    h5: { fontFamily: '"Geist", sans-serif', fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.3 },
    h6: { fontFamily: '"Geist", sans-serif', fontWeight: 600, fontSize: '1rem', lineHeight: 1.3 },
    subtitle1: { fontFamily: '"Geist", sans-serif', fontWeight: 600, fontSize: '1rem', lineHeight: 1.5, letterSpacing: '0.05em' },
    subtitle2: { fontFamily: '"Inter", sans-serif', fontWeight: 500, fontSize: '0.875rem', lineHeight: 1.5 },
    body1: { fontFamily: '"Inter", sans-serif', fontWeight: 400, fontSize: '1rem', lineHeight: 1.6 },
    body2: { fontFamily: '"Inter", sans-serif', fontWeight: 400, fontSize: '0.875rem', lineHeight: 1.6 },
    caption: { fontFamily: '"Inter", sans-serif', fontWeight: 400, fontSize: '0.75rem', lineHeight: 1.5 },
    overline: { fontFamily: '"Geist", sans-serif', fontWeight: 600, fontSize: '0.75rem', lineHeight: 1.5, letterSpacing: '0.1em', textTransform: 'uppercase' },
    button: { fontFamily: '"Geist", sans-serif', fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.5, textTransform: 'none' },
  },
  shape: { borderRadius: 8 },
  shadows: [
    'none',
    '0 4px 20px rgba(0,0,0,0.25)',
    '0 8px 30px rgba(0,0,0,0.3)',
    '0 12px 40px rgba(0,0,0,0.35)',
    '0 16px 50px rgba(0,0,0,0.4)',
    '0 20px 60px rgba(0,0,0,0.45)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
    '0 24px 70px rgba(0,0,0,0.5)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap");
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
          background-color: #020617;
          background-image: 
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(77, 142, 255, 0.15), transparent),
            radial-gradient(ellipse 60% 40% at 100% 100%, rgba(93, 230, 255, 0.1), transparent),
            radial-gradient(ellipse 50% 30% at 0% 0%, rgba(208, 188, 255, 0.08), transparent);
          min-height: 100vh;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(77, 142, 255, 0.3); }
          50% { box-shadow: 0 0 40px rgba(77, 142, 255, 0.5); }
        }
      `,
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '10px 24px',
          fontSize: '0.875rem',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': { transform: 'translateY(-2px)' },
          '&:active': { transform: 'translateY(0)' },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #4d8eff 0%, #5de6ff 100%)',
          color: '#002e6a',
          boxShadow: '0 8px 24px rgba(77, 142, 255, 0.4)',
          '&:hover': {
            background: 'linear-gradient(135deg, #4d8eff 0%, #5de6ff 100%)',
            boxShadow: '0 12px 32px rgba(77, 142, 255, 0.5)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #5de6ff 0%, #d0bcff 100%)',
          color: '#00363e',
          '&:hover': {
            background: 'linear-gradient(135deg, #5de6ff 0%, #d0bcff 100%)',
          },
        },
        outlined: {
          borderWidth: 1.5,
          '&:hover': { borderWidth: 1.5 },
        },
        sizeLarge: { padding: '12px 32px', fontSize: '1rem' },
        sizeSmall: { padding: '6px 16px', fontSize: '0.8125rem' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(140, 144, 159, 0.15)',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            border: '1px solid rgba(77, 142, 255, 0.3)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 0 30px rgba(77, 142, 255, 0.08)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        elevation0: { boxShadow: 'none' },
        elevation1: { boxShadow: '0 4px 20px rgba(0,0,0,0.25)' },
        elevation2: { boxShadow: '0 8px 30px rgba(0,0,0,0.3)' },
        elevation3: { boxShadow: '0 12px 40px rgba(0,0,0,0.35)' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            transition: 'all 0.2s ease',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(77, 142, 255, 0.5)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#4d8eff',
              borderWidth: 2,
            },
            '& input': {
              color: '#e1e2ec',
              '&::placeholder': { color: '#8c909f', opacity: 1 },
            },
          },
          '& .MuiInputLabel-root': {
            color: '#c2c6d6',
            '&.Mui-focused': { color: '#4d8eff' },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
        },
        outlined: {
          borderWidth: 1.5,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid rgba(66, 71, 84, 0.5)' },
        head: {
          fontWeight: 600,
          color: '#c2c6d6',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': { borderBottom: 'none' },
          '&:hover': { backgroundColor: 'rgba(77, 142, 255, 0.04)' },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#10131a',
          border: '1px solid rgba(77, 142, 255, 0.2)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 60px rgba(77, 142, 255, 0.15)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#10131a',
          borderRight: '1px solid rgba(66, 71, 84, 0.5)',
          backdropFilter: 'blur(30px)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(16, 19, 26, 0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(66, 71, 84, 0.5)',
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: { fontWeight: 700 },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
        colorPrimary: { background: 'linear-gradient(90deg, #4d8eff, #5de6ff)' },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontWeight: 500,
        },
        standardError: { backgroundColor: 'rgba(147, 0, 10, 0.3)', color: '#ffdad6', border: '1px solid rgba(147, 0, 10, 0.5)' },
        standardSuccess: { backgroundColor: 'rgba(22, 101, 52, 0.3)', color: '#86efac', border: '1px solid rgba(22, 101, 52, 0.5)' },
        standardWarning: { backgroundColor: 'rgba(180, 83, 9, 0.3)', color: '#fde68a', border: '1px solid rgba(180, 83, 9, 0.5)' },
        standardInfo: { backgroundColor: 'rgba(0, 54, 62, 0.3)', color: '#a2eeff', border: '1px solid rgba(0, 54, 62, 0.5)' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1d2027',
          border: '1px solid rgba(66, 71, 84, 0.5)',
          fontSize: '0.75rem',
          fontWeight: 500,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'all 0.2s ease',
          '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          marginY: 4,
          '&:hover': { backgroundColor: 'rgba(77, 142, 255, 0.1)' },
          '&.Mui-selected': {
            backgroundColor: 'rgba(77, 142, 255, 0.14)',
            borderLeft: '3px solid #4d8eff',
            '&:hover': { backgroundColor: 'rgba(77, 142, 255, 0.18)' },
            '& .MuiListItemIcon-root': { color: '#4d8eff' },
            '& .MuiListItemText-primary': { fontWeight: 700, color: '#4d8eff' },
          },
        },
      },
    },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', position: 'relative' }}>
        <Box
          sx={{
            width: 48, height: 48, borderRadius: '50%',
            border: '4px solid',
            borderColor: 'transparent',
            borderTopColor: '#4d8eff',
            borderRightColor: '#4d8eff',
            animation: 'spin 1s linear infinite',
          }}
        />
        <Box sx={{ position: 'absolute', top: '60%', left: '50%', transform: 'translate(-50%, -50%)', mt: 2 }}>
          <Typography variant="caption" color="text.secondary">Loading...</Typography>
        </Box>
      </Box>
    );
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

import { Box, Typography } from '@mui/material';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Layout />
                  </PrivateRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="sessions/new" element={<NewSessionPage />} />
                <Route path="sessions/:sessionId" element={<SessionPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}