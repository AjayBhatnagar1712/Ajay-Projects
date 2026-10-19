import type { ResolvedDifficultyPricing } from '@/lib/premium-pricing';
import {
  computeTeacherQuestionAccessEndDate,
  sumDifficultyCounts,
  type TeacherQuestionPurchaseCheckoutPayload,
  type TeacherQuestionPurchaseDoc,
} from '@/lib/teacher-question-purchase';

export const ADMIN_TEACHER_QUESTION_ASSIGNMENT_SOURCE = 'admin_teacher_question';

type BuildAdminTeacherQuestionPurchaseDocInput = {
  id: string;
  teacherUserId: string;
  teacherName?: string;
  teacherEmail?: string;
  questionBankOwnerId: string;
  questionBankOwnerName?: string;
  request: TeacherQuestionPurchaseCheckoutPayload;
  regularPricing: ResolvedDifficultyPricing;
  pyqPricing: ResolvedDifficultyPricing;
  referenceTotalAmount: number;
  assignedByAdminId?: string;
  assignedByAdminEmail?: string;
  assignedAt?: string;
};

export const buildAdminTeacherQuestionPurchaseDoc = ({
  id,
  teacherUserId,
  teacherName,
  teacherEmail,
  questionBankOwnerId,
  questionBankOwnerName,
  request,
  regularPricing,
  pyqPricing,
  referenceTotalAmount,
  assignedByAdminId,
  assignedByAdminEmail,
  assignedAt,
}: BuildAdminTeacherQuestionPurchaseDocInput): TeacherQuestionPurchaseDoc => {
  const purchasedAt = assignedAt || new Date().toISOString();
  const totalRegularQuestionCount = sumDifficultyCounts(request.regularCounts);
  const totalPyqQuestionCount = sumDifficultyCounts(request.pyqCounts);
  const totalQuestionCount = totalRegularQuestionCount + totalPyqQuestionCount;

  return {
    ...request,
    id,
    status: 'paid',
    buyerId: teacherUserId,
    buyerName: String(teacherName || '').trim() || 'Teacher',
    buyerEmail: String(teacherEmail || '').trim(),
    teacherId: questionBankOwnerId,
    teacherName: String(questionBankOwnerName || '').trim() || 'DCAM Question Bank',
    dailyRateAmount: Number(Number(
      DIFFICULTY_LEVELS.reduce(
        (sum, level) =>
          sum
          + Number(request.regularCounts[level] || 0) * Number(regularPricing[level.toLowerCase() as keyof ResolvedDifficultyPricing] || 0)
          + Number(request.pyqCounts[level] || 0) * Number(pyqPricing[level.toLowerCase() as keyof ResolvedDifficultyPricing] || 0),
        0
      )
    ).toFixed(2)),
    totalAmountPaid: 0,
    grossAmount: 0,
    currency: 'INR',
    totalQuestionCount,
    totalRegularQuestionCount,
    totalPyqQuestionCount,
    currentCoverageAmount: Number(Number(referenceTotalAmount || 0).toFixed(2)),
    regularDailyRateByDifficulty: regularPricing,
    pyqDailyRateByDifficulty: pyqPricing,
    purchasedAt,
    updatedAt: purchasedAt,
    accessStartsAt: purchasedAt,
    accessEndsAt: computeTeacherQuestionAccessEndDate(purchasedAt, request.daysCount),
    assignmentSource: ADMIN_TEACHER_QUESTION_ASSIGNMENT_SOURCE,
    assignedByAdminId: String(assignedByAdminId || '').trim() || null,
    assignedByAdminEmail: String(assignedByAdminEmail || '').trim() || null,
    pricingReferenceTotalAmount: Number(Number(referenceTotalAmount || 0).toFixed(2)),
  };
};

const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'] as const;
