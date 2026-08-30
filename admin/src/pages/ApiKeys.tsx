import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { adminApi, ApiKey } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FloatingInput } from '@/components/ui/floating-input';
import { InlineDisclosureMenu } from '@/components/ui/inline-disclosure-menu';
import { Plus, Copy, Trash2, ShieldOff, Key } from 'lucide-react';
import { PageHeader } from '@/components/attendx/PageHeader';
import { GlassCard } from '@/components/attendx/GlassCard';
import { DataTable, type Column } from '@/components/attendx/DataTable';
import { staggerContainer, riseItem } from '@/lib/motion';

type ConfirmAction =
  | { type: 'revoke'; key: ApiKey }
  | { type: 'delete'; key: ApiKey }
  | null;

export default function ApiKeys() {
  const [rows, setRows] = useState<ApiKey[]>([]);
  const [dialog, setDialog] = useState(false);
  const [label, setLabel] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  const load = () => {
    setLoading(true);
    adminApi.apiKeys()
      .then((r) => setRows((r.data as any).keys ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      const res = await adminApi.createApiKey(label);
      setNewKey(res.data.api_key);
      setDialog(false);
      setLabel('');
      toast.success('API key created. Copy it now — it will not be shown again.');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed to create API key');
    } finally {
      setBusy(false);
    }
  };

  const executeRevoke = async () => {
    if (!confirm || confirm.type !== 'revoke') return;
    const k = confirm.key;
    setConfirm(null);
    setBusy(true);
    try {
      await adminApi.revokeApiKey(k.key_uuid);
      toast.success(`Key "${k.label}" revoked`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Revoke failed');
    } finally {
      setBusy(false);
    }
  };

  const executeDelete = async () => {
    if (!confirm || confirm.type !== 'delete') return;
    const k = confirm.key;
    setConfirm(null);
    setBusy(true);
    try {
      await adminApi.revokeApiKey(k.key_uuid);
      setRows((prev) => prev.filter((r) => r.key_uuid !== k.key_uuid));
      toast.success(`Key "${k.label}" deleted`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API key copied to clipboard');
  };

  const columns: Column<ApiKey>[] = [
    { key: "label", header: "Label", render: (r) => (
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{r.label}</span>
      </div>
    )},
    { key: "key_uuid", header: "Key ID", className: "font-mono text-xs text-muted-foreground" },
    { key: "created_at", header: "Created", render: (r) => (
      <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
    )},
    { key: "created_by", header: "Creator", className: "text-muted-foreground" },
    { key: "actions", header: "", className: "text-right w-[60px]", render: (r) => (
      <InlineDisclosureMenu
        trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Actions">...</Button>}
        items={[
          {
            key: 'revoke',
            label: 'Revoke Key',
            icon: ShieldOff,
            onClick: () => setConfirm({ type: 'revoke', key: r })
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: Trash2,
            variant: 'danger',
            onClick: () => setConfirm({ type: 'delete', key: r })
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
          title="API Keys"
          subtitle="Manage access keys for third-party integrations and internal apps"
        />

        {newKey && (
          <motion.div variants={riseItem}>
            <div className="rounded-xl border border-success/30 bg-success/10 p-4">
              <h3 className="text-[14px] font-semibold text-success mb-1">New API Key Created</h3>
              <p className="text-[12.5px] text-muted-foreground mb-3">Copy this key now. For security reasons, it will not be shown again.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-canvas px-3 py-2 text-[13px] font-mono border border-border overflow-x-auto">
                  {newKey}
                </code>
                <Button variant="outline" size="icon" onClick={() => copyKey(newKey)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div variants={riseItem}>
          <GlassCard padded={false}>
            <div className="p-5">
              <DataTable
                data={rows}
                columns={columns}
                keyExtractor={(r) => r.key_uuid}
                searchPlaceholder="Search keys by label…"
                searchKeys={["label", "key_uuid"]}
                pageSize={10}
                loading={loading}
                emptyTitle="No API keys"
                emptyDescription="Create one to allow application access."
                toolbar={
                  <Button onClick={() => { setLabel(''); setNewKey(null); setDialog(true); }} className="h-9 text-[13px] font-medium">
                    <Plus className="mr-1.5 size-4" /> Create API Key
                  </Button>
                }
              />
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for application access. The key will only be shown once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FloatingInput
              id="label"
              label="Key Label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && label.trim() && create()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy || !label.trim()}>
              {busy ? 'Creating...' : 'Create Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm?.type === 'revoke'} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Revoke <strong className="text-foreground">{confirm?.key?.label}</strong>? Applications using this key will lose access, but the record will remain visible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeRevoke}>Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm?.type === 'delete'} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Delete key <strong className="text-foreground">{confirm?.key?.label}</strong> permanently? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={executeDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
