import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, IconButton, Typography, Box, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Divider, Avatar, Menu, MenuItem, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, Button,
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard, Group, School, AccountTree, Class as ClassIcon,
  CalendarMonth, Logout, Security, AdminPanelSettings, Key as KeyIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../services/adminApi';

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
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const submitPw = async () => {
    setPwMsg(null);
    if (pwForm.next.length < 8) { setPwMsg({ type: 'error', text: 'New password must be at least 8 characters' }); return; }
    if (pwForm.next !== pwForm.confirm) { setPwMsg({ type: 'error', text: 'Passwords do not match' }); return; }
    setPwBusy(true);
    try {
      await adminApi.changePassword(pwForm.current, pwForm.next);
      setPwMsg({ type: 'success', text: 'Password changed. Use it next time you sign in.' });
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      setPwMsg({ type: 'error', text: e?.response?.data?.error ?? 'Change failed' });
    } finally {
      setPwBusy(false);
    }
  };

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
            <MenuItem onClick={() => { setAnchor(null); setPwOpen(true); }}>
              <ListItemIcon><KeyIcon fontSize="small" /></ListItemIcon>
              Change password
            </MenuItem>
            <MenuItem
              onClick={() => { setAnchor(null); logout(); navigate('/login'); }}
            >
              <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
              Logout
            </MenuItem>
          </Menu>

          <Dialog open={pwOpen} onClose={() => setPwOpen(false)} fullWidth maxWidth="xs">
            <DialogTitle>Change password</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
              {pwMsg && <Alert severity={pwMsg.type} onClose={() => setPwMsg(null)}>{pwMsg.text}</Alert>}
              <TextField label="Current password" type="password" value={pwForm.current}
                onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} fullWidth autoFocus />
              <TextField label="New password (min 8)" type="password" value={pwForm.next}
                onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} fullWidth />
              <TextField label="Confirm new password" type="password" value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} fullWidth />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPwOpen(false)}>Close</Button>
              <Button variant="contained" onClick={submitPw} disabled={pwBusy}>
                {pwBusy ? 'Saving…' : 'Change password'}
              </Button>
            </DialogActions>
          </Dialog>
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
