import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teacherApi, Session, AttendanceRecord } from '../services/teacherApi';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s?: string) => !!s && UUID_RE.test(s);

export function useSessionAttendance(sessionId?: string) {
  return useQuery({
    queryKey: ['sessionAttendance', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const res = await teacherApi.getSessionAttendance(sessionId);
      return res.data;
    },
    enabled: isUuid(sessionId),
    refetchInterval: 5000,
  });
}

export function useSession(sessionId?: string) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const res = await teacherApi.getSession(sessionId);
      return res.data;
    },
    enabled: isUuid(sessionId),
  });
}

export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { course_code: string; session_date?: string }) => {
      const res = await teacherApi.startSession(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['teacherSummary'] });
    },
  });
}

export function useStopSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await teacherApi.stopSession(sessionId);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['teacherSummary'] });
    },
  });
}

export type { Session, AttendanceRecord };