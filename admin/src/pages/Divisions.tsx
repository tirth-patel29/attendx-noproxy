import { useEffect, useState } from 'react';
import { adminApi, Division } from '../services/adminApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FloatingInput } from '@/components/ui/floating-input';
import { InlineDisclosureMenu } from '@/components/ui/inline-disclosure-menu';
import { Plus, Pencil, Users, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function Divisions() {
  const [rows, setRows] = useState<Division[]>([]);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [name, setName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Division | null>(null);
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
      toast.success('Division saved successfully');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const del = async (d: Division) => {
    setBusy(true);
    try {
      await adminApi.deleteDivision(d.id);
      toast.success('Division deleted');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Delete failed');
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
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
                <AnimatePresence>
                  {rows.map((d, index) => (
                    <motion.tr
                      key={d.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    >
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
                        <InlineDisclosureMenu
                          menuItems={[
                            {
                              icon: <Pencil className="h-5 w-5" />,
                              label: 'Edit',
                              onClick: () => { setName(d.name); setDialog({ mode: 'edit', id: d.id }); },
                            },
                          ]}
                          showDelete
                          onDelete={() => setDeleteTarget(d)}
                        />
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
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
            <FloatingInput
              label="Division Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., CS-A, ECE-B"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !name.trim()}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Division</AlertDialogTitle>
            <AlertDialogDescription>
              Delete division <strong>{deleteTarget?.name}</strong>? This will affect{' '}
              {deleteTarget?.student_count} student{deleteTarget?.student_count !== 1 ? 's' : ''}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && del(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
