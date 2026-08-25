import { useEffect, useState } from 'react';
import { adminApi, ApiKey } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Copy, Trash2, Key, Calendar, User } from 'lucide-react';

export default function ApiKeys() {
  const [rows, setRows] = useState<ApiKey[]>([]);
  const [dialog, setDialog] = useState(false);
  const [label, setLabel] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => adminApi.apiKeys().then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      const res = await adminApi.createApiKey(label);
      setNewKey(res.data.api_key);
      setMsg({ type: 'success', text: 'API key created. Copy it now - it will not be shown again.' });
      load();
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error ?? 'Create failed' });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (k: ApiKey) => {
    if (!window.confirm(`Revoke key "${k.label}"? Applications using this key will stop working.`)) return;
    setBusy(true);
    try {
      await adminApi.revokeApiKey(k.key_uuid);
      setMsg({ type: 'success', text: 'API key revoked' });
      load();
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error ?? 'Revoke failed' });
    } finally {
      setBusy(false);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setMsg({ type: 'success', text: 'API key copied to clipboard' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">Manage API access keys for applications</p>
        </div>
        <Button onClick={() => { setLabel(''); setNewKey(null); setDialog(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      {msg && (
        <Alert variant={msg.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}

      {newKey && (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="text-green-600 dark:text-green-400">New API Key Created</CardTitle>
            <CardDescription>Copy this key now. For security reasons, it will not be shown again.</CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle>Active API Keys</CardTitle>
          <CardDescription>{rows.length} keys configured</CardDescription>
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
                    <TableCell className="font-mono text-xs text-muted-foreground">{k.key_uuid}</TableCell>
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
                      <Button variant="ghost" size="icon" onClick={() => revoke(k)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
    </div>
  );
}