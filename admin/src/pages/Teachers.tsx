import { useEffect, useState } from 'react';
import {
  Box, Card, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Chip, Stack,
} from '@mui/material';
import { Add, Edit, Delete, VpnKey } from '@mui/icons-material';
import { adminApi, Teacher } from '../services/adminApi';

interface FormState { email: string; name: string; department: string; password: string; }

const empty: FormState = { email: '', name: '', department: '', password: '' };

export default function Teachers() {
  const [rows, setRows] = useState<Teacher[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [pwDialog, setPwDialog] = useState<{ id: string; name: string } | null>(null);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = () => adminApi.teachers().then((r) => setRows(r.data)).catch(() => setMsg({ type: 'error', text: 'Failed to load teachers' }));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(empty); setDialog({ mode: 'create' }); };
  const openEdit = (t: Teacher) => { setForm({ email: t.email, name: t.name, department: t.department, password: '' }); setDialog({ mode: 'edit', id: t.id }); };

  const save = async () => {
    try {
      if (dialog?.mode === 'create') {
        await adminApi.createTeacher(form);
        setMsg({ type: 'success', text: `Teacher ${form.name} created` });
      } else if (dialog?.id) {
        await adminApi.updateTeacher(dialog.id, { email: form.email, name: form.name, department: form.department });
        setMsg({ type: 'success', text: 'Teacher updated' });
      }
      setDialog(null); load();
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.error ?? 'Save failed' });
    }
  };

  const doResetPw = async () => {
    if (!pwDialog) return;
    try {
      await adminApi.resetTeacherPassword(pwDialog.id, pw);
      setMsg({ type: 'success', text: 'Password reset' });
      setPwDialog(null); setPw('');
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.error ?? 'Reset failed' });
    }
  };

  const doDelete = async (t: Teacher) => {
    if (!window.confirm(`Delete teacher ${t.name}? This will remove their sessions/assignments.`)) return;
    try {
      await adminApi.deleteTeacher(t.id);
      setMsg({ type: 'success', text: 'Teacher deleted' });
      load();
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.error ?? 'Delete failed' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Teachers</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add teacher</Button>
      </Box>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Department</TableCell>
                <TableCell>Login</TableCell><TableCell>Assignments</TableCell><TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>{t.email}</TableCell>
                  <TableCell>{t.department}</TableCell>
                  <TableCell>
                    <Chip size="small" label={t.has_login ? 'Active' : 'No password'} color={t.has_login ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell>{t.assignment_count}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <IconButton size="small" title="Reset password" onClick={() => setPwDialog({ id: t.id, name: t.name })}><VpnKey /></IconButton>
                      <IconButton size="small" title="Edit" onClick={() => openEdit(t)}><Edit /></IconButton>
                      <IconButton size="small" title="Delete" onClick={() => doDelete(t)}><Delete /></IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No teachers yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{dialog?.mode === 'create' ? 'Add teacher' : 'Edit teacher'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
          <TextField label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} fullWidth />
          {dialog?.mode === 'create' && (
            <TextField
              label="Initial password" type="password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} fullWidth
              helperText="The teacher uses this to log in to the portal (min 8 chars)."
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!form.name || !form.email || !form.department}>
            {dialog?.mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(pwDialog)} onClose={() => setPwDialog(null)} fullWidth maxWidth="xs">
        <DialogTitle>Reset password — {pwDialog?.name}</DialogTitle>
        <DialogContent>
          <TextField label="New password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} fullWidth sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPwDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={doResetPw}>Reset</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
