'use client';

import DashboardHeader from '@/components/dashboard-header';
import StudentCurriculumMarketplace from '@/components/student-curriculum-marketplace';

export default function CrashCoursesPage() {
  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Crash Courses" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <StudentCurriculumMarketplace onlyCrashCourses />
      </main>
    </div>
  );
}
