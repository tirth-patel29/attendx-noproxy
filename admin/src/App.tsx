import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Teachers from './pages/Teachers';
import Students from './pages/Students';
import Colleges from './pages/Colleges';
import Departments from './pages/Departments';
import Branches from './pages/Branches';
import Semesters from './pages/Semesters';
import Batches from './pages/Batches';
import Divisions from './pages/Divisions';
import Courses from './pages/Courses';
import Assignments from './pages/Assignments';
import ApiKeys from './pages/ApiKeys';

function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="students" element={<Students />} />
        <Route path="colleges" element={<Colleges />} />
        <Route path="departments" element={<Departments />} />
        <Route path="branches" element={<Branches />} />
        <Route path="semesters" element={<Semesters />} />
        <Route path="batches" element={<Batches />} />
        <Route path="divisions" element={<Divisions />} />
        <Route path="courses" element={<Courses />} />
        <Route path="timetable" element={<Assignments />} />
        <Route path="api-keys" element={<ApiKeys />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
