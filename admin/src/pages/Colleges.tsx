import React, { useEffect, useState } from 'react';
import { academicApi, College } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FloatingInput } from '@/components/ui/floating-input';
import { InlineDisclosureMenu } from '@/components/ui/inline-disclosure-menu';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/attendx/PageHeader';
import { GlassCard } from '@/components/attendx/GlassCard';
import { DataTable, type Column } from '@/components/attendx/DataTable';
import { staggerContainer, riseItem } from '@/lib/motion';

export default function Colleges() {
  const [rows, setRows] = useState<College[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<College | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    academicApi.colleges().then((r) => setRows(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    try {
      if (dialog?.mode === 'create') await academicApi.createCollege({ name, code });
      else if (dialog?.id) await academicApi.updateCollege(dialog.id, { name, code });
      setDialog(null);
      setName('');
      setCode('');
      load();
      toast.success('College saved successfully');
    } catch (e: any) {
      const errBody = e?.response?.data?.error;
      const msg = errBody?.details?.dev_message || errBody?.message || 'Save failed';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const del = async (c: College) => {
    setBusy(true);
    try {
      await academicApi.deleteCollege(c.id);
      toast.success('College deleted');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed');
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  const columns: Column<College>[] = [
    { key: "name", header: "College Name", className: "font-medium" },
    { key: "code", header: "Code", render: (r) => (
      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
        {r.code}
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
            onClick: () => { 
              setName(r.name); 
              setCode(r.code);
              setDialog({ mode: 'edit', id: r.id }); 
            }
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
          title="Colleges"
          subtitle={`${rows.length} colleges configured`}
        />

        <motion.div variants={riseItem}>
          <GlassCard padded={false}>
            <div className="p-5">
              <DataTable
                data={rows}
                columns={columns}
                keyExtractor={(r) => r.id}
                searchPlaceholder="Search colleges…"
                searchKeys={["name", "code"]}
                pageSize={10}
                loading={loading}
                emptyTitle="No colleges found"
                emptyDescription="Create one to get started."
                toolbar={
                  <Button onClick={() => { setName(''); setCode(''); setDialog({ mode: 'create' }); }} className="h-9 text-[13px] font-medium">
                    <Plus className="mr-1.5 size-4" /> Add College
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
            <DialogTitle>{dialog?.mode === 'create' ? 'Add New College' : 'Edit College'}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create'
                ? 'Create a new college (e.g. DEPSTAR)'
                : 'Update college details'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FloatingInput
              id="name"
              label="College Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Devang Patel Institute"
              autoFocus
            />
            <FloatingInput
              id="code"
              label="College Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g., D"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !name.trim() || !code.trim()}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete College</AlertDialogTitle>
            <AlertDialogDescription>
              Delete college <strong className="text-foreground">{deleteTarget?.name}</strong>? 
              This will also delete all associated departments, branches, divisions, and batches.
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
