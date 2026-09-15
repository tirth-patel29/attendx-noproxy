import React, { useEffect, useState } from 'react';
import { academicApi, Division, Branch } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FloatingInput } from '@/components/ui/floating-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { InlineDisclosureMenu } from '@/components/ui/inline-disclosure-menu';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/attendx/PageHeader';
import { GlassCard } from '@/components/attendx/GlassCard';
import { DataTable, type Column } from '@/components/attendx/DataTable';
import { staggerContainer, riseItem } from '@/lib/motion';

interface FormState { name: string; code: string; branch_id: string; semester_id: string; academic_year: string; }
const empty: FormState = { name: '', code: '', branch_id: '', semester_id: '', academic_year: '' };

export default function Divisions() {
  const [rows, setRows] = useState<Division[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [deleteTarget, setDeleteTarget] = useState<Division | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([academicApi.divisions(), academicApi.branches(), academicApi.semesters()])
      .then(([divs, brs, sems]) => { setRows(divs.data); setBranches(brs.data); setSemesters(sems.data); })
      .catch(() => toast.error('Failed to load divisions'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openEdit = (d: Division) => {
    setForm({ 
      name: d.name, 
      code: d.code || '', 
      branch_id: d.branch_id || '',
      semester_id: d.semester_id || '',
      academic_year: d.academic_year ? String(d.academic_year) : ''
    });
    setDialog({ mode: 'edit', id: d.id || d.division_id });
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Division name is required");
    
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        code: form.code || null,
        branch_id: form.branch_id && form.branch_id !== 'none' ? form.branch_id : null,
        semester_id: form.semester_id && form.semester_id !== 'none' ? form.semester_id : null,
        academic_year: form.academic_year ? parseInt(form.academic_year, 10) : null
      };

      if (dialog?.mode === 'create') {
        await academicApi.createDivision(payload);
      } else if (dialog?.id) {
        await academicApi.updateDivision(dialog.id, payload);
      }
      setDialog(null);
      setForm(empty);
      load();
      toast.success('Division saved successfully');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const del = async (d: Division) => {
    setBusy(true);
    try {
      await academicApi.deleteDivision(d.id || d.division_id!);
      toast.success('Division deleted');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed');
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  const columns: Column<Division>[] = [
    { key: "name", header: "Division Name", className: "font-medium" },
    { key: "code", header: "Code", render: (r) => (
      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
        {r.code || '—'}
      </span>
    )},
    { key: "branch_name", header: "Branch", render: (r) => (
      <span className="text-muted-foreground">{r.branch_name || '—'}</span>
    )},
    { key: "semester_name", header: "Semester", render: (r: any) => (
      <span className="text-muted-foreground">{r.semester_name || '—'}</span>
    )},
    { key: "academic_year", header: "Year", render: (r) => (
      <span className="text-muted-foreground">{r.academic_year || '—'}</span>
    )},
    { key: "course_count", header: "Courses", render: (r) => (
      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
        {r.course_count || 0} Courses
      </span>
    )},
    { key: "student_count", header: "Students", render: (r) => (
      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/20">
        {r.student_count || 0} Students
      </span>
    )},
    { key: "actions", header: "", className: "text-right w-[60px]", render: (r) => (
      <InlineDisclosureMenu
        trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Actions">...</Button>}
        items={[
          {
            key: 'edit',
            label: 'Edit',
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
          title="Divisions"
          subtitle={`${rows.length} divisions configured`}
        />

        <motion.div variants={riseItem}>
          <GlassCard padded={false}>
            <div className="p-5">
              <DataTable
                data={rows}
                columns={columns}
                keyExtractor={(r) => r.id || r.division_id!}
                searchPlaceholder="Search divisions…"
                searchKeys={["name", "code", "branch_name", "semester_name"]}
                pageSize={10}
                loading={loading}
                emptyTitle="No divisions found"
                emptyDescription="Create one to get started."
                toolbar={
                  <Button onClick={() => { setForm(empty); setDialog({ mode: 'create' }); }} className="h-9 text-[13px] font-medium">
                    <Plus className="mr-1.5 size-4" /> Add Division
                  </Button>
                }
              />
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>

      <Dialog open={Boolean(dialog)} onOpenChange={() => setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'create' ? 'Add New Division' : 'Edit Division'}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create'
                ? 'Create a new division to organize students and batches'
                : 'Update division details'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branch" className="text-[12.5px] font-medium">Branch (Optional)</Label>
              <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v, semester_id: 'none' })}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.department_name} - {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.branch_id && form.branch_id !== 'none' && (
              <div className="space-y-2">
                <Label htmlFor="semester" className="text-[12.5px] font-medium">Semester (Optional)</Label>
                <Select value={form.semester_id} onValueChange={(v) => setForm({ ...form, semester_id: v })}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select Semester" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {semesters.filter(s => s.branch_id === form.branch_id).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} (Level {s.level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <FloatingInput
              id="name"
              label="Division Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., CE-1"
            />
            <div className="grid grid-cols-2 gap-4">
              <FloatingInput
                id="code"
                label="Division Code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g., C1"
              />
              <FloatingInput
                id="academic_year"
                label="Academic Year"
                type="number"
                value={form.academic_year}
                onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                placeholder="e.g., 1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.name.trim()}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Division</AlertDialogTitle>
            <AlertDialogDescription>
              Delete division <strong className="text-foreground">{deleteTarget?.name}</strong>? This will affect{' '}
              {deleteTarget?.student_count || 0} student{(deleteTarget?.student_count || 0) !== 1 ? 's' : ''}.
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
