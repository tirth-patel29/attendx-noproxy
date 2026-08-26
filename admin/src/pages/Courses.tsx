import { useEffect, useState } from 'react';
import { adminApi, Course, Division } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FloatingInput } from '@/components/ui/floating-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineDisclosureMenu } from '@/components/ui/inline-disclosure-menu';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface FormState { code: string; title: string; credits: number; division_id: string; }
const empty: FormState = { code: '', title: '', credits: 3, division_id: '' };

export default function Courses() {
  const [rows, setRows] = useState<Course[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
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
      toast.success('Course saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const del = async (c: Course) => {
    setBusy(true);
    try {
      await adminApi.deleteCourse(c.id);
      toast.success('Course deleted');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Delete failed');
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
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
                <AnimatePresence>
                  {rows.map((c, index) => (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    >
                      <TableCell className="font-mono font-semibold">{c.course_code}</TableCell>
                      <TableCell>{c.title}</TableCell>
                      <TableCell>{c.credits}</TableCell>
                      <TableCell className="text-muted-foreground">{c.division_name || '—'}</TableCell>
                      <TableCell className="text-right">
                        <InlineDisclosureMenu
                          menuItems={[
                            {
                              icon: <Pencil className="h-5 w-5" />,
                              label: 'Edit',
                              onClick: () => openEdit(c),
                            },
                          ]}
                          showDelete
                          onDelete={() => setDeleteTarget(c)}
                        />
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
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
            <FloatingInput
              label="Course Code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="CS101"
              disabled={dialog?.mode === 'edit'}
            />
            <FloatingInput
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Introduction to Computer Science"
            />
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course</AlertDialogTitle>
            <AlertDialogDescription>
              Delete course <strong>{deleteTarget?.course_code}</strong> — {deleteTarget?.title}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && del(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
