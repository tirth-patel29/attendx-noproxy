import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layers, Building2, GraduationCap, BookOpen, Users } from 'lucide-react';
import { PageHeader } from '../../components/attendx/PageHeader';
import { GlassCard } from '../../components/attendx/GlassCard';
import { DataTable, type Column } from '../../components/attendx/DataTable';
import { staggerContainer, riseItem } from '../../lib/motion';
import api from '../../services/api';
import { toast } from 'sonner';

export default function AcademicHierarchyPage() {
  const [activeTab, setActiveTab] = useState('colleges');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const tabs = [
    { id: 'colleges', label: 'Colleges', icon: Building2 },
    { id: 'departments', label: 'Departments', icon: GraduationCap },
    { id: 'branches', label: 'Branches', icon: BookOpen },
    { id: 'divisions', label: 'Divisions', icon: Layers },
    { id: 'batches', label: 'Batches', icon: Users },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/academic/${activeTab}`);
      setData(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to fetch ${activeTab}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const columns: Column<any>[] = [
    { key: "id", header: "ID / Details", className: "font-mono text-[12px] font-medium", render: (r) => (
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground">{r.id || r.division_id}</span>
        {r.code && <span className="w-max inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">{r.code}</span>}
      </div>
    )},
    { key: "name", header: "Name", className: "font-semibold text-[13px]", render: (r) => (
      <div className="flex items-center gap-2">
        <span>{r.name}</span>
        {r.academic_year && <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/20">Year {r.academic_year}</span>}
      </div>
    )},
    { key: "hierarchy", header: "Hierarchy", render: (r) => (
      <div className="flex flex-col gap-1 text-[11.5px] text-muted-foreground">
        {r.college_name && <div><span className="font-medium text-foreground">College:</span> {r.college_name}</div>}
        {r.department_name && <div><span className="font-medium text-foreground">Dept:</span> {r.department_name}</div>}
        {r.branch_name && <div><span className="font-medium text-foreground">Branch:</span> {r.branch_name}</div>}
        {r.division_name && <div><span className="font-medium text-foreground">Division:</span> {r.division_name}</div>}
      </div>
    )},
    { key: "rolls", header: "Roll Numbers", render: (r) => (
      r.start_roll && r.end_roll ? (
        <span className="font-mono text-[12px] text-muted-foreground">{r.start_roll} - {r.end_roll}</span>
      ) : <span className="text-[12px] text-muted-foreground italic">N/A</span>
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
          title="Academic Hierarchy"
          subtitle="Manage colleges, departments, branches, divisions, and batches."
        />

        <motion.div variants={riseItem}>
          <div className="flex space-x-1 bg-muted p-1 rounded-lg w-max mb-4 shadow-sm border">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted-foreground/10'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <GlassCard padded={false}>
            <div className="p-5">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground">Loading...</div>
              ) : (
                <DataTable
                  data={data}
                  columns={columns}
                  keyExtractor={(r) => r.id || r.division_id}
                  searchPlaceholder={`Search ${activeTab} by name or code…`}
                  searchKeys={["name", "code"]}
                  pageSize={10}
                  emptyTitle={`No ${activeTab} found`}
                  emptyDescription="Try adjusting your search or add a new entry."
                />
              )}
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
