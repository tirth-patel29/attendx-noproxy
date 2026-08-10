import { useEffect, useState } from 'react';
import {
  Box, Card, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Chip, Stack, MenuItem, Select, InputLabel, FormControl, Paper,
  List, ListItem, ListItemText,
} from '@mui/material';
import { Add, Edit, Delete, DevicesOther, Refresh } from '@mui/icons-material';
import { adminApi, Student, Division } from '../services/adminApi';

interface FormState { roll_no: string; email: string; name: string; division_id: string; }
const empty = { roll_no: '', email: '', name: '', division_id: '' };

export default function Students() {
  const [rows, setRows] = useState<Student[]>([]);
  const [divs, setDivs] = useState<Division[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [secretDialog, setSecretDialog] = useState<null | { title: string; secret: string; note: string }>(null);
  const [confirm, setConfirm] = useState<null | { action: 'reset' | 'rotate' | 'delete'; student: Student }>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    adminApi.students().then((r) => setRows(r.data)).catch(() => {});
    adminApi.divisions().then((r) => setDivs(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const showErr = (e: any, fallback: string) => setMsg({ type: 'error', text: e?.response?.data?.error ?? fallback });

  const save = async () => {
    setBusy(true);
    try {
      const data = { ...form, division_id: form.division_id || null };
      if (dialog?.mode === 'create') {
        const r = await adminApi.createStudent(data);
        setSecretDialog({
          title: 'Student created — HMAC signer (Gate 4)',
          secret: r.data.secret_hmac_key,
          note: 'Provision this secret into the student device during onboarding. It is only shown once.',
        });
        setMsg({ type: 'success', text: 'Student created' });
      } else if (dialog?.id) {
        await adminApi.updateStudent(dialog.id, data);
        setMsg({ type: 'success', text: 'Student updated' });
      }
      setDialog(null); load();
    } catch (e) { showErr(e, 'Save failed'); } finally { setBusy(false); }
  };

  const doResetDevice = async (s: Student) => {
    setBusy(true);
    try {
      const r = await adminApi.resetDevice(s.id);
      setSecretDialog({
        title: 'Device reset complete — new HMAC signer',
        secret: r.data.secret_hmac_key,
        note: `Hardware tattoo for ${s.roll_no} unbound. Old device is now locked out. Give this new secret to the working device during re-provisioning.`,
      });
      setMsg({ type: 'success', text: 'Device reset + HMAC rotated' });
      setConfirm(null); load();
    } catch (e) { showErr(e, 'Reset failed'); } finally { setBusy(false); }
  };

  const doRotateHmac = async (s: Student) => {
    setBusy(true);
    try {
      const r = await adminApi.rotateHmac(s.id);
      setSecretDialog({
        title: 'HMAC key rotated',
        secret: r.data.secret_hmac_key,
        note: `New signing key for ${s.roll_no}. The student must update their app with this secret.`,
      });
      setMsg({ type: 'success', text: 'HMAC rotated' });
      setConfirm(null); load();
    } catch (e) { showErr(e, 'Rotation failed'); } finally { setBusy(false); }
  };

  const doDelete = async (s: Student) => {
    setBusy(true);
    try {
      await adminApi.deleteStudent(s.id);
      setMsg({ type: 'success', text: 'Student deleted' });
      setConfirm(null); load();
    } catch (e) { showErr(e, 'Delete failed'); } finally { setBusy(false); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Students</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setForm(empty); setDialog({ mode: 'create' }); }}>Add student</Button>
      </Box>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Roll No</TableCell><TableCell>Name</TableCell><TableCell>Email</TableCell>
                <TableCell>Division</TableCell><TableCell>Device</TableCell><TableCell>HMAC</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{s.roll_no}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>{s.division_name ?? '—'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={s.is_bound ? 'success' : 'warning'}
                      label={s.is_bound ? 'Bound' : 'Unbound'}
                    />
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{s.secret_hmac_key}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <IconButton size="small" title="Reset device (unbind + new HMAC)" color="warning"
                        onClick={() => setConfirm({ action: 'reset', student: s })}><DevicesOther /></IconButton>
                      <IconButton size="small" title="Rotate HMAC key" color="info"
                        onClick={() => setConfirm({ action: 'rotate', student: s })}><Refresh /></IconButton>
                      <IconButton size="small" title="Edit" onClick={() => { setForm({ roll_no: s.roll_no, email: s.email, name: s.name, division_id: s.division_id ?? '' }); setDialog({ mode: 'edit', id: s.id }); }}><Edit /></IconButton>
                      <IconButton size="small" title="Delete" onClick={() => setConfirm({ action: 'delete', student: s })}><Delete /></IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No students yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* create/edit */}
      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{dialog?.mode === 'create' ? 'Add student' : 'Edit student'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Roll number" value={form.roll_no} onChange={(e) => setForm({ ...form, roll_no: e.target.value.toUpperCase() })} fullWidth helperText="Format: 24BCS001" />
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
          <FormControl fullWidth>
            <InputLabel>Division</InputLabel>
            <Select label="Division" value={form.division_id} onChange={(e) => setForm({ ...form, division_id: e.target.value })}>
              <MenuItem value=""><em>None</em></MenuItem>
              {divs.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={busy || !form.roll_no || !form.name || !form.email}>
            {dialog?.mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* confirm destructive/security op */}
      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>
          {confirm?.action === 'reset' ? 'Reset device' : confirm?.action === 'rotate' ? 'Rotate HMAC' : 'Delete student'}
        </DialogTitle>
        <DialogContent>
          {confirm?.action === 'reset' && (
            <Alert severity="warning">
              Unbind the hardware tattoo for <b>{confirm.student.roll_no}</b> and issue a new HMAC signer.
              The old device will be permanently locked out of Gate 1 & Gate 4. This is audit-logged.
            </Alert>
          )}
          {confirm?.action === 'rotate' && (
            <Alert severity="info">
              Rotate the Gate-4 HMAC signing key for <b>{confirm.student.roll_no}</b> (hardware stays bound). Audit-logged.
            </Alert>
          )}
          {confirm?.action === 'delete' && (
            <Alert severity="error">Permanently delete <b>{confirm.student.roll_no}</b> ({confirm.student.name})? Attendance history is removed.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button
            variant="contained" color={confirm?.action === 'delete' ? 'error' : 'warning'}
            disabled={busy} onClick={() => confirm && (confirm.action === 'reset' ? doResetDevice(confirm.student) : confirm.action === 'rotate' ? doRotateHmac(confirm.student) : doDelete(confirm.student))}
          >
            {busy ? 'Working…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* secret reveal */}
      <Dialog open={Boolean(secretDialog)} onClose={() => setSecretDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{secretDialog?.title}</DialogTitle>
        <DialogContent>
          <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#0d1b2a' }}>
            <Typography variant="caption" color="text.secondary">HMAC secret (Gate 4 signer)</Typography>
            <Typography sx={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: 14 }}>{secretDialog?.secret}</Typography>
          </Paper>
          <Typography variant="body2" color="text.secondary">{secretDialog?.note}</Typography>
        </DialogContent>
        <DialogActions>
          <Button color="primary" onClick={() => { navigator.clipboard?.writeText(secretDialog?.secret ?? ''); setSecretDialog(null); }}>Copy & close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
