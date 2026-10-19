'use client';

import { useParams } from 'next/navigation';
import { AdminUserPasswordManagement } from '@/components/admin/admin-user-password-management';

export default function StudentManagementDetailPage() {
  const { studentId } = useParams() as { studentId: string };

  return (
    <AdminUserPasswordManagement
      userId={studentId}
      managementTitle="Student Management"
      entityLabel="student"
      backHref="/admin/students"
    />
  );
}
