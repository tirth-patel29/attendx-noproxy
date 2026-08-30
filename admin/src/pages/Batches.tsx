import React, { useEffect, useState } from 'react';
import { academicApi, Batch, Division } from '../services/adminApi';
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

interface FormState { name: string; code: string; division_id: string; start_roll: string; end_roll: string; }
const empty: FormState = { name: '', code: '', division_id: '', start_roll: '', end_roll: '' };

export default function Batches() {
  const [rows, setRows] = useState<Batch[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [deleteTarget, setDeleteTarget] = useState<Batch | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([academicApi.batches(), academicApi.divisions()])
      .then(([b, d]) => { setRows(b.data); setDivisions(d.data); })
      .catch(() => toast.error('Failed to load batches'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openEdit = (b: Batch) => {
    setForm({ 
      name: b.name, 
      code: b.code || '', 
      division_id: b.division_id,
      start_roll: b.start_roll || '',
      end_roll: b.end_roll || ''
    });
    setDialog({ mode: 'edit', id: b.id });
  };

  const save = async () => {
    if (!form.division_id) return toast.error("Please select a division");
    setBusy(true);
    try {
      if (dialog?.mode === 'create') {
        await academicApi.createBatch({ ...form });
      } else if (dialog?.id) {
        await academicApi.updateBatch(dialog.id, { ...form });
      }
      setDialog(null);
      setForm(empty);
      load();
      toast.success('Batch saved successfully');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const del = async (b: Batch) => {
    setBusy(true);
    try {
      await academicApi.deleteBatch(b.id);
      toast.success('Batch deleted');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed');
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  const columns: Column<Batch>[] = [
    { key: "name", header: "Batch Name", className: "font-medium" },
    { key: "code", header: "Code", render: (r) => (
      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
        {r.code || '—'}
      </span>
    )},
    { key: "division_name", header: "Division", render: (r) => (
      <span className="text-muted-foreground">{r.division_name || '—'}</span>
    )},
    { key: "branch_name", header: "Branch", render: (r) => (
      <span className="text-muted-foreground">{r.branch_name || '—'}</span>
    )},
    { key: "roll_range", header: "Roll Range", render: (r) => (
      <span className="text-[12px] font-mono text-muted-foreground">
        {r.start_roll || '*'} – {r.end_roll || '*'}
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
          title="Batches"
          subtitle={`${rows.length} batches configured`}
        />

        <motion.div variants={riseItem}>
          <GlassCard padded={false}>
            <div className="p-5">
              <DataTable
                data={rows}
                columns={columns}
                keyExtractor={(r) => r.id}
                searchPlaceholder="Search batches…"
                searchKeys={["name", "code", "division_name", "branch_name"]}
                pageSize={10}
                loading={loading}
                emptyTitle="No batches found"
                emptyDescription="Create one to get started."
                toolbar={
                  <Button onClick={() => { setForm(empty); setDialog({ mode: 'create' }); }} className="h-9 text-[13px] font-medium">
                    <Plus className="mr-1.5 size-4" /> Add Batch
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
            <DialogTitle>{dialog?.mode === 'create' ? 'Add New Batch' : 'Edit Batch'}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create'
                ? 'Create a new practical/tutorial batch'
                : 'Update batch details'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="division" className="text-[12.5px] font-medium">Division</Label>
              <Select value={form.division_id} onValueChange={(v) => setForm({ ...form, division_id: v })}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select Division" />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map((d) => (
                    <SelectItem key={d.id || d.division_id!} value={d.id || d.division_id!}>
                      {d.branch_name} - {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FloatingInput
              id="name"
              label="Batch Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., B1"
            />
            <div className="grid grid-cols-2 gap-4">
              <FloatingInput
                id="start_roll"
                label="Start Roll"
                value={form.start_roll}
                onChange={(e) => setForm({ ...form, start_roll: e.target.value })}
                placeholder="e.g., 24DCE001"
              />
              <FloatingInput
                id="end_roll"
                label="End Roll"
                value={form.end_roll}
                onChange={(e) => setForm({ ...form, end_roll: e.target.value })}
                placeholder="e.g., 24DCE070"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.name.trim() || !form.division_id}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch</AlertDialogTitle>
            <AlertDialogDescription>
              Delete batch <strong className="text-foreground">{deleteTarget?.name}</strong>? 
              This will untie any students associated with this batch.
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
