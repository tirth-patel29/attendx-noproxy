import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi, ApiKey } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Copy, Trash2, Key, Calendar, User, ShieldOff } from 'lucide-react';

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
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  const load = () =>
    adminApi.apiKeys().then((r) => setRows((r.data as any).keys ?? r.data)).catch(() => {});

  useEffect(() => { load(); }, []);

  // ── Create ──────────────────────────────────────────────────────────────────
  const create = async () => {
    setBusy(true);
    try {
      const res = await adminApi.createApiKey(label);
      setNewKey(res.data.api_key);
      setDialog(false);
      toast.success('API key created. Copy it now — it will not be shown again.');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed to create API key');
    } finally {
      setBusy(false);
    }
  };

  // ── Revoke ──────────────────────────────────────────────────────────────────
  const confirmRevoke = (k: ApiKey) => setConfirm({ type: 'revoke', key: k });

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

  // ── Delete (revoke + remove from state) ─────────────────────────────────────
  const confirmDelete = (k: ApiKey) => setConfirm({ type: 'delete', key: k });

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

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">Manage API access keys for applications</p>
        </div>
        <Button
          onClick={() => { setLabel(''); setNewKey(null); setDialog(true); }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      {/* ── New key banner ── */}
      {newKey && (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="text-green-600 dark:text-green-400">New API Key Created</CardTitle>
            <CardDescription>
              Copy this key now. For security reasons, it will not be shown again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                {newKey}
              </code>
              <Button size="icon" variant="outline" onClick={() => copyKey(newKey)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Keys table ── */}
      <Card>
        <CardHeader>
          <CardTitle>Active API Keys</CardTitle>
          <CardDescription>{rows.length} key{rows.length !== 1 ? 's' : ''} configured</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Key ID</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No API keys yet. Create one to allow application access.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((k) => (
                  <TableRow key={k.key_uuid}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{k.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {k.key_uuid}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(k.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        {k.created_by}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Revoke — disables the key but keeps the record visible */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmRevoke(k)}
                          disabled={busy}
                          title="Revoke key — disables access but keeps the record"
                        >
                          <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                          Revoke
                        </Button>

                        {/* Delete — revokes and removes from view entirely */}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => confirmDelete(k)}
                          disabled={busy}
                          title="Delete key — removes it permanently"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete
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

      {/* ── Create dialog ── */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for application access. The key will only be shown once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="label">Key Label</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Mobile App / Web Portal / Integration"
                onKeyDown={(e) => e.key === 'Enter' && label.trim() && create()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy || !label.trim()}>
              {busy ? 'Creating...' : 'Create Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke confirmation AlertDialog ── */}
      <AlertDialog
        open={confirm?.type === 'revoke'}
        onOpenChange={(open) => { if (!open) setConfirm(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Revoke "{confirm?.key.label}"? Applications using this key will lose access, but the
              record will remain visible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeRevoke}>Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete confirmation AlertDialog ── */}
      <AlertDialog
        open={confirm?.type === 'delete'}
        onOpenChange={(open) => { if (!open) setConfirm(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Delete key "{confirm?.key.label}" permanently? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
