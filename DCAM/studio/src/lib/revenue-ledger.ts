import {
  Firestore,
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  calculateRevenueSplit,
  CommissionKey,
  getCommissionKeyFromLinkedContentType,
  resolveDefaultCommissions,
  resolveOverrideCommissions,
  RevenueSettingsDoc,
  TeacherCommissionOverrideDoc,
} from '@/lib/revenue-sharing';

type ComputeSplitInput = {
  firestore: Firestore;
  teacherId?: string | null;
  grossAmount: number;
  commissionKey: CommissionKey;
};

type CreditRevenueInput = {
  firestore: Firestore;
  paymentId: string;
  teacherId?: string | null;
  userId: string;
  userEmail?: string;
  studentName?: string;
  studentEmail?: string;
  grossAmount: number;
  currency?: string;
  linkedContentType?: string | null;
  linkedContentId?: string | null;
  saleType?: string;
  purchasedAt?: string;
  metadata?: Record<string, unknown>;
};

const roundMoney = (value: number) => Number((Number(value || 0)).toFixed(2));

const getTeacherRevenueSplit = async (input: ComputeSplitInput) => {
  const normalizedTeacherId = String(input.teacherId || '').trim();
  const grossAmount = roundMoney(input.grossAmount);

  if (!normalizedTeacherId) {
    return {
      grossAmount,
      adminCommissionPercent: 100,
      adminCommissionAmount: grossAmount,
      teacherPayoutAmount: 0,
      commissionKey: input.commissionKey,
    };
  }

  const settingsRef = doc(input.firestore, 'platform_settings', 'revenue');
  const settingsSnap = await getDoc(settingsRef);
  const settings = settingsSnap.exists() ? (settingsSnap.data() as RevenueSettingsDoc) : null;

  const overrideRef = doc(input.firestore, 'teacher_commission_overrides', normalizedTeacherId);
  const overrideSnap = await getDoc(overrideRef);
  const override = overrideSnap.exists() ? (overrideSnap.data() as TeacherCommissionOverrideDoc) : null;

  const defaults = resolveDefaultCommissions(settings);
  const teacherOverride = resolveOverrideCommissions(override);
  const adminCommissionPercent = teacherOverride[input.commissionKey] ?? defaults[input.commissionKey];
  const split = calculateRevenueSplit(grossAmount, adminCommissionPercent);

  return {
    ...split,
    commissionKey: input.commissionKey,
  };
};

export const creditRevenueFromPayment = async (input: CreditRevenueInput) => {
  const normalizedTeacherId = String(input.teacherId || '').trim();
  const purchasedAt = input.purchasedAt || new Date().toISOString();
  const currency = input.currency || 'INR';
  const commissionKey = getCommissionKeyFromLinkedContentType(input.linkedContentType);

  const split = await getTeacherRevenueSplit({
    firestore: input.firestore,
    teacherId: normalizedTeacherId || null,
    grossAmount: input.grossAmount,
    commissionKey,
  });

  const adminWalletRef = doc(input.firestore, 'wallets', 'admin_main');
  await setDoc(
    adminWalletRef,
    {
      id: 'admin_main',
      ownerType: 'admin',
      ownerId: 'admin_main',
      availableBalance: increment(split.adminCommissionAmount),
      totalEarned: increment(split.adminCommissionAmount),
      updatedAt: purchasedAt,
    },
    { merge: true }
  );

  if (normalizedTeacherId && split.teacherPayoutAmount > 0) {
    const teacherWalletRef = doc(input.firestore, 'wallets', `teacher_${normalizedTeacherId}`);
    await setDoc(
      teacherWalletRef,
      {
        id: `teacher_${normalizedTeacherId}`,
        ownerType: 'teacher',
        ownerId: normalizedTeacherId,
        availableBalance: increment(split.teacherPayoutAmount),
        totalEarned: increment(split.teacherPayoutAmount),
        updatedAt: purchasedAt,
      },
      { merge: true }
    );

    const teacherSaleRef = doc(input.firestore, 'users', normalizedTeacherId, 'sales', input.paymentId);
    await setDoc(
      teacherSaleRef,
      {
        id: input.paymentId,
        teacherId: normalizedTeacherId,
        studentId: input.userId,
        studentName: input.studentName || '',
        studentEmail: input.studentEmail || input.userEmail || '',
        linkedContentType: input.linkedContentType || null,
        linkedContentId: input.linkedContentId || null,
        saleType: input.saleType || input.linkedContentType || 'purchase',
        status: 'paid',
        grossAmount: split.grossAmount,
        adminCommissionPercent: split.adminCommissionPercent,
        adminCommissionAmount: split.adminCommissionAmount,
        teacherPayoutAmount: split.teacherPayoutAmount,
        amount: split.grossAmount,
        currency,
        purchasedAt,
        createdAt: serverTimestamp(),
        sourcePaymentId: input.paymentId,
        commissionKey,
        ...(input.metadata || {}),
      },
      { merge: true }
    );
  }

  const walletTxRef = doc(input.firestore, 'wallet_transactions', `sale_${input.paymentId}`);
  await setDoc(
    walletTxRef,
    {
      id: `sale_${input.paymentId}`,
      entryType: 'sale_credit',
      status: 'paid',
      paymentId: input.paymentId,
      teacherId: normalizedTeacherId || null,
      userId: input.userId,
      userEmail: input.userEmail || '',
      studentName: input.studentName || '',
      studentEmail: input.studentEmail || input.userEmail || '',
      linkedContentType: input.linkedContentType || null,
      linkedContentId: input.linkedContentId || null,
      saleType: input.saleType || input.linkedContentType || 'purchase',
      grossAmount: split.grossAmount,
      adminCommissionPercent: split.adminCommissionPercent,
      adminCommissionAmount: split.adminCommissionAmount,
      teacherPayoutAmount: split.teacherPayoutAmount,
      currency,
      createdAt: purchasedAt,
      createdAtServer: serverTimestamp(),
      commissionKey,
      ...(input.metadata || {}),
    },
    { merge: true }
  );

  return split;
};
