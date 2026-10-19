'use client';

import { useParams } from 'next/navigation';
import { AdminUserPasswordManagement } from '@/components/admin/admin-user-password-management';

export default function TeacherManagementDetailPage() {
  const { teacherId } = useParams() as { teacherId: string };

  return (
    <AdminUserPasswordManagement
      userId={teacherId}
      managementTitle="Teacher Management"
      entityLabel="teacher"
      backHref="/admin/students"
    />
  );
}
