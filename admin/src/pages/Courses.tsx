import { useEffect, useState } from 'react';
import {
  Box, Card, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, MenuItem, Select, InputLabel, FormControl,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { adminApi, Course, Division } from '../services/adminApi';

export default function Courses() {
  const [rows, setRows] = useState<Course[]>([]);
  const [divs, setDivs] = useState<Division[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; code?: string }>(null);
  const [form, setForm] = useState({ course_code: '', title: '', division_id: '' });
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = () => {
    adminApi.courses().then((r) => setRows(r.data)).catch(() => {});
    adminApi.divisions().then((r) => setDivs(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const data = { ...form, course_code: form.course_code.toUpperCase(), division_id: form.division_id || null };
      if (dialog?.mode === 'create') await adminApi.createCourse(data);
      else if (dialog?.code) await adminApi.updateCourse(dialog.code, data);
      setDialog(null); load();
      setMsg({ type: 'success', text: 'Saved' });
    } catch (e: any) { setMsg({ type: 'error', text: e?.response?.data?.error ?? 'Save failed' }); }
  };

  const del = async (c: Course) => {
    if (!window.confirm(`Delete course ${c.course_code} (${c.title})?`)) return;
    try { await adminApi.deleteCourse(c.course_code); load(); } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error ?? 'Delete failed' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Courses</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setForm({ course_code: '', title: '', division_id: '' }); setDialog({ mode: 'create' }); }}>Add course</Button>
      </Box>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>Code</TableCell><TableCell>Title</TableCell><TableCell>Division</TableCell><TableCell>Assignments</TableCell><TableCell align="right">Actions</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.course_code}>
                  <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{c.course_code}</TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell>{c.division_name ?? '—'}</TableCell>
                  <TableCell>{c.assignment_count}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => { setForm({ course_code: c.course_code, title: c.title, division_id: c.division_id ?? '' }); setDialog({ mode: 'edit', code: c.course_code }); }}><Edit /></IconButton>
                    <IconButton size="small" onClick={() => del(c)}><Delete /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No courses yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{dialog?.mode === 'create' ? 'Add course' : 'Edit course'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Course code" value={form.course_code} onChange={(e) => setForm({ ...form, course_code: e.target.value.toUpperCase() })} fullWidth helperText="e.g. MATH201" />
          <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} fullWidth />
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
          <Button variant="contained" onClick={save} disabled={!form.course_code || !form.title}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
