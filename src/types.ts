export interface Teacher {
  id: string;
  uid: string;
  email: string;
  name: string;
  createdAt: any;
}

export interface Class {
  id: string;
  name: string;
  subject: string;
  teacherId: string;
  trimesters: number;
  createdAt: any;
}

export interface Student {
  id: string;
  name: string;
  lastName: string;
  dni: string;
  email: string;
  parentEmail: string;
  phone?: string;
  address?: string;
  classId: string;
  teacherId: string;
  createdAt: any;
}

export interface Assessment {
  id: string;
  title: string;
  type: 'exam' | 'work';
  weight: number;
  trimester: number;
  date: any;
  classId: string;
  teacherId: string;
  parentId?: string;
  isCategory?: boolean;
}

export interface Grade {
  id?: string;
  studentId: string;
  assessmentId: string;
  classId: string;
  teacherId: string;
  score: number;
  updatedAt: any;
}

export interface Attendance {
  id?: string;
  studentId: string;
  classId: string;
  teacherId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'late';
}

export interface Notification {
  id: string;
  teacherId: string;
  title: string;
  content: string;
  target: 'teacher' | 'parent';
  studentId?: string;
  classId: string;
  date: any;
  sent: boolean;
  notify?: boolean;
  read?: boolean;
}
