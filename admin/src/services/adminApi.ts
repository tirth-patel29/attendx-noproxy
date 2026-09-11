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

export interface TrendData {
  day: string;
  rate: number;
}

export interface SplitData {
  name: string;
  value: number;
}

export interface ActivityData {
  event_type: string;
  payload: any;
  created_at: string;
}

export interface DeptStats {
  department: string;
  students: number;
  courses: number;
}

export interface SessionActivityData {
  hour: number;
  sessions: number;
}

export interface ActiveSessionData {
  id: string;
  subject: string;
  faculty: string;
  status: string;
  division: string;
  present: number;
  total: number;
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
  batch_id: string | null;
  batch_name: string | null;
  branch_name: string | null;
  department_name: string | null;
  college_name: string | null;
  bound_device_id: string | null;
  secret_hmac_key: string | null;
  is_bound: boolean;
  has_password: boolean;
  created_at?: string;
}

export interface College {
  id: string;
  name: string;
  code: string;
}

export interface Department {
  id: string;
  college_id: string;
  college_name?: string;
  name: string;
  code: string;
}

export interface Branch {
  id: string;
  department_id: string;
  department_name?: string;
  college_name?: string;
  name: string;
  code: string;
}

export interface Batch {
  id: string;
  division_id: string;
  division_name?: string;
  branch_name?: string;
  name: string;
  code: string | null;
  start_roll: string | null;
  end_roll: string | null;
}

export interface Division {
  id: string;
  division_id?: string;
  branch_id?: string | null;
  branch_name?: string;
  department_name?: string;
  college_name?: string;
  name: string;
  code?: string | null;
  academic_year?: number | null;
  course_count?: number;
  student_count?: number;
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

export interface ApiKey {
  key_uuid: string;
  label: string;
  prefix: string;
  status: string;
  created_at: string;
  last_used_at: string | null;
  created_by: string;
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
  attendanceTrend: () => api.get<TrendData[]>('/admin/dashboard/attendance-trend'),
  verificationSplit: () => api.get<SplitData[]>('/admin/dashboard/verification-split'),
  recentActivity: () => api.get<ActivityData[]>('/admin/dashboard/recent-activity'),
  departmentStats: () => api.get<DeptStats[]>('/admin/dashboard/department-stats'),
  sessionActivity: () => api.get<SessionActivityData[]>('/admin/dashboard/session-activity'),
  activeSessions: () => api.get<ActiveSessionData[]>('/admin/dashboard/active-sessions'),

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
  createStudent: (data: { roll_no: string; email: string; name: string; division_id?: string | null; batch_id?: string | null }) =>
    api.post('/admin/students', data),
  updateStudent: (id: string, data: { roll_no: string; email: string; name: string; division_id?: string | null; batch_id?: string | null }) =>
    api.put(`/admin/students/${id}`, data),
  deleteStudent: (id: string) => api.delete(`/admin/students/${id}`),
  resetDevice: (id: string) => api.post(`/admin/students/${id}/reset-device`),
  rotateHmac: (id: string) => api.post(`/admin/students/${id}/rotate-hmac`),
  forgotPassword: (id: string) => api.post(`/admin/students/${id}/forgot-password`),


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
  // API keys console (shared client keys; transport gate)
  apiKeys: () => api.get<ApiKey[]>('/admin/api-keys'),
  createApiKey: (label: string) =>
    api.post<{ key_uuid: string; label: string; prefix: string; api_key: string; created_at: string }>('/admin/api-keys', { label }),
  revokeApiKey: (uuid: string) => api.post(`/admin/api-keys/${uuid}/revoke`),
};

export const academicApi = {
  // Colleges
  colleges: () => api.get<College[]>('/admin/academic/colleges'),
  createCollege: (data: { name: string; code: string }) => api.post('/admin/academic/colleges', data),
  updateCollege: (id: string, data: { name: string; code: string }) => api.put(`/admin/academic/colleges/${id}`, data),
  deleteCollege: (id: string) => api.delete(`/admin/academic/colleges/${id}`),

  // Departments
  departments: () => api.get<Department[]>('/admin/academic/departments'),
  createDepartment: (data: { college_id: string; name: string; code: string }) => api.post('/admin/academic/departments', data),
  updateDepartment: (id: string, data: { college_id: string; name: string; code: string }) => api.put(`/admin/academic/departments/${id}`, data),
  deleteDepartment: (id: string) => api.delete(`/admin/academic/departments/${id}`),

  // Branches
  branches: () => api.get<Branch[]>('/admin/academic/branches'),
  createBranch: (data: { department_id: string; name: string; code: string }) => api.post('/admin/academic/branches', data),
  updateBranch: (id: string, data: { department_id: string; name: string; code: string }) => api.put(`/admin/academic/branches/${id}`, data),
  deleteBranch: (id: string) => api.delete(`/admin/academic/branches/${id}`),

  // Divisions (Full Academic CRUD)
  divisions: () => api.get<any[]>('/admin/academic/divisions').then(r => ({
    ...r,
    data: r.data.map(d => ({ ...d, id: d.division_id || d.id })) as Division[]
  })),
  createDivision: (data: { branch_id?: string | null; name: string; code?: string | null; academic_year?: number | null }) => 
    api.post('/admin/academic/divisions', data),
  updateDivision: (id: string, data: { branch_id?: string | null; name: string; code?: string | null; academic_year?: number | null }) => 
    api.put(`/admin/academic/divisions/${id}`, data),
  deleteDivision: (id: string) => api.delete(`/admin/academic/divisions/${id}`),

  // Batches
  batches: () => api.get<Batch[]>('/admin/academic/batches'),
  createBatch: (data: { division_id: string; name: string; code?: string | null; start_roll?: string | null; end_roll?: string | null }) => 
    api.post('/admin/academic/batches', data),
  updateBatch: (id: string, data: { division_id: string; name: string; code?: string | null; start_roll?: string | null; end_roll?: string | null }) => 
    api.put(`/admin/academic/batches/${id}`, data),
  deleteBatch: (id: string) => api.delete(`/admin/academic/batches/${id}`),
};
