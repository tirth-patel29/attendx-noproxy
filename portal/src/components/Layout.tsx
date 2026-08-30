import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { AppShell } from './attendx/AppShell';

// Helper function to format page titles
function formatPageTitle(pathname: string): string {
  if (pathname.includes('/sessions/new')) return 'Start Session';
  if (pathname.includes('/dashboard')) return 'Dashboard';
  if (pathname.includes('/qr-projector')) return 'QR Projector';
  if (pathname.includes('/session/live')) return 'Live Attendance';
  if (pathname.includes('/session/manual')) return 'Manual Session';
  if (pathname.includes('/session/history')) return 'Session History';
  if (pathname.includes('/profile')) return 'Profile';
  if (pathname.includes('/settings')) return 'Settings';
  return 'Attendance Gateway';
}

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();

  const role = (user?.role === 'admin') ? 'admin' : 'teacher';
  const pageTitle = formatPageTitle(location.pathname);

  return (
    <>
      <AppShell role={role} pageTitle={pageTitle}>
        <Outlet />
      </AppShell>

      <Toaster 
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
        richColors
      />
    </>
  );
}
