'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { collection, collectionGroup, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import {
  Coins,
  IndianRupee,
  Layers3,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import DashboardHeader from '@/components/dashboard-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import {
  updateDocumentNonBlocking,
  useCollection,
  useFirestore,
  useMemoFirebase,
} from '@/firebase';
import {
  buildPracticeQuestionScopeEntries,
  type PracticeQuestionScopeSource,
} from '@/lib/practice-question-scope';
import {
  buildPricingScopeKey,
  normalizeScopedDifficultyPricingMap,
  type PricingQuestionSource,
  type ScopedDifficultyPricingMap,
} from '@/lib/premium-pricing';
import {
  formatPremiumPracticeAttemptPricingRule,
  normalizePremiumPracticeAttemptPricingMap,
  normalizePremiumPracticeAttemptPricingRule,
  resolvePremiumPracticeAttemptPricingRule,
  type AttemptIntervalUnit,
  type AttemptLimitMode,
  type PremiumPracticeAttemptPricingRule,
  type PremiumPracticeAttemptPricingMap,
  type PremiumPracticeSessionPurchase,
  type PremiumPracticeTopicConfig,
} from '@/lib/premium-practice-session';
import {
  buildPremiumCustomMockAttemptRuleFromLegacyLimit,
  formatPremiumCustomMockAttemptPricingRule,
  normalizePremiumCustomMockAttemptPricingMap,
  normalizePremiumCustomMockAttemptPricingRule,
  resolvePremiumCustomMockAttemptPricingRule,
  type PremiumCustomMockAttemptPricingRule,
  type PremiumCustomMockAttemptState,
  type PremiumCustomMockAttemptPricingMap,
} from '@/lib/premium-custom-mock';
import { type TeacherQuestionPurchaseDoc } from '@/lib/teacher-question-purchase';
import { ALLOWED_TEACHER_AUTHOR_EMAIL, DCAM_QUESTION_BANK_LABEL } from '@/lib/teacher-authoring';

type ExamType = {
  id: string;
  name?: string;
};

type ClassItem = {
  id: string;
  name?: string;
  examTypeId?: string;
};

type Subject = {
  id: string;
  name?: string;
  classId?: string;
};

type PricingOwnerProfile = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  dcamTeacherQuestionPricingByScope?: ScopedDifficultyPricingMap;
  premiumPracticeQuestionPricingByScope?: ScopedDifficultyPricingMap;
  dcamPracticeQuestionPricingByScope?: ScopedDifficultyPricingMap;
  premiumPracticeAttemptPricingByScope?: PremiumPracticeAttemptPricingMap;
  premiumMockTestQuestionPricingByScope?: ScopedDifficultyPricingMap;
  dcamMockTestQuestionPricingByScope?: ScopedDifficultyPricingMap;
  premiumMockTestAttemptPricingByScope?: PremiumCustomMockAttemptPricingMap;
  premiumMockTestAttemptLimit?: {
    mode?: AttemptLimitMode;
    maxTotalAttempts?: number | null;
    maxAttemptsPerInterval?: number | null;
    intervalValue?: number | null;
    intervalUnit?: AttemptIntervalUnit | null;
  };
};

type PracticeQuestion = PracticeQuestionScopeSource & {
  accessLevel?: 'free' | 'paid';
  difficultyLevel?: 'Easy' | 'Medium' | 'Hard';
  isPreviousYear?: boolean;
};

type PriceInputState = {
  easy: string;
  medium: string;
  hard: string;
};

type AttemptInputState = {
  mode: AttemptLimitMode;
  maxTotalAttempts: string;
  maxAttemptsPerInterval: string;
  intervalValue: string;
  intervalUnit: AttemptIntervalUnit;
  rechargePrice: string;
  intervalAttemptPrice: string;
};

type QuestionInventorySummary = {
  standard: Record<'Easy' | 'Medium' | 'Hard', number>;
  pyq: Record<'Easy' | 'Medium' | 'Hard', number>;
};

type PricingScopeTuple = {
  examTypeId: string;
  classId: string;
  subjectId: string;
};

type TeacherPurchaseBuyerProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  roleId?: 'student' | 'teacher' | 'admin';
  status?: 'active' | 'blocked';
};

type PremiumPracticePurchaseAuditDoc = PremiumPracticeSessionPurchase & {
  includedTopicConfigs?: PremiumPracticeTopicConfig[];
};

type PremiumCustomMockPurchaseAuditDoc = {
  id?: string;
  teacherId?: string;
  examTypeId?: string;
  classId?: string;
  amount?: number;
  questionCount?: number;
  questionAmountPaid?: number;
  attemptAmountPaid?: number;
  currency?: string;
  paidAt?: string;
  purchasedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  status?: 'paid' | 'failed';
  attemptPricing?: PremiumCustomMockAttemptPricingRule | null;
  attemptState?: PremiumCustomMockAttemptState | null;
  subjectConfigs?: Array<{ subjectId?: string }>;
  includedSubjectConfigs?: Array<{ subjectId?: string }>;
  premiumCustomMockTestId?: string;
  testTitle?: string;
};

type TeacherPurchaseAuditRow = {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  buyerRole: TeacherPurchaseBuyerProfile['roleId'] | '';
  kind: 'practice' | 'mock' | 'teacher_question';
  examTypeId: string;
  classId: string;
  subjectIds: string[];
  questionCount: number;
  amountPaid: number;
  purchasedAt: Date | null;
  ruleSummary: string;
};

type TeacherPurchaseSummaryRow = {
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  purchaseCount: number;
  totalQuestions: number;
  totalAmountPaid: number;
  firstPurchasedAt: Date | null;
  lastPurchasedAt: Date | null;
};

const EMPTY_PRICE_INPUT: PriceInputState = {
  easy: '0',
  medium: '0',
  hard: '0',
};

const EMPTY_ATTEMPT_INPUT: AttemptInputState = {
  mode: 'unlimited',
  maxTotalAttempts: '1',
  maxAttemptsPerInterval: '1',
  intervalValue: '1',
  intervalUnit: 'week',
  rechargePrice: '0',
  intervalAttemptPrice: '0',
};

const formatOwnerName = (owner?: PricingOwnerProfile | null) =>
  `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() || owner?.displayName || 'DCAM Owner';

const toDateSafe = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (
    typeof value === 'object'
    && value !== null
    && 'toDate' in value
    && typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    try {
      const parsed = (value as { toDate: () => Date }).toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

const maxDate = (left: Date | null, right: Date | null): Date | null =>
  !left ? right : !right ? left : left.getTime() > right.getTime() ? left : right;

const minDate = (left: Date | null, right: Date | null): Date | null =>
  !left ? right : !right ? left : left.getTime() < right.getTime() ? left : right;

const formatCurrency = (value: number) => {
  const normalized = Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
  const hasDecimals = Math.abs(normalized % 1) > 0.0001;
  return `₹${normalized.toLocaleString('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
};

const formatDateTime = (value: Date | null) =>
  value
    ? value.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'N/A';

const formatDateRange = (start: Date | null, end: Date | null) => {
  if (!start && !end) return 'No purchase dates yet';
  if (start && end) {
    return `${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} to ${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }
  const resolved = start || end;
  return resolved
    ? resolved.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';
};

const buildBuyerName = (profile?: TeacherPurchaseBuyerProfile | null) =>
  `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || profile?.displayName || 'Teacher';

const getPracticePurchaseSubjectIds = (purchase: PremiumPracticePurchaseAuditDoc) =>
  Array.from(
    new Set(
      [...(purchase.includedTopicConfigs || []), ...(purchase.topicConfigs || [])]
        .map((config) => String(config.subjectId || '').trim())
        .filter(Boolean)
    )
  );

const getMockPurchaseSubjectIds = (purchase: PremiumCustomMockPurchaseAuditDoc) =>
  Array.from(
    new Set(
      [...(purchase.includedSubjectConfigs || []), ...(purchase.subjectConfigs || [])]
        .map((config) => String(config?.subjectId || '').trim())
        .filter(Boolean)
    )
  );

const getScopedInput = (
  pricingMap: ScopedDifficultyPricingMap,
  examTypeId: string,
  classId: string,
  subjectId: string,
  questionSource: PricingQuestionSource
): PriceInputState => {
  const scopeKey = buildPricingScopeKey(examTypeId, classId, subjectId, questionSource);
  const rule = pricingMap[scopeKey];
  return {
    easy: String(rule?.easy ?? 0),
    medium: String(rule?.medium ?? 0),
    hard: String(rule?.hard ?? 0),
  };
};

const parsePriceInput = (value: PriceInputState) => {
  const easy = Number(value.easy);
  const medium = Number(value.medium);
  const hard = Number(value.hard);

  if (
    !Number.isFinite(easy) || easy < 0
    || !Number.isFinite(medium) || medium < 0
    || !Number.isFinite(hard) || hard < 0
  ) {
    return null;
  }

  return {
    easy: Number(easy.toFixed(2)),
    medium: Number(medium.toFixed(2)),
    hard: Number(hard.toFixed(2)),
  };
};

const buildAttemptInputState = (rule: {
  mode: AttemptLimitMode;
  maxTotalAttempts: number | null;
  maxAttemptsPerInterval: number | null;
  intervalValue: number | null;
  intervalUnit: AttemptIntervalUnit | null;
  rechargePrice: number;
  intervalAttemptPrice: number;
}): AttemptInputState => ({
  mode: rule.mode,
  maxTotalAttempts: String(rule.maxTotalAttempts ?? 1),
  maxAttemptsPerInterval: String(rule.maxAttemptsPerInterval ?? 1),
  intervalValue: String(rule.intervalValue ?? 1),
  intervalUnit: rule.intervalUnit || 'week',
  rechargePrice: String(rule.rechargePrice ?? 0),
  intervalAttemptPrice: String(rule.intervalAttemptPrice ?? 0),
});

const buildPaidScopeTuples = (question: PracticeQuestion): PricingScopeTuple[] => {
  const tuples: PricingScopeTuple[] = [];
  const seen = new Set<string>();

  const pushTuple = (params: {
    examTypeId?: string;
    classId?: string;
    subjectId?: string;
    accessLevel?: 'free' | 'paid';
  }) => {
    const accessLevel = (params.accessLevel || question.accessLevel || 'free') === 'paid' ? 'paid' : 'free';
    if (accessLevel !== 'paid') return;

    const examTypeId = String(params.examTypeId || '').trim();
    const classId = String(params.classId || '').trim();
    const subjectId = String(params.subjectId || '').trim();
    if (!examTypeId || !classId || !subjectId) return;

    const key = [examTypeId, classId, subjectId].join('__');
    if (seen.has(key)) return;
    seen.add(key);
    tuples.push({ examTypeId, classId, subjectId });
  };

  pushTuple({
    examTypeId: question.examTypeId,
    classId: question.classId,
    subjectId: question.subjectId,
    accessLevel: question.accessLevel,
  });

  (question.alignments || []).forEach((alignment) => {
    pushTuple({
      examTypeId: alignment.examTypeId,
      classId: alignment.classId,
      subjectId: alignment.subjectId,
      accessLevel: alignment.accessLevel,
    });
  });

  return tuples;
};

function PricingEditorCard({
  title,
  description,
  tone,
  regularInput,
  pyqInput,
  attemptTitle,
  attemptDescription,
  attemptScopeText,
  attemptInput,
  setAttemptInput,
  attemptSummary,
  setRegularInput,
  setPyqInput,
  onSave,
  isSaving,
  saveLabel,
}: {
  title: string;
  description: string;
  tone: 'practice' | 'mock';
  regularInput: PriceInputState;
  pyqInput: PriceInputState;
  attemptTitle: string;
  attemptDescription: string;
  attemptScopeText: string;
  attemptInput: AttemptInputState;
  setAttemptInput: Dispatch<SetStateAction<AttemptInputState>>;
  attemptSummary: string;
  setRegularInput: Dispatch<SetStateAction<PriceInputState>>;
  setPyqInput: Dispatch<SetStateAction<PriceInputState>>;
  onSave: () => Promise<void>;
  isSaving: boolean;
  saveLabel: string;
}) {
  const toneClasses = tone === 'practice'
    ? {
        card: 'border-cyan-400/20 bg-[linear-gradient(180deg,rgba(8,47,73,0.35),rgba(2,6,23,0.95))]',
        badge: 'border-cyan-400/30 bg-cyan-500/12 text-cyan-100',
        saveButton: 'bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 text-slate-950 hover:from-cyan-300 hover:via-sky-300 hover:to-blue-400',
      }
    : {
        card: 'border-amber-400/20 bg-[linear-gradient(180deg,rgba(69,26,3,0.25),rgba(2,6,23,0.95))]',
        badge: 'border-amber-400/30 bg-amber-500/12 text-amber-100',
        saveButton: 'bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-300 text-slate-950 hover:from-amber-200 hover:via-orange-200 hover:to-yellow-200',
      };

  const renderPriceRow = (
    label: string,
    accentClassName: string,
    value: PriceInputState,
    setValue: Dispatch<SetStateAction<PriceInputState>>
  ) => (
    <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.95)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">Set separate Easy, Medium, and Hard daily rates.</p>
        </div>
        <Badge variant="outline" className={accentClassName}>
          INR / day / student
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {(['easy', 'medium', 'hard'] as const).map((difficulty) => (
          <div key={`${label}-${difficulty}`} className="space-y-2">
            <Label className="capitalize">{difficulty}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={value[difficulty]}
              onChange={(event) => setValue((current) => ({ ...current, [difficulty]: event.target.value }))}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Card className={`overflow-hidden rounded-[30px] ${toneClasses.card}`}>
      <CardHeader className="border-b border-white/10 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={toneClasses.badge}>
            {tone === 'practice' ? 'Premium Practice' : 'Premium Custom Mock'}
          </Badge>
        </div>
        <CardTitle className="mt-3 flex items-center gap-2 text-2xl">
          <IndianRupee className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription className="max-w-2xl text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-slate-950/45 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Student Checkout Scope</p>
            <p className="mt-1 text-sm font-medium text-slate-100">{attemptScopeText}</p>
          </div>
          <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-slate-100">
            Saves instantly
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {renderPriceRow('Regular Questions', 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100', regularInput, setRegularInput)}
          {renderPriceRow('PYQ Questions', 'border-amber-400/30 bg-amber-500/10 text-amber-100', pyqInput, setPyqInput)}
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">{attemptTitle}</p>
            <p className="text-xs text-muted-foreground">{attemptDescription}</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,220px)_repeat(4,minmax(0,180px))] md:items-end">
            <div className="space-y-2">
              <Label>Attempt Limit Mode</Label>
              <Select
                value={attemptInput.mode}
                onValueChange={(value) => setAttemptInput((current) => ({ ...current, mode: value as AttemptLimitMode }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                  <SelectItem value="total">Total Attempts</SelectItem>
                  <SelectItem value="interval">Attempts Per Interval</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {attemptInput.mode === 'total' ? (
              <>
                <div className="space-y-2">
                  <Label>Total Attempts</Label>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    value={attemptInput.maxTotalAttempts}
                    onChange={(event) =>
                      setAttemptInput((current) => ({ ...current, maxTotalAttempts: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Recharge Price (INR)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={attemptInput.rechargePrice}
                    onChange={(event) =>
                      setAttemptInput((current) => ({ ...current, rechargePrice: event.target.value }))
                    }
                  />
                </div>
              </>
            ) : null}

            {attemptInput.mode === 'interval' ? (
              <>
                <div className="space-y-2">
                  <Label>Attempts Per Interval</Label>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    value={attemptInput.maxAttemptsPerInterval}
                    onChange={(event) =>
                      setAttemptInput((current) => ({ ...current, maxAttemptsPerInterval: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interval Value</Label>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    value={attemptInput.intervalValue}
                    onChange={(event) =>
                      setAttemptInput((current) => ({ ...current, intervalValue: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interval Unit</Label>
                  <Select
                    value={attemptInput.intervalUnit}
                    onValueChange={(value) =>
                      setAttemptInput((current) => ({ ...current, intervalUnit: value as AttemptIntervalUnit }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Instant Attempt Price (INR)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={attemptInput.intervalAttemptPrice}
                    onChange={(event) =>
                      setAttemptInput((current) => ({ ...current, intervalAttemptPrice: event.target.value }))
                    }
                  />
                </div>
              </>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Current rule: {attemptSummary}
          </p>
        </div>
        <div className="flex justify-end">
          <Button className={`min-w-44 rounded-full px-6 font-semibold shadow-[0_18px_34px_-18px_rgba(14,165,233,0.75)] ${toneClasses.saveButton}`} onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : saveLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TeacherQuestionPricingCard({
  title,
  description,
  scopeText,
  regularInput,
  pyqInput,
  setRegularInput,
  setPyqInput,
  onSave,
  isSaving,
  saveLabel,
  hasSavedScope,
}: {
  title: string;
  description: string;
  scopeText: string;
  regularInput: PriceInputState;
  pyqInput: PriceInputState;
  setRegularInput: Dispatch<SetStateAction<PriceInputState>>;
  setPyqInput: Dispatch<SetStateAction<PriceInputState>>;
  onSave: () => Promise<void>;
  isSaving: boolean;
  saveLabel: string;
  hasSavedScope: boolean;
}) {
  const renderPriceRow = (
    label: string,
    accentClassName: string,
    value: PriceInputState,
    setValue: Dispatch<SetStateAction<PriceInputState>>
  ) => (
    <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.95)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">Set separate Easy, Medium, and Hard daily rates.</p>
        </div>
        <Badge variant="outline" className={accentClassName}>
          INR / day / student
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {(['easy', 'medium', 'hard'] as const).map((difficulty) => (
          <div key={`${label}-${difficulty}`} className="space-y-2">
            <Label className="capitalize">{difficulty}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={value[difficulty]}
              onChange={(event) => setValue((current) => ({ ...current, [difficulty]: event.target.value }))}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Card className="overflow-hidden rounded-[30px] border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(6,78,59,0.24),rgba(2,6,23,0.95))]">
      <CardHeader className="border-b border-white/10 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-emerald-400/30 bg-emerald-500/12 text-emerald-100">
            Teacher Purchase
          </Badge>
          <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-100">
            {hasSavedScope ? 'Saved scope found' : 'New scope'}
          </Badge>
        </div>
        <CardTitle className="mt-3 flex items-center gap-2 text-2xl">
          <Coins className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription className="max-w-3xl text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-slate-950/45 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Teacher Purchase Scope</p>
            <p className="mt-1 text-sm font-medium text-slate-100">{scopeText}</p>
          </div>
          <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-slate-100">
            Saves instantly
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {renderPriceRow('Regular Questions', 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100', regularInput, setRegularInput)}
          {renderPriceRow('PYQ Questions', 'border-amber-400/30 bg-amber-500/10 text-amber-100', pyqInput, setPyqInput)}
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/45 p-4 md:flex-row md:items-center md:justify-between">
          <p className="max-w-3xl text-xs text-muted-foreground">
            These values are stored as the teacher-facing daily rate per student for the selected scope. The teacher total is calculated from selected questions, students, and days.
          </p>
          <Button
            className="min-w-44 rounded-full bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 px-6 font-semibold text-slate-950 shadow-[0_18px_34px_-18px_rgba(16,185,129,0.75)] hover:from-emerald-200 hover:via-teal-200 hover:to-cyan-200"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : saveLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TeacherPurchaseAuditCard({
  scopeText,
  rows,
  isLoading,
  error,
  flowFilter,
  onFlowFilterChange,
  subjectNameById,
}: {
  scopeText: string;
  rows: TeacherPurchaseAuditRow[];
  isLoading: boolean;
  error: string | null;
  flowFilter: 'all' | 'practice' | 'mock' | 'teacher_question';
  onFlowFilterChange: Dispatch<SetStateAction<'all' | 'practice' | 'mock' | 'teacher_question'>>;
  subjectNameById: Record<string, string>;
}) {
  const visibleRows = useMemo(
    () => rows.filter((row) => flowFilter === 'all' || row.kind === flowFilter),
    [flowFilter, rows]
  );

  const summaryRows = useMemo(() => {
    const summaryMap = new Map<string, TeacherPurchaseSummaryRow>();

    visibleRows.forEach((row) => {
      const key = row.buyerId || row.id;
      const current = summaryMap.get(key);

      if (!current) {
        summaryMap.set(key, {
          buyerId: row.buyerId,
          buyerName: row.buyerName,
          buyerEmail: row.buyerEmail,
          purchaseCount: 1,
          totalQuestions: row.questionCount,
          totalAmountPaid: row.amountPaid,
          firstPurchasedAt: row.purchasedAt,
          lastPurchasedAt: row.purchasedAt,
        });
        return;
      }

      current.purchaseCount += 1;
      current.totalQuestions += row.questionCount;
      current.totalAmountPaid += row.amountPaid;
      current.firstPurchasedAt = minDate(current.firstPurchasedAt, row.purchasedAt);
      current.lastPurchasedAt = maxDate(current.lastPurchasedAt, row.purchasedAt);
    });

    return Array.from(summaryMap.values()).sort(
      (left, right) =>
        (right.lastPurchasedAt?.getTime() || 0) - (left.lastPurchasedAt?.getTime() || 0)
    );
  }, [visibleRows]);

  const totalAmountPaid = useMemo(
    () => visibleRows.reduce((sum, row) => sum + row.amountPaid, 0),
    [visibleRows]
  );
  const totalQuestions = useMemo(
    () => visibleRows.reduce((sum, row) => sum + row.questionCount, 0),
    [visibleRows]
  );

  const filterOptions = [
    { value: 'all' as const, label: 'All purchases' },
    { value: 'practice' as const, label: 'Practice only' },
    { value: 'mock' as const, label: 'Custom mock only' },
    { value: 'teacher_question' as const, label: 'Question access only' },
  ];

  return (
    <Card className="overflow-hidden rounded-[30px] border border-cyan-400/18 bg-[linear-gradient(180deg,rgba(8,47,73,0.24),rgba(2,6,23,0.96))]">
      <CardHeader className="border-b border-white/10 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-cyan-400/30 bg-cyan-500/12 text-cyan-100">
            Teacher Purchase Audit
          </Badge>
          <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-100">
            {scopeText || 'Choose a scope'}
          </Badge>
        </div>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-2xl">See which teachers purchased this scope</CardTitle>
            <CardDescription className="max-w-3xl text-sm">
              This view shows teacher accounts that purchased paid DCAM questions in the selected scope, how many checkouts they completed, and the recorded purchase date range. Teacher question-access rows also include the stored students and days detail.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={flowFilter === option.value ? 'default' : 'outline'}
                className={
                  flowFilter === option.value
                    ? 'rounded-full bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                    : 'rounded-full border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
                }
                onClick={() => onFlowFilterChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Teacher buyers</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">{summaryRows.length}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Premium checkouts</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">{visibleRows.length}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Questions bought</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">{totalQuestions}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Collected</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">{formatCurrency(totalAmountPaid)}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-52 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : summaryRows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/35 p-8 text-center">
            <p className="text-lg font-semibold text-slate-100">No teacher purchases found yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Once teachers buy premium questions in this scope, their purchase totals and date range will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-white/10 bg-slate-950/35">
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-sm font-semibold text-slate-100">Teacher-wise purchase overview</p>
                <p className="text-xs text-muted-foreground">
                  Use this table to see which teacher accounts purchased and the date span recorded for them in this scope.
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead>Teacher</TableHead>
                      <TableHead>Checkouts</TableHead>
                      <TableHead>Questions</TableHead>
                      <TableHead>Collected</TableHead>
                      <TableHead>Purchase Range</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryRows.map((row) => (
                      <TableRow key={row.buyerId || `${row.buyerEmail}-${row.buyerName}`} className="border-white/10">
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-50">{row.buyerName}</p>
                            <p className="text-xs text-muted-foreground">{row.buyerEmail || 'Email not available'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{row.purchaseCount}</TableCell>
                        <TableCell>{row.totalQuestions}</TableCell>
                        <TableCell>{formatCurrency(row.totalAmountPaid)}</TableCell>
                        <TableCell>{formatDateRange(row.firstPurchasedAt, row.lastPurchasedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/35">
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-sm font-semibold text-slate-100">Recent purchase rows</p>
                <p className="text-xs text-muted-foreground">
                  Each row shows one stored premium purchase for the selected scope.
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead>Teacher</TableHead>
                      <TableHead>Flow</TableHead>
                      <TableHead>Questions</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Purchased On</TableHead>
                      <TableHead>Stored Subject Scope</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((row) => (
                      <TableRow key={row.id} className="border-white/10">
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-50">{row.buyerName}</p>
                            <p className="text-xs text-muted-foreground">{row.buyerEmail || 'Email not available'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              row.kind === 'practice'
                                ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100'
                                : row.kind === 'mock'
                                  ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
                                  : 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100'
                            }
                          >
                            {row.kind === 'practice'
                              ? 'Premium Practice'
                              : row.kind === 'mock'
                                ? 'Custom Mock'
                                : 'Teacher Question Access'}
                          </Badge>
                          <p className="mt-2 text-xs text-muted-foreground">{row.ruleSummary}</p>
                        </TableCell>
                        <TableCell>{row.questionCount}</TableCell>
                        <TableCell>{formatCurrency(row.amountPaid)}</TableCell>
                        <TableCell>{formatDateTime(row.purchasedAt)}</TableCell>
                        <TableCell>
                          {row.subjectIds.length > 0
                            ? row.subjectIds.map((subjectId) => subjectNameById[subjectId] || subjectId).join(', ')
                            : 'Stored at exam + curriculum level'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminQuestionPricingPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  const ownerQuery = useMemoFirebase(
    () => (
      firestore
        ? query(collection(firestore, 'users'), where('email', '==', ALLOWED_TEACHER_AUTHOR_EMAIL), limit(1))
        : null
    ),
    [firestore]
  );
  const examTypesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null),
    [firestore]
  );
  const classesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null),
    [firestore]
  );
  const subjectsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null),
    [firestore]
  );

  const { data: ownerRowsRaw, isLoading: isOwnerLoading } = useCollection<PricingOwnerProfile>(ownerQuery);
  const ownerRows = ownerRowsRaw || [];
  const owner = ownerRows[0] || null;

  const questionsQuery = useMemoFirebase(
    () => (
      firestore && owner?.id
        ? query(collection(firestore, 'practice_questions'), where('teacherId', '==', owner.id))
        : null
    ),
    [firestore, owner?.id]
  );

  const { data: examTypesRaw, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classesRaw, isLoading: areClassesLoading } = useCollection<ClassItem>(classesQuery);
  const { data: subjectsRaw, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: ownerQuestionsRaw, isLoading: areQuestionsLoading } = useCollection<PracticeQuestion>(questionsQuery);
  const examTypes = examTypesRaw || [];
  const classes = classesRaw || [];
  const subjects = subjectsRaw || [];
  const ownerQuestions = ownerQuestionsRaw || [];

  const [selectedExamTypeId, setSelectedExamTypeId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [teacherRegularInput, setTeacherRegularInput] = useState<PriceInputState>(EMPTY_PRICE_INPUT);
  const [teacherPyqInput, setTeacherPyqInput] = useState<PriceInputState>(EMPTY_PRICE_INPUT);
  const [practiceRegularInput, setPracticeRegularInput] = useState<PriceInputState>(EMPTY_PRICE_INPUT);
  const [practicePyqInput, setPracticePyqInput] = useState<PriceInputState>(EMPTY_PRICE_INPUT);
  const [mockRegularInput, setMockRegularInput] = useState<PriceInputState>(EMPTY_PRICE_INPUT);
  const [mockPyqInput, setMockPyqInput] = useState<PriceInputState>(EMPTY_PRICE_INPUT);
  const [practiceAttemptInput, setPracticeAttemptInput] = useState<AttemptInputState>(EMPTY_ATTEMPT_INPUT);
  const [mockAttemptInput, setMockAttemptInput] = useState<AttemptInputState>(EMPTY_ATTEMPT_INPUT);
  const [isSavingTeacherPricing, setIsSavingTeacherPricing] = useState(false);
  const [isSavingPracticePricing, setIsSavingPracticePricing] = useState(false);
  const [isSavingMockPricing, setIsSavingMockPricing] = useState(false);
  const [teacherPurchaseAuditRows, setTeacherPurchaseAuditRows] = useState<TeacherPurchaseAuditRow[]>([]);
  const [isTeacherPurchaseAuditLoading, setIsTeacherPurchaseAuditLoading] = useState(false);
  const [teacherPurchaseAuditError, setTeacherPurchaseAuditError] = useState<string | null>(null);
  const [teacherPurchaseFlowFilter, setTeacherPurchaseFlowFilter] = useState<'all' | 'practice' | 'mock' | 'teacher_question'>('all');

  const paidScopeTuples = useMemo(
    () => ownerQuestions.flatMap((question) => buildPaidScopeTuples(question)),
    [ownerQuestions]
  );
  const paidQuestionEntries = useMemo(
    () => ownerQuestions
      .flatMap((question) => buildPracticeQuestionScopeEntries(question))
      .filter((entry) => entry.accessLevel === 'paid'),
    [ownerQuestions]
  );

  const examTypeById = useMemo(
    () => new Map(examTypes.map((examType) => [examType.id, examType])),
    [examTypes]
  );
  const classById = useMemo(
    () => new Map(classes.map((classItem) => [classItem.id, classItem])),
    [classes]
  );
  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects]
  );

  const examTypeNameById = useMemo(
    () => Object.fromEntries(examTypes.map((examType) => [examType.id, examType.name || 'Untitled exam'])),
    [examTypes]
  );
  const classNameById = useMemo(
    () => Object.fromEntries(classes.map((classItem) => [classItem.id, classItem.name || 'Untitled curriculum'])),
    [classes]
  );
  const subjectNameById = useMemo(
    () => Object.fromEntries(subjects.map((subject) => [subject.id, subject.name || 'Untitled subject'])),
    [subjects]
  );

  useEffect(() => {
    if (!firestore || !isAdmin || !owner?.id) {
      setTeacherPurchaseAuditRows([]);
      setTeacherPurchaseAuditError(null);
      setIsTeacherPurchaseAuditLoading(false);
      return;
    }

    let isCancelled = false;

    const loadTeacherPurchaseAudit = async () => {
      setIsTeacherPurchaseAuditLoading(true);
      setTeacherPurchaseAuditError(null);

      try {
        const [practiceSnapshot, mockSnapshot, teacherQuestionSnapshot] = await Promise.all([
          getDocs(query(collectionGroup(firestore, 'premium_practice_session_purchases'), where('teacherId', '==', owner.id))),
          getDocs(query(collectionGroup(firestore, 'premium_mock_feature_purchases'), where('teacherId', '==', owner.id))),
          getDocs(query(collectionGroup(firestore, 'teacher_question_purchases'), where('teacherId', '==', owner.id))),
        ]);

        const rawPracticeRows = practiceSnapshot.docs.map((docSnap) => {
          const purchase = docSnap.data() as PremiumPracticePurchaseAuditDoc;
          return {
            id: docSnap.id,
            buyerId: String(docSnap.ref.parent.parent?.id || purchase.studentId || '').trim(),
            examTypeId: String(purchase.examTypeId || '').trim(),
            classId: String(purchase.classId || '').trim(),
            status: purchase.status,
            subjectIds: getPracticePurchaseSubjectIds(purchase),
            purchasedAt: toDateSafe(purchase.updatedAt) || toDateSafe(purchase.purchasedAt) || toDateSafe(purchase.createdAt),
            questionCount: Math.max(0, Number(purchase.questionCount || 0)),
            amountPaid: Number(
              (
                purchase.totalAmountPaid
                ?? purchase.grossAmount
                ?? purchase.attemptsPaidAmount
                ?? 0
              ).toFixed(2)
            ),
            ruleSummary: formatPremiumPracticeAttemptPricingRule(
              purchase.attemptPricing as PremiumPracticeAttemptPricingRule | null | undefined
            ),
          };
        });

        const rawMockRows = mockSnapshot.docs.map((docSnap) => {
          const purchase = docSnap.data() as PremiumCustomMockPurchaseAuditDoc;
          const combinedAmount = Number(
            purchase.amount
            ?? (Number(purchase.questionAmountPaid || 0) + Number(purchase.attemptAmountPaid || 0))
            ?? 0
          );

          return {
            id: docSnap.id,
            buyerId: String(docSnap.ref.parent.parent?.id || '').trim(),
            examTypeId: String(purchase.examTypeId || '').trim(),
            classId: String(purchase.classId || '').trim(),
            status: purchase.status,
            subjectIds: getMockPurchaseSubjectIds(purchase),
            purchasedAt: toDateSafe(purchase.paidAt) || toDateSafe(purchase.updatedAt) || toDateSafe(purchase.purchasedAt) || toDateSafe(purchase.createdAt),
            questionCount: Math.max(0, Number(purchase.questionCount || 0)),
            amountPaid: Number(combinedAmount.toFixed(2)),
            ruleSummary: formatPremiumCustomMockAttemptPricingRule(
              purchase.attemptPricing as PremiumCustomMockAttemptPricingRule | null | undefined
            ),
          };
        });

        const rawTeacherQuestionRows = teacherQuestionSnapshot.docs.map((docSnap) => {
          const purchase = docSnap.data() as TeacherQuestionPurchaseDoc;
          return {
            id: docSnap.id,
            buyerId: String(docSnap.ref.parent.parent?.id || purchase.buyerId || '').trim(),
            examTypeId: String(purchase.examTypeId || '').trim(),
            classId: String(purchase.classId || '').trim(),
            status: purchase.status,
            subjectIds: [String(purchase.subjectId || '').trim()].filter(Boolean),
            purchasedAt: toDateSafe(purchase.updatedAt) || toDateSafe(purchase.purchasedAt),
            questionCount: Math.max(0, Number(purchase.totalQuestionCount || 0)),
            amountPaid: Number((purchase.totalAmountPaid || purchase.grossAmount || 0).toFixed(2)),
            ruleSummary: `${Math.max(1, Number(purchase.studentsCount || 1))} students • ${Math.max(1, Number(purchase.daysCount || 1))} days`,
          };
        });

        const buyerIds = Array.from(
          new Set(
            [...rawPracticeRows, ...rawMockRows, ...rawTeacherQuestionRows]
              .map((row) => row.buyerId)
              .filter(Boolean)
          )
        );

        const buyerProfileEntries = await Promise.all(
          buyerIds.map(async (buyerId) => {
            try {
              const buyerSnapshot = await getDoc(doc(firestore, 'users', buyerId));
              if (!buyerSnapshot.exists()) return [buyerId, { id: buyerId } as TeacherPurchaseBuyerProfile] as const;
              return [buyerId, { id: buyerId, ...(buyerSnapshot.data() as Omit<TeacherPurchaseBuyerProfile, 'id'>) }] as const;
            } catch {
              return [buyerId, { id: buyerId } as TeacherPurchaseBuyerProfile] as const;
            }
          })
        );

        const buyerProfileById = new Map<string, TeacherPurchaseBuyerProfile>(buyerProfileEntries);
        const nextRows: TeacherPurchaseAuditRow[] = [
          ...rawPracticeRows
            .filter((row) => row.status === 'paid' && row.buyerId && row.examTypeId && row.classId)
            .map((row) => {
              const profile = buyerProfileById.get(row.buyerId);
              const buyerRole: TeacherPurchaseAuditRow['buyerRole'] =
                profile?.roleId === 'student' || profile?.roleId === 'teacher' || profile?.roleId === 'admin'
                  ? profile.roleId
                  : '';
              return {
                id: `practice-${row.id}`,
                buyerId: row.buyerId,
                buyerName: buildBuyerName(profile),
                buyerEmail: profile?.email || '',
                buyerRole,
                kind: 'practice' as const,
                examTypeId: row.examTypeId,
                classId: row.classId,
                subjectIds: row.subjectIds,
                questionCount: row.questionCount,
                amountPaid: row.amountPaid,
                purchasedAt: row.purchasedAt,
                ruleSummary: row.ruleSummary,
              };
            }),
          ...rawMockRows
            .filter((row) => row.status === 'paid' && row.buyerId && row.examTypeId && row.classId)
            .map((row) => {
              const profile = buyerProfileById.get(row.buyerId);
              const buyerRole: TeacherPurchaseAuditRow['buyerRole'] =
                profile?.roleId === 'student' || profile?.roleId === 'teacher' || profile?.roleId === 'admin'
                  ? profile.roleId
                  : '';
              return {
                id: `mock-${row.id}`,
                buyerId: row.buyerId,
                buyerName: buildBuyerName(profile),
                buyerEmail: profile?.email || '',
                buyerRole,
                kind: 'mock' as const,
                examTypeId: row.examTypeId,
                classId: row.classId,
                subjectIds: row.subjectIds,
                questionCount: row.questionCount,
                amountPaid: row.amountPaid,
                purchasedAt: row.purchasedAt,
                ruleSummary: row.ruleSummary,
              };
            }),
          ...rawTeacherQuestionRows
            .filter((row) => row.status === 'paid' && row.buyerId && row.examTypeId && row.classId)
            .map((row) => {
              const profile = buyerProfileById.get(row.buyerId);
              const buyerRole: TeacherPurchaseAuditRow['buyerRole'] =
                profile?.roleId === 'student' || profile?.roleId === 'teacher' || profile?.roleId === 'admin'
                  ? profile.roleId
                  : '';
              return {
                id: `teacher-question-${row.id}`,
                buyerId: row.buyerId,
                buyerName: buildBuyerName(profile),
                buyerEmail: profile?.email || '',
                buyerRole,
                kind: 'teacher_question' as const,
                examTypeId: row.examTypeId,
                classId: row.classId,
                subjectIds: row.subjectIds,
                questionCount: row.questionCount,
                amountPaid: row.amountPaid,
                purchasedAt: row.purchasedAt,
                ruleSummary: row.ruleSummary,
              };
            }),
        ]
          .filter((row) => !row.buyerRole || row.buyerRole === 'teacher' || row.buyerRole === 'admin')
          .sort((left, right) => (right.purchasedAt?.getTime() || 0) - (left.purchasedAt?.getTime() || 0));

        if (!isCancelled) setTeacherPurchaseAuditRows(nextRows);
      } catch (error: any) {
        if (!isCancelled) {
          setTeacherPurchaseAuditRows([]);
          setTeacherPurchaseAuditError(error?.message || 'Could not load teacher purchase activity.');
        }
      } finally {
        if (!isCancelled) setIsTeacherPurchaseAuditLoading(false);
      }
    };

    void loadTeacherPurchaseAudit();

    return () => {
      isCancelled = true;
    };
  }, [firestore, isAdmin, owner?.id]);

  const availableExamTypes = useMemo(
    () => Array.from(new Set(paidScopeTuples.map((scope) => scope.examTypeId)))
      .map((examTypeId) => examTypeById.get(examTypeId) || { id: examTypeId, name: examTypeNameById[examTypeId] || examTypeId })
      .sort((left, right) => (left.name || left.id).localeCompare(right.name || right.id)),
    [examTypeById, examTypeNameById, paidScopeTuples]
  );
  const availableClasses = useMemo(
    () => Array.from(
      new Set(
        paidScopeTuples
          .filter((scope) => scope.examTypeId === selectedExamTypeId)
          .map((scope) => scope.classId)
      )
    )
      .map((classId) => classById.get(classId) || { id: classId, name: classNameById[classId] || classId, examTypeId: selectedExamTypeId })
      .sort((left, right) => (left.name || left.id).localeCompare(right.name || right.id)),
    [classById, classNameById, paidScopeTuples, selectedExamTypeId]
  );
  const availableSubjects = useMemo(
    () => Array.from(
      new Set(
        paidScopeTuples
          .filter((scope) => scope.examTypeId === selectedExamTypeId && scope.classId === selectedClassId)
          .map((scope) => scope.subjectId)
      )
    )
      .map((subjectId) => subjectById.get(subjectId) || { id: subjectId, name: subjectNameById[subjectId] || subjectId, classId: selectedClassId })
      .sort((left, right) => (left.name || left.id).localeCompare(right.name || right.id)),
    [paidScopeTuples, selectedClassId, selectedExamTypeId, subjectById, subjectNameById]
  );

  useEffect(() => {
    if (availableExamTypes.length === 0) {
      setSelectedExamTypeId('');
      return;
    }
    if (availableExamTypes.some((examType) => examType.id === selectedExamTypeId)) return;
    setSelectedExamTypeId(availableExamTypes[0].id);
  }, [availableExamTypes, selectedExamTypeId]);

  useEffect(() => {
    if (availableClasses.length === 0) {
      setSelectedClassId('');
      return;
    }
    if (availableClasses.some((classItem) => classItem.id === selectedClassId)) return;
    setSelectedClassId(availableClasses[0].id);
  }, [availableClasses, selectedClassId]);

  useEffect(() => {
    if (availableSubjects.length === 0) {
      setSelectedSubjectId('');
      return;
    }
    if (availableSubjects.some((subject) => subject.id === selectedSubjectId)) return;
    setSelectedSubjectId(availableSubjects[0].id);
  }, [availableSubjects, selectedSubjectId]);

  const teacherPricingMap = useMemo(
    () => normalizeScopedDifficultyPricingMap(owner?.dcamTeacherQuestionPricingByScope),
    [owner?.dcamTeacherQuestionPricingByScope]
  );
  const practicePricingMap = useMemo(
    () => normalizeScopedDifficultyPricingMap(owner?.dcamPracticeQuestionPricingByScope ?? owner?.premiumPracticeQuestionPricingByScope),
    [owner?.dcamPracticeQuestionPricingByScope, owner?.premiumPracticeQuestionPricingByScope]
  );
  const mockPricingMap = useMemo(
    () => normalizeScopedDifficultyPricingMap(owner?.dcamMockTestQuestionPricingByScope ?? owner?.premiumMockTestQuestionPricingByScope),
    [owner?.dcamMockTestQuestionPricingByScope, owner?.premiumMockTestQuestionPricingByScope]
  );
  const practiceAttemptPricingMap = useMemo(
    () => normalizePremiumPracticeAttemptPricingMap(owner?.premiumPracticeAttemptPricingByScope),
    [owner?.premiumPracticeAttemptPricingByScope]
  );
  const mockAttemptPricingMap = useMemo(
    () => normalizePremiumCustomMockAttemptPricingMap(owner?.premiumMockTestAttemptPricingByScope),
    [owner?.premiumMockTestAttemptPricingByScope]
  );

  useEffect(() => {
    if (!selectedExamTypeId || !selectedClassId || !selectedSubjectId) {
      setTeacherRegularInput(EMPTY_PRICE_INPUT);
      setTeacherPyqInput(EMPTY_PRICE_INPUT);
      return;
    }
    setTeacherRegularInput(getScopedInput(teacherPricingMap, selectedExamTypeId, selectedClassId, selectedSubjectId, 'standard'));
    setTeacherPyqInput(getScopedInput(teacherPricingMap, selectedExamTypeId, selectedClassId, selectedSubjectId, 'pyq'));
  }, [teacherPricingMap, selectedClassId, selectedExamTypeId, selectedSubjectId]);

  useEffect(() => {
    if (!selectedExamTypeId || !selectedClassId || !selectedSubjectId) {
      setPracticeRegularInput(EMPTY_PRICE_INPUT);
      setPracticePyqInput(EMPTY_PRICE_INPUT);
      return;
    }
    setPracticeRegularInput(getScopedInput(practicePricingMap, selectedExamTypeId, selectedClassId, selectedSubjectId, 'standard'));
    setPracticePyqInput(getScopedInput(practicePricingMap, selectedExamTypeId, selectedClassId, selectedSubjectId, 'pyq'));
  }, [practicePricingMap, selectedClassId, selectedExamTypeId, selectedSubjectId]);

  useEffect(() => {
    if (!selectedExamTypeId || !selectedClassId || !selectedSubjectId) {
      setMockRegularInput(EMPTY_PRICE_INPUT);
      setMockPyqInput(EMPTY_PRICE_INPUT);
      return;
    }
    setMockRegularInput(getScopedInput(mockPricingMap, selectedExamTypeId, selectedClassId, selectedSubjectId, 'standard'));
    setMockPyqInput(getScopedInput(mockPricingMap, selectedExamTypeId, selectedClassId, selectedSubjectId, 'pyq'));
  }, [mockPricingMap, selectedClassId, selectedExamTypeId, selectedSubjectId]);

  const selectedPracticeAttemptRule = useMemo(
    () => resolvePremiumPracticeAttemptPricingRule({
      scopedPricingMap: practiceAttemptPricingMap,
      examTypeId: selectedExamTypeId,
      classId: selectedClassId,
    }),
    [practiceAttemptPricingMap, selectedClassId, selectedExamTypeId]
  );
  const selectedMockAttemptRule = useMemo(() => {
    const scopedRule = resolvePremiumCustomMockAttemptPricingRule({
      scopedPricingMap: mockAttemptPricingMap,
      examTypeId: selectedExamTypeId,
      classId: selectedClassId,
    });
    const scopeKey = buildPricingScopeKey(selectedExamTypeId, selectedClassId);
    if (scopeKey && mockAttemptPricingMap[scopeKey]) {
      return scopedRule;
    }
    return buildPremiumCustomMockAttemptRuleFromLegacyLimit(owner?.premiumMockTestAttemptLimit);
  }, [mockAttemptPricingMap, owner?.premiumMockTestAttemptLimit, selectedClassId, selectedExamTypeId]);

  useEffect(() => {
    setPracticeAttemptInput(buildAttemptInputState(selectedPracticeAttemptRule));
  }, [selectedPracticeAttemptRule]);

  useEffect(() => {
    setMockAttemptInput(buildAttemptInputState(selectedMockAttemptRule));
  }, [selectedMockAttemptRule]);

  const selectedScopeEntries = useMemo(
    () => paidQuestionEntries.filter((entry) =>
      entry.examTypeId === selectedExamTypeId
      && entry.classId === selectedClassId
      && entry.subjectId === selectedSubjectId
    ),
    [paidQuestionEntries, selectedClassId, selectedExamTypeId, selectedSubjectId]
  );

  const questionInventorySummary = useMemo<QuestionInventorySummary>(() => {
    const createSets = () => ({
      Easy: new Set<string>(),
      Medium: new Set<string>(),
      Hard: new Set<string>(),
    });
    const standardSets = createSets();
    const pyqSets = createSets();

    selectedScopeEntries.forEach((entry) => {
      const targetSets = entry.isPreviousYear ? pyqSets : standardSets;
      targetSets[entry.difficultyLevel].add(entry.sourceQuestionId);
    });

    return {
      standard: {
        Easy: standardSets.Easy.size,
        Medium: standardSets.Medium.size,
        Hard: standardSets.Hard.size,
      },
      pyq: {
        Easy: pyqSets.Easy.size,
        Medium: pyqSets.Medium.size,
        Hard: pyqSets.Hard.size,
      },
    };
  }, [selectedScopeEntries]);

  const currentSubjectScopeKeyRegular = selectedExamTypeId && selectedClassId && selectedSubjectId
    ? buildPricingScopeKey(selectedExamTypeId, selectedClassId, selectedSubjectId, 'standard')
    : '';
  const currentSubjectScopeKeyPyq = selectedExamTypeId && selectedClassId && selectedSubjectId
    ? buildPricingScopeKey(selectedExamTypeId, selectedClassId, selectedSubjectId, 'pyq')
    : '';
  const currentAttemptScopeKey = selectedExamTypeId && selectedClassId
    ? buildPricingScopeKey(selectedExamTypeId, selectedClassId)
    : '';
  const selectedFullScopeLabel = [
    examTypeNameById[selectedExamTypeId],
    classNameById[selectedClassId],
    subjectNameById[selectedSubjectId],
  ].filter(Boolean).join(' / ');
  const hasSavedPracticeScope = Boolean(
    (currentSubjectScopeKeyRegular && practicePricingMap[currentSubjectScopeKeyRegular])
    || (currentSubjectScopeKeyPyq && practicePricingMap[currentSubjectScopeKeyPyq])
    || (currentAttemptScopeKey && practiceAttemptPricingMap[currentAttemptScopeKey])
  );
  const hasSavedTeacherScope = Boolean(
    (currentSubjectScopeKeyRegular && teacherPricingMap[currentSubjectScopeKeyRegular])
    || (currentSubjectScopeKeyPyq && teacherPricingMap[currentSubjectScopeKeyPyq])
  );
  const hasSavedMockScope = Boolean(
    (currentSubjectScopeKeyRegular && mockPricingMap[currentSubjectScopeKeyRegular])
    || (currentSubjectScopeKeyPyq && mockPricingMap[currentSubjectScopeKeyPyq])
    || (currentAttemptScopeKey && mockAttemptPricingMap[currentAttemptScopeKey])
  );
  const filteredTeacherPurchaseAuditRows = useMemo(
    () =>
      teacherPurchaseAuditRows.filter((row) => {
        if (row.examTypeId !== selectedExamTypeId || row.classId !== selectedClassId) return false;
        if (!selectedSubjectId) return true;
        return row.subjectIds.length === 0 || row.subjectIds.includes(selectedSubjectId);
      }),
    [selectedClassId, selectedExamTypeId, selectedSubjectId, teacherPurchaseAuditRows]
  );

  const saveTeacherScopedPricing = async () => {
    if (!firestore || !owner?.id) return;
    if (!selectedExamTypeId || !selectedClassId || !selectedSubjectId) {
      toast({
        variant: 'destructive',
        title: 'Complete the pricing scope',
        description: 'Choose exam, curriculum, and subject before saving teacher question pricing.',
      });
      return;
    }

    const normalizedRegularInput = parsePriceInput(teacherRegularInput);
    const normalizedPyqInput = parsePriceInput(teacherPyqInput);

    if (!normalizedRegularInput || !normalizedPyqInput) {
      toast({
        variant: 'destructive',
        title: 'Invalid price',
        description: 'Enter valid non-negative values for every difficulty field.',
      });
      return;
    }

    const nextTeacherPricingMap: ScopedDifficultyPricingMap = {
      ...normalizeScopedDifficultyPricingMap(owner.dcamTeacherQuestionPricingByScope),
      [buildPricingScopeKey(selectedExamTypeId, selectedClassId, selectedSubjectId, 'standard')]: {
        examTypeId: selectedExamTypeId,
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        questionSource: 'standard',
        ...normalizedRegularInput,
      },
      [buildPricingScopeKey(selectedExamTypeId, selectedClassId, selectedSubjectId, 'pyq')]: {
        examTypeId: selectedExamTypeId,
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        questionSource: 'pyq',
        ...normalizedPyqInput,
      },
    };

    setIsSavingTeacherPricing(true);
    try {
      await updateDocumentNonBlocking(doc(firestore, 'users', owner.id), {
        dcamTeacherQuestionPricingByScope: nextTeacherPricingMap,
      });
      toast({
        title: 'Teacher question pricing saved',
        description: `${subjectNameById[selectedSubjectId] || 'Selected subject'} teacher-purchase pricing is updated for ${examTypeNameById[selectedExamTypeId] || 'the selected exam'} / ${classNameById[selectedClassId] || 'the selected curriculum'}.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: error?.message || 'Could not save teacher question pricing right now.',
      });
    } finally {
      setIsSavingTeacherPricing(false);
    }
  };

  const saveScopedPricing = async ({
    mode,
    regularInput,
    pyqInput,
    attemptInput,
  }: {
    mode: 'practice' | 'mock';
    regularInput: PriceInputState;
    pyqInput: PriceInputState;
    attemptInput: AttemptInputState;
  }) => {
    if (!firestore || !owner?.id) return;
    if (!selectedExamTypeId || !selectedClassId || !selectedSubjectId) {
      toast({
        variant: 'destructive',
        title: 'Complete the pricing scope',
        description: 'Choose exam, curriculum, and subject before saving question pricing.',
      });
      return;
    }

    const normalizedRegularInput = parsePriceInput(regularInput);
    const normalizedPyqInput = parsePriceInput(pyqInput);

    if (!normalizedRegularInput || !normalizedPyqInput) {
      toast({
        variant: 'destructive',
        title: 'Invalid price',
        description: 'Enter valid non-negative values for every difficulty field.',
      });
      return;
    }

    const questionPricingField = mode === 'practice'
      ? 'dcamPracticeQuestionPricingByScope'
      : 'dcamMockTestQuestionPricingByScope';
    const attemptPricingField = mode === 'practice'
      ? 'premiumPracticeAttemptPricingByScope'
      : 'premiumMockTestAttemptPricingByScope';

    const normalizedAttemptRule = mode === 'practice'
      ? normalizePremiumPracticeAttemptPricingRule({
          examTypeId: selectedExamTypeId,
          classId: selectedClassId,
          mode: attemptInput.mode,
          maxTotalAttempts: Number(attemptInput.maxTotalAttempts),
          maxAttemptsPerInterval: Number(attemptInput.maxAttemptsPerInterval),
          intervalValue: Number(attemptInput.intervalValue),
          intervalUnit: attemptInput.intervalUnit,
          rechargePrice: Number(attemptInput.rechargePrice),
          intervalAttemptPrice: Number(attemptInput.intervalAttemptPrice),
        })
      : normalizePremiumCustomMockAttemptPricingRule({
          examTypeId: selectedExamTypeId,
          classId: selectedClassId,
          mode: attemptInput.mode,
          maxTotalAttempts: Number(attemptInput.maxTotalAttempts),
          maxAttemptsPerInterval: Number(attemptInput.maxAttemptsPerInterval),
          intervalValue: Number(attemptInput.intervalValue),
          intervalUnit: attemptInput.intervalUnit,
          rechargePrice: Number(attemptInput.rechargePrice),
          intervalAttemptPrice: Number(attemptInput.intervalAttemptPrice),
        });

    if (attemptInput.mode === 'total' && !normalizedAttemptRule.maxTotalAttempts) {
      toast({
        variant: 'destructive',
        title: 'Invalid total attempts',
        description: 'Set total attempts to 1 or more before saving this scope.',
      });
      return;
    }

    if (
      attemptInput.mode === 'interval'
      && (!normalizedAttemptRule.maxAttemptsPerInterval || !normalizedAttemptRule.intervalValue || !normalizedAttemptRule.intervalUnit)
    ) {
      toast({
        variant: 'destructive',
        title: 'Invalid interval limit',
        description: 'Set attempts per interval, interval value, and interval unit before saving this scope.',
      });
      return;
    }

    const currentQuestionPricingMap = normalizeScopedDifficultyPricingMap(owner[questionPricingField]);
    const nextQuestionPricingMap: ScopedDifficultyPricingMap = {
      ...currentQuestionPricingMap,
      [buildPricingScopeKey(selectedExamTypeId, selectedClassId, selectedSubjectId, 'standard')]: {
        examTypeId: selectedExamTypeId,
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        questionSource: 'standard',
        ...normalizedRegularInput,
      },
      [buildPricingScopeKey(selectedExamTypeId, selectedClassId, selectedSubjectId, 'pyq')]: {
        examTypeId: selectedExamTypeId,
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        questionSource: 'pyq',
        ...normalizedPyqInput,
      },
    };
    const scopeKey = buildPricingScopeKey(selectedExamTypeId, selectedClassId);
    const currentAttemptPricingMap = mode === 'practice'
      ? normalizePremiumPracticeAttemptPricingMap(owner[attemptPricingField])
      : normalizePremiumCustomMockAttemptPricingMap(owner[attemptPricingField]);
    const nextAttemptPricingMap = {
      ...currentAttemptPricingMap,
      [scopeKey]: normalizedAttemptRule,
    };

    if (mode === 'practice') setIsSavingPracticePricing(true);
    else setIsSavingMockPricing(true);

    try {
      await updateDocumentNonBlocking(doc(firestore, 'users', owner.id), {
        [questionPricingField]: nextQuestionPricingMap,
        [attemptPricingField]: nextAttemptPricingMap,
      });
      toast({
        title: mode === 'practice' ? 'Practice pricing saved' : 'Custom mock pricing saved',
        description: `${subjectNameById[selectedSubjectId] || 'Selected subject'} pricing and the ${mode === 'practice' ? 'practice' : 'custom mock'} attempt rule are updated for ${examTypeNameById[selectedExamTypeId] || 'the selected exam'} / ${classNameById[selectedClassId] || 'the selected curriculum'}.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: error?.message || 'Could not save the pricing rule right now.',
      });
    } finally {
      if (mode === 'practice') setIsSavingPracticePricing(false);
      else setIsSavingMockPricing(false);
    }
  };

  const isLoading =
    isAdminLoading
    || isOwnerLoading
    || areExamTypesLoading
    || areClassesLoading
    || areSubjectsLoading
    || areQuestionsLoading;

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="DCAM Question Pricing" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : !isAdmin ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle>Admin access required</CardTitle>
              <CardDescription>This workspace is only available to admin accounts.</CardDescription>
            </CardHeader>
          </Card>
        ) : !owner?.id ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle>DCAM owner account not found</CardTitle>
              <CardDescription>
                Could not locate the allowlisted question-bank owner for {ALLOWED_TEACHER_AUTHOR_EMAIL}.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="relative overflow-hidden rounded-[32px] border border-cyan-400/20 bg-[linear-gradient(140deg,rgba(12,74,110,0.24),rgba(2,6,23,0.98)_45%,rgba(15,23,42,0.96))] shadow-[0_30px_90px_-48px_rgba(14,165,233,0.65)]">
              <div className="pointer-events-none absolute -right-16 -top-12 h-48 w-48 rounded-full bg-cyan-400/18 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-blue-500/12 blur-3xl" />
              <CardHeader className="relative space-y-6 p-6 md:p-7">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-primary/35 bg-primary/10 text-primary">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    Admin Pricing Control
                  </Badge>
                  <Badge variant="outline" className="border-cyan-400/30 bg-cyan-500/12 text-cyan-100">
                    {DCAM_QUESTION_BANK_LABEL}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <CardTitle className="text-3xl md:text-4xl">DCAM Paid Question Pricing</CardTitle>
                      <CardDescription className="max-w-3xl text-sm md:text-base">
                        Set the live checkout pricing for paid questions, PYQs, and premium attempt rules used in student practice sessions and custom mocks.
                      </CardDescription>
                    </div>
                    <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground">
                      Admin updates here are applied in the student payment flow for the selected scope.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Managed Account</p>
                      <p className="mt-2 text-base font-semibold text-slate-50">{formatOwnerName(owner)}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Paid Subject Scopes</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-50">{new Set(paidScopeTuples.map((scope) => `${scope.examTypeId}__${scope.classId}__${scope.subjectId}`)).size}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Visible Entries</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-50">{selectedScopeEntries.length}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.97),rgba(2,6,23,0.98))]">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Layers3 className="h-5 w-5 text-primary" />
                  Pricing Scope
                </CardTitle>
                <CardDescription>Select the exact exam, curriculum, and subject whose paid prices you want to control.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-cyan-100/80">Step 1</p>
                    <Label>Exam</Label>
                    <Select value={selectedExamTypeId} onValueChange={setSelectedExamTypeId}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select exam" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableExamTypes.map((examType) => (
                          <SelectItem key={examType.id} value={examType.id}>
                            {examType.name || 'Untitled exam'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-cyan-100/80">Step 2</p>
                    <Label>Curriculum</Label>
                    <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={!selectedExamTypeId}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select curriculum" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClasses.map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.name || 'Untitled curriculum'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-cyan-100/80">Step 3</p>
                    <Label>Subject</Label>
                    <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId} disabled={!selectedClassId}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSubjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name || 'Untitled subject'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/8 p-4">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-primary" />
                      <p className="font-semibold">Current scope</p>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-slate-50">
                      {selectedFullScopeLabel || 'Select exam, curriculum, and subject'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-white/10 bg-white/5">Exam: {examTypeNameById[selectedExamTypeId] || 'Not selected'}</Badge>
                      <Badge variant="outline" className="border-white/10 bg-white/5">Curriculum: {classNameById[selectedClassId] || 'Not selected'}</Badge>
                      <Badge variant="outline" className="border-white/10 bg-white/5">Subject: {subjectNameById[selectedSubjectId] || 'Not selected'}</Badge>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-amber-400/20 bg-amber-500/8 p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <p className="font-semibold">Paid question inventory</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/8 p-3">
                        <p className="font-medium text-cyan-100">Regular</p>
                        <p className="mt-1 text-muted-foreground">
                          Easy {questionInventorySummary.standard.Easy} | Medium {questionInventorySummary.standard.Medium} | Hard {questionInventorySummary.standard.Hard}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/8 p-3">
                        <p className="font-medium text-amber-100">PYQ</p>
                        <p className="mt-1 text-muted-foreground">
                          Easy {questionInventorySummary.pyq.Easy} | Medium {questionInventorySummary.pyq.Medium} | Hard {questionInventorySummary.pyq.Hard}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Attempt rules below apply at the exam + curriculum level, while question prices save for the selected subject.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <TeacherQuestionPricingCard
              title="Teacher Question Pricing"
              description="Set the per-day, per-student rate teachers pay when they purchase paid DCAM questions for the selected scope."
              scopeText={selectedFullScopeLabel || 'Choose the scope above to start editing'}
              regularInput={teacherRegularInput}
              pyqInput={teacherPyqInput}
              setRegularInput={setTeacherRegularInput}
              setPyqInput={setTeacherPyqInput}
              onSave={saveTeacherScopedPricing}
              isSaving={isSavingTeacherPricing}
              saveLabel={hasSavedTeacherScope ? 'Update Scope' : 'Save Scope'}
              hasSavedScope={hasSavedTeacherScope}
            />

            <TeacherPurchaseAuditCard
              scopeText={selectedFullScopeLabel || 'Choose the scope above to review purchases'}
              rows={filteredTeacherPurchaseAuditRows}
              isLoading={isTeacherPurchaseAuditLoading}
              error={teacherPurchaseAuditError}
              flowFilter={teacherPurchaseFlowFilter}
              onFlowFilterChange={setTeacherPurchaseFlowFilter}
              subjectNameById={subjectNameById}
            />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <PricingEditorCard
                title="Practice Session Pricing"
                description="These prices are used when students open premium practice sessions from the DCAM question bank and then proceed to payment."
                tone="practice"
                regularInput={practiceRegularInput}
                pyqInput={practicePyqInput}
                attemptTitle="Practice Attempt Settings"
                attemptDescription="Control how many times a student can reuse the same paid practice purchase for this exam and curriculum."
                attemptScopeText={selectedFullScopeLabel || 'Choose the scope to start editing'}
                attemptInput={practiceAttemptInput}
                setAttemptInput={setPracticeAttemptInput}
                attemptSummary={formatPremiumPracticeAttemptPricingRule(selectedPracticeAttemptRule)}
                setRegularInput={setPracticeRegularInput}
                setPyqInput={setPracticePyqInput}
                onSave={() => saveScopedPricing({
                  mode: 'practice',
                  regularInput: practiceRegularInput,
                  pyqInput: practicePyqInput,
                  attemptInput: practiceAttemptInput,
                })}
                isSaving={isSavingPracticePricing}
                saveLabel={hasSavedPracticeScope ? 'Update Scope' : 'Save Scope'}
              />

              <PricingEditorCard
                title="Custom Mock Pricing"
                description="These prices are used when students create premium custom mock tests from the DCAM question bank and then complete payment."
                tone="mock"
                regularInput={mockRegularInput}
                pyqInput={mockPyqInput}
                attemptTitle="Custom Mock Attempt Settings"
                attemptDescription="Set how many times a student can re-attempt or recharge premium custom mocks for this exam and curriculum."
                attemptScopeText={selectedFullScopeLabel || 'Choose the scope to start editing'}
                attemptInput={mockAttemptInput}
                setAttemptInput={setMockAttemptInput}
                attemptSummary={formatPremiumCustomMockAttemptPricingRule(selectedMockAttemptRule)}
                setRegularInput={setMockRegularInput}
                setPyqInput={setMockPyqInput}
                onSave={() => saveScopedPricing({
                  mode: 'mock',
                  regularInput: mockRegularInput,
                  pyqInput: mockPyqInput,
                  attemptInput: mockAttemptInput,
                })}
                isSaving={isSavingMockPricing}
                saveLabel={hasSavedMockScope ? 'Update Scope' : 'Save Scope'}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
