import { createContext, useContext, useState, ReactNode } from 'react';
import { adminApi, AdminUser } from '../services/adminApi';

interface AuthCtx {
  user: AdminUser | null;
  login: (email: string, password: string) => Promise<AdminUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(() => {
    try {
      const raw = localStorage.getItem('admin_user');
      return raw ? (JSON.parse(raw) as AdminUser) : null;
    } catch {
      return null;
    }
  });

  const login = async (email: string, password: string) => {
    const res = await adminApi.login(email, password);
    localStorage.setItem('admin_access_token', res.data.access_token);
    localStorage.setItem('admin_refresh_token', res.data.refresh_token);
    localStorage.setItem('admin_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
