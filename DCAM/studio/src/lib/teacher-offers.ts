import type { PremiumCustomMockAttemptPricingRule } from '@/lib/premium-custom-mock';
import type { PremiumPracticeAttemptPricingRule } from '@/lib/premium-practice-session';
import type { ResolvedDifficultyPricing } from '@/lib/premium-pricing';

export type TeacherOfferCourse = {
  id: string;
  title: string;
};

export type TeacherOfferCrashCourse = {
  id: string;
  title: string;
};

export type TeacherOfferMockTest = {
  id: string;
  title: string;
};

export type TeacherOfferLiveBatch = {
  id: string;
  title: string;
  totalSessions: number;
  includedSessions: number;
};

export type TeacherOfferPracticeSubjectConfig = {
  subjectId: string;
  subjectName: string;
  questionType: 'All' | 'MCQ' | 'Numerical';
  difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  questionSource?: 'all' | 'pyq';
  previousYears?: string[];
  count: number;
  selectedTopicCount?: number;
};

export type TeacherOfferPracticeTopicConfig = {
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  subtopics?: string[];
  questionBankSource?: 'student_plus_official' | 'teacher_official';
  questionType: 'All' | 'MCQ' | 'Numerical';
  difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  previousYearMode?: 'all' | 'pyq';
  previousYears?: string[];
  count: number;
};

export type TeacherOfferPracticePack = {
  title?: string;
  questionAccessLevel?: 'free' | 'paid';
  questionBankSource?: 'student_plus_official' | 'teacher_official';
  perQuestionTimeSeconds?: number | null;
  perQuestionPriceByDifficulty?: ResolvedDifficultyPricing;
  attemptPricing?: PremiumPracticeAttemptPricingRule;
  estimatedAmount?: number;
  totalQuestions: number;
  questionCountByDifficulty?: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
  subjectConfigs: TeacherOfferPracticeSubjectConfig[];
  topicConfigs?: TeacherOfferPracticeTopicConfig[];
};

export type TeacherOfferCustomMockSectionConfig = {
  subjectId: string;
  subjectName: string;
  topicId?: string;
  topicName?: string;
  subtopic?: string;
  subtopicPaths?: string[];
  questionSource?: 'all' | 'pyq';
  previousYears?: string[];
  randomizePerAttempt?: boolean;
  questionType: 'All' | 'MCQ' | 'Numerical' | 'Text';
  difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard';
  count: number;
};

export type TeacherOfferCustomMockPack = {
  title?: string;
  questionAccessLevel?: 'free' | 'paid';
  questionBankSource?: 'student_plus_official' | 'teacher_official';
  duration?: number | null;
  marksPerQuestion?: number | null;
  negativeMarksPerQuestion?: number | null;
  perQuestionPriceByDifficulty?: ResolvedDifficultyPricing;
  amountByDifficulty?: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
  attemptPricing?: PremiumCustomMockAttemptPricingRule;
  estimatedAmount?: number;
  totalQuestions: number;
  totalMarks?: number | null;
  subjectConfigs: TeacherOfferCustomMockSectionConfig[];
};

export type TeacherOffer = {
  id?: string;
  createdByTeacherId?: string;
  title?: string;
  examTypeId?: string;
  examTypeName?: string;
  classId?: string;
  className?: string;
  subjectIds?: string[];
  subjectNames?: string[];
  courses?: TeacherOfferCourse[];
  crashCourses?: TeacherOfferCrashCourse[];
  mockTests?: TeacherOfferMockTest[];
  liveBatches?: TeacherOfferLiveBatch[];
  premiumPracticePack?: TeacherOfferPracticePack | null;
  premiumCustomMockPack?: TeacherOfferCustomMockPack | null;
  premiumPracticeSessionCount?: number;
  premiumCustomMockQuestionCount?: number;
  price?: number;
  currency?: string;
  status?: 'active' | 'archived';
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const countTeacherOfferSelections = (offer?: TeacherOffer | null) => {
  const coursesCount = Array.isArray(offer?.courses) ? offer?.courses.length : 0;
  const crashCoursesCount = Array.isArray(offer?.crashCourses) ? offer?.crashCourses.length : 0;
  const mockTestsCount = Array.isArray(offer?.mockTests) ? offer?.mockTests.length : 0;
  const liveBatchesCount = Array.isArray(offer?.liveBatches) ? offer?.liveBatches.length : 0;
  const premiumPracticeSessionCount = Math.max(
    0,
    Number(offer?.premiumPracticePack?.totalQuestions ?? offer?.premiumPracticeSessionCount ?? 0)
  );
  const premiumCustomMockQuestionCount = Math.max(
    0,
    Number(offer?.premiumCustomMockPack?.totalQuestions ?? offer?.premiumCustomMockQuestionCount ?? 0)
  );

  return {
    coursesCount,
    crashCoursesCount,
    mockTestsCount,
    liveBatchesCount,
    premiumPracticeSessionCount,
    premiumCustomMockQuestionCount,
    totalSelections:
      coursesCount
      + crashCoursesCount
      + mockTestsCount
      + liveBatchesCount
      + (premiumPracticeSessionCount > 0 ? 1 : 0)
      + (premiumCustomMockQuestionCount > 0 ? 1 : 0),
  };
};

export const hasTeacherOfferSelections = (offer?: TeacherOffer | null) =>
  countTeacherOfferSelections(offer).totalSelections > 0;
