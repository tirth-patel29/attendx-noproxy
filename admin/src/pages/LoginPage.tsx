import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ShieldCheck, Smartphone, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Ambient } from '@/components/attendx/Ambient';
import { Logo } from '@/components/attendx/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { staggerContainer, riseItem, ease } from '@/lib/motion';

const indicators = [
  { icon: ShieldCheck, label: "Secure Connection" },
  { icon: Smartphone, label: "Device Verified" },
  { icon: Lock, label: "Protected Session" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('admin@atmyhome.tech');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      if (err?.response?.status >= 500) {
        setError(`API Offline (${err.response.status}): The backend or Cloudflare tunnel is unreachable.`);
        return;
      }
      const respErr = err?.response?.data?.error;
      const msg = typeof respErr === 'string' ? respErr : respErr?.message ?? 'Login failed - check your credentials';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <Ambient intensity="strong" />

      <div className="absolute left-6 top-5">
        <Logo />
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="w-full max-w-[400px]"
      >
        <motion.div variants={riseItem} className="glass-panel rounded-3xl p-8 shadow-lift">
          <motion.div variants={staggerContainer} className="mb-8 text-center">
            <motion.div variants={riseItem} className="mb-4 flex justify-center">
              <Logo />
            </motion.div>
            <motion.h1 variants={riseItem} className="text-[22px] font-semibold tracking-[-0.03em]">
              Admin Portal
            </motion.h1>
            <motion.p variants={riseItem} className="mt-1.5 text-[13px] text-muted-foreground">
              Institution-wide attendance management and oversight.
            </motion.p>
          </motion.div>

          <motion.form
            variants={staggerContainer}
            onSubmit={submit}
            className="space-y-4"
            noValidate
          >
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-destructive/10 px-4 py-2.5 text-[12.5px] text-destructive ring-1 ring-inset ring-destructive/20"
                role="alert"
              >
                {error}
              </motion.div>
            )}

            <motion.div variants={riseItem} className="space-y-1.5">
              <Label htmlFor="email" className="text-[12.5px] font-medium">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@university.edu"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10"
              />
            </motion.div>

            <motion.div variants={riseItem} className="space-y-1.5">
              <Label htmlFor="password" className="text-[12.5px] font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </motion.div>

            <motion.div variants={riseItem} transition={ease}>
              <Button
                id="admin-sign-in"
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Signing in…
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </motion.div>
          </motion.form>

          <motion.div
            variants={riseItem}
            className="mt-6 flex items-center justify-center gap-4"
          >
            {indicators.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
              >
                <Icon className="size-3 text-success" aria-hidden />
                {label}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
