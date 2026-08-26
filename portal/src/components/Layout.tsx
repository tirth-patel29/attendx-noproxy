import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import { LayoutDashboard, Plus, LogOut, Shield, Menu, X } from 'lucide-react';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sessions/new', label: 'Start Session', icon: Plus },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
          {/* Logo */}
          <div className="flex h-16 items-center border-b px-4">
            {sidebarOpen ? (
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Teacher Portal</span>
                  <span className="text-xs text-muted-foreground">Attendance Gateway</span>
                </div>
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg mx-auto">
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
                {user?.name?.[0]?.toUpperCase() ?? 'T'}
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name ?? 'Teacher'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              )}
            </div>
            {sidebarOpen && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start mt-2 text-destructive hover:text-destructive"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
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
          <h1 className="text-xl font-bold">Attendance Management</h1>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}