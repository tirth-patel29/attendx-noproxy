import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, IconButton, Typography, Box, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Divider, Avatar, Menu, MenuItem, Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard, Group, School, AccountTree, Class as ClassIcon,
  CalendarMonth, Logout, Security, AdminPanelSettings,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: <Dashboard />, end: true },
  { to: '/teachers', label: 'Teachers', icon: <Group /> },
  { to: '/students', label: 'Students', icon: <School /> },
  { to: '/divisions', label: 'Divisions', icon: <AccountTree /> },
  { to: '/courses', label: 'Courses', icon: <ClassIcon /> },
  { to: '/timetable', label: 'Timetable', icon: <CalendarMonth /> },
];

export default function Layout() {
  const [open, setOpen] = useState(true);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Security color="primary" />
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.1}>
            Attendance Admin
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Zero-Trust Gateway
          </Typography>
        </Box>
      </Box>
      <Divider />
      <List sx={{ flex: 1, px: 1 }}>
        {NAV.map((n) => (
          <ListItemButton
            key={n.to}
            component={NavLink}
            to={n.to}
            end={n.end}
            sx={{ borderRadius: 2, mb: 0.5 }}
            style={({ isActive }) => ({ bgcolor: isActive ? 'rgba(76,201,240,0.12)' : 'transparent' })}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{n.icon}</ListItemIcon>
            <ListItemText primary={n.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <ListItemButton sx={{ borderRadius: 2 }}>
        <ListItemIcon sx={{ minWidth: 36 }}><AdminPanelSettings /></ListItemIcon>
        <ListItemText primary={user?.email ?? 'admin'} secondary="Administrator" />
      </ListItemButton>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" color="transparent" elevation={0} sx={{ backdropFilter: 'blur(8px)' }}>
        <Toolbar>
          <IconButton edge="start" onClick={() => setOpen((v) => !v)} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            Admin Console
          </Typography>
          <Tooltip title="Account">
            <IconButton onClick={(e) => setAnchor(e.currentTarget)}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: '#4cc9f0', color: '#0d1b2a' }}>
                {user?.name?.[0]?.toUpperCase() ?? 'A'}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            <MenuItem disabled>Signed in as {user?.email}</MenuItem>
            <MenuItem
              onClick={() => { setAnchor(null); logout(); navigate('/login'); }}
            >
              <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: open ? 250 : 64,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: open ? 250 : 64, transition: 'width .2s', boxSizing: 'border-box', overflowX: 'hidden' },
        }}
      >
        {drawer}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
