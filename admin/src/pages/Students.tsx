import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { adminApi, academicApi, Student, Division } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FloatingInput } from '@/components/ui/floating-input';
import { InlineDisclosureMenu } from '@/components/ui/inline-disclosure-menu';
import { Plus, Pencil, Trash2, Smartphone, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/attendx/PageHeader';
import { GlassCard } from '@/components/attendx/GlassCard';
import { DataTable, type Column } from '@/components/attendx/DataTable';
import { staggerContainer, riseItem } from '@/lib/motion';

interface FormState { roll_no: string; email: string; name: string; division_id: string; }
const empty: FormState = { roll_no: '', email: '', name: '', division_id: '' };

export default function Students() {
  const [rows, setRows] = useState<Student[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([adminApi.students(), academicApi.divisions()])
      .then(([s, d]) => { setRows(s.data); setDivisions(d.data); })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(empty); setDialog({ mode: 'create' }); };
  const openEdit = (s: Student) => {
    setForm({ roll_no: s.roll_no, email: s.email, name: s.name, division_id: s.division_id || '' });
    setDialog({ mode: 'edit', id: s.id });
  };

  const save = async () => {
    setBusy(true);
    try {
      if (dialog?.mode === 'create') {
        await adminApi.createStudent(form);
        toast.success(`Student ${form.name} created`);
      } else if (dialog?.id) {
        await adminApi.updateStudent(dialog.id, form);
        toast.success('Student updated');
      }
      setDialog(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi.deleteStudent(deleteTarget.id);
      toast.success('Student deleted');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const doResetDevice = async (s: Student) => {
    setBusy(true);
    try {
      await adminApi.resetDevice(s.id);
      toast.success(`Device reset for ${s.name}`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Reset device failed');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Student>[] = [
    { key: "roll_no", header: "Roll No", className: "font-mono text-[12px] font-medium" },
    { key: "name", header: "Student", render: (r) => (
      <div className="flex items-center gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-[12px] font-semibold text-accent-foreground">
          {r.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <div>
          <p className="font-medium">{r.name}</p>
          <a href={`mailto:${r.email}`} className="text-[11.5px] text-muted-foreground hover:text-foreground">
            {r.email}
          </a>
        </div>
      </div>
    )},
    { key: "academic_hierarchy", header: "Academic Program", render: (r) => (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {r.college_name && (
            <span className="inline-flex items-center rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-600 ring-1 ring-inset ring-purple-500/20">
              {r.college_name}
            </span>
          )}
          {r.department_name && (
            <span className="inline-flex items-center rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 ring-1 ring-inset ring-blue-500/20">
              {r.department_name}
            </span>
          )}
          {r.branch_name && (
            <span className="inline-flex items-center rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 ring-1 ring-inset ring-indigo-500/20">
              {r.branch_name}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
            Div: {r.division_name || r.division_id || '—'}
          </span>
          <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
            Batch: {r.batch_name || '—'}
          </span>
        </div>
      </div>
    )},
    { key: "bound_device_id", header: "Device", render: (r) => (
      r.bound_device_id ? (
        <div className="flex items-center gap-1.5 text-[12.5px] text-success">
          <Smartphone className="size-3.5" /> Bound
        </div>
      ) : (
        <span className="text-[12.5px] text-muted-foreground">Unbound</span>
      )
    )},
    { key: "actions", header: "", className: "text-right w-[60px]", render: (r) => (
      <InlineDisclosureMenu
        trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Actions">...</Button>}
        items={[
          {
            key: 'edit',
            label: 'Edit Student',
            icon: Pencil,
            onClick: () => openEdit(r)
          },
          {
            key: 'reset',
            label: 'Reset Device',
            icon: RefreshCw,
            onClick: () => doResetDevice(r),
            disabled: !r.bound_device_id
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
          title="Students"
          subtitle={`${rows.length} enrolled students.`}
        />

        <motion.div variants={riseItem}>
          <GlassCard padded={false}>
            <div className="p-5">
              <DataTable
                data={rows}
                columns={columns}
                keyExtractor={(r) => r.id}
                searchPlaceholder="Search by name, email, or roll no…"
                searchKeys={["name", "email", "roll_no", "division_name"]}
                pageSize={10}
                loading={loading}
                emptyTitle="No students found"
                emptyDescription="Add a student to get started."
                toolbar={
                  <Button onClick={openCreate} className="h-9 text-[13px] font-medium" id="add-student-btn">
                    <Plus className="mr-1.5 size-4" /> Add Student
                  </Button>
                }
              />
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>

      {/* Dialog for Create/Edit */}
      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'create' ? 'Add Student' : 'Edit Student'}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create' ? 'Register a new student.' : 'Update student details.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <FloatingInput
              id="roll_no" label="Roll Number" value={form.roll_no}
              onChange={(e) => setForm({ ...form, roll_no: e.target.value })}
            />
            <FloatingInput
              id="name" label="Full Name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <FloatingInput
              id="email" label="Email Address" type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none flex items-center justify-between">
                Division (Optional)
                <span className="text-[10px] text-muted-foreground font-normal">Auto-resolved if left blank</span>
              </label>
              <select
                className="flex h-12 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={form.division_id}
                onChange={(e) => setForm({ ...form, division_id: e.target.value })}
              >
                <option value="">-- Auto Resolve --</option>
                {divisions.map((d) => (
                  <option key={d.id || d.division_id!} value={d.id || d.division_id!}>{d.branch_name ? `${d.branch_name} - ` : ''}{d.semester_name ? `${d.semester_name} - ` : ''}{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.name || !form.roll_no}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget?.name} and remove their data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
