import { useEffect, useState } from 'react';
import {
  Box, Card, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, MenuItem, Select, InputLabel, FormControl, Chip, Grid, TextField, Paper, Stack,
} from '@mui/material';
import { Add, Edit, Delete, PersonSearch } from '@mui/icons-material';
import { adminApi, Assignment, Teacher, Course, Division, dayName } from '../services/adminApi';

const empty = { prof_uuid: '', course_code: '', division_id: '', day_of_week: 1, start_time: '09:00', end_time: '10:00' };

export default function Assignments() {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [divs, setDivs] = useState<Division[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = () => {
    adminApi.assignments().then((r) => setRows(r.data)).catch(() => {});
    adminApi.teachers().then((r) => setTeachers(r.data)).catch(() => {});
    adminApi.courses().then((r) => setCourses(r.data)).catch(() => {});
    adminApi.divisions().then((r) => setDivs(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  // Default to the first teacher for convenience (timetable is teacher-wise)
  useEffect(() => {
    if (!teacherId && teachers.length > 0) setTeacherId(teachers[0].id);
  }, [teachers]);

  const mine = teacherId ? rows.filter((a) => a.prof_uuid === teacherId) : rows;
  const selectedTeacher = teachers.find((t) => t.id === teacherId);

  const save = async () => {
    try {
      if (dialog?.mode === 'create') await adminApi.createAssignment(form);
      else if (dialog?.id) await adminApi.updateAssignment(dialog.id, form);
      setDialog(null); load();
      setMsg({ type: 'success', text: 'Saved' });
    } catch (e: any) { setMsg({ type: 'error', text: e?.response?.data?.error ?? 'Save failed' }); }
  };

  const del = async (a: Assignment) => {
    if (!window.confirm('Delete this timetable entry?')) return;
    try { await adminApi.deleteAssignment(a.id); load(); } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error ?? 'Delete failed' });
    }
  };

  const fields = (
    <Grid container spacing={2} sx={{ pt: 2 }}>
      <Grid item xs={12}>
        <FormControl fullWidth disabled>
          <InputLabel>Teacher</InputLabel>
          <Select label="Teacher" value={dialog?.mode === 'create' ? teacherId : form.prof_uuid}>
            <MenuItem value={teacherId}>{selectedTeacher ? `${selectedTeacher.name} (${selectedTeacher.email})` : '—'}</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={6}>
        <FormControl fullWidth>
          <InputLabel>Course</InputLabel>
          <Select label="Course" value={form.course_code} onChange={(e) => setForm({ ...form, course_code: e.target.value })}>
            {courses.map((c) => <MenuItem key={c.course_code} value={c.course_code}>{c.course_code} — {c.title}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={6}>
        <FormControl fullWidth>
          <InputLabel>Division</InputLabel>
          <Select label="Division" value={form.division_id} onChange={(e) => setForm({ ...form, division_id: e.target.value })}>
            {divs.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={4}>
        <FormControl fullWidth>
          <InputLabel>Day</InputLabel>
          <Select label="Day" value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}>
            {[0,1,2,3,4,5,6].map((d) => <MenuItem key={d} value={d}>{dayName(d)}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={4}>
        <TextField type="time" label="Start" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
      </Grid>
      <Grid item xs={4}>
        <TextField type="time" label="End" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
      </Grid>
    </Grid>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Timetable</Typography>
      </Box>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {/* Teacher-wise selector */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2, border: '1px solid rgba(139,163,184,0.15)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 180 }}>
            <PersonSearch color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>Teacher:</Typography>
          </Stack>
          <FormControl sx={{ flex: 1, minWidth: 260 }}>
            <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} size="small" displayEmpty>
              {teachers.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.name} — {t.department}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained" startIcon={<Add />} disabled={!teacherId}
            onClick={() => { setForm({ ...empty, prof_uuid: teacherId }); setDialog({ mode: 'create' }); }}
          >
            Add lecture
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Timetable is managed <b>per teacher</b> — the teacher portal surfaces today's lectures automatically.
        </Typography>
      </Paper>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>Day</TableCell><TableCell>Time</TableCell><TableCell>Course</TableCell><TableCell>Division</TableCell><TableCell align="right">Actions</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {mine.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell><Chip size="small" label={dayName(a.day_of_week)} variant="outlined" color={a.day_of_week === 0 || a.day_of_week === 6 ? 'default' : 'primary'} /></TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{a.start_time}–{a.end_time}</TableCell>
                  <TableCell>{a.course_code} — {a.course_title}</TableCell>
                  <TableCell>{a.division_name}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => { setForm({ prof_uuid: a.prof_uuid, course_code: a.course_code, division_id: a.division_id, day_of_week: a.day_of_week, start_time: a.start_time, end_time: a.end_time }); setDialog({ mode: 'edit', id: a.id }); }}><Edit /></IconButton>
                    <IconButton size="small" onClick={() => del(a)}><Delete /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {mine.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {teachers.length === 0 ? 'No teachers yet. Add teachers first.' : `No lectures assigned to ${selectedTeacher?.name ?? 'this teacher'} yet.`}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{dialog?.mode === 'create' ? 'Add lecture' : 'Edit lecture'}</DialogTitle>
        <DialogContent sx={{ pb: 1 }}>{fields}</DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!form.course_code || !form.division_id || !teacherId}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}