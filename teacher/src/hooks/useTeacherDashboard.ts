import { useQuery } from '@tanstack/react-query';
import { teacherApi } from '../services/teacherApi';

export function useTeacherProfile() {
  return useQuery({
    queryKey: ['teacherProfile'],
    queryFn: async () => {
      const res = await teacherApi.me();
      return res.data;
    },
  });
}

export function useTeacherSummary() {
  return useQuery({
    queryKey: ['teacherSummary'],
    queryFn: async () => {
      const res = await teacherApi.getSummary();
      return res.data;
    },
  });
}

export function useTeacherTimetable() {
  return useQuery({
    queryKey: ['teacherTimetable'],
    queryFn: async () => {
      const res = await teacherApi.getTimetable();
      return res.data;
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await teacherApi.getSessions();
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
