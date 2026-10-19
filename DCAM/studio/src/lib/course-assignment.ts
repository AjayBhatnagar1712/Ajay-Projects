export type AdminAssignableCourse = {
  id: string;
  teacherId?: string | null;
  publicationStatus?: 'draft' | 'published' | 'deleted' | string | null;
  deletedAt?: string | number | null;
  accessLevel?: 'free' | 'paid' | string | null;
  subscriptionAttached?: boolean | null;
};

export type StudentVisibleCourse = {
  publicationStatus?: 'draft' | 'published' | 'deleted' | string | null;
  deletedAt?: string | number | null;
  accessLevel?: 'free' | 'paid' | string | null;
  subscriptionAttached?: boolean | null;
};

export function isCourseHiddenFromStudents(course: Pick<StudentVisibleCourse, 'publicationStatus' | 'deletedAt'>) {
  const status = String(course.publicationStatus || 'published').trim().toLowerCase();
  if (course.deletedAt) return true;
  return ['draft', 'deleted', 'archived', 'removed', 'inactive'].includes(status);
}

export function isCourseVisibleToStudents(course: StudentVisibleCourse) {
  if (isCourseHiddenFromStudents(course)) return false;

  const accessLevel = String(course.accessLevel || 'free').trim().toLowerCase();
  if (accessLevel === 'paid') {
    return course.subscriptionAttached === true;
  }

  return true;
}

export function isCourseAssignableForStudentAccess(course: AdminAssignableCourse) {
  if (isCourseHiddenFromStudents(course)) return false;

  const accessLevel = String(course.accessLevel || 'free').trim().toLowerCase();
  if (accessLevel === 'paid') {
    return course.subscriptionAttached === true;
  }

  return true;
}

export function buildAdminAssignedCoursePayload(params: {
  courseId: string;
  teacherId?: string | null;
  adminUserId?: string | null;
  adminUserEmail?: string | null;
  assignedAt?: string;
}) {
  const assignedAt = params.assignedAt || new Date().toISOString();

  return {
    id: params.courseId,
    courseId: params.courseId,
    teacherId: params.teacherId || null,
    purchasedAt: assignedAt,
    assignedAt,
    assignedByAdminId: params.adminUserId || '',
    assignedByAdminEmail: params.adminUserEmail || '',
    assignmentSource: 'admin_manual',
  };
}
