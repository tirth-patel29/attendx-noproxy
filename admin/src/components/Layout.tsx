import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
} from 'lucide-react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/teachers', label: 'Teachers', icon: Users },
  { to: '/students', label: 'Students', icon: GraduationCap },
  { to: '/divisions', label: 'Divisions', icon: Network },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/api-keys', label: 'API Keys', icon: Key },
  { to: '/timetable', label: 'Timetable', icon: Calendar },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
      setPwMsg({ type: 'success', text: 'Password changed successfully!' });
      setPwForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setPwOpen(false), 1500);
    } catch (e: any) {
      setPwMsg({ type: 'error', text: e?.response?.data?.error ?? 'Change failed' });
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo/Header */}
          <div className="flex h-16 items-center border-b px-4">
            {sidebarOpen ? (
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Attendance Admin</span>
                  <span className="text-xs text-muted-foreground">Zero-Trust Gateway</span>
                </div>
              </div>
            ) : (
              <Shield className="h-6 w-6 text-primary mx-auto" />
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
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
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
                  onClick={() => setPwOpen(true)}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Change Password
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn("flex-1 transition-all duration-300", sidebarOpen ? "ml-64" : "ml-16")}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <h1 className="text-xl font-bold">Admin Console</h1>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Update your admin password. Minimum 8 characters required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {pwMsg && (
              <Alert variant={pwMsg.type === 'error' ? 'destructive' : 'default'}>
                <AlertDescription>{pwMsg.text}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="current">Current Password</Label>
              <Input
                id="current"
                type="password"
                value={pwForm.current}
                onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next">New Password</Label>
              <Input
                id="next"
                type="password"
                value={pwForm.next}
                onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                placeholder="Minimum 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm New Password</Label>
              <Input
                id="confirm"
                type="password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitPw} disabled={pwBusy}>
              {pwBusy ? 'Saving...' : 'Change Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
