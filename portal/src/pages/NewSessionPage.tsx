import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { portalApi } from '../services/portalApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FloatingInput } from '@/components/ui/floating-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Zap, Lock, User, Calendar, CheckCircle2 } from 'lucide-react';

export default function NewSessionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [courseCode, setCourseCode] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ courseCode?: string }>({});

  const validateForm = () => {
    const errors: { courseCode?: string } = {};
    
    if (!courseCode.trim()) {
      errors.courseCode = 'Course code is required';
    } else if (courseCode.trim().length < 2) {
      errors.courseCode = 'Course code must be at least 2 characters';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setError('');
    setSubmitting(true);
    try {
      const session = await portalApi.startSession({
        course_code: courseCode.trim(),
        session_date: sessionDate,
      });
      navigate(`/sessions/${session.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create session');
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-2xl mx-auto space-y-4"
    >
      <Button variant="ghost" onClick={() => navigate('/dashboard')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Start Attendance Session</h1>
        <p className="text-muted-foreground mt-1">
          Create a new session and display the QR code for students to scan
        </p>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
            <CardDescription>
              Configure your attendance session. The QR code will be displayed after creation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Professor Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                {user?.name?.[0]?.toUpperCase() || 'P'}
              </div>
              <div className="flex-1">
                <p className="font-semibold flex items-center gap-2">
                  <User className="h-3 w-3" />
                  {user?.name}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>Auto-detected from login</span>
              </div>
            </motion.div>

            {/* Course Code with Floating Input */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-2"
            >
              <FloatingInput
                id="course"
                label="Course Code"
                placeholder=" "
                value={courseCode}
                onChange={(e) => {
                  setCourseCode(e.target.value.toUpperCase());
                  if (fieldErrors.courseCode) {
                    setFieldErrors({ ...fieldErrors, courseCode: undefined });
                  }
                }}
                className="font-mono"
                autoFocus
              />
              {fieldErrors.courseCode && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs text-destructive flex items-center gap-1"
                >
                  <motion.span
                    animate={{ x: [-5, 5, -5, 5, 0] }}
                    transition={{ duration: 0.4 }}
                  >
                    {fieldErrors.courseCode}
                  </motion.span>
                </motion.p>
              )}
              {!fieldErrors.courseCode && courseCode.trim().length >= 2 && (
                <motion.p
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Valid course code
                </motion.p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter the course code for this attendance session
              </p>
            </motion.div>

            {/* Session Date with Floating Input */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Calendar className="h-3 w-3" />
                Session Date
              </div>
              <FloatingInput
                id="date"
                type="date"
                label="Date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </motion.div>

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={submitting || !courseCode.trim()}
              >
                {submitting ? (
                  <motion.div
                    className="flex items-center gap-2"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Zap className="h-4 w-4" />
                    </motion.div>
                    Starting Session...
                  </motion.div>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Start Session
                  </>
                )}
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              What happens next?
            </h3>
            <motion.ul className="space-y-2">
              {[
                'A rotating QR code will be displayed on screen',
                'Project it on the smartboard for students to scan',
                'Real-time attendance tracking begins immediately',
                'Students use the mobile app to mark attendance'
              ].map((text, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  className="text-sm text-muted-foreground flex items-center gap-2"
                >
                  <CheckCircle2 className="h-3 w-3 text-blue-600 flex-shrink-0" />
                  {text}
                </motion.li>
              ))}
            </motion.ul>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}