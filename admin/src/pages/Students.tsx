import { useEffect, useState } from 'react';
import { adminApi, Student, Division } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Pencil, Trash2, Smartphone, Search, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface FormState { roll_no: string; email: string; name: string; division_id: string; }
const empty: FormState = { roll_no: '', email: '', name: '', division_id: '' };

export default function Students() {
  const [rows, setRows] = useState<Student[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([adminApi.students(), adminApi.divisions()])
      .then(([s, d]) => { setRows(s.data); setDivisions(d.data); setLoading(false); })
      .catch(() => { setMsg({ type: 'error', text: 'Failed to load data' }); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_no.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setForm(empty); setDialog({ mode: 'create' }); };
  const openEdit = (s: Student) => {
    setForm({ roll_no: s.roll_no, email: s.email, name: s.name, division_id: s.division_id || '' });
    setDialog({ mode: 'edit', id: s.student_uuid });
  };

  const save = async () => {
    setBusy(true);
    try {
      if (dialog?.mode === 'create') {
        await adminApi.createStudent(form);
        setMsg({ type: 'success', text: `Student ${form.name} created` });
      } else if (dialog?.id) {
        await adminApi.updateStudent(dialog.id, form);
        setMsg({ type: 'success', text: 'Student updated' });
      }
      setDialog(null);
      load();
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.error?.message ?? 'Save failed' });
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (s: Student) => {
    if (!window.confirm(`Delete student ${s.name}? This will remove their attendance records.`)) return;
    setBusy(true);
    try {
      await adminApi.deleteStudent(s.student_uuid);
      setMsg({ type: 'success', text: 'Student deleted' });
      load();
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.error?.message ?? 'Delete failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">Manage student registrations and device bindings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Student
          </Button>
        </div>
      </div>

      {msg && (
        <Alert variant={msg.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or roll number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Directory</CardTitle>
          <CardDescription>
            {filtered.length} of {rows.length} students {search && '(filtered)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {search ? 'No students match your search' : 'No students found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow key={s.student_uuid}>
                      <TableCell className="font-mono font-medium">{s.roll_no}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.email}</TableCell>
                      <TableCell>{s.division_name || '—'}</TableCell>
                      <TableCell>
                        {s.bound_device_id ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                            <Smartphone className="h-3 w-3" />
                            Bound
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not bound</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => doDelete(s)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={Boolean(dialog)} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'create' ? 'Add New Student' : 'Edit Student'}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create' ? 'Register a new student account' : 'Update student information'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="roll">Roll Number</Label>
              <Input id="roll" value={form.roll_no} onChange={(e) => setForm({ ...form, roll_no: e.target.value })} placeholder="24DCE051" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@student.edu" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="division">Division</Label>
              <select
                id="division"
                value={form.division_id}
                onChange={(e) => setForm({ ...form, division_id: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="">No division</option>
                {divisions.map((d) => (
                  <option key={d.division_id} value={d.division_id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}