import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portalApi, Session, AttendanceRecord } from '../services/portalApi';

export function useSessionAttendance(sessionId?: string) {
  return useQuery({
    queryKey: ['sessionAttendance', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const res = await portalApi.getSessionAttendance(sessionId);
      return res.data;
    },
    enabled: !!sessionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(sessionId),
    refetchInterval: 5000, // Poll every 5 seconds for live attendance
  });
}

export function useSession(sessionId?: string) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const res = await portalApi.getSession(sessionId);
      return res.data;
    },
    enabled: !!sessionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(sessionId),
  }););
}

export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { course_code: string; session_date?: string }) => {
      const res = await portalApi.startSession(data);
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
      const res = await portalApi.stopSession(sessionId);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['teacherSummary'] });
    },
  });
}

export type { Session, AttendanceRecord };
