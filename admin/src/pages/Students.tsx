import { useEffect, useState } from 'react';
import {
  Box, Card, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Chip, Stack, InputAdornment, Tooltip, Paper,
} from '@mui/material';
import { Search, Edit, Delete, DevicesOther, Refresh, Key as KeyIcon, PersonAddAlt1 } from '@mui/icons-material';
import { adminApi, Student, Division } from '../services/adminApi';
import MenuItem from '@mui/material/MenuItem';

interface FormState { roll_no: string; email: string; name: string; division_id: string; }
const empty = { roll_no: '', email: '', name: '', division_id: '' };

export default function Students() {
  const [rows, setRows] = useState<Student[]>([]);
  const [divs, setDivs] = useState<Division[]>([]);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<null | { mode: 'edit'; id: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [secretDialog, setSecretDialog] = useState<null | { title: string; secret: string; note: string }>(null);
  const [confirm, setConfirm] = useState<null | { action: 'reset' | 'rotate' | 'delete' | 'forgot'; student: Student }>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    adminApi.students().then((r) => setRows(r.data)).catch(() => {});
    adminApi.divisions().then((r) => setDivs(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const showErr = (e: any, fallback: string) => setMsg({ type: 'error', text: e?.response?.data?.error ?? fallback });

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((s) =>
        s.roll_no.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q))
    : rows;

  const doAction = async (s: Student) => {
    setBusy(true);
    try {
      switch (confirm?.action) {
        case 'reset': {
          const r = await adminApi.resetDevice(s.id);
          setSecretDialog({
            title: 'Device reset complete — new HMAC signer',
            secret: r.data.secret_hmac_key,
            note: `Hardware tattoo for ${s.roll_no} unbound; old device locked out. On next app login the student's device rebinds automatically and receives this signer.`,
          });
          setMsg({ type: 'success', text: 'Device reset + HMAC rotated' });
          break;
        }
        case 'rotate': {
          const r = await adminApi.rotateHmac(s.id);
          setSecretDialog({ title: 'HMAC key rotated', secret: r.data.secret_hmac_key, note: `New signer for ${s.roll_no}. The app refreshes it on next login.` });
          setMsg({ type: 'success', text: 'HMAC rotated' });
          break;
        }
        case 'forgot': {
          await adminApi.forgotPassword(s.id);
          setMsg({ type: 'success', text: `Password cleared — ${s.roll_no} will set a new one in the app` });
          break;
        }
        case 'delete': {
          await adminApi.deleteStudent(s.id);
          setMsg({ type: 'success', text: 'Student deleted' });
          break;
        }
      }
      setConfirm(null); load();
    } catch (e) { showErr(e, 'Action failed'); } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      if (dialog?.id) {
        await adminApi.updateStudent(dialog.id, { ...form, division_id: form.division_id || null });
        setMsg({ type: 'success', text: 'Student updated' });
      }
      setDialog(null); load();
    } catch (e) { showErr(e, 'Save failed'); } finally { setBusy(false); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Students</Typography>
        <Chip
          icon={<PersonAddAlt1 />}
          label="Students self-register in the app — accounts are created on their phone"
          variant="outlined"
          sx={{ color: 'text.secondary' }}
        />
      </Box>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {/* Search */}
      <Paper elevation={0} sx={{ p: 1.5, mb: 2, borderRadius: 2, border: '1px solid rgba(139,163,184,0.15)' }}>
        <TextField
          fullWidth size="small" placeholder="Search by roll number, name or email…"
          value={query} onChange={(e) => setQuery(e.target.value)}
          InputProps={{ startAdornment: (<InputAdornment position="start"><Search /></InputAdornment>) }}
        />
      </Paper>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Roll No</TableCell><TableCell>Name</TableCell><TableCell>Email</TableCell>
                <TableCell>Division</TableCell><TableCell>Device</TableCell><TableCell>Password</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{s.roll_no}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>{s.division_name ?? '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" color={s.is_bound ? 'success' : 'warning'} label={s.is_bound ? 'Bound' : 'Unbound'} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" color={s.has_password ? 'info' : 'error'} label={s.has_password ? 'Set' : 'Not set'} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Forgot password (student sets a new one in-app)">
                        <IconButton size="small" color="secondary" onClick={() => setConfirm({ action: 'forgot', student: s })}>
                          <KeyIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reset device (unbind + new HMAC)">
                        <IconButton size="small" color="warning" onClick={() => setConfirm({ action: 'reset', student: s })}><DevicesOther /></IconButton>
                      </Tooltip>
                      <Tooltip title="Rotate HMAC key">
                        <IconButton size="small" color="info" onClick={() => setConfirm({ action: 'rotate', student: s })}><Refresh /></IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => { setForm({ roll_no: s.roll_no, email: s.email, name: s.name, division_id: s.division_id ?? '' }); setDialog({ mode: 'edit', id: s.id }); }}><Edit /></IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setConfirm({ action: 'delete', student: s })}><Delete /></IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {rows.length === 0 ? 'No students yet — they register themselves in the app.' : `No students match "${query}".`}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* edit */}
      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit student</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Roll number" value={form.roll_no} onChange={(e) => setForm({ ...form, roll_no: e.target.value.toUpperCase() })} fullWidth />
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
          <TextField select label="Division" value={form.division_id} onChange={(e) => setForm({ ...form, division_id: e.target.value })} fullWidth>
            <MenuItem value=""><em>None</em></MenuItem>
            {divs.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={busy}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* confirm */}
      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>
          {confirm?.action === 'reset' ? 'Reset device' : confirm?.action === 'rotate' ? 'Rotate HMAC' : confirm?.action === 'forgot' ? 'Forgot password' : 'Delete student'}
        </DialogTitle>
        <DialogContent>
          {confirm?.action === 'reset' && (
            <Alert severity="warning">Unbind the hardware tattoo for <b>{confirm.student.roll_no}</b> and mint a new HMAC signer. Old device is locked out. Audit-logged.</Alert>
          )}
          {confirm?.action === 'rotate' && (
            <Alert severity="info">Rotate the Gate-4 HMAC signer for <b>{confirm.student.roll_no}</b> (hardware stays bound). Audit-logged.</Alert>
          )}
          {confirm?.action === 'forgot' && (
            <Alert severity="info">Clear the password for <b>{confirm.student.roll_no}</b>? The next time they open the app they'll be asked to set a new password (twice). Audit-logged.</Alert>
          )}
          {confirm?.action === 'delete' && (
            <Alert severity="error">Permanently delete <b>{confirm.student.roll_no}</b> ({confirm.student.name})? Attendance history is removed.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="contained" color={confirm?.action === 'delete' ? 'error' : 'primary'} disabled={busy}
            onClick={() => confirm && doAction(confirm.student)}>
            {busy ? 'Working…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* secret reveal */}
      <Dialog open={Boolean(secretDialog)} onClose={() => setSecretDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{secretDialog?.title}</DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: '#0d1b2a', border: '1px solid rgba(76,201,240,0.2)' }}>
            <Typography variant="caption" color="text.secondary">HMAC secret (Gate 4 signer)</Typography>
            <Typography sx={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: 14 }}>{secretDialog?.secret}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">{secretDialog?.note}</Typography>
        </DialogContent>
        <DialogActions>
          <Button color="primary" onClick={() => { navigator.clipboard?.writeText(secretDialog?.secret ?? ''); setSecretDialog(null); }}>Copy & close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}