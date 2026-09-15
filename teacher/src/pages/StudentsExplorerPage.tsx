import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Building2,
  GraduationCap,
  BookOpen,
  Layers,
  ChevronRight,
  AlertTriangle,
  Smartphone,
  ChevronLeft,
} from "lucide-react";
import { PageHeader } from "../components/attendx/PageHeader";
import { GlassCard } from "../components/attendx/GlassCard";
import { staggerContainer, riseItem } from "../lib/motion";
import api from "../services/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Flow: Colleges -> Departments -> Branches -> Divisions -> Students
type Level = "colleges" | "departments" | "branches" | "divisions" | "students";

interface SelectionState {
  college?: any;
  department?: any;
  branch?: any;
  division?: any;
}

export default function StudentsExplorerPage() {
  const [level, setLevel] = useState<Level>("colleges");
  const [selections, setSelections] = useState<SelectionState>({});
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHierarchy = async (currentLevel: Level, params: any = {}) => {
    setLoading(true);
    setError(null);
    setData([]); // Clear old data to prevent stale flashes
    try {
      if (currentLevel === "students" && params.division_id) {
        const res = await api.get(`/professor/divisions/${params.division_id}/students`);
        const divisionStudents = res.data || [];
        
        // Ensure attendance percentage is handled
        const mappedStudents = divisionStudents.map((s: any) => ({
          ...s,
          percentage: s.percentage || "N/A"
        }));
        setData(mappedStudents);
      } else {
        const queryParams = new URLSearchParams(params).toString();
        const res = await api.get(`/academic/${currentLevel}${queryParams ? `?${queryParams}` : ''}`);
        setData(res.data || []);
      }
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      const msg = typeof errorData === 'string' ? errorData : errorData?.message || `Failed to fetch ${currentLevel}`;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (level === "colleges") {
      fetchHierarchy("colleges");
    }
  }, [level]);

  const handleSelect = (item: any) => {
    switch (level) {
      case "colleges":
        setSelections({ college: item });
        setLevel("departments");
        fetchHierarchy("departments", { college_id: item.id });
        break;
      case "departments":
        setSelections({ ...selections, department: item });
        setLevel("branches");
        fetchHierarchy("branches", { department_id: item.id });
        break;
      case "branches":
        setSelections({ ...selections, branch: item });
        setLevel("divisions");
        fetchHierarchy("divisions", { branch_id: item.id });
        break;
      case "divisions":
        setSelections({ ...selections, division: item });
        setLevel("students");
        fetchHierarchy("students", { division_id: item.division_id });
        break;
    }
  };

  const handleGoBack = (targetLevel: Level) => {
    if (targetLevel === "colleges") {
      setSelections({});
      setLevel("colleges");
      fetchHierarchy("colleges");
    } else if (targetLevel === "departments") {
      setSelections({ college: selections.college });
      setLevel("departments");
      fetchHierarchy("departments", { college_id: selections.college.id });
    } else if (targetLevel === "branches") {
      setSelections({ college: selections.college, department: selections.department });
      setLevel("branches");
      fetchHierarchy("branches", { department_id: selections.department.id });
    } else if (targetLevel === "divisions") {
      setSelections({ ...selections, division: undefined });
      setLevel("divisions");
      fetchHierarchy("divisions", { branch_id: selections.branch.id });
    }
  };

  const getBreadcrumbs = () => {
    const crumbs = [];
    crumbs.push(
      <span key="home" onClick={() => handleGoBack("colleges")} className="cursor-pointer font-medium hover:text-primary transition-colors flex items-center">
        Colleges
      </span>
    );

    if (selections.college) {
      crumbs.push(<ChevronRight key="s1" className="h-4 w-4 mx-1.5 text-muted-foreground/50" />);
      crumbs.push(
        <span key="col" onClick={() => handleGoBack("departments")} className="cursor-pointer font-medium hover:text-primary transition-colors max-w-[120px] truncate block">
          {selections.college.name}
        </span>
      );
    }
    if (selections.department) {
      crumbs.push(<ChevronRight key="s2" className="h-4 w-4 mx-1.5 text-muted-foreground/50" />);
      crumbs.push(
        <span key="dep" onClick={() => handleGoBack("branches")} className="cursor-pointer font-medium hover:text-primary transition-colors max-w-[120px] truncate block">
          {selections.department.name}
        </span>
      );
    }
    if (selections.branch) {
      crumbs.push(<ChevronRight key="s3" className="h-4 w-4 mx-1.5 text-muted-foreground/50" />);
      crumbs.push(
        <span key="br" onClick={() => handleGoBack("divisions")} className="cursor-pointer font-medium hover:text-primary transition-colors max-w-[120px] truncate block">
          {selections.branch.name}
        </span>
      );
    }
    if (selections.division) {
      crumbs.push(<ChevronRight key="s4" className="h-4 w-4 mx-1.5 text-muted-foreground/50" />);
      crumbs.push(
        <span key="div" className="text-primary font-semibold max-w-[120px] truncate block">
          {selections.division.name}
        </span>
      );
    }

    return crumbs;
  };

  const getLevelIcon = () => {
    switch (level) {
      case "colleges": return <Building2 className="h-6 w-6" />;
      case "departments": return <GraduationCap className="h-6 w-6" />;
      case "branches": return <BookOpen className="h-6 w-6" />;
      case "divisions": return <Layers className="h-6 w-6" />;
      default: return <Building2 className="h-6 w-6" />;
    }
  };

  const renderSkeleton = () => (
    <motion.div
      key="skeleton"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-[120px] rounded-2xl bg-card border border-border animate-pulse shadow-sm" />
      ))}
    </motion.div>
  );

  const renderError = () => (
    <motion.div
      key="error"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="p-8 text-center bg-destructive/5 rounded-2xl border border-destructive/20"
    >
      <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-destructive mb-1">Failed to load data</h3>
      <p className="text-sm text-destructive/80 mb-4">{error}</p>
      <button
        onClick={() => fetchHierarchy(level, selections)}
        className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors"
      >
        Try Again
      </button>
    </motion.div>
  );

  const renderHierarchyCards = () => (
    <motion.div
      key={`grid-${level}`}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.2 }}
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {data.map((item) => (
        <GlassCard 
          key={item.id || item.division_id}
          className="cursor-pointer hover:shadow-lg hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative border border-border/50"
          onClick={() => handleSelect(item)}
          padded={false}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                {getLevelIcon()}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
            </div>
            
            <h3 className="font-semibold text-base leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {item.name}
            </h3>
            
            <div className="flex items-center gap-2 mt-3">
              {item.code && (
                <span className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[11px] font-mono font-medium">
                  {item.code}
                </span>
              )}
              {item.academic_year && (
                <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-medium">
                  Year {item.academic_year}
                </span>
              )}
            </div>
            
            {level === "colleges" && (
              <p className="text-[12px] text-muted-foreground mt-3">
                Charusat University
              </p>
            )}
          </div>
        </GlassCard>
      ))}
    </motion.div>
  );

  const renderStudents = () => (
    <motion.div
      key="students"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.2 }}
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {data.map((student) => {
        const isLow = parseFloat(student.percentage) < 75;
        return (
          <GlassCard 
            key={student.id} 
            padded={false} 
            className={cn(
              "relative overflow-hidden transition-all duration-200 hover:shadow-md", 
              isLow ? "border-destructive/30 bg-destructive/[0.02]" : "border-border/50"
            )}
          >
            <div className="p-5 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex flex-col pr-4">
                  <span className="text-[15px] font-bold font-mono text-foreground flex items-center gap-1.5 mb-1">
                    {isLow && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    {student.roll_no}
                  </span>
                  <span className="text-[13px] text-muted-foreground font-medium truncate" title={student.name}>
                    {student.name}
                  </span>
                </div>
                {student.bound_device_id ? (
                  <span className="shrink-0 text-[11px] font-semibold text-emerald-600 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                    <Smartphone className="h-3 w-3" /> Bound
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground italic px-2 py-1">
                    Unbound
                  </span>
                )}
              </div>
              <div className="pt-3 border-t border-border/50 flex justify-between items-center bg-card/50 -mx-5 -mb-5 px-5 pb-5 rounded-b-xl">
                <span className="text-[12px] font-medium text-muted-foreground">Attendance</span>
                <span className={cn(
                  "text-[15px] font-bold", 
                  isLow ? "text-destructive" : "text-emerald-600"
                )}>
                  {student.percentage}%
                </span>
              </div>
            </div>
          </GlassCard>
        );
      })}
    </motion.div>
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 min-h-screen pb-24">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-6xl space-y-6"
      >
        <PageHeader
          title="Students Explorer"
          subtitle="Navigate through the academic hierarchy to view students and their attendance."
          action={
            level !== "colleges" && (
              <button
                onClick={() => {
                  const levels: Level[] = ["colleges", "departments", "branches", "divisions", "students"];
                  const currentIndex = levels.indexOf(level);
                  handleGoBack(levels[currentIndex - 1]);
                }}
                className="inline-flex items-center justify-center rounded-lg border bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-all duration-200"
              >
                <ChevronLeft className="mr-1.5 h-4 w-4" />
                Back
              </button>
            )
          }
        />

        <motion.div variants={riseItem} className="flex items-center text-[13px] text-muted-foreground bg-card/60 backdrop-blur-md px-4 py-3 rounded-xl border shadow-sm flex-wrap gap-y-2">
          {getBreadcrumbs()}
        </motion.div>

        <AnimatePresence mode="wait">
          {error ? renderError() : loading ? renderSkeleton() : data.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-12 text-center text-muted-foreground bg-card rounded-2xl border border-dashed shadow-sm"
            >
              No {level} found in this category.
            </motion.div>
          ) : level === "students" ? renderStudents() : renderHierarchyCards()}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
