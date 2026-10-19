'use client';

import TeacherOfferPracticePackBuilder from '@/components/subscription/teacher-offer-practice-pack-builder';
import type { TeacherOfferCustomMockPack } from '@/lib/teacher-offers';

type Subject = {
  id: string;
  name: string;
  classId: string;
};

type TeacherOfferCustomMockBuilderProps = {
  teacherId: string;
  examTypeId: string;
  examTypeName: string;
  classId: string;
  className: string;
  availableSubjects: Subject[];
  selectedSubjectIds: string[];
  resetToken: number;
  initialValue?: TeacherOfferCustomMockPack | null;
  onChange: (value: TeacherOfferCustomMockPack | null) => void;
};

export default function TeacherOfferCustomMockBuilder(props: TeacherOfferCustomMockBuilderProps) {
  return <TeacherOfferPracticePackBuilder {...props} variant="custom_mock" />;
}
