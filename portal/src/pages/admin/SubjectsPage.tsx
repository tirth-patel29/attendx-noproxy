import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, BookOpen } from "lucide-react";
import { PageHeader } from "../../components/attendx/PageHeader";
import { GlassCard } from "../../components/attendx/GlassCard";
import { DataTable, type Column } from "../../components/attendx/DataTable";
import { staggerContainer, riseItem } from "../../lib/motion";
import api from "../../services/api";
import { toast } from "sonner";

export default function SubjectsPage() {
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/courses');
      setCoursesList(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const columns: Column<any>[] = [
    { key: "course_code", header: "Code", className: "font-mono text-[12px] font-medium" },
    { key: "title", header: "Subject", render: (r) => (
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <BookOpen className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="font-semibold text-[13px]">{r.title}</p>
        </div>
      </div>
    )},
    { key: "division_name", header: "Division", render: (r) => (
      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
        {r.division_name || r.division_id || "Unassigned"}
      </span>
    )},
    { key: "assignment_count", header: "Assignments", render: (r) => (
      <span className="font-medium text-[13px] text-muted-foreground">{r.assignment_count} Active</span>
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
          title="Subjects"
          subtitle={`${coursesList.length} courses offered.`}
          action={
            <button 
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
              onClick={() => toast.info('Add subject disabled in UI demo')}
            >
              <Plus className="h-4 w-4" />
              Add Subject
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
                  data={coursesList}
                  columns={columns}
                  keyExtractor={(r) => r.id}
                  searchPlaceholder="Search by name, code, or division…"
                  searchKeys={["title", "course_code", "division_name"]}
                  pageSize={10}
                  emptyTitle="No courses found"
                  emptyDescription="Try adjusting your search."
                />
              )}
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
