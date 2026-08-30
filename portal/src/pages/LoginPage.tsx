import * as React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ShieldCheck, Smartphone, Lock } from 'lucide-react';
import { Ambient } from '@/components/attendx/Ambient';
import { Logo } from '@/components/attendx/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../context/AuthContext';
import { staggerContainer, riseItem, ease } from '@/lib/motion';

const indicators = [
  { icon: ShieldCheck, label: 'Secure Connection' },
  { icon: Smartphone, label: 'Device Verified' },
  { icon: Lock, label: 'Protected Session' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    try {
      setLoading(true);
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const status = err?.response?.status;
      
      if (status === 401) {
        setError('Invalid email or password.');
      } else if (status === 403) {
        setError('Your account is not authorized for the teacher portal.');
      } else if (status >= 500) {
        setError('The server could not process your request. Please try again.');
      } else {
        console.error("Login Error:", err);
        setError(apiError?.message || apiError || err.message || 'Unable to sign in.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <Ambient intensity="strong" />

      {/* Header logo — top-left */}
      <div className="absolute left-6 top-5">
        <Logo />
      </div>

      {/* Login card */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="w-full max-w-[400px]"
      >
        <motion.div
          variants={riseItem}
          className="glass-panel rounded-3xl p-8 shadow-lift"
        >
          {/* Brand */}
          <motion.div variants={staggerContainer} className="mb-8 text-center">
            <motion.div variants={riseItem} className="mb-4 flex justify-center">
              <Logo />
            </motion.div>
            <motion.h1
              variants={riseItem}
              className="text-[22px] font-semibold tracking-[-0.03em]"
            >
              Teacher Portal
            </motion.h1>
            <motion.p variants={riseItem} className="mt-1.5 text-[13px] text-muted-foreground">
              Secure attendance management for your classroom.
            </motion.p>
          </motion.div>

          {/* Form */}
          <motion.form
            variants={staggerContainer}
            onSubmit={handleSubmit}
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
              <Label htmlFor="teacher-email" className="text-[12.5px] font-medium">
                Email address
              </Label>
              <Input
                id="teacher-email"
                type="email"
                placeholder="you@university.edu"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10"
              />
            </motion.div>

            <motion.div variants={riseItem} className="space-y-1.5">
              <Label htmlFor="teacher-password" className="text-[12.5px] font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="teacher-password"
                  type={showPassword ? 'text' : 'password'}
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
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </motion.div>

            <motion.div
              variants={riseItem}
              className="flex items-center justify-between text-[12.5px]"
            >
              <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                <input
                  id="teacher-remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-border accent-primary"
                />
                Remember me
              </label>
              <button
                type="button"
                className="text-primary-deep transition-colors hover:text-primary"
              >
                Forgot password?
              </button>
            </motion.div>

            <motion.div variants={riseItem} transition={ease}>
              <Button
                id="teacher-sign-in"
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in…
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>
            </motion.div>
          </motion.form>

          {/* Security indicators */}
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

          {/* Admin link */}
          <motion.p
            variants={riseItem}
            className="mt-5 text-center text-[12px] text-muted-foreground"
          >
            Are you an administrator?{' '}
            <Link to="/admin" className="text-primary-deep hover:underline">
              Admin Portal
            </Link>
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}
