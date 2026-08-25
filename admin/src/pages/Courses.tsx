import { useEffect, useState } from 'react';
import { adminApi, Course, Division } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface FormState { code: string; title: string; credits: number; division_id: string; }
const empty: FormState = { code: '', title: '', credits: 3, division_id: '' };

export default function Courses() {
  const [rows, setRows] = useState<Course[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    Promise.all([adminApi.courses(), adminApi.divisions()])
      .then(([c, d]) => { setRows(c.data); setDivisions(d.data); })
      .catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const openEdit = (c: Course) => {
    setForm({ code: c.course_code, title: c.title, credits: c.credits, division_id: c.division_id || '' });
    setDialog({ mode: 'edit', id: c.id });
  };

  const save = async () => {
    setBusy(true);
    try {
      if (dialog?.mode === 'create') {
        await adminApi.createCourse({ course_code: form.code, title: form.title, credits: form.credits, division_id: form.division_id || null });
      } else if (dialog?.id) {
        await adminApi.updateCourse(dialog.id, { title: form.title, credits: form.credits, division_id: form.division_id || null });
      }
      setDialog(null);
      setForm(empty);
      load();
      setMsg({ type: 'success', text: 'Course saved' });
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error ?? 'Save failed' });
    } finally {
      setBusy(false);
    }
  };

  const del = async (c: Course) => {
    if (!window.confirm(`Delete course ${c.course_code}?`)) return;
    setBusy(true);
    try {
      await adminApi.deleteCourse(c.id);
      setMsg({ type: 'success', text: 'Course deleted' });
      load();
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error ?? 'Delete failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
          <p className="text-muted-foreground">Manage course catalog and assignments</p>
        </div>
        <Button onClick={() => { setForm(empty); setDialog({ mode: 'create' }); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Course
        </Button>
      </div>

      {msg && (
        <Alert variant={msg.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Course Catalog</CardTitle>
          <CardDescription>{rows.length} courses available</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Division</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No courses found
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-semibold">{c.course_code}</TableCell>
                    <TableCell>{c.title}</TableCell>
                    <TableCell>{c.credits}</TableCell>
                    <TableCell className="text-muted-foreground">{c.division_name || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => del(c)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(dialog)} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'create' ? 'Add New Course' : 'Edit Course'}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create' ? 'Create a new course in the catalog' : 'Update course details'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Course Code</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="CS101"
                disabled={dialog?.mode === 'edit'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Introduction to Computer Science"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="credits">Credits</Label>
              <Input
                id="credits"
                type="number"
                value={form.credits}
                onChange={(e) => setForm({ ...form, credits: parseInt(e.target.value) || 0 })}
                min="1"
                max="6"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="division">Division (Optional)</Label>
              <Select value={form.division_id} onValueChange={(v) => setForm({ ...form, division_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="No specific division" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific division</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.division_id} value={d.division_id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.code || !form.title}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}