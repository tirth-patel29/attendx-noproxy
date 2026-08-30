import React, { useEffect, useState } from 'react';
import { academicApi, Department, College } from '../services/adminApi';
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

interface FormState { name: string; code: string; college_id: string; }
const empty: FormState = { name: '', code: '', college_id: '' };

export default function Departments() {
  const [rows, setRows] = useState<Department[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([academicApi.departments(), academicApi.colleges()])
      .then(([d, c]) => { setRows(d.data); setColleges(c.data); })
      .catch(() => toast.error('Failed to load departments'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openEdit = (d: Department) => {
    setForm({ name: d.name, code: d.code, college_id: d.college_id });
    setDialog({ mode: 'edit', id: d.id });
  };

  const save = async () => {
    if (!form.college_id) return toast.error("Please select a college");
    setBusy(true);
    try {
      if (dialog?.mode === 'create') {
        await academicApi.createDepartment({ ...form });
      } else if (dialog?.id) {
        await academicApi.updateDepartment(dialog.id, { ...form });
      }
      setDialog(null);
      setForm(empty);
      load();
      toast.success('Department saved successfully');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const del = async (d: Department) => {
    setBusy(true);
    try {
      await academicApi.deleteDepartment(d.id);
      toast.success('Department deleted');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed');
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  const columns: Column<Department>[] = [
    { key: "name", header: "Department Name", className: "font-medium" },
    { key: "code", header: "Code", render: (r) => (
      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
        {r.code}
      </span>
    )},
    { key: "college_name", header: "College", render: (r) => (
      <span className="text-muted-foreground">{r.college_name || '—'}</span>
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
        className="mx-auto max-w-5xl space-y-6"
      >
        <PageHeader
          title="Departments"
          subtitle={`${rows.length} departments configured`}
        />

        <motion.div variants={riseItem}>
          <GlassCard padded={false}>
            <div className="p-5">
              <DataTable
                data={rows}
                columns={columns}
                keyExtractor={(r) => r.id}
                searchPlaceholder="Search departments…"
                searchKeys={["name", "code", "college_name"]}
                pageSize={10}
                loading={loading}
                emptyTitle="No departments found"
                emptyDescription="Create one to get started."
                toolbar={
                  <Button onClick={() => { setForm(empty); setDialog({ mode: 'create' }); }} className="h-9 text-[13px] font-medium">
                    <Plus className="mr-1.5 size-4" /> Add Department
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
            <DialogTitle>{dialog?.mode === 'create' ? 'Add New Department' : 'Edit Department'}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create'
                ? 'Create a new department under a college'
                : 'Update department details'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="college" className="text-[12.5px] font-medium">College</Label>
              <Select value={form.college_id} onValueChange={(v) => setForm({ ...form, college_id: v })}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select College" />
                </SelectTrigger>
                <SelectContent>
                  {colleges.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FloatingInput
              id="name"
              label="Department Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Computer Engineering"
            />
            <FloatingInput
              id="code"
              label="Department Code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g., CE"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.name.trim() || !form.code.trim() || !form.college_id}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Delete department <strong className="text-foreground">{deleteTarget?.name}</strong>? 
              This will also delete all associated branches, divisions, and batches.
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
