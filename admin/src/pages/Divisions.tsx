import { useEffect, useState } from 'react';
import {
  Box, Card, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { adminApi, Division } from '../services/adminApi';

export default function Divisions() {
  const [rows, setRows] = useState<Division[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = () => adminApi.divisions().then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (dialog?.mode === 'create') await adminApi.createDivision(name);
      else if (dialog?.id) await adminApi.updateDivision(dialog.id, name);
      setDialog(null); setName(''); load();
      setMsg({ type: 'success', text: 'Saved' });
    } catch (e: any) { setMsg({ type: 'error', text: e?.response?.data?.error ?? 'Save failed' }); }
  };

  const del = async (d: Division) => {
    if (!window.confirm(`Delete division ${d.name}?`)) return;
    try { await adminApi.deleteDivision(d.id); load(); } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error ?? 'Delete failed' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Divisions</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setName(''); setDialog({ mode: 'create' }); }}>Add division</Button>
      </Box>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>Name</TableCell><TableCell>Courses</TableCell><TableCell>Students</TableCell><TableCell align="right">Actions</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{d.name}</TableCell>
                  <TableCell>{d.course_count}</TableCell>
                  <TableCell>{d.student_count}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => { setName(d.name); setDialog({ mode: 'edit', id: d.id }); }}><Edit /></IconButton>
                    <IconButton size="small" onClick={() => del(d)}><Delete /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>No divisions yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} fullWidth maxWidth="xs">
        <DialogTitle>{dialog?.mode === 'create' ? 'Add division' : 'Edit division'}</DialogTitle>
        <DialogContent><TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth sx={{ mt: 1 }} autoFocus /></DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!name.trim()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
