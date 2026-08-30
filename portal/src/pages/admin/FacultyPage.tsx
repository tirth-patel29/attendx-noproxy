import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Mail } from "lucide-react";
import { PageHeader } from "../../components/attendx/PageHeader";
import { GlassCard } from "../../components/attendx/GlassCard";
import { DataTable, type Column } from "../../components/attendx/DataTable";
import { staggerContainer, riseItem } from "../../lib/motion";
import api from "../../services/api";
import { toast } from "sonner";

export default function FacultyPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFaculty = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/teachers');
      setFacultyList(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch faculty');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  const columns: Column<any>[] = [
    { key: "name", header: "Name", render: (f) => (
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-[11px] font-semibold text-foreground">
          {f.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2)}
        </div>
        <div>
          <p className="font-medium">{f.name}</p>
          <p className="text-[11px] text-muted-foreground">{f.email}</p>
        </div>
      </div>
    )},
    { key: "id", header: "Faculty ID", className: "font-mono text-[12px]" },
    { key: "department", header: "Department", className: "text-muted-foreground" },
    { key: "assignment_count", header: "Assignments", render: (f) => (
      <span className="font-medium inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-inset ring-border">{f.assignment_count} Classes</span>
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
          title="Faculty"
          subtitle={`${facultyList.length} members across all departments`}
          action={
            <button 
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Faculty
            </button>
          }
        />

        <motion.div variants={riseItem}>
          <GlassCard padded={false}>
            <div className="p-5">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground">Loading...</div>
              ) : (
                <DataTable
                  data={facultyList}
                  columns={columns}
                  keyExtractor={(f) => f.id}
                  searchPlaceholder="Search by name, email, or department…"
                  searchKeys={["name", "email", "department", "id"]}
                  pageSize={10}
                  emptyTitle="No faculty found"
                  emptyDescription="Try adjusting your search."
                />
              )}
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>

      {/* Basic modal placeholder for Add Faculty (matches polish layout but simplified to raw HTML/Tailwind) */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl border shadow-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Add Faculty Member</h2>
            <form onSubmit={(e) => { e.preventDefault(); setAddOpen(false); toast.info('Add faculty disabled in UI demo'); }} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Full name</label>
                <input className="w-full px-3 py-2 border rounded-md" placeholder="Dr. Jane Smith" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5"><Mail className="h-3.5 w-3.5"/>Email</label>
                <input type="email" className="w-full px-3 py-2 border rounded-md" placeholder="jane.smith@university.edu" required />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 border rounded-md hover:bg-muted">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">Add Member</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
