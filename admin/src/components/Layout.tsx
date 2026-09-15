import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../services/adminApi';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FloatingInput } from '@/components/ui/floating-input';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Network,
  BookOpen,
  Calendar,
  Key,
  Menu,
  X,
  LogOut,
  Lock,
  Shield,
  Sun,
  Moon,
  Home,
  ChevronDown,
  Building2,
  Layers,
  GitBranch,
  BookMarked,
} from 'lucide-react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/colleges', label: 'Colleges', icon: Building2 },
  { to: '/departments', label: 'Departments', icon: Layers },
  { to: '/branches', label: 'Branches', icon: GitBranch },
  { to: '/semesters', label: 'Semesters', icon: Layers },
  { to: '/batches', label: 'Batches', icon: BookMarked },
  { to: '/divisions', label: 'Divisions', icon: Network },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/timetable', label: 'Timetable', icon: Calendar },
  { to: '/teachers', label: 'Teachers', icon: Users },
  { to: '/students', label: 'Students', icon: GraduationCap },
  { to: '/api-keys', label: 'API Keys', icon: Key },
];

// ── theme toggle ──────────────────────────────────────────────────────────────
function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('admin_theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      localStorage.setItem('admin_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('admin_theme', 'light');
    }
  }, [dark]);

  return { dark, toggle: () => setDark((v) => !v) };
}

// ── breadcrumb helpers ────────────────────────────────────────────────────────
function formatBreadcrumbLabel(segment: string): string {
  if (segment === 'timetable') return 'Timetable';
  if (segment === 'teachers') return 'Teachers';
  if (segment === 'students') return 'Students';
  if (segment === 'colleges') return 'Colleges';
  if (segment === 'departments') return 'Departments';
  if (segment === 'branches') return 'Branches';
  if (segment === 'semesters') return 'Semesters';
  if (segment === 'batches') return 'Batches';
  if (segment === 'divisions') return 'Divisions';
  if (segment === 'courses') return 'Courses';
  if (segment === 'api-keys') return 'API Keys';
  // UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return 'Details';
  }
  return segment
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── component ─────────────────────────────────────────────────────────────────
export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { dark, toggle: toggleTheme } = useTheme();

  // ── breadcrumbs ──
  const breadcrumbs = (() => {
    const paths = location.pathname.split('/').filter(Boolean);
    return paths.map((segment, index) => ({
      path: '/' + paths.slice(0, index + 1).join('/'),
      label: formatBreadcrumbLabel(segment),
    }));
  })();

  // ── change password ──
  const openPw = () => {
    setPwMsg(null);
    setPwForm({ current: '', next: '', confirm: '' });
    setPwOpen(true);
  };

  const submitPw = async () => {
    setPwMsg(null);
    if (pwForm.next.length < 8) {
      setPwMsg({ type: 'error', text: 'New password must be at least 8 characters' });
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    setPwBusy(true);
    try {
      await adminApi.changePassword(pwForm.current, pwForm.next);
      setPwMsg({ type: 'success', text: 'Password changed. Use it next time you sign in.' });
      setPwForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setPwOpen(false), 1500);
    } catch (e: any) {
      setPwMsg({ type: 'error', text: e?.response?.data?.error ?? 'Change failed' });
    } finally {
      setPwBusy(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <div className="flex h-screen bg-background">
        {/* ── Sidebar ── */}
        <aside
          className={cn(
            'fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300',
            sidebarOpen ? 'w-64' : 'w-16'
          )}
        >
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-16 items-center border-b px-4">
              {sidebarOpen ? (
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Attendance Admin</span>
                    <span className="text-xs text-muted-foreground">Zero-Trust Gateway</span>
                  </div>
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg mx-auto">
                  <Shield className="h-5 w-5 text-white" />
                </div>
              )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-2">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {sidebarOpen && <span>{item.label}</span>}
                  </NavLink>
                );
              })}
            </nav>

            {/* User section */}
            <div className="border-t p-2">
              <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  {user?.name?.[0]?.toUpperCase() ?? 'A'}
                </div>
                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user?.name ?? 'Admin'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                )}
              </div>
              {sidebarOpen && (
                <div className="mt-2 space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={openPw}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Change Password
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className={cn('flex-1 transition-all duration-300', sidebarOpen ? 'ml-64' : 'ml-16')}>
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <h1 className="text-xl font-bold">Admin Console</h1>

            <div className="ml-auto flex items-center gap-2">
              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>

              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      {user?.name?.[0]?.toUpperCase() ?? 'A'}
                    </div>
                    <span className="hidden sm:inline text-sm">{user?.name ?? 'Admin'}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{user?.name ?? 'Admin'}</span>
                      <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={openPw}>
                    <Lock className="mr-2 h-4 w-4" />
                    Change password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Breadcrumb navigation */}
          {location.pathname !== '/login' && (
            <div className="border-b bg-muted/40 px-6 py-3">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/" className="flex items-center gap-1.5">
                        <Home className="h-3.5 w-3.5" />
                        <span className="sr-only">Home</span>
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>

                  {breadcrumbs.map((crumb, index) => (
                    <span key={crumb.path} className="contents">
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {index === breadcrumbs.length - 1 ? (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={crumb.path}>{crumb.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </span>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          )}

          {/* Page content */}
          <main className="p-6">
            <Outlet />
          </main>
        </div>
      </div>

      {/* ── Change Password Dialog ── */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Update your admin password. Minimum 8 characters required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {pwMsg && (
              <Alert variant={pwMsg.type === 'error' ? 'destructive' : 'default'}>
                <AlertDescription>{pwMsg.text}</AlertDescription>
              </Alert>
            )}
            <FloatingInput
              label="Current Password"
              type="password"
              value={pwForm.current}
              onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
              autoFocus
            />
            <FloatingInput
              label="New Password (min 8)"
              type="password"
              value={pwForm.next}
              onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
            />
            <FloatingInput
              label="Confirm New Password"
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && submitPw()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitPw} disabled={pwBusy}>
              {pwBusy ? 'Saving…' : 'Change Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Toaster ── */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          className: 'z-[9999]',
          style: {
            backgroundColor: '#dc2626',
            color: '#ffffff',
            border: 'none',
          },
        }}
      />
    </>
  );
}
