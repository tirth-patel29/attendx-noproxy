import { useEffect, useState } from 'react';
import { adminApi, Division } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Pencil, Trash2, Users, BookOpen } from 'lucide-react';

export default function Divisions() {
  const [rows, setRows] = useState<Division[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => adminApi.divisions().then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    try {
      if (dialog?.mode === 'create') await adminApi.createDivision(name);
      else if (dialog?.id) await adminApi.updateDivision(dialog.id, name);
      setDialog(null);
      setName('');
      load();
      setMsg({ type: 'success', text: 'Division saved successfully' });
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error ?? 'Save failed' });
    } finally {
      setBusy(false);
    }
  };

  const del = async (d: Division) => {
    if (!window.confirm(`Delete division ${d.name}? This will affect ${d.student_count} students.`)) return;
    setBusy(true);
    try {
      await adminApi.deleteDivision(d.id);
      setMsg({ type: 'success', text: 'Division deleted' });
      load();
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error ?? 'Delete failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Divisions</h1>
          <p className="text-muted-foreground">Organize students into divisions/classes</p>
        </div>
        <Button onClick={() => { setName(''); setDialog({ mode: 'create' }); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Division
        </Button>
      </div>

      {msg && (
        <Alert variant={msg.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Division Directory</CardTitle>
          <CardDescription>{rows.length} divisions configured</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Students</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No divisions found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-semibold">{d.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <BookOpen className="h-3 w-3" />
                        {d.course_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {d.student_count}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setName(d.name); setDialog({ mode: 'edit', id: d.id }); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => del(d)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
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

      <Dialog open={Boolean(dialog)} onOpenChange={() => setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'create' ? 'Add New Division' : 'Edit Division'}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create'
                ? 'Create a new division to organize students'
                : 'Update division name'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="divname">Division Name</Label>
              <Input
                id="divname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., CS-A, ECE-B"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !name.trim()}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}