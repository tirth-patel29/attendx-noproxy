import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
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
import { FloatingInput } from '@/components/ui/floating-input';
import { InlineDisclosureMenu, MenuItemProps } from '@/components/ui/inline-disclosure-menu';
import { Plus, Pencil, KeyRound, Trash2, Mail, Building2, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface FormState { email: string; name: string; department: string; password: string; }
const empty: FormState = { email: '', name: '', department: '', password: '' };

export default function Teachers() {
  const [rows, setRows] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [pwDialog, setPwDialog] = useState<{ id: string; name: string } | null>(null);
  const [pw, setPw] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.teachers()
      .then((r) => setRows(r.data))
      .catch(() => toast.error('Failed to load teachers'))
      .finally(() => setLoading(false));
  };
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
        toast.success(`Teacher ${form.name} created successfully`);
      } else if (dialog?.id) {
        await adminApi.updateTeacher(dialog.id, { email: form.email, name: form.name, department: form.department });
        toast.success('Teacher updated successfully');
      }
      setDialog(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const doResetPw = async () => {
    if (!pwDialog) return;
    setBusy(true);
    try {
      await adminApi.resetTeacherPassword(pwDialog.id, pw);
      toast.success('Password reset successfully');
      setPwDialog(null);
      setPw('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi.deleteTeacher(deleteTarget.id);
      toast.success('Teacher deleted successfully');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const getMenuItems = (t: Teacher): MenuItemProps[] => [
    {
      icon: <Pencil className="h-5 w-5" />,
      label: 'Edit',
      onClick: () => openEdit(t),
    },
    {
      icon: <KeyRound className="h-5 w-5" />,
      label: 'Reset Password',
      onClick: () => { setPw(''); setPwDialog({ id: t.id, name: t.name }); },
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teachers</h1>
          <p className="text-muted-foreground">Manage faculty members and their access</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Teacher
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Faculty Directory</CardTitle>
          <CardDescription>{rows.length} teachers registered</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
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
                  <AnimatePresence initial={false}>
                    {rows.map((t, index) => (
                      <motion.tr
                        key={t.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
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
                            t.has_login
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {t.has_login ? 'Active' : 'Pending'}
                          </span>
                        </TableCell>
                        <TableCell>{t.assignment_count ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <InlineDisclosureMenu
                            menuItems={getMenuItems(t)}
                            showDelete={true}
                            onDelete={() => setDeleteTarget(t)}
                          />
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </TableBody>
            </Table>
          )}
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
          <div className="space-y-5 py-4">
            <FloatingInput
              label="Full Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder=" "
            />
            <FloatingInput
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder=" "
            />
            <FloatingInput
              label="Department"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder=" "
            />
            {dialog?.mode === 'create' && (
              <FloatingInput
                label="Initial Password (min 8 chars)"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder=" "
              />
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
          <div className="space-y-5 py-4">
            <FloatingInput
              label="New Password (min 8 chars)"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder=" "
              autoFocus
            />
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

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove their sessions and assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={doDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
