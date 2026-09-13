// src/services/teacherApi.ts
import api from './api';

export interface Professor {
  id: string;
  email: string;
  name: string;
  department: string;
}

export interface Session {
  id: string;
  course_code: string;
  professor_id: string;
  session_date: string;
  is_active: boolean;
  created_at: string;
  total_students?: number;
  present_count?: number;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_roll_no: string;
  student_email: string;
  client_claimed_time: number;
  server_logged_time: string;
  verification_delta_ms: number;
  status: string;
}

export interface ActiveToken {
  token_val: string;
  created_at_epoch: number;
  expires_at_epoch: number;
}

export interface TokensResponse {
  session_uuid: string;
  tokens: ActiveToken[];
}

export const teacherApi = {
  // Auth
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  logout: () => api.post('/auth/logout'),

  me: () => api.get('/auth/me'),

  // Professors
  getProfessors: () => api.get<Professor[]>('/professors'),
  getProfessor: (id: string) => api.get<Professor>(`/professors/${id}`),

  // Sessions
  // NOTE: prof_uuid is intentionally NOT accepted — the backend takes the
  // professor identity from the JWT, so a teacher can never create a session
  // as someone else.
  startSession: (data: { course_code: string; session_date?: string }) =>
    api.post<Session>('/sessions/start', data),

  stopSession: (sessionId: string) =>
    api.post(`/sessions/${sessionId}/stop`),

  getSessions: () =>
    api.get<Session[]>('/sessions'),

  getSession: (id: string) => api.get<Session>(`/sessions/${id}`),

  // Teacher timetable + analytics (JWT-scoped)
  getTimetable: () => api.get<{ today_dow: number; today: any[]; week: any[] }>('/professor/timetable'),
  getSummary: () => api.get<any[]>('/professor/summary'),
  getAttendanceTrend: () => api.get<{ day: string; rate: number }[]>('/professor/attendance-trend'),
  getCurrentLecture: () => api.get<any>('/professor/current-lecture'),
  getAlerts: (threshold = 0.75) => api.get<any[]>(`/professor/alerts?threshold=${threshold}`),

  // Tokens
  getSessionTokens: (sessionId: string) =>
    api.get<TokensResponse>(`/sessions/${sessionId}/tokens`),

  // Attendance
  getSessionAttendance: (sessionId: string) =>
    api.get<AttendanceRecord[]>(`/sessions/${sessionId}/attendance`),

  getStudentAttendance: (studentId: string) =>
    api.get<AttendanceRecord[]>(`/students/${studentId}/attendance`),

  // Device
  registerDevice: (studentUuid: string, deviceIdHash: string) =>
    api.post('/devices/register', { student_uuid: studentUuid, device_id_hash: deviceIdHash }),
};
