import { useQuery } from '@tanstack/react-query';
import { portalApi } from '../services/portalApi';

export function useTeacherProfile() {
  return useQuery({
    queryKey: ['teacherProfile'],
    queryFn: async () => {
      const res = await portalApi.me();
      return res.data;
    },
  });
}

export function useTeacherSummary() {
  return useQuery({
    queryKey: ['teacherSummary'],
    queryFn: async () => {
      const res = await portalApi.getSummary();
      return res.data;
    },
  });
}

export function useTeacherTimetable() {
  return useQuery({
    queryKey: ['teacherTimetable'],
    queryFn: async () => {
      const res = await portalApi.getTimetable();
      return res.data;
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await portalApi.getSessions();
      return res.data;
    },
  });
}

export function useCurrentLecture() {
  const { data: sessions } = useSessions();
  
  // Find the first active session
  const activeSession = sessions?.find(s => s.is_active);
  
  return {
    data: activeSession ? { active_session: activeSession } : null,
  };
}
