import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Menu,
  X,
  Users,
  BookOpen,
  Layers,
  LogOut,
  Shield,
  CalendarDays,
  GraduationCap,
  ChevronRight,
  Key as KeyIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./components/attendx/Logo";
import { useAuth } from "./context/AuthContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
}

import { Library, Building2, Network, School } from "lucide-react";

const adminNav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/colleges", label: "Colleges", icon: Library },
  { to: "/departments", label: "Departments", icon: Building2 },
  { to: "/branches", label: "Branches", icon: Network },
  { to: "/batches", label: "Batches", icon: School },
  { to: "/divisions", label: "Divisions", icon: Layers },
  { to: "/students", label: "Students", icon: Users },
  { to: "/teachers", label: "Faculty", icon: GraduationCap },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/timetable", label: "Timetable", icon: CalendarDays },
  { to: "/api-keys", label: "API Keys", icon: KeyIcon },
];

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

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-5">
        <Logo subtitle="Admin Portal" />
      </div>

      <Separator className="mx-3 mb-2" />

      <nav className="flex-1 overflow-y-auto px-3 py-1" aria-label="Main navigation">
        <div className="space-y-0.5">
          {adminNav.map((item) => (
            <NavLink key={item.to} item={item} onClick={onNavigate} />
          ))}
        </div>
      </nav>

      <Separator className="mx-3 my-2" />

      <nav className="px-3 pb-2" aria-label="Account navigation">
        <div className="space-y-0.5">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground">
             <Shield className="size-4 shrink-0 text-primary" />
             <div className="flex flex-col">
               <span>{user?.email || "Administrator"}</span>
               <span className="text-[10px] text-muted-foreground font-normal">Superadmin Role</span>
             </div>
          </div>
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

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const prevPath = useRef(location.pathname);
  
  // Minimal hook to simulate isMobile for simple usage
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      prevPath.current = location.pathname;
      setDrawerOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {!isMobile && (
        <aside
          className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar"
          aria-label="Sidebar"
        >
          <SidebarContent />
        </aside>
      )}

      <AnimatePresence>
        {isMobile && drawerOpen && (
          <>
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
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="size-4" />
                </Button>
              </div>
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="size-4" />
              </Button>
            )}
            {isMobile && <Logo />}
            {!isMobile && (
              <span className="text-[13px] font-medium text-muted-foreground">Admin Console</span>
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

        <main className="flex-1 overflow-y-auto" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
