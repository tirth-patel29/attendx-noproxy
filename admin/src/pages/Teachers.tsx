import { useEffect, useState } from 'react';
import { adminApi, Teacher } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Pencil, Trash2, KeyRound, Mail, Building2, User } from 'lucide-react';

interface FormState { email: string; name: string; department: string; password: string; }
const empty: FormState = { email: '', name: '', department: '', password: '' };

export default function Teachers() {
  const [rows, setRows] = useState<Teacher[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [pwDialog, setPwDialog] = useState<{ id: string; name: string } | null>(null);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => adminApi.teachers().then((r) => setRows(r.data)).catch(() => setMsg({ type: 'error', text: 'Failed to load teachers' }));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(empty); setDialog({ mode: 'create' }); };
  const openEdit = (t: Teacher) => {
    setForm({ email: t.email, name: t.name, department: t.department, password: '' });
    setDialog({ mode: 'edit', id: t.id });
  };

  const save = async () => {
    setBusy(true);
    try {
      if (dialog?.mode === 'create') {
        await adminApi.createTeacher(form);
        setMsg({ type: 'success', text: `Teacher ${form.name} created successfully` });
      } else if (dialog?.id) {
        await adminApi.updateTeacher(dialog.id, { email: form.email, name: form.name, department: form.department });
        setMsg({ type: 'success', text: 'Teacher updated successfully' });
      }
      setDialog(null);
      load();
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.error?.message ?? 'Save failed' });
    } finally {
      setBusy(false);
    }
  };

  const doResetPw = async () => {
    if (!pwDialog) return;
    setBusy(true);
    try {
      await adminApi.resetTeacherPassword(pwDialog.id, pw);
      setMsg({ type: 'success', text: 'Password reset successfully' });
      setPwDialog(null);
      setPw('');
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.error?.message ?? 'Reset failed' });
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (t: Teacher) => {
    if (!window.confirm(`Delete teacher ${t.name}? This will remove their sessions/assignments.`)) return;
    setBusy(true);
    try {
      await adminApi.deleteTeacher(t.id);
      setMsg({ type: 'success', text: 'Teacher deleted successfully' });
      load();
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.error?.message ?? 'Delete failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teachers</h1>
          <p className="text-muted-foreground">Manage faculty members and their access</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Teacher
        </Button>
      </div>

      {msg && (
        <Alert variant={msg.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Faculty Directory</CardTitle>
          <CardDescription>{rows.length} teachers registered</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignments</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No teachers found. Add one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                          {t.name[0]?.toUpperCase()}
                        </div>
                        {t.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {t.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {t.department}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        t.has_password
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {t.has_password ? 'Active' : 'Pending'}
                      </span>
                    </TableCell>
                    <TableCell>{t.assignment_count ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPwDialog({ id: t.id, name: t.name })}
                          title="Reset password"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => doDelete(t)}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
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

      {/* Create/Edit Dialog */}
      <Dialog open={Boolean(dialog)} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === 'create' ? 'Add New Teacher' : 'Edit Teacher'}
            </DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create'
                ? 'Create a new teacher account. They will receive login credentials.'
                : 'Update teacher information. Password is not required for updates.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Dr. John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="john.smith@college.edu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="Computer Science"
              />
            </div>
            {dialog?.mode === 'create' && (
              <div className="space-y-2">
                <Label htmlFor="password">Initial Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? 'Saving...' : dialog?.mode === 'create' ? 'Create Teacher' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={Boolean(pwDialog)} onOpenChange={() => setPwDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for {pwDialog?.name}. They will need to use this new password for their next login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newpw">New Password</Label>
              <Input
                id="newpw"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Minimum 8 characters"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialog(null)}>
              Cancel
            </Button>
            <Button onClick={doResetPw} disabled={busy || pw.length < 8}>
              {busy ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}