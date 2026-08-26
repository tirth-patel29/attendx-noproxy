import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { adminApi, Student, Division } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Plus, Pencil, Trash2, Smartphone, Search, RefreshCw, KeyRound } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';

interface FormState { roll_no: string; email: string; name: string; division_id: string; }
const empty: FormState = { roll_no: '', email: '', name: '', division_id: '' };

export default function Students() {
  const [rows, setRows] = useState<Student[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([adminApi.students(), adminApi.divisions()])
      .then(([s, d]) => { setRows(s.data); setDivisions(d.data); })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_no.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setForm(empty); setDialog({ mode: 'create' }); };
  const openEdit = (s: Student) => {
    setForm({ roll_no: s.roll_no, email: s.email, name: s.name, division_id: s.division_id || '' });
    setDialog({ mode: 'edit', id: s.id });
  };

  const save = async () => {
    setBusy(true);
    try {
      if (dialog?.mode === 'create') {
        await adminApi.createStudent(form);
        toast.success(`Student ${form.name} created`);
      } else if (dialog?.id) {
        await adminApi.updateStudent(dialog.id, form);
        toast.success('Student updated');
      }
      setDialog(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi.deleteStudent(deleteTarget.id);
      toast.success('Student deleted');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const doResetDevice = async (s: Student) => {
    setBusy(true);
    try {
      await adminApi.resetDevice(s.id);
      toast.success(`Device reset for ${s.name}`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Reset device failed');
    } finally {
      setBusy(false);
    }
  };

  const doRotateHmac = async (s: Student) => {
    setBusy(true);
    try {
      await adminApi.rotateHmac(s.id);
      toast.success(`HMAC key rotated for ${s.name}`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Rotate HMAC failed');
    } finally {
      setBusy(false);
    }
  };

  const doForgotPassword = async (s: Student) => {
    setBusy(true);
    try {
      await adminApi.forgotPassword(s.id);
      toast.success(`Password reset triggered for ${s.name}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Password reset failed');
    } finally {
      setBusy(false);
    }
  };

  const getMenuItems = (s: Student): MenuItemProps[] => [
    {
      icon: <Pencil className="h-5 w-5" />,
      label: 'Edit',
      onClick: () => openEdit(s),
    },
    {
      icon: <Smartphone className="h-5 w-5" />,
      label: 'Reset Device',
      onClick: () => doResetDevice(s),
    },
    {
      icon: <RefreshCw className="h-5 w-5" />,
      label: 'Rotate HMAC',
      onClick: () => doRotateHmac(s),
    },
    {
      icon: <KeyRound className="h-5 w-5" />,
      label: 'Reset Password',
      onClick: () => doForgotPassword(s),
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
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">Manage student registrations and device bindings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Student
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, email, or roll number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Directory</CardTitle>
          <CardDescription>
            {filtered.length} of {rows.length} students {search && '(filtered)'}
          </CardDescription>
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
                  <TableHead>Roll No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {search ? 'No students match your search' : 'No students found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  <AnimatePresence initial={false}>
                    {filtered.map((s, index) => (
                      <motion.tr
                        key={s.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="font-mono font-medium">{s.roll_no}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell className="text-muted-foreground">{s.email}</TableCell>
                        <TableCell>{s.division_name || '—'}</TableCell>
                        <TableCell>
                          {s.bound_device_id ? (
                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                              <Smartphone className="h-3 w-3" />
                              Bound
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Not bound</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <InlineDisclosureMenu
                            menuItems={getMenuItems(s)}
                            showDelete={true}
                            onDelete={() => setDeleteTarget(s)}
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
            <DialogTitle>{dialog?.mode === 'create' ? 'Add New Student' : 'Edit Student'}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create' ? 'Register a new student account' : 'Update student information'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <FloatingInput
              label="Roll Number"
              value={form.roll_no}
              onChange={(e) => setForm({ ...form, roll_no: e.target.value })}
              placeholder=" "
            />
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
            <div className="space-y-2">
              <Label htmlFor="division">Division</Label>
              <select
                id="division"
                value={form.division_id}
                onChange={(e) => setForm({ ...form, division_id: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">No division</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove their attendance records. This action cannot be undone.
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
