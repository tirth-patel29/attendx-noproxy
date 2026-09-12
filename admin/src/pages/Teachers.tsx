import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { adminApi, academicApi, Teacher, Department } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FloatingInput } from '@/components/ui/floating-input';
import { InlineDisclosureMenu } from '@/components/ui/inline-disclosure-menu';
import { Plus, Pencil, KeyRound, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/attendx/PageHeader';
import { GlassCard } from '@/components/attendx/GlassCard';
import { DataTable, type Column } from '@/components/attendx/DataTable';
import { staggerContainer, riseItem } from '@/lib/motion';

interface FormState {
  email: string;
  name: string;
  department: string;
  department_id?: string;
  password: string;
}

const empty: FormState = { email: '', name: '', department: '', department_id: '', password: '' };

export default function Teachers() {
  const [rows, setRows] = useState<Teacher[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [pwDialog, setPwDialog] = useState<{ id: string; name: string } | null>(null);
  const [pw, setPw] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      adminApi.teachers(),
      academicApi.departments(),
    ])
      .then(([t, d]) => {
        setRows(t.data);
        setDepts(d.data);
      })
      .catch(() => toast.error('Failed to load teachers'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(empty); setDialog({ mode: 'create' }); };
  const openEdit = (t: Teacher) => {
    setForm({
      email: t.email,
      name: t.name,
      department: t.department,
      department_id: t.department_id || '',
      password: '',
    });
    setDialog({ mode: 'edit', id: t.id });
  };

  const save = async () => {
    setBusy(true);
    try {
      const selectedDept = depts.find((d) => d.id === form.department_id);
      const payload = {
        email: form.email,
        name: form.name,
        department: selectedDept ? selectedDept.name : form.department,
        department_id: form.department_id || null,
      };

      if (dialog?.mode === 'create') {
        await adminApi.createTeacher({ ...payload, password: form.password });
        toast.success(`Teacher ${form.name} created successfully`);
      } else if (dialog?.id) {
        await adminApi.updateTeacher(dialog.id, payload);
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

  const columns: Column<Teacher>[] = [
    { key: "name", header: "Teacher", render: (r) => (
      <div className="flex items-center gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-[12px] font-semibold text-accent-foreground">
          {r.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-[12px] text-muted-foreground">{r.email}</p>
        </div>
      </div>
    )},
    { key: "department", header: "Department", render: (r) => (
      <div>
        <span className="font-medium text-foreground">{r.department_name || r.department}</span>
        {r.college_name && (
          <span className="block text-[11px] text-muted-foreground">{r.college_name}</span>
        )}
      </div>
    )},
    { key: "assignment_count", header: "Lectures", render: (r) => (
      <span className="text-[12px] font-medium text-muted-foreground">{r.assignment_count} slots</span>
    )},
    { key: "has_login", header: "Access", render: (r) => (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        r.has_login
          ? 'bg-success/10 text-success border border-success/20'
          : 'bg-muted text-muted-foreground'
      }`}>
        {r.has_login ? 'Active Login' : 'No Password'}
      </span>
    )},
    { key: "actions", header: "", className: "text-right w-[60px]", render: (r) => (
      <InlineDisclosureMenu
        trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Actions">...</Button>}
        items={[
          {
            key: 'edit',
            label: 'Edit Teacher',
            icon: Pencil,
            onClick: () => openEdit(r)
          },
          {
            key: 'reset-pw',
            label: 'Reset Password',
            icon: KeyRound,
            onClick: () => { setPwDialog({ id: r.id, name: r.name }); setPw(''); }
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: Trash2,
            danger: true,
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
          title="Faculty Management"
          subtitle={`${rows.length} faculty members registered.`}
        />

        <motion.div variants={riseItem}>
          <GlassCard padded={false}>
            <div className="p-5">
              <DataTable
                data={rows}
                columns={columns}
                keyExtractor={(r) => r.id}
                searchPlaceholder="Search faculty by name, email, or department…"
                searchKeys={["name", "email", "department"]}
                pageSize={10}
                loading={loading}
                emptyTitle="No faculty found"
                emptyDescription="Add a teacher to get started."
                toolbar={
                  <Button onClick={openCreate} className="h-9 text-[13px] font-medium">
                    <Plus className="mr-1.5 size-4" /> Add Teacher
                  </Button>
                }
              />
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>

      {/* Dialog for Create/Edit */}
      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'create' ? 'Add Teacher' : 'Edit Teacher'}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create'
                ? 'Create a new teacher account and assign them to an academic department.'
                : 'Update teacher details and academic department.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FloatingInput
              id="name"
              label="Full Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
            <FloatingInput
              id="email"
              label="Email Address"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            {/* Department Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-medium">Academic Department</label>
              <Select
                value={form.department_id || 'NONE'}
                onValueChange={(v) => {
                  const d = depts.find((x) => x.id === v);
                  setForm({
                    ...form,
                    department_id: v === 'NONE' ? '' : v,
                    department: d ? d.name : form.department,
                  });
                }}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select department…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Select from configured departments…</SelectItem>
                  {depts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} {d.college_name ? `(${d.college_name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {dialog?.mode === 'create' && (
              <FloatingInput
                id="password"
                label="Initial Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.name || !form.email || (dialog?.mode === 'create' && form.password.length < 8)}>
              {dialog?.mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password reset dialog */}
      <Dialog open={!!pwDialog} onOpenChange={(v) => !v && setPwDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {pwDialog?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FloatingInput
              id="new-password"
              label="New Password"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialog(null)}>Cancel</Button>
            <Button onClick={doResetPw} disabled={busy || pw.length < 8}>
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Faculty Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.name}? This will remove all their timetable assignments and access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
