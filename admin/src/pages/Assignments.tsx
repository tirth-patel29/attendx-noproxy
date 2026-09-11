import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { adminApi, academicApi, Assignment, Teacher, Course, Division, dayName } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FloatingInput } from '@/components/ui/floating-input';
import { InlineDisclosureMenu } from '@/components/ui/inline-disclosure-menu';
import { Plus, Calendar, Clock, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/attendx/PageHeader';
import { GlassCard } from '@/components/attendx/GlassCard';
import { DataTable, type Column } from '@/components/attendx/DataTable';
import { staggerContainer, riseItem } from '@/lib/motion';

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
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      adminApi.assignments(),
      adminApi.teachers(),
      adminApi.courses(),
      academicApi.divisions()
    ]).then(([a, t, c, d]) => {
      setRows(a.data);
      setTeachers(t.data);
      setCourses(c.data);
      setDivs(d.data);
    }).catch(() => toast.error('Failed to load timetable data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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

  const isWeekend = (day: number) => day === 0 || day === 6;

  const columns: Column<Assignment>[] = [
    { key: "day_of_week", header: "Day", render: (r) => (
      <Badge variant={isWeekend(r.day_of_week) ? 'secondary' : 'default'} className={!isWeekend(r.day_of_week) ? "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20" : ""}>
        {dayName(r.day_of_week)}
      </Badge>
    )},
    { key: "time", header: "Time", className: "font-mono font-medium", render: (r) => (
      <span>{r.start_time}–{r.end_time}</span>
    )},
    { key: "course_code", header: "Course", render: (r) => (
      <div>
        <div className="font-medium">{r.course_title}</div>
        <div className="text-[11.5px] text-muted-foreground">{r.course_code}</div>
      </div>
    )},
    { key: "division_name", header: "Division", render: (r) => (
      <span className="text-muted-foreground">{r.division_name || '—'}</span>
    )},
    { key: "actions", header: "", className: "text-right w-[60px]", render: (r) => (
      <InlineDisclosureMenu
        trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Actions">...</Button>}
        items={[
          {
            key: 'edit',
            label: 'Edit',
            icon: Pencil,
            onClick: () => openEdit(r)
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
        className="mx-auto max-w-6xl space-y-6"
      >
        <PageHeader
          title="Timetable"
          subtitle="Manage teacher lecture schedules and room allocations"
        />

        <motion.div variants={riseItem}>
          <GlassCard padded={false}>
            <div className="p-5 border-b border-border bg-canvas/30 rounded-t-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2 shrink-0">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-[13.5px]">Teacher:</span>
                </div>

                <div className="flex-1 max-w-[280px]">
                  <Select value={teacherId} onValueChange={setTeacherId}>
                    <SelectTrigger className="h-10 text-[13px]">
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
              </div>
            </div>
            <div className="p-5">
              <DataTable
                data={mine}
                columns={columns}
                keyExtractor={(r) => r.id}
                searchPlaceholder="Search timetable…"
                searchKeys={["course_code", "course_title", "division_name"]}
                pageSize={10}
                loading={loading}
                emptyTitle={teachers.length === 0 ? "No teachers yet" : "No lectures assigned"}
                emptyDescription={teachers.length === 0 ? "Add teachers first." : `No lectures for ${selectedTeacher?.name ?? 'this teacher'} yet.`}
                toolbar={
                  <Button
                    onClick={() => { setForm({ ...empty, prof_uuid: teacherId }); setDialog({ mode: 'create' }); }}
                    disabled={!teacherId}
                    className="h-9 text-[13px] font-medium"
                  >
                    <Plus className="mr-1.5 size-4" /> Add Lecture
                  </Button>
                }
              />
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>

      <Dialog open={Boolean(dialog)} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'create' ? 'Add Lecture' : 'Edit Lecture'}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create' ? 'Schedule a new lecture for this teacher.' : 'Update the lecture details.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-medium">Teacher</label>
              <div className="px-3 py-2.5 rounded-lg bg-secondary text-[13px] text-muted-foreground ring-1 ring-inset ring-border">
                {selectedTeacher ? `${selectedTeacher.name} (${selectedTeacher.email})` : '—'}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12.5px] font-medium">Course</label>
              <Select value={form.course_code} onValueChange={(v) => setForm({ ...form, course_code: v })}>
                <SelectTrigger className="h-11">
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

            <div className="space-y-1.5">
              <label className="text-[12.5px] font-medium">Division</label>
              <Select value={form.division_id} onValueChange={(v) => setForm({ ...form, division_id: v })}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select division…" />
                </SelectTrigger>
                <SelectContent>
                  {divs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12.5px] font-medium">Day of week</label>
              <Select value={String(form.day_of_week)} onValueChange={(v) => setForm({ ...form, day_of_week: Number(v) })}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select day…" />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <SelectItem key={d} value={String(d)}>{dayName(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-1">
              <FloatingInput
                label="Start time" type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
              <FloatingInput
                label="End time" type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.course_code || !form.division_id || !teacherId}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lecture?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the <strong className="text-foreground">{deleteTarget ? dayName(deleteTarget.day_of_week) : ''}</strong> lecture for <strong className="text-foreground">{deleteTarget?.course_code}</strong> ({deleteTarget?.division_name}).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && del(deleteTarget)} disabled={busy}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
