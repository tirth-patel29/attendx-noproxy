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
  return useQuery({
    queryKey: ['currentLecture'],
    queryFn: async () => {
      const res = await teacherApi.getCurrentLecture();
      return res.data;
    },
  });
}

export function useTeacherTrend() {
  return useQuery({
    queryKey: ['teacherTrend'],
    queryFn: async () => {
      const res = await teacherApi.getAttendanceTrend();
      return res.data;
    },
  });
}

export function useTeacherAlerts(threshold = 0.75) {
  return useQuery({
    queryKey: ['teacherAlerts', threshold],
    queryFn: async () => {
      const res = await teacherApi.getAlerts(threshold);
      return res.data;
    },
  });
}
