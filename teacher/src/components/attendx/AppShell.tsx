import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Play,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  BookOpen,
  Layers,
  BarChart3,
  Shield,
  CalendarDays,
  GraduationCap,
  ChevronRight,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

export type Role = "teacher" | "admin" | "student";

/* -------------------------------------------------------------------------- */
/*  Nav item definitions                                                        */
/* -------------------------------------------------------------------------- */

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
}

const teacherNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sessions/new", label: "Start Session", icon: Play },
  { to: "/sessions/new", label: "Manual Session", icon: BookOpen },
  { to: "/sessions/history", label: "Session History", icon: History },
  { to: "/students", label: "Students", icon: Users },
];

const teacherBottom: NavItem[] = [
  { to: "/dashboard", label: "Profile", icon: User },
];

const adminNav: NavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/faculty", label: "Faculty", icon: GraduationCap },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/subjects", label: "Subjects", icon: BookOpen },
  { to: "/admin/divisions", label: "Divisions", icon: Layers },
  { to: "/admin/sessions", label: "Sessions", icon: CalendarDays },
  { to: "/admin/attendance", label: "Attendance", icon: BarChart3 },
  { to: "/admin/reports", label: "Reports", icon: BookOpen },
  { to: "/admin/security", label: "Security", icon: Shield },
];

const adminBottom: NavItem[] = [
  { to: "/admin/profile", label: "Profile", icon: User },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

/* -------------------------------------------------------------------------- */
/*  NavLink                                                                    */
/* -------------------------------------------------------------------------- */

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const location = useLocation();
  const active = item.end
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
        active
          ? "bg-primary/10 text-primary"
          : "text-sidebar-foreground hover:bg-accent/60 hover:text-accent-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      {active && (
        <motion.span
          layoutId="nav-indicator"
          className="absolute inset-0 rounded-xl bg-primary/10"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <item.icon
        className={cn(
          "relative size-4 shrink-0 transition-colors",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      <span className="relative truncate">{item.label}</span>
      {active && <ChevronRight className="relative ml-auto size-3 text-primary/60 shrink-0" />}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*  SidebarContent (shared between desktop + mobile drawer)                   */
/* -------------------------------------------------------------------------- */

function SidebarContent({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate?: () => void;
}) {
  const mainNav = role === "teacher" ? teacherNav : adminNav;
  const bottomNav = role === "teacher" ? teacherBottom : adminBottom;
  const subtitle = role === "teacher" ? "Teacher Portal" : "Admin Portal";
  const loginPath = "/login";

  const { logout: authLogout } = useAuth();

  function handleLogout() {
    authLogout();
    // Use window.location instead of navigate so the auth context properly clears on unmount or forces refresh
    window.location.href = loginPath;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="px-4 pb-3 pt-5">
        <Logo subtitle={subtitle} />
      </div>

      <Separator className="mx-3 mb-2" />

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-1" aria-label="Main navigation">
        <div className="space-y-0.5">
          {mainNav.map((item) => (
            <NavLink key={item.label} item={item} onClick={onNavigate} />
          ))}
        </div>
      </nav>

      <Separator className="mx-3 my-2" />

      {/* Bottom nav */}
      <nav className="px-3 pb-2" aria-label="Account navigation">
        <div className="space-y-0.5">
          {bottomNav.map((item) => (
            <NavLink key={item.to} item={item} onClick={onNavigate} />
          ))}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-destructive/8 hover:text-destructive"
            aria-label="Log out"
          >
            <LogOut className="size-4 shrink-0" />
            <span>Log out</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  AppShell                                                                   */
/* -------------------------------------------------------------------------- */

interface AppShellProps {
  role: Role;
  children: React.ReactNode;
  pageTitle?: string;
}

export function AppShell({ role, children, pageTitle }: AppShellProps) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Close drawer on navigation (route change)
  const location = useLocation();
  const prevPath = React.useRef(location.pathname);
  React.useEffect(() => {
    if (location.pathname !== prevPath.current) {
      prevPath.current = location.pathname;
      setDrawerOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* ---- Desktop Sidebar ---- */}
      {!isMobile && (
        <aside
          className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar"
          aria-label="Sidebar"
        >
          <SidebarContent role={role} />
        </aside>
      )}

      {/* ---- Mobile Drawer ---- */}
      <AnimatePresence>
        {isMobile && drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            {/* Drawer panel */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-sidebar-border bg-sidebar shadow-lift"
              aria-label="Sidebar"
            >
              <div className="flex items-center justify-end px-3 pt-4">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                >
                  <X />
                </Button>
              </div>
              <SidebarContent role={role} onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ---- Main content area ---- */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TopBar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
              >
                <Menu />
              </Button>
            )}
            {isMobile && <Logo />}
            {pageTitle && !isMobile && (
              <span className="text-[13px] font-medium text-muted-foreground">{pageTitle}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              <span className="hidden text-[11.5px] font-medium text-muted-foreground sm:block">
                Secure Connection
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
