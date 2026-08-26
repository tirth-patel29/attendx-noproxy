import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { adminApi, Assignment, Teacher, Course, Division, dayName } from '../services/adminApi';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FloatingInput } from '@/components/ui/floating-input';
import { InlineDisclosureMenu, MenuItemProps } from '@/components/ui/inline-disclosure-menu';
import { HugeiconsIcon } from '@hugeicons/react';
import { PencilEdit02Icon } from '@hugeicons/core-free-icons';
import { Plus, Calendar, Clock, Pencil } from 'lucide-react';

const empty = {
  prof_uuid: '',
  course_code: '',
  division_id: '',
  day_of_week: 1,
  start_time: '09:00',
  end_time: '10:00',
};

export default function Assignments() {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [divs, setDivs] = useState<Division[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState(empty);
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    adminApi.assignments().then((r) => setRows(r.data)).catch(() => {});
    adminApi.teachers().then((r) => setTeachers(r.data)).catch(() => {});
    adminApi.courses().then((r) => setCourses(r.data)).catch(() => {});
    adminApi.divisions().then((r) => setDivs(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  // Default to the first teacher for convenience (timetable is teacher-wise)
  useEffect(() => {
    if (!teacherId && teachers.length > 0) setTeacherId(teachers[0].id);
  }, [teachers]);

  const mine = teacherId ? rows.filter((a) => a.prof_uuid === teacherId) : rows;
  const selectedTeacher = teachers.find((t) => t.id === teacherId);

  const save = async () => {
    setBusy(true);
    try {
      if (dialog?.mode === 'create') {
        await adminApi.createAssignment(form);
      } else if (dialog?.id) {
        await adminApi.updateAssignment(dialog.id, form);
      }
      setDialog(null);
      load();
      toast.success('Saved successfully');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const del = async (a: Assignment) => {
    setBusy(true);
    try {
      await adminApi.deleteAssignment(a.id);
      setDeleteTarget(null);
      load();
      toast.success('Lecture removed');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (a: Assignment) => {
    setForm({
      prof_uuid: a.prof_uuid,
      course_code: a.course_code,
      division_id: a.division_id,
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
    });
    setDialog({ mode: 'edit', id: a.id });
  };

  const buildMenuItems = (a: Assignment): MenuItemProps[] => [
    {
      icon: <HugeiconsIcon icon={PencilEdit02Icon} size={24} />,
      label: 'Edit',
      onClick: () => openEdit(a),
    },
  ];

  const isWeekend = (day: number) => day === 0 || day === 6;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Timetable</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage teacher lecture schedules</p>
      </div>

      {/* Teacher selector bar */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Teacher:</span>
            </div>

            <div className="flex-1 min-w-[260px]">
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a teacher…" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} — {t.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              disabled={!teacherId}
              onClick={() => {
                setForm({ ...empty, prof_uuid: teacherId });
                setDialog({ mode: 'create' });
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Lecture
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Timetable is managed <strong>per teacher</strong> — the teacher portal surfaces
            today&apos;s lectures automatically.
          </p>
        </CardContent>
      </Card>

      {/* Schedule table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Schedule
          </CardTitle>
          {selectedTeacher && (
            <CardDescription>
              Showing lectures for {selectedTeacher.name}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Division</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mine.map((a, index) => (
                <motion.tr
                  key={a.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  <TableCell>
                    <Badge variant={isWeekend(a.day_of_week) ? 'secondary' : 'outline'}>
                      {dayName(a.day_of_week)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {a.start_time}–{a.end_time}
                  </TableCell>
                  <TableCell>{a.course_code} — {a.course_title}</TableCell>
                  <TableCell>{a.division_name}</TableCell>
                  <TableCell className="text-right">
                    <InlineDisclosureMenu
                      menuItems={buildMenuItems(a)}
                      showDelete
                      onDelete={() => setDeleteTarget(a)}
                    />
                  </TableCell>
                </motion.tr>
              ))}
              {mine.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {teachers.length === 0
                      ? 'No teachers yet. Add teachers first.'
                      : `No lectures assigned to ${selectedTeacher?.name ?? 'this teacher'} yet.`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={Boolean(dialog)} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === 'create' ? 'Add Lecture' : 'Edit Lecture'}
            </DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create'
                ? 'Schedule a new lecture for this teacher.'
                : 'Update the lecture details.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Teacher (read-only) */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Teacher</label>
              <div className="px-3 py-2 border rounded-lg bg-muted text-sm text-muted-foreground">
                {selectedTeacher
                  ? `${selectedTeacher.name} (${selectedTeacher.email})`
                  : '—'}
              </div>
            </div>

            {/* Course */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Course</label>
              <Select
                value={form.course_code}
                onValueChange={(v) => setForm({ ...form, course_code: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course…" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.course_code} value={c.course_code}>
                      {c.course_code} — {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Division */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Division</label>
              <Select
                value={form.division_id}
                onValueChange={(v) => setForm({ ...form, division_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select division…" />
                </SelectTrigger>
                <SelectContent>
                  {divs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Day of week</label>
              <Select
                value={String(form.day_of_week)}
                onValueChange={(v) => setForm({ ...form, day_of_week: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day…" />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {dayName(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-3">
              <FloatingInput
                label="Start time"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
              <FloatingInput
                label="End time"
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={busy || !form.course_code || !form.division_id || !teacherId}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lecture?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the{' '}
              <strong>{deleteTarget ? dayName(deleteTarget.day_of_week) : ''}</strong> lecture for{' '}
              <strong>{deleteTarget?.course_code}</strong> ({deleteTarget?.division_name}).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && del(deleteTarget)}
              disabled={busy}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
