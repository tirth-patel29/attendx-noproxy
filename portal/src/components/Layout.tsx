// src/components/Layout.tsx
// Premium shell: sidebar navigation (Dashboard / Start Session), profile footer, logout.
import { useState } from 'react';
import { useNavigate, useLocation, Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMediaQuery, useTheme, alpha, Box, Tooltip } from '@mui/material';
import {
  AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Avatar, Divider, Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  EventNote as EventNoteIcon,
  Logout as LogoutIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';

const drawerWidth = 280;

const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { path: '/sessions/new', label: 'Start Session', icon: <EventNoteIcon /> },
];

export default function Layout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box
          sx={{
            width: 48, height: 48, borderRadius: 3, display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.35)}`,
          }}
        >
          <ShieldIcon sx={{ color: '#002e6a' }} fontSize="medium" />
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={800} lineHeight={1.1} color="text.primary">
            Teacher Portal
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Attendance Gateway
          </Typography>
        </Box>
      </Box>

      {/* Nav */}
      <List sx={{ flex: 1, px: 1.5, pt: 1.5 }}>
        {NAV.map((item) => {
          const active = location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={NavLink}
                to={item.path}
                selected={active}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: `${alpha(theme.palette.primary.main, 0.14)}`,
                    color: theme.palette.primary.main,
                    borderLeft: `3px solid ${theme.palette.primary.main}`,
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: active ? theme.palette.primary.main : 'inherit' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: active ? 800 : 600 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Profile footer */}
      <Divider />
      <List sx={{ px: 1.5, py: 1 }} dense>
        <ListItem disablePadding>
          <ListItemButton sx={{ borderRadius: 2 }}>
            <Avatar sx={{ width: 38, height: 38, bgcolor: 'primary.main', color: '#002e6a', fontWeight: 800, fontSize: 16 }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'P'}
            </Avatar>
            <ListItemText
              sx={{ ml: 1 }}
              primary={user?.name || 'Teacher'}
              secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
              secondary={user?.email}
            />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding sx={{ mt: 0.5 }}>
          <ListItemButton onClick={handleLogout} sx={{ borderRadius: 2, color: theme.palette.error.main }}>
            <ListItemIcon sx={{ minWidth: 40 }}><LogoutIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Sign out" primaryTypographyProps={{ fontWeight: 600 }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: 'rgba(16, 19, 26, 0.95)',
          color: 'text.primary',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 2 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1" fontWeight={800}>{user?.name ? `Welcome, ${user.name.split(' ')[0]}` : 'Teacher Portal'}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              Start a live session and it becomes your classroom's secure projector
            </Typography>
          </Box>
          <Tooltip title="Secure session">
            <Chip
              size="small"
              variant="outlined"
              label="Zero-Trust"
              icon={<ShieldIcon sx={{ fontSize: 15 }} />}
              sx={{ color: theme.palette.primary.main, borderColor: alpha(theme.palette.primary.main, 0.4) }}
            />
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: `1px solid ${theme.palette.divider}`,
            backgroundColor: '#10131a',
            backdropFilter: 'blur(30px)',
          },
        }}
      >
        {drawer}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3.5 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: '64px',
          ml: { md: `${drawerWidth}px` },
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}