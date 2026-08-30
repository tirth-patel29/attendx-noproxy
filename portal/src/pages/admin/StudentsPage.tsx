import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Smartphone } from "lucide-react";
import { PageHeader } from "../../components/attendx/PageHeader";
import { GlassCard } from "../../components/attendx/GlassCard";
import { DataTable, type Column } from "../../components/attendx/DataTable";
import { staggerContainer, riseItem } from "../../lib/motion";
import api from "../../services/api";
import { toast } from "sonner";

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/students');
      setStudents(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const columns: Column<any>[] = [
    { key: "roll_no", header: "Roll No", className: "font-mono text-[12px] font-medium" },
    { key: "name", header: "Student", render: (r) => (
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-[12px] font-semibold text-accent-foreground">
          {r.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
        </div>
        <div>
          <p className="font-medium">{r.name}</p>
          <a href={`mailto:${r.email}`} className="text-[11.5px] text-muted-foreground hover:text-foreground">
            {r.email}
          </a>
        </div>
      </div>
    )},
    { key: "division_name", header: "Hierarchy", render: (r) => (
      <div className="flex flex-col gap-1">
        {r.division_name ? (
          <span className="inline-flex w-max items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
            Div: {r.division_name}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">No Division</span>
        )}
        {r.batch_name && (
          <span className="inline-flex w-max items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
            Batch: {r.batch_name}
          </span>
        )}
      </div>
    )},
    { key: "bound_device_id", header: "Device", render: (r) => (
      r.is_bound ? (
        <div className="flex items-center gap-1.5 text-[12.5px] text-emerald-600">
          <Smartphone className="h-3.5 w-3.5" /> Bound
        </div>
      ) : (
        <span className="text-[12.5px] text-muted-foreground">Unbound</span>
      )
    )},
    { key: "created_at", header: "Added", render: (r) => (
      <span className="text-muted-foreground text-[12.5px]">{new Date(r.created_at).toLocaleDateString()}</span>
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
          title="Students Directory"
          subtitle={`${students.length} enrolled students.`}
        />

        <motion.div variants={riseItem}>
          <GlassCard padded={false}>
            <div className="p-5">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground">Loading...</div>
              ) : (
                <DataTable
                  data={students}
                  columns={columns}
                  keyExtractor={(r) => r.id}
                  searchPlaceholder="Search by name, email, or roll no…"
                  searchKeys={["name", "email", "roll_no", "division_name", "batch_name"]}
                  pageSize={10}
                  emptyTitle="No students found"
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
