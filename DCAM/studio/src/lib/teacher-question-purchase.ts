import { collection, doc, getDocs, query, setDoc, type Firestore } from 'firebase/firestore';
import type { ResolvedDifficultyPricing } from '@/lib/premium-pricing';
import { QUESTION_DIFFICULTY } from '@/lib/question-difficulty';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export type DifficultyCountMap = Record<DifficultyLevel, number>;

export type SearchParamReader = {
  get(name: string): string | null;
};

export type TeacherQuestionPurchaseCheckoutPayload = {
  examTypeId: string;
  examTypeName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  topicId?: string;
  topicName?: string;
  subtopicPath?: string;
  subtopicLabel?: string;
  regularCounts: DifficultyCountMap;
  pyqCounts: DifficultyCountMap;
  studentsCount: number;
  daysCount: number;
};

export type TeacherQuestionPurchaseExtensionSource = 'teacher_paid' | 'admin_extension';

export type TeacherQuestionPurchaseExtensionEntry = {
  id: string;
  source: TeacherQuestionPurchaseExtensionSource;
  addedDaysCount: number;
  previousDaysCount: number;
  nextDaysCount: number;
  previousAccessEndsAt: string;
  nextAccessEndsAt: string;
  amountPaidDelta: number;
  pricingReferenceAmountDelta?: number | null;
  extendedAt: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  assignedByAdminId?: string | null;
  assignedByAdminEmail?: string | null;
};

export type TeacherQuestionPurchaseDoc = TeacherQuestionPurchaseCheckoutPayload & {
  id: string;
  status: 'paid' | 'failed';
  buyerId: string;
  buyerName?: string;
  buyerEmail?: string;
  teacherId: string;
  teacherName?: string;
  dailyRateAmount: number;
  totalAmountPaid: number;
  grossAmount: number;
  currency: string;
  totalQuestionCount: number;
  totalRegularQuestionCount: number;
  totalPyqQuestionCount: number;
  regularDailyRateByDifficulty: ResolvedDifficultyPricing;
  pyqDailyRateByDifficulty: ResolvedDifficultyPricing;
  purchasedAt: string;
  updatedAt: string;
  accessStartsAt: string;
  accessEndsAt: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  assignmentSource?: string | null;
  assignedByAdminId?: string | null;
  assignedByAdminEmail?: string | null;
  pricingReferenceTotalAmount?: number | null;
  currentCoverageAmount?: number | null;
  extensionHistory?: TeacherQuestionPurchaseExtensionEntry[] | null;
};

export type TeacherQuestionPurchasePublicScope = Pick<
  TeacherQuestionPurchaseDoc,
  | 'id'
  | 'status'
  | 'teacherId'
  | 'teacherName'
  | 'examTypeId'
  | 'examTypeName'
  | 'classId'
  | 'className'
  | 'subjectId'
  | 'subjectName'
  | 'topicId'
  | 'topicName'
  | 'subtopicPath'
  | 'subtopicLabel'
  | 'regularCounts'
  | 'pyqCounts'
  | 'studentsCount'
  | 'daysCount'
  | 'totalQuestionCount'
  | 'totalRegularQuestionCount'
  | 'totalPyqQuestionCount'
  | 'assignmentSource'
  | 'accessStartsAt'
  | 'accessEndsAt'
  | 'purchasedAt'
  | 'updatedAt'
>;

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [QUESTION_DIFFICULTY];
const RUPEE_SYMBOL = '\u20B9';

export const formatRupeeAmount = (value: number) => {
  const normalized = Number.isFinite(Number(value)) ? Number(Number(value).toFixed(2)) : 0;
  const hasDecimals = Math.abs(normalized % 1) > 0.0001;
  return `${RUPEE_SYMBOL}${normalized.toLocaleString('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
};

export const createEmptyDifficultyCountMap = (): DifficultyCountMap => ({
  Easy: 0,
  Medium: 0,
  Hard: 0,
});

const normalizeWholePositiveNumber = (value: unknown, fallback = 0) => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const getDifficultyPricingValue = (pricing: ResolvedDifficultyPricing, level: DifficultyLevel) => {
  const difficultyKey = level.toLowerCase() as keyof ResolvedDifficultyPricing;
  return Number(pricing[difficultyKey] || 0);
};

export const normalizeTeacherQuestionStudentCount = (value: unknown) =>
  Math.max(1, normalizeWholePositiveNumber(value, 1));

export const normalizeTeacherQuestionDayCount = (value: unknown) =>
  Math.min(365, Math.max(1, normalizeWholePositiveNumber(value, 1)));

export const normalizeTeacherQuestionExtensionDayCount = (value: unknown) =>
  Math.min(365, Math.max(1, normalizeWholePositiveNumber(value, 1)));

export const normalizeTeacherQuestionStoredDayCount = (value: unknown) =>
  Math.max(1, normalizeWholePositiveNumber(value, 1));

export const normalizeDifficultyCountMap = (
  value: Partial<Record<DifficultyLevel, unknown>> | null | undefined
): DifficultyCountMap => ({
  Easy:
    normalizeWholePositiveNumber(value?.Easy, 0)
    + normalizeWholePositiveNumber(value?.Medium, 0)
    + normalizeWholePositiveNumber(value?.Hard, 0),
  Medium: 0,
  Hard: 0,
});

export const sumDifficultyCounts = (counts: DifficultyCountMap) =>
  DIFFICULTY_LEVELS.reduce((sum, level) => sum + Number(counts[level] || 0), 0);

export const computeTeacherQuestionDailyRateAmount = ({
  regularCounts,
  pyqCounts,
  regularPricing,
  pyqPricing,
}: {
  regularCounts: DifficultyCountMap;
  pyqCounts: DifficultyCountMap;
  regularPricing: ResolvedDifficultyPricing;
  pyqPricing: ResolvedDifficultyPricing;
}) =>
  Number(
    DIFFICULTY_LEVELS.reduce(
      (sum, level) =>
        sum
        + Number(regularCounts[level] || 0) * getDifficultyPricingValue(regularPricing, level)
        + Number(pyqCounts[level] || 0) * getDifficultyPricingValue(pyqPricing, level),
      0
    ).toFixed(2)
  );

export const computeTeacherQuestionTotalAmount = ({
  dailyRateAmount,
  studentsCount,
  daysCount,
}: {
  dailyRateAmount: number;
  studentsCount: number;
  daysCount: number;
}) =>
  Number(
    (
      Number(dailyRateAmount || 0)
      * normalizeTeacherQuestionStudentCount(studentsCount)
      * normalizeTeacherQuestionDayCount(daysCount)
    ).toFixed(2)
  );

export const hasTeacherQuestionPurchaseSelection = (payload: TeacherQuestionPurchaseCheckoutPayload) =>
  sumDifficultyCounts(payload.regularCounts) + sumDifficultyCounts(payload.pyqCounts) > 0;

export const buildTeacherQuestionPurchaseScopeLabel = (
  value: Pick<TeacherQuestionPurchaseCheckoutPayload, 'examTypeName' | 'className' | 'subjectName'>
) => [value.examTypeName, value.className, value.subjectName].map((part) => String(part || '').trim()).filter(Boolean).join(' / ');

export const buildTeacherQuestionPurchaseScopeDetail = (
  value: Pick<TeacherQuestionPurchaseCheckoutPayload, 'topicName' | 'subtopicLabel'>
) => [String(value.topicName || '').trim(), String(value.subtopicLabel || '').trim()].filter(Boolean).join(' / ');

export const computeTeacherQuestionAccessEndDate = (purchasedAtIso: string, daysCount: number) => {
  const purchasedAt = new Date(purchasedAtIso);
  if (Number.isNaN(purchasedAt.getTime())) return purchasedAtIso;
  purchasedAt.setDate(purchasedAt.getDate() + normalizeTeacherQuestionDayCount(daysCount));
  return purchasedAt.toISOString();
};

const addDaysToIsoDate = (baseIso: string, daysCount: number) => {
  const baseDate = new Date(baseIso);
  if (Number.isNaN(baseDate.getTime())) return baseIso;
  baseDate.setDate(baseDate.getDate() + Math.max(1, normalizeWholePositiveNumber(daysCount, 1)));
  return baseDate.toISOString();
};

const resolveTeacherQuestionPurchaseDate = (value?: unknown) => {
  const parsed = new Date(String(value || '').trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveTeacherQuestionPurchaseLatestExtensionEntry = (
  purchase: Partial<Pick<TeacherQuestionPurchaseDoc, 'extensionHistory'>> | null | undefined
): TeacherQuestionPurchaseExtensionEntry | null => {
  const extensionHistory = Array.isArray(purchase?.extensionHistory) ? purchase.extensionHistory : [];
  if (extensionHistory.length === 0) return null;

  let latestEntry: TeacherQuestionPurchaseExtensionEntry | null = null;
  let latestEntryTime = -1;
  let latestEntryIndex = -1;

  extensionHistory.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const entryTime = resolveTeacherQuestionPurchaseDate(entry.extendedAt)?.getTime() ?? -1;
    if (entryTime > latestEntryTime || (entryTime === latestEntryTime && index > latestEntryIndex)) {
      latestEntry = entry;
      latestEntryTime = entryTime;
      latestEntryIndex = index;
    }
  });

  return latestEntry;
};

export const getTeacherQuestionPurchaseResolvedDaysCount = (
  purchase: Partial<Pick<TeacherQuestionPurchaseDoc, 'daysCount' | 'extensionHistory'>> | null | undefined
) => {
  const storedDaysCount = normalizeTeacherQuestionStoredDayCount(purchase?.daysCount);
  const latestExtensionEntry = resolveTeacherQuestionPurchaseLatestExtensionEntry(purchase);
  if (!latestExtensionEntry) return storedDaysCount;
  return Math.max(
    storedDaysCount,
    normalizeTeacherQuestionStoredDayCount(latestExtensionEntry.nextDaysCount)
  );
};

export const getTeacherQuestionPurchaseResolvedAccessEndsAt = (
  purchase: Partial<Pick<TeacherQuestionPurchaseDoc, 'accessEndsAt' | 'extensionHistory'>> | null | undefined
) => {
  const storedAccessEndsAt = String(purchase?.accessEndsAt || '').trim();
  const storedEndsAtTime = resolveTeacherQuestionPurchaseDate(storedAccessEndsAt)?.getTime() ?? -1;
  const latestExtensionEntry = resolveTeacherQuestionPurchaseLatestExtensionEntry(purchase);
  const latestAccessEndsAt = String(latestExtensionEntry?.nextAccessEndsAt || '').trim();
  const latestEndsAtTime = resolveTeacherQuestionPurchaseDate(latestAccessEndsAt)?.getTime() ?? -1;
  return latestEndsAtTime > storedEndsAtTime ? latestAccessEndsAt : storedAccessEndsAt;
};

export const computeTeacherQuestionPurchaseExtensionAmount = ({
  purchase,
  addedDaysCount,
}: {
  purchase: Pick<TeacherQuestionPurchaseDoc, 'dailyRateAmount' | 'studentsCount'>;
  addedDaysCount: number;
}) =>
  computeTeacherQuestionTotalAmount({
    dailyRateAmount: Number(purchase.dailyRateAmount || 0),
    studentsCount: normalizeTeacherQuestionStudentCount(purchase.studentsCount),
    daysCount: normalizeTeacherQuestionExtensionDayCount(addedDaysCount),
  });

export const getTeacherQuestionPurchaseCurrentCoverageAmount = (
  purchase: Partial<Pick<TeacherQuestionPurchaseDoc, 'assignmentSource' | 'currentCoverageAmount' | 'pricingReferenceTotalAmount' | 'totalAmountPaid'>>
) => {
  const explicitCoverageAmount = Number(purchase.currentCoverageAmount);
  if (Number.isFinite(explicitCoverageAmount) && explicitCoverageAmount > 0) {
    return Number(explicitCoverageAmount.toFixed(2));
  }

  if (purchase.assignmentSource) {
    return Number(
      (
        Number(purchase.pricingReferenceTotalAmount || 0)
        + Number(purchase.totalAmountPaid || 0)
      ).toFixed(2)
    );
  }

  return Number(Number(purchase.totalAmountPaid || 0).toFixed(2));
};

export const computeTeacherQuestionPurchaseExtendedAccessEndDate = (
  purchase: Partial<Pick<TeacherQuestionPurchaseDoc, 'accessEndsAt' | 'extensionHistory'>>,
  addedDaysCount: number,
  extensionReferenceTimeIso: string = new Date().toISOString()
) => {
  const nowDate = resolveTeacherQuestionPurchaseDate(extensionReferenceTimeIso) || new Date();
  const currentEndsAt = resolveTeacherQuestionPurchaseDate(getTeacherQuestionPurchaseResolvedAccessEndsAt(purchase));
  const extensionBase = currentEndsAt && currentEndsAt.getTime() > nowDate.getTime()
    ? currentEndsAt.toISOString()
    : nowDate.toISOString();
  return addDaysToIsoDate(extensionBase, normalizeTeacherQuestionExtensionDayCount(addedDaysCount));
};

export const extendTeacherQuestionPurchaseDoc = ({
  purchase,
  addedDaysCount,
  extendedAt,
  source,
  amountPaidDelta = 0,
  pricingReferenceAmountDelta = 0,
  razorpayOrderId,
  razorpayPaymentId,
  assignedByAdminId,
  assignedByAdminEmail,
}: {
  purchase: TeacherQuestionPurchaseDoc;
  addedDaysCount: number;
  extendedAt?: string;
  source: TeacherQuestionPurchaseExtensionSource;
  amountPaidDelta?: number;
  pricingReferenceAmountDelta?: number;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  assignedByAdminId?: string | null;
  assignedByAdminEmail?: string | null;
}): TeacherQuestionPurchaseDoc => {
  const normalizedAddedDaysCount = normalizeTeacherQuestionExtensionDayCount(addedDaysCount);
  const extensionTimestamp = String(extendedAt || '').trim() || new Date().toISOString();
  const previousDaysCount = getTeacherQuestionPurchaseResolvedDaysCount(purchase);
  const nextDaysCount = previousDaysCount + normalizedAddedDaysCount;
  const previousAccessEndsAt = String(
    getTeacherQuestionPurchaseResolvedAccessEndsAt(purchase) || purchase.purchasedAt || extensionTimestamp
  ).trim() || extensionTimestamp;
  const nextAccessEndsAt = computeTeacherQuestionPurchaseExtendedAccessEndDate(
    purchase,
    normalizedAddedDaysCount,
    extensionTimestamp,
  );
  const normalizedAmountPaidDelta = Number(Number(amountPaidDelta || 0).toFixed(2));
  const normalizedPricingReferenceAmountDelta = Number(Number(pricingReferenceAmountDelta || 0).toFixed(2));
  const nextCoverageAmount = Number(
    (
      getTeacherQuestionPurchaseCurrentCoverageAmount(purchase)
      + normalizedAmountPaidDelta
      + normalizedPricingReferenceAmountDelta
    ).toFixed(2)
  );
  const extensionEntry: TeacherQuestionPurchaseExtensionEntry = {
    id: String(razorpayPaymentId || `${source}_${extensionTimestamp}`).trim(),
    source,
    addedDaysCount: normalizedAddedDaysCount,
    previousDaysCount,
    nextDaysCount,
    previousAccessEndsAt,
    nextAccessEndsAt,
    amountPaidDelta: normalizedAmountPaidDelta,
    pricingReferenceAmountDelta: normalizedPricingReferenceAmountDelta > 0
      ? normalizedPricingReferenceAmountDelta
      : null,
    extendedAt: extensionTimestamp,
    razorpayOrderId: String(razorpayOrderId || '').trim() || null,
    razorpayPaymentId: String(razorpayPaymentId || '').trim() || null,
    assignedByAdminId: String(assignedByAdminId || '').trim() || null,
    assignedByAdminEmail: String(assignedByAdminEmail || '').trim() || null,
  };

  return {
    ...purchase,
    daysCount: nextDaysCount,
    accessEndsAt: nextAccessEndsAt,
    updatedAt: extensionTimestamp,
    totalAmountPaid: Number(Number(purchase.totalAmountPaid || 0).toFixed(2)) + normalizedAmountPaidDelta,
    grossAmount: Number(Number(purchase.grossAmount || 0).toFixed(2)) + normalizedAmountPaidDelta,
    pricingReferenceTotalAmount: purchase.assignmentSource
      ? Number(Number(purchase.pricingReferenceTotalAmount || 0).toFixed(2)) + normalizedPricingReferenceAmountDelta
      : purchase.pricingReferenceTotalAmount ?? null,
    currentCoverageAmount: nextCoverageAmount,
    extensionHistory: [...(Array.isArray(purchase.extensionHistory) ? purchase.extensionHistory : []), extensionEntry],
  };
};

export const isTeacherQuestionPurchaseActiveAt = (
  purchase:
    | Partial<
        Pick<
          TeacherQuestionPurchaseDoc,
          'status' | 'accessStartsAt' | 'accessEndsAt' | 'purchasedAt'
        >
      >
    | null
    | undefined,
  referenceTime: Date = new Date()
) => {
  if (!purchase || typeof purchase !== 'object') return false;
  if ((purchase.status || 'paid') !== 'paid') return false;

  const referenceMs = referenceTime.getTime();
  if (Number.isNaN(referenceMs)) return false;

  const accessStartsAt =
    resolveTeacherQuestionPurchaseDate(purchase.accessStartsAt)
    || resolveTeacherQuestionPurchaseDate(purchase.purchasedAt);
  const accessEndsAt = resolveTeacherQuestionPurchaseDate(getTeacherQuestionPurchaseResolvedAccessEndsAt(purchase));
  if (!accessEndsAt) return false;
  if (accessStartsAt && accessStartsAt.getTime() > referenceMs) return false;
  return accessEndsAt.getTime() >= referenceMs;
};

export const isTeacherQuestionPurchaseActive = (
  purchase: Partial<Pick<TeacherQuestionPurchaseDoc, 'status' | 'accessStartsAt' | 'accessEndsAt' | 'purchasedAt'>>
) => isTeacherQuestionPurchaseActiveAt(purchase, new Date());

export const buildTeacherQuestionPurchasePublicScopes = (
  purchases: Array<TeacherQuestionPurchaseDoc | TeacherQuestionPurchasePublicScope> = []
) =>
  (Array.isArray(purchases) ? purchases : [])
    .filter((purchase) => !!purchase && (purchase.status || 'paid') === 'paid')
    .map((purchase) => ({
      id: String(purchase.id || '').trim(),
      status: 'paid' as const,
      teacherId: String(purchase.teacherId || '').trim(),
      teacherName: String(purchase.teacherName || '').trim(),
      examTypeId: String(purchase.examTypeId || '').trim(),
      examTypeName: String(purchase.examTypeName || '').trim(),
      classId: String(purchase.classId || '').trim(),
      className: String(purchase.className || '').trim(),
      subjectId: String(purchase.subjectId || '').trim(),
      subjectName: String(purchase.subjectName || '').trim(),
      topicId: String(purchase.topicId || '').trim(),
      topicName: String(purchase.topicName || '').trim(),
      subtopicPath: String(purchase.subtopicPath || '').trim(),
      subtopicLabel: String(purchase.subtopicLabel || '').trim(),
      regularCounts: normalizeDifficultyCountMap(purchase.regularCounts),
      pyqCounts: normalizeDifficultyCountMap(purchase.pyqCounts),
      studentsCount: normalizeTeacherQuestionStudentCount(purchase.studentsCount),
      daysCount: getTeacherQuestionPurchaseResolvedDaysCount(purchase),
      totalQuestionCount: Math.max(0, Number(purchase.totalQuestionCount || 0)),
      totalRegularQuestionCount: Math.max(0, Number(purchase.totalRegularQuestionCount || 0)),
      totalPyqQuestionCount: Math.max(0, Number(purchase.totalPyqQuestionCount || 0)),
      assignmentSource: String(purchase.assignmentSource || '').trim() || null,
      accessStartsAt: String(purchase.accessStartsAt || '').trim(),
      accessEndsAt: getTeacherQuestionPurchaseResolvedAccessEndsAt(purchase),
      purchasedAt: String(purchase.purchasedAt || '').trim(),
      updatedAt: String(purchase.updatedAt || '').trim(),
    }))
    .filter((purchase) => purchase.id && purchase.teacherId && purchase.examTypeId && purchase.classId && purchase.subjectId)
    .sort((left, right) => {
      const leftEndsAt = resolveTeacherQuestionPurchaseDate(left.accessEndsAt)?.getTime() || 0;
      const rightEndsAt = resolveTeacherQuestionPurchaseDate(right.accessEndsAt)?.getTime() || 0;
      if (leftEndsAt !== rightEndsAt) return rightEndsAt - leftEndsAt;
      return [
        left.examTypeName || left.examTypeId,
        left.className || left.classId,
        left.subjectName || left.subjectId,
        left.topicName || left.topicId || '',
        left.subtopicLabel || left.subtopicPath || '',
        left.id,
      ].join(' / ').localeCompare([
        right.examTypeName || right.examTypeId,
        right.className || right.classId,
        right.subjectName || right.subjectId,
        right.topicName || right.topicId || '',
        right.subtopicLabel || right.subtopicPath || '',
        right.id,
      ].join(' / '));
    });

export const syncTeacherQuestionPurchasePublicScopes = async (
  firestore: Firestore,
  teacherUserId: string,
  purchases?: Array<TeacherQuestionPurchaseDoc | TeacherQuestionPurchasePublicScope>
) => {
  const normalizedTeacherUserId = String(teacherUserId || '').trim();
  if (!normalizedTeacherUserId) return;

  let resolvedPurchases = Array.isArray(purchases) ? purchases : null;
  if (!resolvedPurchases) {
    const purchasesSnapshot = await getDocs(
      query(collection(firestore, 'users', normalizedTeacherUserId, 'teacher_question_purchases'))
    );
    resolvedPurchases = purchasesSnapshot.docs.map((docSnap) => ({
      ...(docSnap.data() as TeacherQuestionPurchaseDoc),
      id: docSnap.id,
    }));
  }

  await setDoc(
    doc(firestore, 'users', normalizedTeacherUserId),
    {
      publicTeacherQuestionPurchaseScopes: buildTeacherQuestionPurchasePublicScopes(resolvedPurchases),
      publicTeacherQuestionPurchaseScopesUpdatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
};

export const buildTeacherQuestionPurchaseCheckoutHref = (payload: TeacherQuestionPurchaseCheckoutPayload) => {
  const params = new URLSearchParams();
  params.set('examTypeId', payload.examTypeId);
  params.set('examTypeName', payload.examTypeName);
  params.set('classId', payload.classId);
  params.set('className', payload.className);
  params.set('subjectId', payload.subjectId);
  params.set('subjectName', payload.subjectName);
  params.set('students', String(normalizeTeacherQuestionStudentCount(payload.studentsCount)));
  params.set('days', String(normalizeTeacherQuestionDayCount(payload.daysCount)));

  if (payload.topicId) params.set('topicId', payload.topicId);
  if (payload.topicName) params.set('topicName', payload.topicName);
  if (payload.subtopicPath) params.set('subtopicPath', payload.subtopicPath);
  if (payload.subtopicLabel) params.set('subtopicLabel', payload.subtopicLabel);

  DIFFICULTY_LEVELS.forEach((level) => {
    params.set(`regular${level}`, String(normalizeWholePositiveNumber(payload.regularCounts[level], 0)));
    params.set(`pyq${level}`, String(normalizeWholePositiveNumber(payload.pyqCounts[level], 0)));
  });

  return params.toString();
};

export const buildTeacherQuestionPurchaseFormHref = (payload: TeacherQuestionPurchaseCheckoutPayload) =>
  `/teacher/premium-questions?${buildTeacherQuestionPurchaseCheckoutHref(payload)}`;

export const buildTeacherQuestionPurchaseCheckoutLink = (payload: TeacherQuestionPurchaseCheckoutPayload) =>
  `/teacher/premium-questions/checkout?${buildTeacherQuestionPurchaseCheckoutHref(payload)}`;

export const parseTeacherQuestionPurchaseCheckoutPayload = (
  searchParams: SearchParamReader
): TeacherQuestionPurchaseCheckoutPayload | null => {
  const examTypeId = String(searchParams.get('examTypeId') || '').trim();
  const classId = String(searchParams.get('classId') || '').trim();
  const subjectId = String(searchParams.get('subjectId') || '').trim();
  if (!examTypeId || !classId || !subjectId) return null;

  const regularCounts = DIFFICULTY_LEVELS.reduce((acc, level) => {
    acc[level] = normalizeWholePositiveNumber(searchParams.get(`regular${level}`), 0);
    return acc;
  }, createEmptyDifficultyCountMap());
  const pyqCounts = DIFFICULTY_LEVELS.reduce((acc, level) => {
    acc[level] = normalizeWholePositiveNumber(searchParams.get(`pyq${level}`), 0);
    return acc;
  }, createEmptyDifficultyCountMap());

  return {
    examTypeId,
    examTypeName: String(searchParams.get('examTypeName') || '').trim() || 'Exam',
    classId,
    className: String(searchParams.get('className') || '').trim() || 'Curriculum',
    subjectId,
    subjectName: String(searchParams.get('subjectName') || '').trim() || 'Subject',
    topicId: String(searchParams.get('topicId') || '').trim(),
    topicName: String(searchParams.get('topicName') || '').trim(),
    subtopicPath: String(searchParams.get('subtopicPath') || '').trim(),
    subtopicLabel: String(searchParams.get('subtopicLabel') || '').trim(),
    regularCounts,
    pyqCounts,
    studentsCount: normalizeTeacherQuestionStudentCount(searchParams.get('students')),
    daysCount: normalizeTeacherQuestionDayCount(searchParams.get('days')),
  };
};
