import React, { useEffect, useState } from 'react';
import { adminApi, academicApi, Course, Division } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FloatingInput } from '@/components/ui/floating-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineDisclosureMenu } from '@/components/ui/inline-disclosure-menu';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/attendx/PageHeader';
import { GlassCard } from '@/components/attendx/GlassCard';
import { DataTable, type Column } from '@/components/attendx/DataTable';
import { staggerContainer, riseItem } from '@/lib/motion';

interface FormState { code: string; title: string; division_id: string; }
const empty: FormState = { code: '', title: '', division_id: '' };

export default function Courses() {
  const [rows, setRows] = useState<Course[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([adminApi.courses(), academicApi.divisions()])
      .then(([c, d]) => { setRows(c.data); setDivisions(d.data); })
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openEdit = (c: Course) => {
    setForm({ code: c.course_code, title: c.title, division_id: c.division_id || '' });
    setDialog({ mode: 'edit', id: c.id });
  };

  const save = async () => {
    setBusy(true);
    try {
      if (dialog?.mode === 'create') {
        await adminApi.createCourse({ course_code: form.code, title: form.title, division_id: form.division_id || null });
      } else if (dialog?.id) {
        await adminApi.updateCourse(dialog.id, { course_code: form.code, title: form.title, division_id: form.division_id || null });
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

  const columns: Column<Course>[] = [
    { key: "course_code", header: "Code", className: "font-mono font-medium" },
    { key: "title", header: "Course Title" },
    { key: "division_name", header: "Division", render: (r) => (
      <span className="text-muted-foreground">{r.division_name || '—'}</span>
    )},
    { key: "actions", header: "", className: "text-right w-[60px]", render: (r) => (
      <InlineDisclosureMenu
        trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Actions">...</Button>}
        items={[
          {
            key: 'edit',
            label: 'Edit Course',
            icon: Pencil,
            onClick: () => openEdit(r)
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: Trash2,
            variant: 'danger',
            onClick: () => setDeleteTarget(r)
          }
        ]}
      />
    )}
  ];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-6xl space-y-6"
      >
        <PageHeader
          title="Courses"
          subtitle="Manage course catalog and subject assignments"
        />

        <motion.div variants={riseItem}>
          <GlassCard padded={false}>
            <div className="p-5">
              <DataTable
                data={rows}
                columns={columns}
                keyExtractor={(r) => r.id}
                searchPlaceholder="Search courses by code or title…"
                searchKeys={["course_code", "title"]}
                pageSize={10}
                loading={loading}
                emptyTitle="No courses found"
                emptyDescription="Add a course to get started."
                toolbar={
                  <Button onClick={() => { setForm(empty); setDialog({ mode: 'create' }); }} className="h-9 text-[13px] font-medium">
                    <Plus className="mr-1.5 size-4" /> Add Course
                  </Button>
                }
              />
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>

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
              id="code"
              label="Course Code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="CS101"
              disabled={dialog?.mode === 'edit'}
            />
            <FloatingInput
              id="title"
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Introduction to Computer Science"
            />
            <div className="space-y-2">
              <Label htmlFor="division" className="text-[12.5px] font-medium">Division (Optional)</Label>
              <Select value={form.division_id} onValueChange={(v) => setForm({ ...form, division_id: v })}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="No specific division" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific division</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
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
              Delete course <strong className="text-foreground">{deleteTarget?.course_code}</strong> — {deleteTarget?.title}?
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
    </div>
  );
}
