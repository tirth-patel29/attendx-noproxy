import React, { useEffect, useState } from 'react';
import { academicApi, Branch } from '../services/adminApi';
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

interface FormState { name: string; level: number; branch_id: string; }
const empty: FormState = { name: '', level: 1, branch_id: '' };

export default function Semesters() {
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([academicApi.semesters(), academicApi.branches()])
      .then(([s, b]) => { setRows(s.data); setBranches(b.data); })
      .catch(() => toast.error('Failed to load semesters'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openEdit = (s: any) => {
    setForm({ name: s.name, level: s.level, branch_id: s.branch_id });
    setDialog({ mode: 'edit', id: b.id });
  };

  const save = async () => {
    if (!form.branch_id) return toast.error("Please select a branch");
    setBusy(true);
    try {
      if (dialog?.mode === 'create') {
        await academicApi.createSemester({ ...form });
      } else if (dialog?.id) {
        await academicApi.updateSemester(dialog.id, { ...form });
      }
      setDialog(null);
      setForm(empty);
      load();
      toast.success('Semester saved successfully');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const del = async (s: any) => {
    setBusy(true);
    try {
      await academicApi.deleteSemester(s.id);
      toast.success('Semester deleted');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed');
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  const columns: Column<any>[] = [
    { key: "name", header: "Semester Name", className: "font-medium" },
    { key: "level", header: "Level", render: (r) => (
      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
        {r.level}
      </span>
    )},
    { key: "branch_name", header: "Branch", render: (r) => (
      <span className="text-muted-foreground">{r.branch_name || '—'}</span>
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
          title="Semesters"
          subtitle={`${rows.length} semesters configured`}
        />

        <motion.div variants={riseItem}>
          <GlassCard padded={false}>
            <div className="p-5">
              <DataTable
                data={rows}
                columns={columns}
                keyExtractor={(r) => r.id}
                searchPlaceholder="Search semesters…"
                searchKeys={["name", "level", "branch_name", "department_name", "college_name"]}
                pageSize={10}
                loading={loading}
                emptyTitle="No semesters found"
                emptyDescription="Create one to get started."
                toolbar={
                  <Button onClick={() => { setForm(empty); setDialog({ mode: 'create' }); }} className="h-9 text-[13px] font-medium">
                    <Plus className="mr-1.5 size-4" /> Add Semester
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
            <DialogTitle>{dialog?.mode === 'create' ? 'Add New Semester' : 'Edit Semester'}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create'
                ? 'Create a new semester under a branch'
                : 'Update semester details'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branch" className="text-[12.5px] font-medium">Branch</Label>
              <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.college_name} - {b.department_name} - {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FloatingInput
              id="name"
              label="Semester Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Semester 5"
            />
            <FloatingInput
              id="level"
              type="number"
              label="Level"
              value={String(form.level)}
              onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) || 1 })}
              placeholder="e.g., 5"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.name.trim() || !form.branch_id}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Semester</AlertDialogTitle>
            <AlertDialogDescription>
              Delete semester <strong className="text-foreground">{deleteTarget?.name}</strong>? 
              This will also delete all associated divisions and batches.
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
