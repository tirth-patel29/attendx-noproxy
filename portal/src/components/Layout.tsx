import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ThemeToggle } from './ThemeToggle';
import { LayoutDashboard, Plus, LogOut, Shield, Menu, X, Home } from 'lucide-react';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sessions/new', label: 'Start Session', icon: Plus },
];

// Helper function to format breadcrumb labels
function formatBreadcrumbLabel(segment: string): string {
  // Handle special cases
  if (segment === 'new') return 'New Session';
  if (segment === 'sessions') return 'Sessions';
  if (segment === 'dashboard') return 'Dashboard';
  
  // UUID pattern detection (8-4-4-4-12 format)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return 'Session Details';
  }
  
  // Default: capitalize and replace hyphens with spaces
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Generate breadcrumbs from current location
  const generateBreadcrumbs = (): Array<{ path: string; label: string }> => {
    const paths = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: Array<{ path: string; label: string }> = [];

    paths.forEach((segment, index) => {
      const path = '/' + paths.slice(0, index + 1).join('/');
      const label = formatBreadcrumbLabel(segment);
      breadcrumbs.push({ path, label });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

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

        {/* Breadcrumb Navigation */}
        {breadcrumbs.length > 0 && location.pathname !== '/login' && (
          <div className="border-b bg-muted/40 px-6 py-3">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard" className="flex items-center gap-1.5">
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
  );
}