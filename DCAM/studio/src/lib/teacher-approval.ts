export type AppRoleId = 'student' | 'teacher' | 'admin' | 'question_upload';
export type TeacherApprovalStatus = 'pending' | 'approved' | 'rejected';

export type TeacherApprovalProfile = {
  roleId?: AppRoleId;
  status?: 'active' | 'blocked';
  teacherStatus?: TeacherApprovalStatus;
};

export function hasTeacherRole(profile?: TeacherApprovalProfile | null) {
  return profile?.roleId === 'teacher' || profile?.roleId === 'admin';
}

export function getNormalizedTeacherStatus(profile?: TeacherApprovalProfile | null): TeacherApprovalStatus | null {
  if (!profile || !hasTeacherRole(profile)) return null;
  if (profile.roleId === 'admin') return 'approved';
  if (profile.teacherStatus === 'pending' || profile.teacherStatus === 'approved' || profile.teacherStatus === 'rejected') {
    return profile.teacherStatus;
  }
  // Legacy teacher records without teacherStatus should keep working as approved.
  return 'approved';
}

export function isApprovedTeacherProfile(profile?: TeacherApprovalProfile | null) {
  return hasTeacherRole(profile) && getNormalizedTeacherStatus(profile) === 'approved';
}

export function isPendingTeacherProfile(profile?: TeacherApprovalProfile | null) {
  return profile?.roleId === 'teacher' && getNormalizedTeacherStatus(profile) === 'pending';
}

export function isRejectedTeacherProfile(profile?: TeacherApprovalProfile | null) {
  return profile?.roleId === 'teacher' && getNormalizedTeacherStatus(profile) === 'rejected';
}

export function isLockedTeacherProfile(profile?: TeacherApprovalProfile | null) {
  return isPendingTeacherProfile(profile) || isRejectedTeacherProfile(profile);
}

export function isPublicTeacherProfile(profile?: TeacherApprovalProfile | null) {
  return profile?.roleId === 'teacher'
    && profile?.status !== 'blocked'
    && getNormalizedTeacherStatus(profile) === 'approved';
}
