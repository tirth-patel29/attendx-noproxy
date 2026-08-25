import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { portalApi } from '../services/portalApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Zap, Lock, User, Calendar } from 'lucide-react';

export default function NewSessionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [courseCode, setCourseCode] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!courseCode.trim()) {
      setError('Course code is required');
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
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => navigate('/dashboard')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Start Attendance Session</h1>
        <p className="text-muted-foreground mt-1">
          Create a new session and display the QR code for students to scan
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
          <CardDescription>
            Configure your attendance session. The QR code will be displayed after creation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Professor Info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
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
          </div>

          {/* Course Code */}
          <div className="space-y-2">
            <Label htmlFor="course">Course Code</Label>
            <Input
              id="course"
              placeholder="e.g., CS201, MATH101"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
              className="font-mono"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Enter the course code for this attendance session
            </p>
          </div>

          {/* Session Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              Session Date
            </Label>
            <Input
              id="date"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>

          {/* Submit Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={submitting || !courseCode.trim()}
          >
            {submitting ? (
              'Starting Session...'
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Start Session
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600" />
            What happens next?
          </h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• A rotating QR code will be displayed on screen</li>
            <li>• Project it on the smartboard for students to scan</li>
            <li>• Real-time attendance tracking begins immediately</li>
            <li>• Students use the mobile app to mark attendance</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}