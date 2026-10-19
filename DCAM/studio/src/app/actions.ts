"use server";

import {
  getPersonalizedLearningPath,
  type PersonalizedLearningPathInput,
  type PersonalizedLearningPathOutput,
} from "@/ai/flows/personalized-learning-path";
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { getApps as getAdminApps, initializeApp as initializeAdminApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  calculateRevenueSplit,
  getCommissionKeyFromLinkedContentType,
  resolveDefaultCommissions,
  resolveOverrideCommissions,
  type RevenueSettingsDoc,
  type TeacherCommissionOverrideDoc,
} from '@/lib/revenue-sharing';

export type ActionResult = {
  data: PersonalizedLearningPathOutput | null;
  error?: string;
};

type ResolveSavedPhoneOtpLoginInput = {
  idToken: string;
};

type ResolveSavedPhoneOtpLoginResult = {
  success: boolean;
  customToken?: string;
  error?: string;
};

export async function getRecommendations(
  input: PersonalizedLearningPathInput
): Promise<ActionResult> {
  try {
    const result = await getPersonalizedLearningPath(input);
    if (!result) {
      return { 
        data: null,
        error: "Failed to get recommendations. The AI model did not return a result.",
      };
    }
    return { data: result };
  } catch (error) {
    console.error("Error getting recommendations:", error);
    return { 
        data: null,
        error: "An unexpected error occurred while fetching recommendations.",
     };
  }
}

export async function createRazorpayOrder(amount: number, currency: string = 'INR'): Promise<{orderId: string | null, error?: string}> {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        console.error("Razorpay keys not found.");
        return { orderId: null, error: 'Razorpay is not configured. Please provide API keys.' };
    }

    const normalizedAmount = toNumber(amount);
    const normalizedCurrency = cleanString(currency || 'INR').toUpperCase();
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        return { orderId: null, error: 'Invalid payment amount.' };
    }
    if (normalizedAmount > 500000) {
        return { orderId: null, error: 'Payment amount exceeds the supported limit.' };
    }
    if (normalizedCurrency !== 'INR') {
        return { orderId: null, error: 'Unsupported payment currency.' };
    }
    
    const instance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const amountInSmallestUnit = Math.round(normalizedAmount * 100);
    const options = {
        amount: amountInSmallestUnit,  // amount in the smallest currency unit
        currency: normalizedCurrency,
        receipt: `receipt_order_${new Date().getTime()}`,
    };

    try {
        const order = await instance.orders.create(options);
        return { orderId: order.id };
    } catch (error: any) {
        console.error("Error creating Razorpay order:", error);
        return { orderId: null, error: error.message };
    }
}

export async function verifyRazorpayPayment(
    orderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
): Promise<{verified: boolean, error?: string}> {
     if (!process.env.RAZORPAY_KEY_SECRET) {
        console.error("Razorpay secret not found.");
        return { verified: false, error: 'Razorpay is not configured.' };
    }

    const body = orderId + "|" + razorpayPaymentId;

    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');
    
    const isAuthentic = expectedSignature === razorpaySignature;

    if (isAuthentic) {
        return { verified: true };
    } else {
        return { verified: false, error: "Payment signature verification failed." };
    }
}

export async function initiateRazorpayXPayoutPlaceholder(input: {
  payoutRequestId: string;
  amount: number;
  recipientType: 'teacher' | 'admin';
  recipientId: string;
}): Promise<{ success: boolean; payoutId?: string; error?: string }> {
  try {
    if (!input?.payoutRequestId || !input?.recipientId || !Number.isFinite(input?.amount) || input.amount <= 0) {
      return { success: false, error: 'Invalid payout payload.' };
    }

    const auth = getRazorpayXHeaders();
    if (!auth?.creds?.sourceAccountNumber) {
      return {
        success: false,
        error: 'RazorpayX payout is not configured. Missing key/account configuration.',
      };
    }

    const app = getAdminApp();
    const db = getAdminFirestore(app);
    const recipientSnap = await db.doc(`users/${input.recipientId}`).get();
    const recipientData = recipientSnap.data() || {};
    const fundAccountId = cleanString(recipientData.razorpayFundAccountId);
    const payoutMethod = cleanString(recipientData.payoutMethod).toLowerCase();
    const payoutMode = payoutMethod === 'upi' ? 'UPI' : 'IMPS';

    if (!fundAccountId) {
      return {
        success: false,
        error: 'Recipient payout account is not verified. Missing Razorpay fund account id.',
      };
    }

    const payoutPayload = {
      account_number: auth.creds.sourceAccountNumber,
      fund_account_id: fundAccountId,
      amount: Math.round(toNumber(input.amount) * 100),
      currency: 'INR',
      mode: payoutMode,
      purpose: 'payout',
      queue_if_low_balance: true,
      reference_id: input.payoutRequestId,
      narration: `Teacher withdrawal ${input.payoutRequestId}`,
      notes: {
        recipientType: input.recipientType,
        recipientId: input.recipientId,
      },
    };

    const response = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: {
        ...auth.headers,
        'X-Payout-Idempotency': input.payoutRequestId,
      },
      body: JSON.stringify(payoutPayload),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: readProviderError(payload, 'RazorpayX payout request failed.'),
      };
    }

    const payoutId = cleanString((payload as any)?.id);
    if (!payoutId) {
      return { success: false, error: 'RazorpayX payout id missing in provider response.' };
    }

    return { success: true, payoutId };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Could not initiate payout.' };
  }
}

type PaymentRevenueSplitInput = {
  idToken: string;
  paymentId: string;
  teacherId?: string | null;
  linkedContentType?: string | null;
  linkedContentId?: string | null;
  saleType?: string;
  grossAmount?: number;
  currency?: string;
  purchasedAt?: string;
  metadata?: Record<string, unknown>;
  studentName?: string;
  studentEmail?: string;
  userEmail?: string;
};

type PaymentRevenueSplitResult = {
  success: boolean;
  split?: {
    grossAmount: number;
    adminCommissionPercent: number;
    adminCommissionAmount: number;
    teacherPayoutAmount: number;
  };
  error?: string;
};

type RecoverablePremiumCustomMockPayment = {
  paymentId: string;
  orderId: string;
  amount: number;
  paidAt: string;
  teacherId: string;
  examTypeId: string;
  classId: string;
  questionAmountPaid: number;
  attemptAmountPaid: number;
  attemptActionKind: string;
};

type PayoutMethod = 'upi' | 'bank_account';

type PayoutDestinationSnapshot = {
  method: PayoutMethod;
  label: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  payoutTransferMode: 'UPI' | 'BANK_TRANSFER';
  hasUpiRoute?: boolean;
  hasBankRoute?: boolean;
  bankName?: string | null;
  bankIfsc?: string | null;
  accountHolderName?: string | null;
  bankAccountNumber?: string | null;
  accountLast4?: string | null;
  upiId?: string | null;
  upiIdMasked?: string | null;
  updatedAt?: string | null;
};

const cleanString = (value: unknown) => String(value || '').trim();
const toNumber = (value: unknown) => Number(Number(value || 0).toFixed(2));

const sanitizeMetadata = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw !== undefined) {
      output[key] = raw;
    }
  }
  return output;
};

const normalizePhoneNumber = (value: unknown) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};

export async function resolveSavedPhoneOtpLogin(
  input: ResolveSavedPhoneOtpLoginInput
): Promise<ResolveSavedPhoneOtpLoginResult> {
  try {
    const idToken = cleanString(input?.idToken);
    if (!idToken) {
      return { success: false, error: 'Missing auth token.' };
    }

    const app = getAdminApp();
    const auth = getAdminAuth(app);
    const db = getAdminFirestore(app);
    const decoded = await auth.verifyIdToken(idToken);

    const signInProvider = cleanString((decoded as { firebase?: { sign_in_provider?: string } }).firebase?.sign_in_provider);
    const verifiedPhone = cleanString((decoded as { phone_number?: string }).phone_number);
    const normalizedPhone = normalizePhoneNumber(verifiedPhone);

    if (signInProvider && signInProvider !== 'phone') {
      return { success: false, error: 'This session is not a phone OTP session.' };
    }
    if (!normalizedPhone) {
      return { success: false, error: 'No verified phone number was found for this OTP session.' };
    }

    const matchedProfiles = new Map<string, Record<string, unknown>>();
    const phoneCandidates = Array.from(new Set([normalizedPhone, verifiedPhone].filter(Boolean)));

    for (const phoneCandidate of phoneCandidates) {
      const snapshot = await db.collection('users').where('phoneNumber', '==', phoneCandidate).limit(5).get();
      snapshot.docs.forEach((entry) => {
        matchedProfiles.set(entry.id, entry.data() as Record<string, unknown>);
      });
    }

    const completedMatches = Array.from(matchedProfiles.entries()).filter(([profileId, profile]) => {
      if (profileId === cleanString(decoded.uid)) return false;
      const roleId = cleanString(profile.roleId);
      return Boolean(roleId) && normalizePhoneNumber(profile.phoneNumber) === normalizedPhone;
    });

    if (completedMatches.length === 0) {
      return { success: false, error: 'This phone number is not saved on any completed account yet.' };
    }

    if (completedMatches.length > 1) {
      return { success: false, error: 'This phone number is linked to multiple accounts. Please use Email or Google login once and keep only one saved phone number.' };
    }

    const [matchedUid] = completedMatches[0];
    await auth.getUser(matchedUid);
    const customToken = await auth.createCustomToken(matchedUid, { phone_login: true });

    return { success: true, customToken };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Could not match the verified phone number to an existing account.',
    };
  }
}

const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isValidUpiId = (value: string) => /^[a-z0-9._-]{2,}@[a-z][a-z0-9.-]{1,}$/i.test(value);
const isValidIfscCode = (value: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value);

const maskAccountNumber = (value: string) => {
  if (!value) return '';
  const visible = value.slice(-4);
  return `${'*'.repeat(Math.max(0, value.length - 4))}${visible}`;
};

const maskUpiId = (value: string) => {
  const normalized = cleanString(value).toLowerCase();
  const [handle, domain] = normalized.split('@');
  if (!handle || !domain) return normalized;
  const visiblePrefix = handle.slice(0, Math.min(3, handle.length));
  const hiddenLength = Math.max(1, handle.length - visiblePrefix.length);
  return `${visiblePrefix}${'*'.repeat(hiddenLength)}@${domain}`;
};

const buildPayoutDestinationLabel = (input: {
  hasUpiRoute: boolean;
  hasBankRoute: boolean;
  upiIdMasked?: string | null;
  bankName?: string | null;
  accountLast4?: string | null;
}) => {
  if (input.hasUpiRoute && input.hasBankRoute) {
    return 'UPI + Bank details saved';
  }
  if (input.hasUpiRoute) {
    return `UPI • ${cleanString(input.upiIdMasked) || 'Saved route'}`;
  }
  const bankName = cleanString(input.bankName) || 'Bank';
  const accountLast4 = cleanString(input.accountLast4);
  return `Bank • ${bankName}${accountLast4 ? ` • ****${accountLast4}` : ''}`;
};

const getRazorpayXCredentials = () => {
  const keyId = process.env.RAZORPAYX_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAYX_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
  const sourceAccountNumber =
    process.env.RAZORPAYX_SOURCE_ACCOUNT_NUMBER ||
    process.env.RAZORPAYX_ACCOUNT_NUMBER;

  return {
    keyId: cleanString(keyId),
    keySecret: cleanString(keySecret),
    sourceAccountNumber: cleanString(sourceAccountNumber),
  };
};

const getRazorpayXHeaders = () => {
  const creds = getRazorpayXCredentials();
  if (!creds.keyId || !creds.keySecret) {
    return null;
  }
  const basicToken = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
  return {
    creds,
    headers: {
      Authorization: `Basic ${basicToken}`,
      'Content-Type': 'application/json',
    },
  };
};

const readProviderError = (payload: unknown, fallback: string) =>
  cleanString((payload as any)?.error?.description || (payload as any)?.error?.reason || (payload as any)?.message) || fallback;

const upsertRazorpayXContact = async (input: {
  existingContactId?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  referenceId: string;
}) => {
  const auth = getRazorpayXHeaders();
  if (!auth) {
    return {
      success: false as const,
      error: 'RazorpayX contact verification is not configured. Missing key configuration.',
    };
  }

  const createContactPayload = {
    name: input.contactName,
    email: input.contactEmail,
    contact: input.contactPhone,
    type: 'vendor',
    reference_id: input.referenceId,
  };
  const updatePayload = {
    name: input.contactName,
    email: input.contactEmail,
    contact: input.contactPhone,
  };

  const existingContactId = cleanString(input.existingContactId);
  if (existingContactId) {
    const patchResponse = await fetch(`https://api.razorpay.com/v1/contacts/${existingContactId}`, {
      method: 'PATCH',
      headers: auth.headers,
      body: JSON.stringify(updatePayload),
      cache: 'no-store',
    });
    const patchPayload = await patchResponse.json().catch(() => ({}));
    if (patchResponse.ok) {
      const contactId = cleanString((patchPayload as any)?.id || existingContactId);
      if (contactId) {
        return { success: true as const, contactId };
      }
    }
  }

  const createResponse = await fetch('https://api.razorpay.com/v1/contacts', {
    method: 'POST',
    headers: auth.headers,
    body: JSON.stringify(createContactPayload),
    cache: 'no-store',
  });
  const createPayload = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok) {
    return {
      success: false as const,
      error: readProviderError(createPayload, 'Could not verify payout contact with RazorpayX.'),
    };
  }

  const contactId = cleanString((createPayload as any)?.id);
  if (!contactId) {
    return { success: false as const, error: 'RazorpayX contact id missing in provider response.' };
  }

  return { success: true as const, contactId };
};

const createRazorpayXFundAccount = async (input:
  | {
      method: 'upi';
      contactId: string;
      contactName: string;
      upiId: string;
    }
  | {
      method: 'bank_account';
      contactId: string;
      accountHolderName: string;
      accountNumber: string;
      ifscCode: string;
    }) => {
  const auth = getRazorpayXHeaders();
  if (!auth) {
    return {
      success: false as const,
      error: 'RazorpayX fund-account verification is not configured. Missing key configuration.',
    };
  }

  const payload =
    input.method === 'upi'
      ? {
          contact_id: input.contactId,
          account_type: 'vpa',
          vpa: {
            address: input.upiId,
          },
        }
      : {
          contact_id: input.contactId,
          account_type: 'bank_account',
          bank_account: {
            name: input.accountHolderName,
            ifsc: input.ifscCode,
            account_number: input.accountNumber,
          },
        };

  const response = await fetch('https://api.razorpay.com/v1/fund_accounts', {
    method: 'POST',
    headers: auth.headers,
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const providerPayload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false as const,
      error: readProviderError(providerPayload, 'Could not verify payout destination with RazorpayX.'),
    };
  }

  const fundAccountId = cleanString((providerPayload as any)?.id);
  if (!fundAccountId) {
    return { success: false as const, error: 'RazorpayX fund account id missing in provider response.' };
  }

  return { success: true as const, fundAccountId };
};

const buildStoredPayoutSnapshot = (userData: Record<string, unknown>): PayoutDestinationSnapshot | null => {
  const status = cleanString(userData.payoutDetailsStatus).toLowerCase();
  const method = cleanString(userData.payoutMethod).toLowerCase();
  const contactName = cleanString(userData.payoutContactName);
  const contactEmail = cleanString(userData.payoutContactEmail);
  const contactPhone = cleanString(userData.payoutContactPhone);
  const upiId = cleanString(userData.payoutUpiId) || null;
  const upiIdMasked = cleanString(userData.payoutUpiIdMasked) || null;
  const bankAccountNumber = cleanString(userData.payoutBankAccountNumber) || null;
  const bankName = cleanString(userData.payoutBankName) || null;
  const bankIfsc = cleanString(userData.payoutBankIfsc) || null;
  const accountHolderName = cleanString(userData.payoutAccountHolderName) || null;
  const accountLast4 = cleanString(userData.payoutBankAccountLast4) || null;
  const hasUpiRoute = Boolean(upiId || upiIdMasked);
  const hasBankRoute = Boolean(bankAccountNumber && bankName && bankIfsc);
  const payoutTransferMode =
    method === 'bank_account' && hasBankRoute ? 'BANK_TRANSFER' : 'UPI';
  const resolvedMethod =
    method === 'upi' && hasUpiRoute
      ? 'upi'
      : method === 'bank_account' && hasBankRoute
        ? 'bank_account'
        : hasUpiRoute
          ? 'upi'
          : hasBankRoute
            ? 'bank_account'
            : '';
  const label = buildPayoutDestinationLabel({
    hasUpiRoute,
    hasBankRoute,
    upiIdMasked,
    bankName,
    accountLast4,
  });

  if (!['saved', 'submitted', 'verified'].includes(status) || !contactName || !contactEmail || !contactPhone) {
    return null;
  }
  if (!hasUpiRoute && !hasBankRoute) {
    return null;
  }
  if (resolvedMethod !== 'upi' && resolvedMethod !== 'bank_account') {
    return null;
  }

  return {
    method: resolvedMethod as PayoutMethod,
    label,
    contactName,
    contactEmail,
    contactPhone,
    payoutTransferMode,
    hasUpiRoute,
    hasBankRoute,
    bankName,
    bankIfsc,
    accountHolderName,
    bankAccountNumber,
    accountLast4,
    upiId,
    upiIdMasked,
    updatedAt: cleanString(userData.payoutDetailsUpdatedAt || userData.payoutDetailsVerifiedAt) || null,
  };
};

const verifyCapturedRazorpayPayment = async (input: {
  paymentId: string;
  orderId?: string;
  amountInInr: number;
  currency: string;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return { success: false, error: 'Razorpay credentials are not configured.' };
    }

    const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const payment = await instance.payments.fetch(input.paymentId);
    if (!payment || typeof payment !== 'object') {
      return { success: false, error: 'Could not fetch payment from Razorpay.' };
    }

    const paymentStatus = cleanString((payment as any).status).toLowerCase();
    if (paymentStatus !== 'captured') {
      return { success: false, error: `Razorpay payment is not captured (status: ${paymentStatus || 'unknown'}).` };
    }

    if (input.orderId && cleanString((payment as any).order_id) && cleanString((payment as any).order_id) !== cleanString(input.orderId)) {
      return { success: false, error: 'Razorpay order reference mismatch.' };
    }

    const paidAmountMinor = Number((payment as any).amount || 0);
    const expectedAmountMinor = Math.round(toNumber(input.amountInInr) * 100);
    if (!Number.isFinite(paidAmountMinor) || paidAmountMinor !== expectedAmountMinor) {
      return { success: false, error: 'Razorpay amount mismatch.' };
    }

    const paidCurrency = cleanString((payment as any).currency).toUpperCase();
    const expectedCurrency = cleanString(input.currency || 'INR').toUpperCase();
    if (paidCurrency && expectedCurrency && paidCurrency !== expectedCurrency) {
      return { success: false, error: 'Razorpay currency mismatch.' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to verify payment with Razorpay.' };
  }
};

type ServerVerifiedPaymentWrite = {
  path: string;
  data: Record<string, unknown>;
  merge?: boolean;
};

type CompleteVerifiedPaymentInput = {
  idToken: string;
  orderId: string;
  paymentId: string;
  signature: string;
  grossAmount: number;
  currency?: string;
  paymentData: Record<string, unknown>;
  writes?: ServerVerifiedPaymentWrite[];
  userProfileUpdates?: Record<string, unknown>;
  revenueSplit?: Omit<PaymentRevenueSplitInput, 'idToken' | 'paymentId' | 'grossAmount' | 'currency'>;
};

type CompleteVerifiedPaymentResult = {
  success: boolean;
  error?: string;
  split?: PaymentRevenueSplitResult['split'];
};

const serverVerifiedPaymentSubcollections = new Set([
  'enrolled_live_batches',
  'purchased_courses',
  'purchased_live_batches',
  'purchased_mock_tests',
  'purchased_teacher_offers',
  'premium_mock_feature_purchases',
  'premium_practice_session_purchases',
  'subscriptions',
  'teacher_offer_purchases',
  'teacher_question_purchases',
]);

const serverVerifiedUserProfileFields = new Set([
  'subscriptionStatus',
  'subscriptionPlanId',
]);

const sanitizeAdminFirestoreValue = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeAdminFirestoreValue(item))
      .filter((item) => item !== undefined);
  }
  if (typeof value !== 'object') return value;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== '__proto__' && key !== 'constructor' && key !== 'prototype')
    .map(([key, item]) => [key, sanitizeAdminFirestoreValue(item)] as const)
    .filter(([, item]) => item !== undefined);

  return Object.fromEntries(entries);
};

const sanitizeAdminFirestoreObject = (value: Record<string, unknown>) =>
  sanitizeAdminFirestoreValue(value) as Record<string, unknown>;

const normalizeServerWritePath = (path: unknown) => cleanString(path).replace(/^\/+|\/+$/g, '');

const assertRequesterOwnedWrite = (data: Record<string, unknown>, requesterId: string) => {
  const userBoundFields = ['userId', 'studentId', 'buyerId'];
  for (const field of userBoundFields) {
    const value = cleanString(data[field]);
    if (value && value !== requesterId) {
      throw new Error(`Payment write has an invalid ${field}.`);
    }
  }
};

const assertAllowedServerVerifiedPaymentWrite = (
  write: ServerVerifiedPaymentWrite,
  requesterId: string
) => {
  const path = normalizeServerWritePath(write.path);
  const segments = path.split('/').filter(Boolean);
  if (segments.length !== 4 || segments[0] !== 'users' || segments[1] !== requesterId) {
    throw new Error('Payment completion can only write requester-owned purchase records.');
  }
  const collectionId = segments[2];
  if (!serverVerifiedPaymentSubcollections.has(collectionId) || !segments[3]) {
    throw new Error('Payment completion write target is not allowed.');
  }
  const data = sanitizeAdminFirestoreObject(write.data || {});
  assertRequesterOwnedWrite(data, requesterId);
  if (
    collectionId !== 'subscriptions'
    && collectionId !== 'enrolled_live_batches'
    && cleanString(data.status)
    && cleanString(data.status).toLowerCase() !== 'paid'
  ) {
    throw new Error('Payment completion can only create paid purchase records.');
  }
  return {
    path,
    data,
    merge: write.merge !== false,
  };
};

const sanitizeVerifiedPaymentData = (input: {
  data: Record<string, unknown>;
  requesterId: string;
  paymentId: string;
  orderId: string;
  grossAmount: number;
  currency: string;
}) => {
  const data = sanitizeAdminFirestoreObject(input.data || {});
  assertRequesterOwnedWrite(data, input.requesterId);
  if (cleanString(data.userId) && cleanString(data.userId) !== input.requesterId) {
    throw new Error('Payment user does not match the signed-in user.');
  }

  return {
    ...data,
    id: input.paymentId,
    userId: input.requesterId,
    status: 'paid',
    grossAmount: input.grossAmount,
    currency: input.currency,
    razorpayOrderId: input.orderId,
    razorpayPaymentId: input.paymentId,
    serverVerified: true,
    serverVerifiedAt: new Date().toISOString(),
  };
};

const sanitizeServerVerifiedUserProfileUpdates = (value: Record<string, unknown> | undefined) => {
  if (!value || typeof value !== 'object') return null;
  const output: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, raw]) => {
    if (!serverVerifiedUserProfileFields.has(key)) return;
    const sanitized = sanitizeAdminFirestoreValue(raw);
    if (sanitized !== undefined) output[key] = sanitized;
  });
  return Object.keys(output).length ? output : null;
};

export async function completeVerifiedPayment(
  input: CompleteVerifiedPaymentInput
): Promise<CompleteVerifiedPaymentResult> {
  try {
    const idToken = cleanString(input?.idToken);
    const orderId = cleanString(input?.orderId);
    const paymentId = cleanString(input?.paymentId);
    const signature = cleanString(input?.signature);
    const grossAmount = toNumber(input?.grossAmount);
    const currency = cleanString(input?.currency || 'INR').toUpperCase();

    if (!idToken || !orderId || !paymentId || !signature) {
      return { success: false, error: 'Missing payment verification context.' };
    }
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      return { success: false, error: 'Invalid payment amount.' };
    }
    if (currency !== 'INR') {
      return { success: false, error: 'Unsupported payment currency.' };
    }

    const signatureVerification = await verifyRazorpayPayment(orderId, paymentId, signature);
    if (!signatureVerification.verified) {
      return { success: false, error: signatureVerification.error || 'Payment signature verification failed.' };
    }

    const capturedVerification = await verifyCapturedRazorpayPayment({
      paymentId,
      orderId,
      amountInInr: grossAmount,
      currency,
    });
    if (!capturedVerification.success) {
      return { success: false, error: capturedVerification.error || 'Payment capture verification failed.' };
    }

    const app = getAdminApp();
    const auth = getAdminAuth(app);
    const db = getAdminFirestore(app);
    const decoded = await auth.verifyIdToken(idToken);
    const requesterId = cleanString(decoded.uid);
    if (!requesterId) {
      return { success: false, error: 'Could not resolve the signed-in user.' };
    }

    const paymentData = sanitizeVerifiedPaymentData({
      data: input.paymentData || {},
      requesterId,
      paymentId,
      orderId,
      grossAmount,
      currency,
    });
    const writes = (Array.isArray(input.writes) ? input.writes : [])
      .map((write) => assertAllowedServerVerifiedPaymentWrite(write, requesterId));
    const userProfileUpdates = sanitizeServerVerifiedUserProfileUpdates(input.userProfileUpdates);
    const nowIso = new Date().toISOString();

    await db.runTransaction(async (tx) => {
      const paymentRef = db.doc(`payments/${paymentId}`);
      tx.set(paymentRef, paymentData, { merge: true });

      if (userProfileUpdates) {
        tx.set(
          db.doc(`users/${requesterId}`),
          {
            ...userProfileUpdates,
            subscriptionUpdatedAt: nowIso,
          },
          { merge: true }
        );
      }

      writes.forEach((write) => {
        tx.set(
          db.doc(write.path),
          {
            ...write.data,
            serverVerifiedPaymentId: paymentId,
            serverVerifiedAt: nowIso,
          },
          { merge: write.merge }
        );
      });
    });

    if (input.revenueSplit) {
      const splitResult = await finalizePaymentRevenueSplit({
        ...input.revenueSplit,
        idToken,
        paymentId,
        grossAmount,
        currency,
      });
      if (!splitResult.success) {
        return { success: false, error: splitResult.error || 'Could not credit revenue split.' };
      }
      return { success: true, split: splitResult.split };
    }

    return { success: true };
  } catch (error: any) {
    console.error('completeVerifiedPayment failed:', error);
    return {
      success: false,
      error: error?.message || 'Could not complete this verified payment.',
    };
  }
}

export async function findRecoverablePremiumCustomMockPayments(input: {
  idToken: string;
  teacherId?: string | null;
  examTypeId?: string | null;
  classId?: string | null;
  limit?: number;
}): Promise<{ success: boolean; payments?: RecoverablePremiumCustomMockPayment[]; error?: string }> {
  try {
    const idToken = cleanString(input?.idToken);
    if (!idToken) {
      return { success: false, error: 'Missing auth token.' };
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return { success: false, error: 'Razorpay is not configured.' };
    }

    const app = getAdminApp();
    const auth = getAdminAuth(app);
    const db = getAdminFirestore(app);
    const decoded = await auth.verifyIdToken(idToken);
    const requesterId = cleanString(decoded.uid);
    const teacherId = cleanString(input.teacherId);
    const examTypeId = cleanString(input.examTypeId);
    const classId = cleanString(input.classId);
    const limit = Math.min(Math.max(Number(input.limit) || 5, 1), 10);

    const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const from = Math.floor((Date.now() - (30 * 24 * 60 * 60 * 1000)) / 1000);
    const paymentList = await instance.payments.all({ from, count: 100 });
    const paymentItems = Array.isArray((paymentList as any)?.items) ? (paymentList as any).items : [];

    const recoverablePayments: RecoverablePremiumCustomMockPayment[] = [];

    for (const payment of paymentItems) {
      if (recoverablePayments.length >= limit) break;

      const paymentId = cleanString((payment as any)?.id);
      const status = cleanString((payment as any)?.status).toLowerCase();
      const notes = ((payment as any)?.notes && typeof (payment as any).notes === 'object')
        ? ((payment as any).notes as Record<string, unknown>)
        : {};

      if (!paymentId || status !== 'captured') continue;
      if (cleanString(notes.source).toLowerCase() !== 'premium_custom_mock_test') continue;
      if (cleanString(notes.userId) !== requesterId) continue;
      if (teacherId && cleanString(notes.teacherId) !== teacherId) continue;
      if (examTypeId && cleanString(notes.examTypeId) !== examTypeId) continue;
      if (classId && cleanString(notes.classId) !== classId) continue;

      const existingCustomTestsSnap = await db
        .collection(`users/${requesterId}/custom_tests`)
        .where('lastPaymentId', '==', paymentId)
        .limit(1)
        .get();
      if (!existingCustomTestsSnap.empty) continue;

      const amountMinor = Number((payment as any)?.amount || 0);
      const amount = Number((amountMinor / 100).toFixed(2));
      const createdAtSeconds = Number((payment as any)?.created_at || 0);
      const paidAt = createdAtSeconds > 0
        ? new Date(createdAtSeconds * 1000).toISOString()
        : new Date().toISOString();
      const attemptAmountPaid = toNumber(notes.attemptAmountPayable);
      const questionAmountFromNotes = toNumber(notes.questionAmountPayable);
      const questionAmountPaid = questionAmountFromNotes > 0
        ? questionAmountFromNotes
        : Number(Math.max(0, amount - attemptAmountPaid).toFixed(2));

      recoverablePayments.push({
        paymentId,
        orderId: cleanString((payment as any)?.order_id),
        amount,
        paidAt,
        teacherId: cleanString(notes.teacherId),
        examTypeId: cleanString(notes.examTypeId),
        classId: cleanString(notes.classId),
        questionAmountPaid,
        attemptAmountPaid,
        attemptActionKind: cleanString(notes.premiumCustomMockAttemptActionKind || 'none') || 'none',
      });
    }

    return { success: true, payments: recoverablePayments };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Could not load recoverable premium custom-mock payments.',
    };
  }
}

const resolveTeacherIdForRevenue = async (input: {
  db: ReturnType<typeof getAdminFirestore>;
  linkedContentType?: string | null;
  linkedContentId?: string | null;
  fallbackTeacherId?: string | null;
}) => {
  const type = cleanString(input.linkedContentType);
  const linkedId = cleanString(input.linkedContentId);
  const fallbackTeacherId = cleanString(input.fallbackTeacherId);

  if (type === 'course' && linkedId) {
    const snap = await input.db.doc(`courses/${linkedId}`).get();
    return cleanString(snap.data()?.teacherId || fallbackTeacherId);
  }
  if (type === 'mock_test' && linkedId) {
    const snap = await input.db.doc(`mock_tests/${linkedId}`).get();
    return cleanString(snap.data()?.teacherId || fallbackTeacherId);
  }
  if (type === 'live_batch' && linkedId) {
    const snap = await input.db.doc(`live_batches/${linkedId}`).get();
    return cleanString(snap.data()?.teacherId || fallbackTeacherId);
  }
  if ((type === 'premium_practice_session' || type === 'practice_session') && linkedId) {
    return linkedId;
  }

  return fallbackTeacherId;
};

const computeRevenueSplitForPayment = async (input: {
  db: ReturnType<typeof getAdminFirestore>;
  teacherId?: string | null;
  linkedContentType?: string | null;
  grossAmount: number;
}) => {
  const normalizedTeacherId = cleanString(input.teacherId);
  const grossAmount = toNumber(input.grossAmount);
  const commissionKey = getCommissionKeyFromLinkedContentType(input.linkedContentType);

  if (!normalizedTeacherId) {
    return {
      ...calculateRevenueSplit(grossAmount, 100),
      commissionKey,
    };
  }

  const settingsSnap = await input.db.doc('platform_settings/revenue').get();
  const settings = settingsSnap.exists ? (settingsSnap.data() as RevenueSettingsDoc) : null;

  const overrideSnap = await input.db.doc(`teacher_commission_overrides/${normalizedTeacherId}`).get();
  const override = overrideSnap.exists ? (overrideSnap.data() as TeacherCommissionOverrideDoc) : null;

  const defaults = resolveDefaultCommissions(settings);
  const overrides = resolveOverrideCommissions(override);
  const adminCommissionPercent = overrides[commissionKey] ?? defaults[commissionKey];

  return {
    ...calculateRevenueSplit(grossAmount, adminCommissionPercent),
    commissionKey,
  };
};

export async function finalizePaymentRevenueSplit(input: PaymentRevenueSplitInput): Promise<PaymentRevenueSplitResult> {
  try {
    const paymentId = cleanString(input?.paymentId);
    const idToken = cleanString(input?.idToken);
    if (!paymentId || !idToken) {
      return { success: false, error: 'Missing payment context.' };
    }

    const app = getAdminApp();
    const auth = getAdminAuth(app);
    const db = getAdminFirestore(app);
    const decoded = await auth.verifyIdToken(idToken);
    const requesterId = cleanString(decoded.uid);

    const paymentRef = db.doc(`payments/${paymentId}`);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) {
      return { success: false, error: 'Payment record not found.' };
    }
    const paymentData = paymentSnap.data() || {};

    if (cleanString(paymentData.userId) !== requesterId) {
      return { success: false, error: 'You are not authorized for this payment.' };
    }
    if (cleanString(paymentData.status).toLowerCase() !== 'paid') {
      return { success: false, error: 'Payment is not marked as paid.' };
    }

    const existingGross = toNumber(paymentData.grossAmount);
    const grossAmount = existingGross > 0 ? existingGross : toNumber(input.grossAmount);
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      return { success: false, error: 'Invalid payment amount.' };
    }

    const currency = cleanString(paymentData.currency || input.currency || 'INR').toUpperCase();
    const linkedContentType = cleanString(paymentData.linkedContentType || input.linkedContentType || '');
    const linkedContentId = cleanString(paymentData.linkedContentId || input.linkedContentId || '');
    const fallbackTeacherId = cleanString(paymentData.teacherId || input.teacherId || '');
    const purchasedAt = cleanString(paymentData.purchasedAt || input.purchasedAt) || new Date().toISOString();
    const saleType = cleanString(paymentData.type || input.saleType || linkedContentType || 'purchase');

    if (paymentData.revenueSplitProcessed === true) {
      return {
        success: true,
        split: {
          grossAmount,
          adminCommissionPercent: toNumber(paymentData.adminCommissionPercent),
          adminCommissionAmount: toNumber(paymentData.adminCommissionAmount),
          teacherPayoutAmount: toNumber(paymentData.teacherPayoutAmount),
        },
      };
    }

    const razorpayPaymentId = cleanString(paymentData.razorpayPaymentId || paymentId);
    const razorpayOrderId = cleanString(paymentData.razorpayOrderId || '');
    const paymentVerification = await verifyCapturedRazorpayPayment({
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId || undefined,
      amountInInr: grossAmount,
      currency,
    });
    if (!paymentVerification.success) {
      return { success: false, error: paymentVerification.error || 'Payment verification failed.' };
    }

    const resolvedTeacherId = await resolveTeacherIdForRevenue({
      db,
      linkedContentType,
      linkedContentId,
      fallbackTeacherId,
    });

    const split = await computeRevenueSplitForPayment({
      db,
      teacherId: resolvedTeacherId || null,
      linkedContentType,
      grossAmount,
    });
    const nowIso = new Date().toISOString();
    const metadata = sanitizeMetadata(input.metadata);
    const studentName = cleanString(input.studentName || paymentData.studentName || decoded.name || '');
    const studentEmail = cleanString(input.studentEmail || input.userEmail || paymentData.userEmail || decoded.email || '');

    await db.runTransaction(async (tx) => {
      const livePaymentSnap = await tx.get(paymentRef);
      const livePaymentData = livePaymentSnap.data() || {};
      if (!livePaymentSnap.exists) {
        throw new Error('Payment record missing during split finalization.');
      }
      if (cleanString(livePaymentData.userId) !== requesterId) {
        throw new Error('Payment ownership mismatch.');
      }
      if (cleanString(livePaymentData.status).toLowerCase() !== 'paid') {
        throw new Error('Payment is not paid.');
      }
      if (livePaymentData.revenueSplitProcessed === true) {
        return;
      }

      const adminWalletRef = db.doc('wallets/admin_main');
      tx.set(
        adminWalletRef,
        {
          id: 'admin_main',
          ownerType: 'admin',
          ownerId: 'admin_main',
          availableBalance: FieldValue.increment(split.adminCommissionAmount),
          totalEarned: FieldValue.increment(split.adminCommissionAmount),
          updatedAt: purchasedAt,
        },
        { merge: true }
      );

      if (resolvedTeacherId && split.teacherPayoutAmount > 0) {
        const teacherWalletRef = db.doc(`wallets/teacher_${resolvedTeacherId}`);
        tx.set(
          teacherWalletRef,
          {
            id: `teacher_${resolvedTeacherId}`,
            ownerType: 'teacher',
            ownerId: resolvedTeacherId,
            availableBalance: FieldValue.increment(split.teacherPayoutAmount),
            totalEarned: FieldValue.increment(split.teacherPayoutAmount),
            updatedAt: purchasedAt,
          },
          { merge: true }
        );

        const teacherSaleRef = db.doc(`users/${resolvedTeacherId}/sales/${paymentId}`);
        tx.set(
          teacherSaleRef,
          {
            id: paymentId,
            teacherId: resolvedTeacherId,
            studentId: requesterId,
            studentName,
            studentEmail,
            linkedContentType: linkedContentType || null,
            linkedContentId: linkedContentId || null,
            saleType,
            status: 'paid',
            grossAmount: split.grossAmount,
            adminCommissionPercent: split.adminCommissionPercent,
            adminCommissionAmount: split.adminCommissionAmount,
            teacherPayoutAmount: split.teacherPayoutAmount,
            amount: split.grossAmount,
            currency,
            purchasedAt,
            createdAt: FieldValue.serverTimestamp(),
            sourcePaymentId: paymentId,
            commissionKey: split.commissionKey,
            ...metadata,
          },
          { merge: true }
        );
      }

      const walletTxRef = db.doc(`wallet_transactions/sale_${paymentId}`);
      tx.set(
        walletTxRef,
        {
          id: `sale_${paymentId}`,
          entryType: 'sale_credit',
          status: 'paid',
          paymentId,
          teacherId: resolvedTeacherId || null,
          userId: requesterId,
          userEmail: cleanString(paymentData.userEmail || input.userEmail || decoded.email || ''),
          studentName,
          studentEmail,
          linkedContentType: linkedContentType || null,
          linkedContentId: linkedContentId || null,
          saleType,
          grossAmount: split.grossAmount,
          adminCommissionPercent: split.adminCommissionPercent,
          adminCommissionAmount: split.adminCommissionAmount,
          teacherPayoutAmount: split.teacherPayoutAmount,
          currency,
          createdAt: purchasedAt,
          createdAtServer: FieldValue.serverTimestamp(),
          commissionKey: split.commissionKey,
          ...metadata,
        },
        { merge: true }
      );

      tx.set(
        paymentRef,
        {
          teacherId: resolvedTeacherId || null,
          adminCommissionPercent: split.adminCommissionPercent,
          adminCommissionAmount: split.adminCommissionAmount,
          teacherPayoutAmount: split.teacherPayoutAmount,
          revenueSplitProcessed: true,
          revenueSplitProcessedAt: nowIso,
          splitStatus: 'credited',
          commissionKey: split.commissionKey,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    });

    return {
      success: true,
      split: {
        grossAmount: split.grossAmount,
        adminCommissionPercent: split.adminCommissionPercent,
        adminCommissionAmount: split.adminCommissionAmount,
        teacherPayoutAmount: split.teacherPayoutAmount,
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Could not finalize revenue split.' };
  }
}

const getAdminApp = () => {
  if (getAdminApps().length > 0) return getAdminApps()[0];

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return initializeAdminApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  return initializeAdminApp({
    credential: applicationDefault(),
    projectId,
  });
};

type AdminDb = ReturnType<typeof getAdminFirestore>;

type BellActionResult = {
  success: boolean;
  notificationId?: string;
  deliveredCount?: number;
  error?: string;
};

type PushSelfBellNotificationInput = {
  idToken: string;
  title: string;
  message: string;
  href?: string | null;
  notificationType: string;
  dedupeKey: string;
  contentType?: string | null;
  contentId?: string | null;
  teacherId?: string | null;
  batchId?: string | null;
  courseId?: string | null;
  testId?: string | null;
  liveBatchId?: string | null;
  eventDate?: string | null;
  eventEndDate?: string | null;
  eventTime?: string | null;
  eventEndTime?: string | null;
  accessLevel?: string | null;
  metadata?: Record<string, unknown>;
};

type FanOutLiveBatchBellNotificationInput = {
  idToken: string;
  batchId: string;
  title: string;
  message: string;
  notificationType: string;
  dedupeKey: string;
  href?: string | null;
  eventDate?: string | null;
  eventEndDate?: string | null;
  eventTime?: string | null;
  eventEndTime?: string | null;
};

type FanOutTeacherPublicationBellNotificationInput = {
  idToken: string;
  contentType: 'course' | 'mock_test' | 'live_batch';
  contentId: string;
};

type AdminVisiblePasswordSource =
  | 'admin_reset'
  | 'email_login'
  | 'google_password_link'
  | 'profile_change'
  | 'student_registration'
  | 'teacher_registration';

type SaveAdminVisibleUserPasswordInput = {
  idToken: string;
  password: string;
  source?: AdminVisiblePasswordSource;
  userId?: string;
};

type SaveAdminVisibleUserPasswordResult = {
  success: boolean;
  updatedAt?: string;
  error?: string;
};

type GetAdminVisibleUserPasswordInput = {
  idToken: string;
  userId: string;
};

type GetAdminVisibleUserPasswordResult = {
  success: boolean;
  currentPassword?: string | null;
  updatedAt?: string | null;
  source?: AdminVisiblePasswordSource | null;
  updatedByUserEmail?: string | null;
  updatedByRoleId?: string | null;
  userEmail?: string | null;
  userRoleId?: string | null;
  error?: string;
};

type AdminResetUserPasswordInput = {
  idToken: string;
  userId: string;
  newPassword: string;
};

type AdminResetUserPasswordResult = {
  success: boolean;
  currentPassword?: string;
  updatedAt?: string;
  error?: string;
};

const buildNotificationDocId = (namespace: string, recipientId: string, dedupeKey: string) =>
  crypto.createHash('sha1').update(`${namespace}:${recipientId}:${dedupeKey}`).digest('hex');

const chunkItems = <T,>(items: T[], size = 400) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const extractUserIdFromNestedPath = (path: string) => {
  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2 || segments[0] !== 'users') return '';
  return cleanString(segments[1]);
};

const getRequesterContext = async (db: AdminDb, auth: ReturnType<typeof getAdminAuth>, idToken: string) => {
  const decoded = await auth.verifyIdToken(idToken);
  const requesterId = cleanString(decoded.uid);
  const requesterSnap = requesterId ? await db.doc(`users/${requesterId}`).get() : null;
  const requesterRoleId = requesterSnap?.exists ? cleanString(requesterSnap.data()?.roleId) : '';
  return {
    requesterId,
    requesterRoleId,
    isAdmin: requesterRoleId === 'admin',
  };
};

const ensureAdminRequester = async (db: AdminDb, auth: ReturnType<typeof getAdminAuth>, idToken: string) => {
  const decoded = await auth.verifyIdToken(idToken);
  const requesterId = cleanString(decoded.uid);
  if (!requesterId) {
    throw new Error('Could not resolve the current admin.');
  }

  const adminRoleSnap = await db.doc(`roles_admin/${requesterId}`).get();
  if (!adminRoleSnap.exists) {
    throw new Error('Only admins can manage user passwords.');
  }

  const requesterSnap = await db.doc(`users/${requesterId}`).get();
  const requesterData = requesterSnap.exists ? requesterSnap.data() || {} : {};

  return {
    requesterId,
    requesterEmail: cleanString(decoded.email || requesterData.email).toLowerCase() || null,
    requesterRoleId: cleanString(requesterData.roleId) || 'admin',
  };
};

export async function saveAdminVisibleUserPassword(
  input: SaveAdminVisibleUserPasswordInput
): Promise<SaveAdminVisibleUserPasswordResult> {
  return {
    success: false,
    error: 'Plaintext password storage is disabled. Use Firebase Auth password reset/update flows instead.',
  };
}

export async function getAdminVisibleUserPassword(
  input: GetAdminVisibleUserPasswordInput
): Promise<GetAdminVisibleUserPasswordResult> {
  return {
    success: false,
    currentPassword: null,
    error: 'Plaintext password lookup is disabled.',
  };
}

export async function adminResetUserPassword(
  input: AdminResetUserPasswordInput
): Promise<AdminResetUserPasswordResult> {
  try {
    const idToken = cleanString(input?.idToken);
    const userId = cleanString(input?.userId);
    const newPassword = String(input?.newPassword || '');
    if (!idToken || !userId) {
      return { success: false, error: 'Missing password reset context.' };
    }
    if (newPassword.trim().length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    const app = getAdminApp();
    const auth = getAdminAuth(app);
    const db = getAdminFirestore(app);
    const adminContext = await ensureAdminRequester(db, auth, idToken);

    const userSnap = await db.doc(`users/${userId}`).get();
    if (!userSnap.exists) {
      return { success: false, error: 'User profile not found.' };
    }

    const userData = userSnap.data() || {};
    await auth.updateUser(userId, { password: newPassword });

    return {
      success: true,
      updatedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Could not reset the user password.',
    };
  }
}

const buildNotificationDocData = (input: {
  notificationId: string;
  recipientId: string;
  title: string;
  message: string;
  notificationType: string;
  dedupeKey: string;
  href?: string | null;
  audience?: string | null;
  actorId?: string | null;
  contentType?: string | null;
  contentId?: string | null;
  teacherId?: string | null;
  batchId?: string | null;
  courseId?: string | null;
  testId?: string | null;
  liveBatchId?: string | null;
  eventDate?: string | null;
  eventEndDate?: string | null;
  eventTime?: string | null;
  eventEndTime?: string | null;
  accessLevel?: string | null;
  metadata?: Record<string, unknown>;
}) => {
  const data: Record<string, unknown> = {
    id: input.notificationId,
    recipientId: input.recipientId,
    title: cleanString(input.title) || 'Notification',
    message: cleanString(input.message),
    href: cleanString(input.href) || null,
    audience: cleanString(input.audience) || 'student',
    actorId: cleanString(input.actorId) || null,
    notificationType: cleanString(input.notificationType) || 'general',
    contentType: cleanString(input.contentType) || null,
    contentId: cleanString(input.contentId) || null,
    teacherId: cleanString(input.teacherId) || null,
    batchId: cleanString(input.batchId) || null,
    courseId: cleanString(input.courseId) || null,
    testId: cleanString(input.testId) || null,
    liveBatchId: cleanString(input.liveBatchId) || null,
    eventDate: cleanString(input.eventDate) || null,
    eventEndDate: cleanString(input.eventEndDate) || null,
    eventTime: cleanString(input.eventTime) || null,
    eventEndTime: cleanString(input.eventEndTime) || null,
    accessLevel: cleanString(input.accessLevel) || null,
    dedupeKey: cleanString(input.dedupeKey) || null,
    metadata: sanitizeMetadata(input.metadata),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    isRead: false,
    readAt: null,
  };

  return data;
};

const writeNotificationsForRecipients = async (
  db: AdminDb,
  input: {
    namespace: string;
    dedupeKey: string;
    recipientIds: string[];
    title: string;
    message: string;
    notificationType: string;
    href?: string | null;
    audience?: string | null;
    actorId?: string | null;
    contentType?: string | null;
    contentId?: string | null;
    teacherId?: string | null;
    batchId?: string | null;
    courseId?: string | null;
    testId?: string | null;
    liveBatchId?: string | null;
    eventDate?: string | null;
    eventEndDate?: string | null;
    eventTime?: string | null;
    eventEndTime?: string | null;
    accessLevel?: string | null;
    metadata?: Record<string, unknown>;
  }
) => {
  const recipientIds = Array.from(new Set(input.recipientIds.map((value) => cleanString(value)).filter(Boolean)));
  if (recipientIds.length === 0) return 0;

  for (const chunk of chunkItems(recipientIds)) {
    const batch = db.batch();
    chunk.forEach((recipientId) => {
      const notificationId = buildNotificationDocId(input.namespace, recipientId, input.dedupeKey);
      const notificationRef = db.doc(`notifications/${notificationId}`);
      batch.set(
        notificationRef,
        buildNotificationDocData({
          notificationId,
          recipientId,
          title: input.title,
          message: input.message,
          notificationType: input.notificationType,
          dedupeKey: input.dedupeKey,
          href: input.href,
          audience: input.audience,
          actorId: input.actorId,
          contentType: input.contentType,
          contentId: input.contentId,
          teacherId: input.teacherId,
          batchId: input.batchId,
          courseId: input.courseId,
          testId: input.testId,
          liveBatchId: input.liveBatchId,
          eventDate: input.eventDate,
          eventEndDate: input.eventEndDate,
          eventTime: input.eventTime,
          eventEndTime: input.eventEndTime,
          accessLevel: input.accessLevel,
          metadata: input.metadata,
        })
      );
    });
    await batch.commit();
  }

  return recipientIds.length;
};

const collectTeacherRelatedStudentIds = async (db: AdminDb, teacherId: string) => {
  const resolvedTeacherId = cleanString(teacherId);
  if (!resolvedTeacherId) return [] as string[];

  const addUserId = (target: Set<string>, value: unknown) => {
    const normalized = cleanString(value);
    if (normalized && normalized !== resolvedTeacherId) {
      target.add(normalized);
    }
  };

  const addUserIdsFromQuery = (target: Set<string>, snapshot: FirebaseFirestore.QuerySnapshot) => {
    snapshot.docs.forEach((docSnap) => {
      addUserId(target, extractUserIdFromNestedPath(docSnap.ref.path));
    });
  };

  const [
    teacherSalesSnap,
    coursePurchasesSnap,
    mockPurchasesSnap,
    paidBatchPurchasesSnap,
    enrolledBatchSnap,
    premiumPracticeSnap,
    premiumMockSnap,
    teacherOfferSnap,
  ] = await Promise.all([
    db.collection(`users/${resolvedTeacherId}/sales`).get(),
    db.collectionGroup('purchased_courses').where('teacherId', '==', resolvedTeacherId).get(),
    db.collectionGroup('purchased_mock_tests').where('teacherId', '==', resolvedTeacherId).get(),
    db.collectionGroup('purchased_live_batches').where('teacherId', '==', resolvedTeacherId).get(),
    db.collectionGroup('enrolled_live_batches').where('teacherId', '==', resolvedTeacherId).get(),
    db.collectionGroup('premium_practice_session_purchases').where('teacherId', '==', resolvedTeacherId).get(),
    db.collectionGroup('premium_mock_feature_purchases').where('teacherId', '==', resolvedTeacherId).get(),
    db.collectionGroup('purchased_teacher_offers').where('teacherId', '==', resolvedTeacherId).get(),
  ]);

  const studentIds = new Set<string>();
  teacherSalesSnap.docs.forEach((docSnap) => addUserId(studentIds, docSnap.data()?.studentId));
  addUserIdsFromQuery(studentIds, coursePurchasesSnap);
  addUserIdsFromQuery(studentIds, mockPurchasesSnap);
  addUserIdsFromQuery(studentIds, paidBatchPurchasesSnap);
  addUserIdsFromQuery(studentIds, enrolledBatchSnap);
  addUserIdsFromQuery(studentIds, premiumPracticeSnap);
  addUserIdsFromQuery(studentIds, premiumMockSnap);
  addUserIdsFromQuery(studentIds, teacherOfferSnap);

  return Array.from(studentIds);
};

const getPublishedContentDoc = async (
  db: AdminDb,
  input: { contentType: 'course' | 'mock_test' | 'live_batch'; contentId: string }
) => {
  const contentType = cleanString(input.contentType) as FanOutTeacherPublicationBellNotificationInput['contentType'];
  const contentId = cleanString(input.contentId);
  if (!contentType || !contentId) return null;

  const collectionName =
    contentType === 'course'
      ? 'courses'
      : contentType === 'mock_test'
        ? 'mock_tests'
        : 'live_batches';
  const docSnap = await db.doc(`${collectionName}/${contentId}`).get();
  if (!docSnap.exists) return null;

  const data = docSnap.data() || {};
  const teacherId = cleanString(data.teacherId);
  const publicationStatus = cleanString(data.publicationStatus || 'published') || 'published';
  const title = cleanString(data.title || data.name || data.meetingTitle || '');
  const teacherName = cleanString(data.teacherName || '');
  const accessLevel = cleanString(data.accessLevel || '');
  const href =
    contentType === 'course'
      ? `/courses/${contentId}`
      : contentType === 'mock_test'
        ? `/mock-tests/${contentId}`
        : `/live-batches/${contentId}`;

  return {
    contentType,
    contentId,
    teacherId,
    teacherName,
    publicationStatus,
    title: title || 'New content',
    accessLevel,
    href,
  };
};

export async function pushSelfBellNotification(input: PushSelfBellNotificationInput): Promise<BellActionResult> {
  try {
    const idToken = cleanString(input?.idToken);
    const notificationType = cleanString(input?.notificationType);
    const dedupeKey = cleanString(input?.dedupeKey);
    if (!idToken || !notificationType || !dedupeKey) {
      return { success: false, error: 'Missing bell-notification context.' };
    }

    const app = getAdminApp();
    const auth = getAdminAuth(app);
    const db = getAdminFirestore(app);
    const { requesterId } = await getRequesterContext(db, auth, idToken);
    if (!requesterId) {
      return { success: false, error: 'Could not resolve the current user.' };
    }

    const notificationId = buildNotificationDocId('self', requesterId, dedupeKey);
    await db.doc(`notifications/${notificationId}`).set(
      buildNotificationDocData({
        notificationId,
        recipientId: requesterId,
        title: input.title,
        message: input.message,
        notificationType,
        dedupeKey,
        href: input.href,
        audience: 'student',
        actorId: requesterId,
        contentType: input.contentType,
        contentId: input.contentId,
        teacherId: input.teacherId,
        batchId: input.batchId,
        courseId: input.courseId,
        testId: input.testId,
        liveBatchId: input.liveBatchId,
        eventDate: input.eventDate,
        eventEndDate: input.eventEndDate,
        eventTime: input.eventTime,
        eventEndTime: input.eventEndTime,
        accessLevel: input.accessLevel,
        metadata: input.metadata,
      })
    );

    return { success: true, notificationId };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Could not save bell notification.' };
  }
}

export async function fanOutLiveBatchBellNotification(
  input: FanOutLiveBatchBellNotificationInput
): Promise<BellActionResult> {
  try {
    const idToken = cleanString(input?.idToken);
    const batchId = cleanString(input?.batchId);
    const notificationType = cleanString(input?.notificationType);
    const dedupeKey = cleanString(input?.dedupeKey);
    if (!idToken || !batchId || !notificationType || !dedupeKey) {
      return { success: false, error: 'Missing live-batch bell-notification context.' };
    }

    const app = getAdminApp();
    const auth = getAdminAuth(app);
    const db = getAdminFirestore(app);
    const { requesterId, isAdmin } = await getRequesterContext(db, auth, idToken);
    if (!requesterId) {
      return { success: false, error: 'Could not resolve the current user.' };
    }

    const batchSnap = await db.doc(`live_batches/${batchId}`).get();
    if (!batchSnap.exists) {
      return { success: false, error: 'Live batch not found.' };
    }
    const batchData = batchSnap.data() || {};
    const batchTeacherId = cleanString(batchData.teacherId);
    if (!isAdmin && batchTeacherId !== requesterId) {
      return { success: false, error: 'You are not allowed to notify this batch.' };
    }

    const enrolledStudentsSnap = await db.collectionGroup('enrolled_live_batches').where('batchId', '==', batchId).get();
    const recipientIds = Array.from(
      new Set(
        enrolledStudentsSnap.docs
          .filter((docSnap) => docSnap.data()?.adminAccessDisabled !== true)
          .map((docSnap) => extractUserIdFromNestedPath(docSnap.ref.path))
          .filter(Boolean)
      )
    );

    const deliveredCount = await writeNotificationsForRecipients(db, {
      namespace: 'batch',
      dedupeKey,
      recipientIds,
      title: input.title,
      message: input.message,
      notificationType,
      href: input.href,
      audience: 'student',
      actorId: requesterId,
      contentType: 'live_batch',
      contentId: batchId,
      teacherId: batchTeacherId || requesterId,
      batchId,
      liveBatchId: batchId,
      eventDate: input.eventDate,
      eventEndDate: input.eventEndDate,
      eventTime: input.eventTime,
      eventEndTime: input.eventEndTime,
    });

    return { success: true, deliveredCount };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Could not send live-batch notifications.' };
  }
}

export async function fanOutTeacherPublicationBellNotification(
  input: FanOutTeacherPublicationBellNotificationInput
): Promise<BellActionResult> {
  try {
    const idToken = cleanString(input?.idToken);
    const contentType = cleanString(input?.contentType) as FanOutTeacherPublicationBellNotificationInput['contentType'];
    const contentId = cleanString(input?.contentId);
    if (!idToken || !contentType || !contentId) {
      return { success: false, error: 'Missing publish-notification context.' };
    }

    const app = getAdminApp();
    const auth = getAdminAuth(app);
    const db = getAdminFirestore(app);
    const { requesterId, isAdmin } = await getRequesterContext(db, auth, idToken);
    if (!requesterId) {
      return { success: false, error: 'Could not resolve the current user.' };
    }

    const contentDoc = await getPublishedContentDoc(db, { contentType, contentId });
    if (!contentDoc) {
      return { success: false, error: 'Published content not found.' };
    }
    if (contentDoc.publicationStatus !== 'published') {
      return { success: true, deliveredCount: 0 };
    }
    if (!isAdmin && contentDoc.teacherId !== requesterId) {
      return { success: false, error: 'You are not allowed to notify students for this content.' };
    }

    const recipientIds = await collectTeacherRelatedStudentIds(db, contentDoc.teacherId || requesterId);
    const typeLabel =
      contentType === 'course'
        ? 'course'
        : contentType === 'mock_test'
          ? 'mock test'
          : 'live batch';
    const teacherLabel = contentDoc.teacherName || 'Your teacher';
    const notificationType =
      contentType === 'course'
        ? 'teacher_new_course'
        : contentType === 'mock_test'
          ? 'teacher_new_mock_test'
          : 'teacher_new_live_batch';

    const deliveredCount = await writeNotificationsForRecipients(db, {
      namespace: 'publish',
      dedupeKey: `published:${contentType}:${contentId}`,
      recipientIds,
      title:
        contentType === 'course'
          ? 'New course from your teacher'
          : contentType === 'mock_test'
            ? 'New mock test from your teacher'
            : 'New live batch from your teacher',
      message: `${teacherLabel} published a new ${typeLabel}: ${contentDoc.title}.`,
      notificationType,
      href: contentDoc.href,
      audience: 'student',
      actorId: requesterId,
      contentType,
      contentId,
      teacherId: contentDoc.teacherId || requesterId,
      courseId: contentType === 'course' ? contentId : null,
      testId: contentType === 'mock_test' ? contentId : null,
      batchId: contentType === 'live_batch' ? contentId : null,
      liveBatchId: contentType === 'live_batch' ? contentId : null,
      accessLevel: contentDoc.accessLevel || null,
      metadata: {
        teacherName: teacherLabel,
        publicationStatus: contentDoc.publicationStatus,
      },
    });

    return { success: true, deliveredCount };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Could not notify students about published content.' };
  }
}

export async function saveTeacherPayoutDestination(input: {
  idToken: string;
  payoutMethod: PayoutMethod;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  upiId?: string;
  accountHolderName?: string;
  bankName?: string;
  ifscCode?: string;
  accountNumber?: string;
  confirmAccountNumber?: string;
}): Promise<{ success: boolean; routeLabel?: string; error?: string }> {
  try {
    const payoutMethod = cleanString(input?.payoutMethod).toLowerCase() as PayoutMethod;
    if (!input?.idToken || (payoutMethod !== 'upi' && payoutMethod !== 'bank_account')) {
      return { success: false, error: 'Invalid payout destination payload.' };
    }

    const app = getAdminApp();
    const auth = getAdminAuth(app);
    const db = getAdminFirestore(app);
    const decoded = await auth.verifyIdToken(input.idToken);
    const requesterId = cleanString(decoded.uid);
    const nowIso = new Date().toISOString();

    const userRef = db.doc(`users/${requesterId}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return { success: false, error: 'User profile not found.' };
    }

    const userData = userSnap.data() || {};
    const roleId = cleanString(userData.roleId);
    if (roleId !== 'teacher' && roleId !== 'admin') {
      return { success: false, error: 'Only teacher accounts can configure payout destination here.' };
    }

    const contactName =
      cleanString(input.contactName) ||
      cleanString(`${cleanString(userData.firstName)} ${cleanString(userData.lastName)}`) ||
      cleanString(decoded.name);
    const contactEmail = cleanString(input.contactEmail || userData.email || decoded.email).toLowerCase();
    const contactPhone = normalizePhoneNumber(input.contactPhone || userData.phoneNumber);

    if (contactName.length < 3) {
      return { success: false, error: 'Enter the full account holder or receiver name.' };
    }
    if (!isValidEmailAddress(contactEmail)) {
      return { success: false, error: 'Enter a valid payout email address.' };
    }
    if (contactPhone.length !== 10) {
      return { success: false, error: 'Enter a valid 10-digit Indian mobile number for payout alerts.' };
    }

    let payoutTransferMode: 'UPI' | 'BANK_TRANSFER' = payoutMethod === 'upi' ? 'UPI' : 'BANK_TRANSFER';
    let payoutDestinationLabel = cleanString(userData.payoutDestinationLabel);
    let payoutUpiId: string | null = cleanString(userData.payoutUpiId).toLowerCase() || null;
    let payoutUpiIdMasked: string | null = cleanString(userData.payoutUpiIdMasked) || null;
    let payoutBankName: string | null = cleanString(userData.payoutBankName) || null;
    let payoutBankIfsc: string | null = cleanString(userData.payoutBankIfsc) || null;
    let payoutAccountHolderName: string | null = cleanString(userData.payoutAccountHolderName) || null;
    let payoutBankAccountNumber: string | null = cleanString(userData.payoutBankAccountNumber) || null;
    let payoutBankAccountLast4: string | null = cleanString(userData.payoutBankAccountLast4) || null;

    if (payoutMethod === 'upi') {
      const normalizedUpiId = cleanString(input.upiId || payoutUpiId).toLowerCase();
      if (!normalizedUpiId) {
        return { success: false, error: 'Enter a UPI ID so admin knows where to send your payment.' };
      }
      if (!isValidUpiId(normalizedUpiId)) {
        return { success: false, error: 'Enter a valid UPI ID such as name@bank.' };
      }

      payoutUpiId = normalizedUpiId;
      payoutUpiIdMasked = maskUpiId(normalizedUpiId);
      payoutDestinationLabel = `UPI • ${payoutUpiIdMasked}`;
    } else {
      const normalizedIfsc = cleanString(input.ifscCode || payoutBankIfsc).toUpperCase();
      const bankName = cleanString(input.bankName || payoutBankName);
      const accountHolderName =
        cleanString(input.accountHolderName || payoutAccountHolderName) || contactName;
      const accountNumber = String(input.accountNumber || '').replace(/\D/g, '');
      const confirmAccountNumber = String(input.confirmAccountNumber || '').replace(/\D/g, '');
      const existingAccountNumber = cleanString(payoutBankAccountNumber);

      if (bankName.length < 2) {
        return { success: false, error: 'Enter the bank name for this payout route.' };
      }
      if (accountHolderName.length < 3) {
        return { success: false, error: 'Enter the bank account holder name.' };
      }
      if (!isValidIfscCode(normalizedIfsc)) {
        return { success: false, error: 'Enter a valid IFSC code.' };
      }

      if (accountNumber || confirmAccountNumber) {
        if (accountNumber.length < 9 || accountNumber.length > 18) {
          return { success: false, error: 'Enter a valid bank account number.' };
        }
        if (accountNumber !== confirmAccountNumber) {
          return { success: false, error: 'Bank account numbers do not match.' };
        }
      } else {
        if (!existingAccountNumber) {
          return { success: false, error: 'Enter and confirm the bank account number so admin can send your payment.' };
        }
      }

      payoutBankName = bankName;
      payoutBankIfsc = normalizedIfsc;
      payoutAccountHolderName = accountHolderName;
      payoutBankAccountNumber = accountNumber || existingAccountNumber;
      payoutBankAccountLast4 = payoutBankAccountNumber.slice(-4);
      payoutDestinationLabel = `Bank • ${payoutBankName} • ****${payoutBankAccountLast4 || ''}`;
    }

    const hasUpiRoute = Boolean(payoutUpiId || payoutUpiIdMasked);
    const hasBankRoute = Boolean(payoutBankAccountNumber && payoutBankName && payoutBankIfsc);
    if (!hasUpiRoute && !hasBankRoute) {
      return { success: false, error: 'Add a UPI ID or bank account so admin knows where to send your payment.' };
    }

    payoutDestinationLabel = buildPayoutDestinationLabel({
      hasUpiRoute,
      hasBankRoute,
      upiIdMasked: payoutUpiIdMasked,
      bankName: payoutBankName,
      accountLast4: payoutBankAccountLast4,
    });

    await userRef.set(
      {
        razorpayContactId: null,
        razorpayFundAccountId: null,
        payoutMethod,
        payoutTransferMode,
        payoutDetailsStatus: 'submitted',
        payoutDestinationLabel,
        payoutContactName: contactName,
        payoutContactEmail: contactEmail,
        payoutContactPhone: contactPhone,
        payoutUpiId,
        payoutUpiIdMasked,
        payoutBankName,
        payoutBankIfsc,
        payoutAccountHolderName,
        payoutBankAccountNumber,
        payoutBankAccountLast4,
        payoutDetailsVerifiedAt: null,
        payoutDetailsUpdatedAt: nowIso,
      },
      { merge: true }
    );

    return { success: true, routeLabel: payoutDestinationLabel };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Could not save payout destination.' };
  }
}

export async function processTeacherInstantWithdrawal(input: {
  idToken: string;
  amount: number;
  reason?: string;
}): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    const amount = Number(input?.amount || 0);
    if (!input?.idToken || !Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: 'Invalid withdrawal request.' };
    }
    if (amount > 200000) {
      return { success: false, error: 'Maximum per withdrawal request is INR 2,00,000.' };
    }

    const app = getAdminApp();
    const auth = getAdminAuth(app);
    const db = getAdminFirestore(app);

    const decoded = await auth.verifyIdToken(input.idToken);
    const requesterId = decoded.uid;
    const nowIso = new Date().toISOString();
    const reason = String(input.reason || '').trim();

    const userRef = db.doc(`users/${requesterId}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return { success: false, error: 'User profile not found.' };
    }
    const userData = userSnap.data() || {};
    const roleId = String(userData.roleId || '');
    if (roleId !== 'teacher' && roleId !== 'admin') {
      return { success: false, error: 'Only teacher accounts can submit withdrawal requests here.' };
    }
    if (roleId === 'teacher' && userData.teacherStatus && userData.teacherStatus !== 'approved') {
      return { success: false, error: 'Teacher account is not approved for withdrawal requests.' };
    }

    const payoutDestinationSnapshot = buildStoredPayoutSnapshot(userData);
    if (!payoutDestinationSnapshot) {
      return {
        success: false,
        error: 'Add your UPI ID or bank account details first so admin knows where to send your payment.',
      };
    }

    const recentRequestsSnap = await db
      .collection('payout_requests')
      .where('requesterId', '==', requesterId)
      .limit(50)
      .get();
    const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
    const recentInstantCount = recentRequestsSnap.docs.filter((docSnap) => {
      const data = docSnap.data() || {};
      if (String(data.requesterType || '') !== 'teacher') return false;
      const createdAt = String(data.createdAt || '');
      const ms = Date.parse(createdAt);
      if (!Number.isFinite(ms)) return false;
      return ms >= oneDayAgoMs;
    }).length;
    if (recentInstantCount >= 3) {
      return { success: false, error: 'Daily withdrawal request limit reached. Try again tomorrow.' };
    }

    const payoutRequestRef = db.collection('payout_requests').doc();
    const payoutRequestId = payoutRequestRef.id;
    const walletTxRef = db.doc(`wallet_transactions/withdraw_${payoutRequestId}`);

    const walletRef = db.doc(`wallets/teacher_${requesterId}`);
    await db.runTransaction(async (tx) => {
      const walletSnap = await tx.get(walletRef);
      const walletData = walletSnap.exists ? walletSnap.data() || {} : {};
      const available = Number(walletData.availableBalance || 0);
      const pending = Number(walletData.pendingBalance || 0);

      if (amount > available) {
        throw new Error('Requested amount exceeds available wallet balance.');
      }

      tx.set(
        payoutRequestRef,
        {
          id: payoutRequestId,
          requesterId,
          requesterType: 'teacher',
          amount,
          reason,
          status: 'pending',
          createdAt: nowIso,
          providerMode: 'manual_admin_settlement',
          queueReason: 'Awaiting admin manual transfer.',
          payoutMethod: payoutDestinationSnapshot.method,
          payoutDestinationLabel: payoutDestinationSnapshot.label,
          payoutDestinationSnapshot,
        },
        { merge: true }
      );

      tx.set(
        walletRef,
        {
          id: `teacher_${requesterId}`,
          ownerType: 'teacher',
          ownerId: requesterId,
          availableBalance: available - amount,
          pendingBalance: pending + amount,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      tx.set(
        walletTxRef,
        {
          id: `withdraw_${payoutRequestId}`,
          entryType: 'withdrawal_pending',
          status: 'pending',
          payoutRequestId,
          teacherId: requesterId,
          requesterId,
          requesterType: 'teacher',
          grossAmount: 0,
          adminCommissionPercent: 0,
          adminCommissionAmount: 0,
          teacherPayoutAmount: -amount,
          withdrawalAmount: amount,
          currency: 'INR',
          createdAt: nowIso,
          createdAtServer: FieldValue.serverTimestamp(),
          reason,
          providerMode: 'manual_admin_settlement',
          queueReason: 'Awaiting admin manual transfer.',
          payoutMethod: payoutDestinationSnapshot.method,
          payoutDestinationLabel: payoutDestinationSnapshot.label,
          payoutDestinationSnapshot,
        },
        { merge: true }
      );
    });

    return {
      success: true,
      requestId: payoutRequestId,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Could not submit withdrawal request.' };
  }
}
