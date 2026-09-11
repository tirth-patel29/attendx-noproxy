/**
 * Mock presentation data for the AttendX prototype.
 * Shape mirrors what a headless backend would return, so screens can be wired
 * to real API responses by swapping this module for query hooks.
 */

export type AttendanceStatus = "VERIFIED" | "PENDING" | "FAILED";
export type SessionStatus = "LIVE" | "COMPLETED" | "CANCELLED";

export interface Subject {
  id: string;
  code: string;
  name: string;
  department: string;
  credits: number;
  faculty: string;
  divisions: string[];
  status: "ACTIVE" | "ARCHIVED";
}

export interface Division {
  id: string;
  name: string;
  department: string;
  semester: number;
  students: number;
  faculty: string;
}

export interface Faculty {
  id: string;
  name: string;
  email: string;
  department: string;
  subjects: number;
  role: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface Student {
  id: string;
  enrollmentId: string;
  name: string;
  department: string;
  division: string;
  email: string;
  attendance: number;
  status: "ACTIVE" | "INACTIVE";
}

export interface AttendanceRecord {
  enrollmentId: string;
  student: string;
  time: string;
  status: AttendanceStatus;
  device?: string;
}

export interface Session {
  id: string;
  subject: string;
  subjectCode: string;
  faculty: string;
  division: string;
  room: string;
  date: string;
  time: string;
  present: number;
  total: number;
  status: SessionStatus;
  mode: "QR" | "MANUAL";
}

export const teacher = {
  name: "Dr. Anaya Kulkarni",
  short: "Anaya",
  email: "anaya.kulkarni@university.edu",
  department: "Computer Engineering",
  role: "Associate Professor",
  facultyId: "FAC-2094",
  device: "MacBook Pro 14 · Chrome 128",
  initials: "AK",
};

export const admin = {
  name: "Rahul Deshmukh",
  email: "rahul.deshmukh@university.edu",
  department: "Registrar Office",
  role: "Institution Administrator",
  adminId: "ADM-0012",
  device: "Dell Latitude · Edge 128",
  initials: "RD",
};

export const subjects: Subject[] = [
  {
    id: "SUB-01",
    code: "CE3021",
    name: "Operating System Design",
    department: "Computer Engineering",
    credits: 4,
    faculty: "Dr. Anaya Kulkarni",
    divisions: ["CE-A", "CE-B"],
    status: "ACTIVE",
  },
  {
    id: "SUB-02",
    code: "CE3014",
    name: "Computer Networks",
    department: "Computer Engineering",
    credits: 3,
    faculty: "Dr. Anaya Kulkarni",
    divisions: ["CE-A"],
    status: "ACTIVE",
  },
  {
    id: "SUB-03",
    code: "CE2008",
    name: "Data Structures",
    department: "Computer Engineering",
    credits: 4,
    faculty: "Prof. Meera Iyer",
    divisions: ["CE-B", "CE-C"],
    status: "ACTIVE",
  },
  {
    id: "SUB-04",
    code: "IT3102",
    name: "Database Management Systems",
    department: "Information Technology",
    credits: 4,
    faculty: "Dr. Samir Bhatt",
    divisions: ["IT-A"],
    status: "ACTIVE",
  },
  {
    id: "SUB-05",
    code: "EC2210",
    name: "Digital Signal Processing",
    department: "Electronics",
    credits: 3,
    faculty: "Prof. Nikhil Rao",
    divisions: ["EC-A"],
    status: "ARCHIVED",
  },
];

export const divisions: Division[] = [
  { id: "DIV-01", name: "CE-A", department: "Computer Engineering", semester: 5, students: 62, faculty: "Dr. Anaya Kulkarni" },
  { id: "DIV-02", name: "CE-B", department: "Computer Engineering", semester: 5, students: 58, faculty: "Prof. Meera Iyer" },
  { id: "DIV-03", name: "CE-C", department: "Computer Engineering", semester: 3, students: 64, faculty: "Prof. Meera Iyer" },
  { id: "DIV-04", name: "IT-A", department: "Information Technology", semester: 5, students: 55, faculty: "Dr. Samir Bhatt" },
  { id: "DIV-05", name: "EC-A", department: "Electronics", semester: 7, students: 48, faculty: "Prof. Nikhil Rao" },
];

export const faculty: Faculty[] = [
  { id: "FAC-2094", name: "Dr. Anaya Kulkarni", email: "anaya.kulkarni@university.edu", department: "Computer Engineering", subjects: 2, role: "Associate Professor", status: "ACTIVE" },
  { id: "FAC-2101", name: "Prof. Meera Iyer", email: "meera.iyer@university.edu", department: "Computer Engineering", subjects: 2, role: "Assistant Professor", status: "ACTIVE" },
  { id: "FAC-1988", name: "Dr. Samir Bhatt", email: "samir.bhatt@university.edu", department: "Information Technology", subjects: 3, role: "Professor", status: "ACTIVE" },
  { id: "FAC-2143", name: "Prof. Nikhil Rao", email: "nikhil.rao@university.edu", department: "Electronics", subjects: 1, role: "Assistant Professor", status: "INACTIVE" },
  { id: "FAC-2077", name: "Dr. Farah Sheikh", email: "farah.sheikh@university.edu", department: "Computer Engineering", subjects: 2, role: "Professor", status: "ACTIVE" },
  { id: "FAC-2160", name: "Prof. Devika Menon", email: "devika.menon@university.edu", department: "Information Technology", subjects: 1, role: "Assistant Professor", status: "ACTIVE" },
];

const studentNames = [
  "Aarav Sharma", "Isha Patil", "Rohan Gupta", "Sneha Nair", "Kabir Mehta",
  "Ananya Joshi", "Vivaan Shah", "Tanvi Kulkarni", "Arjun Reddy", "Diya Kapoor",
  "Neel Verma", "Meher Singh", "Yash Chavan", "Riya Bansal", "Aditya Pillai",
  "Kavya Desai", "Ishaan Rane", "Nidhi Agarwal", "Om Prakash", "Saanvi Bhosale",
  "Dev Malhotra", "Trisha Sen", "Manav Rathi", "Pooja Salunkhe",
];

export const students: Student[] = studentNames.map((name, i) => {
  const division = divisions[i % 3]!.name;
  return {
    id: `STU-${i + 1}`,
    enrollmentId: `2023CE${String(1041 + i).padStart(4, "0")}`,
    name,
    department: i % 4 === 3 ? "Information Technology" : "Computer Engineering",
    division: i % 4 === 3 ? "IT-A" : division,
    email: `${name.toLowerCase().replace(/ /g, ".")}@university.edu`,
    attendance: 68 + ((i * 7) % 31),
    status: i === 11 || i === 19 ? "INACTIVE" : "ACTIVE",
  };
});

const statuses: AttendanceStatus[] = ["VERIFIED", "VERIFIED", "VERIFIED", "PENDING", "VERIFIED", "FAILED"];

export const liveAttendance: AttendanceRecord[] = students.slice(0, 18).map((s, i) => ({
  enrollmentId: s.enrollmentId,
  student: s.name,
  time: `09:${String(12 + i).padStart(2, "0")}:${String((i * 17) % 60).padStart(2, "0")}`,
  status: statuses[i % statuses.length]!,
  device: i % 5 === 0 ? "iPhone 15 · Safari" : "Android 14 · Chrome",
}));

export const liveSession = {
  id: "SES-40219",
  subject: "Operating System Design",
  subjectCode: "CE3021",
  division: "CE-A",
  room: "LH-204",
  faculty: teacher.name,
  startedAt: "09:10",
  total: 62,
};

export const sessions: Session[] = [
  { id: "SES-40219", subject: "Operating System Design", subjectCode: "CE3021", faculty: "Dr. Anaya Kulkarni", division: "CE-A", room: "LH-204", date: "2026-08-26", time: "09:10", present: 54, total: 62, status: "LIVE", mode: "QR" },
  { id: "SES-40211", subject: "Computer Networks", subjectCode: "CE3014", faculty: "Dr. Anaya Kulkarni", division: "CE-A", room: "LH-118", date: "2026-08-25", time: "11:00", present: 57, total: 62, status: "COMPLETED", mode: "QR" },
  { id: "SES-40205", subject: "Data Structures", subjectCode: "CE2008", faculty: "Prof. Meera Iyer", division: "CE-B", room: "LH-302", date: "2026-08-25", time: "14:30", present: 48, total: 58, status: "COMPLETED", mode: "MANUAL" },
  { id: "SES-40198", subject: "Database Management Systems", subjectCode: "IT3102", faculty: "Dr. Samir Bhatt", division: "IT-A", room: "LAB-4", date: "2026-08-24", time: "10:15", present: 51, total: 55, status: "COMPLETED", mode: "QR" },
  { id: "SES-40190", subject: "Operating System Design", subjectCode: "CE3021", faculty: "Dr. Anaya Kulkarni", division: "CE-B", room: "LH-204", date: "2026-08-24", time: "08:30", present: 44, total: 58, status: "COMPLETED", mode: "QR" },
  { id: "SES-40182", subject: "Computer Networks", subjectCode: "CE3014", faculty: "Dr. Farah Sheikh", division: "CE-A", room: "LH-118", date: "2026-08-23", time: "09:10", present: 0, total: 62, status: "CANCELLED", mode: "QR" },
  { id: "SES-40175", subject: "Data Structures", subjectCode: "CE2008", faculty: "Prof. Meera Iyer", division: "CE-C", room: "LH-302", date: "2026-08-23", time: "13:00", present: 59, total: 64, status: "COMPLETED", mode: "QR" },
  { id: "SES-40168", subject: "Digital Signal Processing", subjectCode: "EC2210", faculty: "Prof. Nikhil Rao", division: "EC-A", room: "LAB-2", date: "2026-08-22", time: "15:00", present: 39, total: 48, status: "COMPLETED", mode: "MANUAL" },
];

export const todaySchedule = [
  { time: "09:10", subject: "Operating System Design", division: "CE-A", room: "LH-204", state: "LIVE" as const },
  { time: "11:00", subject: "Computer Networks", division: "CE-A", room: "LH-118", state: "UPCOMING" as const },
  { time: "14:30", subject: "Operating System Design", division: "CE-B", room: "LH-204", state: "UPCOMING" as const },
];

export const attendanceTrend = [
  { day: "Mon", rate: 88, present: 214 },
  { day: "Tue", rate: 91, present: 226 },
  { day: "Wed", rate: 86, present: 208 },
  { day: "Thu", rate: 93, present: 231 },
  { day: "Fri", rate: 89, present: 219 },
  { day: "Sat", rate: 78, present: 168 },
];

export const subjectAttendance = [
  { subject: "OS Design", rate: 92 },
  { subject: "Networks", rate: 88 },
  { subject: "Data Struct.", rate: 84 },
  { subject: "DBMS", rate: 90 },
  { subject: "DSP", rate: 79 },
];

export const departmentStats = [
  { name: "Computer Engineering", value: 1284, rate: 91 },
  { name: "Information Technology", value: 862, rate: 88 },
  { name: "Electronics", value: 534, rate: 84 },
  { name: "Mechanical", value: 611, rate: 80 },
];

export const sessionActivity = [
  { hour: "08", sessions: 4 },
  { hour: "10", sessions: 9 },
  { hour: "12", sessions: 6 },
  { hour: "14", sessions: 11 },
  { hour: "16", sessions: 7 },
  { hour: "18", sessions: 2 },
];

export const verificationSplit = [
  { name: "Verified", value: 1842 },
  { name: "Pending", value: 96 },
  { name: "Failed", value: 41 },
];

export type AuditEvent =
  | "Login"
  | "Logout"
  | "Device binding"
  | "Session creation"
  | "Session termination"
  | "Attendance verification"
  | "Failed verification";

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  event: AuditEvent;
  detail: string;
  status: "SUCCESS" | "WARNING" | "FAILED";
  ip: string;
}

export const auditLogs: AuditLog[] = [
  { id: "EVT-9021", timestamp: "2026-08-26 09:10:04", user: "Dr. Anaya Kulkarni", event: "Session creation", detail: "CE3021 · CE-A · LH-204", status: "SUCCESS", ip: "10.14.2.88" },
  { id: "EVT-9020", timestamp: "2026-08-26 09:09:41", user: "Dr. Anaya Kulkarni", event: "Login", detail: "Teacher portal", status: "SUCCESS", ip: "10.14.2.88" },
  { id: "EVT-9019", timestamp: "2026-08-26 09:14:22", user: "2023CE1052", event: "Attendance verification", detail: "Verified in 1.2s", status: "SUCCESS", ip: "10.14.9.31" },
  { id: "EVT-9018", timestamp: "2026-08-26 09:15:07", user: "2023CE1046", event: "Failed verification", detail: "Device mismatch", status: "FAILED", ip: "10.14.9.77" },
  { id: "EVT-9017", timestamp: "2026-08-26 08:58:12", user: "2023CE1044", event: "Device binding", detail: "New device registered", status: "WARNING", ip: "10.14.9.12" },
  { id: "EVT-9016", timestamp: "2026-08-25 16:02:55", user: "Prof. Meera Iyer", event: "Session termination", detail: "CE2008 · CE-B", status: "SUCCESS", ip: "10.14.3.14" },
  { id: "EVT-9015", timestamp: "2026-08-25 15:44:03", user: "Rahul Deshmukh", event: "Login", detail: "Admin portal", status: "SUCCESS", ip: "10.14.1.4" },
  { id: "EVT-9014", timestamp: "2026-08-25 12:31:19", user: "Dr. Samir Bhatt", event: "Logout", detail: "Teacher portal", status: "SUCCESS", ip: "10.14.5.62" },
];

export const recentActivity = [
  { title: "Session started", meta: "OS Design · CE-A · Dr. Anaya Kulkarni", time: "2m ago", tone: "primary" as const },
  { title: "Faculty added", meta: "Prof. Devika Menon · Information Technology", time: "1h ago", tone: "neutral" as const },
  { title: "Failed verification", meta: "2023CE1046 · device mismatch", time: "2h ago", tone: "danger" as const },
  { title: "Subject updated", meta: "CE3014 credits changed to 3", time: "5h ago", tone: "neutral" as const },
  { title: "Session completed", meta: "DBMS · IT-A · 51/55 present", time: "Yesterday", tone: "success" as const },
];

export const departments = ["Computer Engineering", "Information Technology", "Electronics", "Mechanical"];
export const rooms = ["LH-204", "LH-118", "LH-302", "LAB-2", "LAB-4"];
