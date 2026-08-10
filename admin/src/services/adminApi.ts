import api from './api';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Stats {
  teachers: number;
  students: number;
  divisions: number;
  courses: number;
  assignments: number;
  active_sessions: number;
}

export interface Teacher {
  id: string;
  email: string;
  name: string;
  department: string;
  has_login: boolean;
  assignment_count: number;
}

export interface Student {
  id: string;
  roll_no: string;
  email: string;
  name: string;
  division_id: string | null;
  division_name: string | null;
  bound_device_id: string | null;
  secret_hmac_key: string | null;
  is_bound: boolean;
  has_password: boolean;
  created_at?: string;
}

export interface Division {
  id: string;
  name: string;
  course_count: number;
  student_count: number;
}

export interface Course {
  id: string;
  course_code: string;
  title: string;
  division_id: string | null;
  division_name: string | null;
  assignment_count: number;
}

export interface Assignment {
  id: string;
  prof_uuid: string;
  teacher_name: string;
  teacher_email: string;
  course_code: string;
  course_title: string;
  division_id: string;
  division_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const dayName = (d: number) => DAYS[d] ?? String(d);

export const adminApi = {
  // auth
  login: (email: string, password: string) =>
    api.post<{ access_token: string; refresh_token: string; user: AdminUser }>('/admin/login', { email, password }),
  changePassword: (current: string, next: string) =>
    api.post('/admin/change-password', { current_password: current, new_password: next }),

  // stats
  stats: () => api.get<Stats>('/admin/stats'),

  // teachers
  teachers: () => api.get<Teacher[]>('/admin/teachers'),
  createTeacher: (data: { email: string; name: string; department: string; password: string }) =>
    api.post('/admin/teachers', data),
  updateTeacher: (id: string, data: { email: string; name: string; department: string }) =>
    api.put(`/admin/teachers/${id}`, data),
  resetTeacherPassword: (id: string, password: string) =>
    api.post(`/admin/teachers/${id}/reset-password`, { password }),
  deleteTeacher: (id: string) => api.delete(`/admin/teachers/${id}`),

  // students
  students: () => api.get<Student[]>('/admin/students'),
  student: (id: string) => api.get<Student>(`/admin/students/${id}`),
  createStudent: (data: { roll_no: string; email: string; name: string; division_id?: string | null }) =>
    api.post('/admin/students', data),
  updateStudent: (id: string, data: { roll_no: string; email: string; name: string; division_id?: string | null }) =>
    api.put(`/admin/students/${id}`, data),
  deleteStudent: (id: string) => api.delete(`/admin/students/${id}`),
  resetDevice: (id: string) => api.post(`/admin/students/${id}/reset-device`),
  rotateHmac: (id: string) => api.post(`/admin/students/${id}/rotate-hmac`),
  forgotPassword: (id: string) => api.post(`/admin/students/${id}/forgot-password`),

  // divisions
  divisions: () => api.get<Division[]>('/admin/divisions'),
  createDivision: (name: string) => api.post('/admin/divisions', { name }),
  updateDivision: (id: string, name: string) => api.put(`/admin/divisions/${id}`, { name }),
  deleteDivision: (id: string) => api.delete(`/admin/divisions/${id}`),

  // courses
  courses: () => api.get<Course[]>('/admin/courses'),
  createCourse: (data: { course_code: string; title: string; division_id?: string | null }) =>
    api.post('/admin/courses', data),
  updateCourse: (code: string, data: { course_code: string; title: string; division_id?: string | null }) =>
    api.put(`/admin/courses/${code}`, data),
  deleteCourse: (code: string) => api.delete(`/admin/courses/${code}`),

  // assignments (timetable)
  assignments: () => api.get<Assignment[]>('/admin/assignments'),
  createAssignment: (data: Omit<Assignment, 'id' | 'teacher_name' | 'teacher_email' | 'course_title' | 'division_name'>) =>
    api.post('/admin/assignments', data),
  updateAssignment: (id: string, data: Omit<Assignment, 'id' | 'teacher_name' | 'teacher_email' | 'course_title' | 'division_name'>) =>
    api.put(`/admin/assignments/${id}`, data),
  deleteAssignment: (id: string) => api.delete(`/admin/assignments/${id}`),
};
