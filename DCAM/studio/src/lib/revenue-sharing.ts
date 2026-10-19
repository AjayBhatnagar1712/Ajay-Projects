export type CommissionKey = 'course' | 'mockTest' | 'liveBatch' | 'practiceSession' | 'customMockTest';
export type CommissionConfig = Record<CommissionKey, number>;
export type PartialCommissionConfig = Partial<Record<CommissionKey, number>>;

export type RevenueSettingsDoc = {
  defaultCommissionPercent?: number;
  defaultCommissions?: PartialCommissionConfig;
};

export type TeacherCommissionOverrideDoc = {
  commissionPercent?: number;
  commissions?: PartialCommissionConfig;
};

export type RevenueSplit = {
  grossAmount: number;
  adminCommissionPercent: number;
  adminCommissionAmount: number;
  teacherPayoutAmount: number;
};

export const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  course: 20,
  mockTest: 20,
  liveBatch: 20,
  practiceSession: 20,
  customMockTest: 20,
};

const roundMoney = (value: number) => Number((Number(value || 0)).toFixed(2));

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const readPercent = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return clampPercent(value);
};

export const resolveDefaultCommissions = (settings?: RevenueSettingsDoc | null): CommissionConfig => {
  const legacyDefault = readPercent(settings?.defaultCommissionPercent) ?? DEFAULT_COMMISSION_CONFIG.course;
  const source = settings?.defaultCommissions;
  const fallbackCourse = readPercent(source?.course) ?? legacyDefault;
  return {
    course: fallbackCourse,
    mockTest: readPercent(source?.mockTest) ?? legacyDefault,
    liveBatch: readPercent(source?.liveBatch) ?? fallbackCourse,
    practiceSession: readPercent(source?.practiceSession) ?? legacyDefault,
    customMockTest: readPercent(source?.customMockTest) ?? legacyDefault,
  };
};

export const resolveOverrideCommissions = (override?: TeacherCommissionOverrideDoc | null): PartialCommissionConfig => {
  const legacyOverride = readPercent(override?.commissionPercent);
  const source = override?.commissions;
  const fallbackCourse = readPercent(source?.course) ?? legacyOverride;
  return {
    course: fallbackCourse,
    mockTest: readPercent(source?.mockTest) ?? legacyOverride,
    liveBatch: readPercent(source?.liveBatch) ?? fallbackCourse,
    practiceSession: readPercent(source?.practiceSession) ?? legacyOverride,
    customMockTest: readPercent(source?.customMockTest) ?? legacyOverride,
  };
};

export const getCommissionKeyFromLinkedContentType = (linkedContentType?: string | null): CommissionKey => {
  if (linkedContentType === 'mock_test') return 'mockTest';
  if (linkedContentType === 'live_batch') return 'liveBatch';
  if (linkedContentType === 'premium_practice_session') return 'practiceSession';
  if (linkedContentType === 'premium_custom_mock_test') return 'customMockTest';
  if (linkedContentType === 'custom_mock_test') return 'customMockTest';
  if (linkedContentType === 'practice_session') return 'practiceSession';
  // Fallback: other paid content uses the course bucket.
  return 'course';
};

export const calculateRevenueSplit = (grossAmountInput: number, adminCommissionPercentInput: number): RevenueSplit => {
  const grossAmount = roundMoney(grossAmountInput);
  const adminCommissionPercent = clampPercent(adminCommissionPercentInput);
  const adminCommissionAmount = roundMoney((grossAmount * adminCommissionPercent) / 100);
  const teacherPayoutAmount = roundMoney(Math.max(0, grossAmount - adminCommissionAmount));

  return {
    grossAmount,
    adminCommissionPercent,
    adminCommissionAmount,
    teacherPayoutAmount,
  };
};
