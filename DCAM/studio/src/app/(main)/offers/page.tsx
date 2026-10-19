'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { collection, doc, getDoc, query, where } from 'firebase/firestore';
import { ArrowRight, BookOpen, CalendarClock, CreditCard, Layers3, LoaderCircle, PackagePlus, RefreshCcw, SlidersHorizontal, Sparkles, Target, TicketPercent, UserRound, Video } from 'lucide-react';

import DashboardHeader from '@/components/dashboard-header';
import OfferQuestionCoverageSummary from '@/components/subscription/offer-question-coverage-summary';
import { completeVerifiedPayment, createRazorpayOrder } from '@/app/actions';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { sendSelfBellNotification } from '@/lib/client-notifications';
import { formatPremiumCustomMockAttemptPricingRule } from '@/lib/premium-custom-mock';
import { formatPremiumPracticeAttemptPricingRule } from '@/lib/premium-practice-session';
import { splitSubtopicPath } from '@/lib/subtopic-paths';
import { formatTestDurationLabel } from '@/lib/test-duration';
import { countTeacherOfferSelections, type TeacherOffer } from '@/lib/teacher-offers';
import { isCourseHiddenFromStudents } from '@/lib/course-assignment';
import { mergeLegacyDifficultyCounts, QUESTION_DIFFICULTY } from '@/lib/question-difficulty';

type ExamType = {
  id: string;
  name: string;
};

type ClassItem = {
  id: string;
  name: string;
  examTypeId: string;
};

const getQuestionBankSourceLabel = (value?: string) =>
  value === 'teacher_official' ? 'Teacher Official' : 'Student + Official';

type Subject = {
  id: string;
  name: string;
  classId: string;
};

type UserProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  roleId?: 'student' | 'teacher' | 'admin';
  status?: 'active' | 'blocked';
};

type TeacherOfferPurchase = {
  id: string;
  offerId?: string;
  teacherOfferId?: string;
  status?: 'paid' | 'failed';
};

type OfferCoursePreview = {
  id: string;
  title: string;
  description?: string;
  teacherName?: string;
  accessLevel?: 'free' | 'paid';
  subscriptionAttached?: boolean;
  publicationStatus?: 'draft' | 'published' | 'deleted' | string;
  thumbnailUrl?: string;
  imageUrl?: string;
  classLevel?: string;
  classId?: string;
  examTypeId?: string;
  subjectIds?: string[];
  isCrashCourse?: boolean;
};

type OfferMockTestPreview = {
  id: string;
  title: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  accessLevel?: 'free' | 'paid';
  publicationStatus?: 'draft' | 'published';
  examTypeId?: string;
  classId?: string;
  questionIds?: string[];
  duration?: number | null;
};

type OfferLiveBatchPreview = {
  id: string;
  title: string;
  description?: string;
  accessLevel?: 'free' | 'paid';
  subscriptionAttached?: boolean;
  publicationStatus?: 'draft' | 'published';
  examTypeId?: string;
  classId?: string;
  batchStartDate?: string;
  subjectIds?: string[];
  thumbnailUrl?: string;
  totalSessions?: number;
  includedSessions?: number;
};

type OfferPracticeSubjectConfig = NonNullable<NonNullable<TeacherOffer['premiumPracticePack']>['subjectConfigs']>[number];
type OfferPracticeTopicConfig = NonNullable<NonNullable<TeacherOffer['premiumPracticePack']>['topicConfigs']>[number];
type OfferCustomMockSectionConfig = NonNullable<NonNullable<TeacherOffer['premiumCustomMockPack']>['subjectConfigs']>[number];

declare global {
  interface Window {
    Razorpay: any;
  }
}

const toDate = (value: unknown): Date | null => {
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
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const buildTeacherName = (profile?: UserProfile | null) =>
  `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || profile?.displayName || 'Teacher';

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];

const formatPracticeTimerLabel = (value: unknown) => {
  const seconds = Math.floor(Number(value));
  return Number.isFinite(seconds) && seconds > 0 ? `${seconds}s per question` : 'Untimed';
};

const formatBatchStartDate = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString();
};

const normalizeRazorpayContact = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.length >= 10 ? digits.slice(-10) : '';
};

const summarizeOfferItems = (items: string[], limit = 2) => {
  const normalized = items.map((item) => String(item || '').trim()).filter(Boolean);
  if (normalized.length === 0) return '';
  if (normalized.length <= limit) return normalized.join(', ');
  return `${normalized.slice(0, limit).join(', ')} +${normalized.length - limit} more`;
};

const formatCompactScopeLine = (
  count: number,
  subjectName?: string,
  topicName?: string,
  subtopicPaths?: string[],
  fallbackTopicMeta?: string
) => {
  const parts = [
    String(subjectName || '').trim(),
    String(topicName || '').trim(),
  ].filter(Boolean);

  const formattedSubtopics = normalizeStringArray(subtopicPaths)
    .map((path) => splitSubtopicPath(path).join(' / ') || path)
    .filter(Boolean);

  if (formattedSubtopics.length > 0) {
    parts.push(summarizeOfferItems(formattedSubtopics, 1));
  } else if (fallbackTopicMeta) {
    parts.push(fallbackTopicMeta);
  }

  return `${Math.max(0, Number(count || 0))} Q | ${parts.join(' | ') || 'Saved scope'}`;
};

const buildCompactPracticePackLines = (
  offer: TeacherOffer,
  subjectNameById: Record<string, string>
) => {
  const pack = offer.premiumPracticePack;
  if (!pack) return [];

  const topicLines = (pack.topicConfigs || [])
    .filter((config) => Math.max(0, Number(config.count || 0)) > 0)
    .map((config) =>
      formatCompactScopeLine(
        Number(config.count || 0),
        config.subjectName || subjectNameById[config.subjectId || ''] || 'Subject',
        config.topicName || 'All topics',
        config.subtopics
      )
    );

  if (topicLines.length > 0) {
    return topicLines;
  }

  return (pack.subjectConfigs || [])
    .filter((config) => Math.max(0, Number(config.count || 0)) > 0)
    .map((config) => {
      const selectedTopicCount = Math.max(0, Number(config.selectedTopicCount || 0));
      return formatCompactScopeLine(
        Number(config.count || 0),
        config.subjectName || subjectNameById[config.subjectId || ''] || 'Subject',
        '',
        [],
        selectedTopicCount > 0 ? `${selectedTopicCount} selected topics` : 'All selected topics'
      );
    });
};

const buildCompactCustomMockLines = (
  offer: TeacherOffer,
  subjectNameById: Record<string, string>
) =>
  (offer.premiumCustomMockPack?.subjectConfigs || [])
    .filter((config) => Math.max(0, Number(config.count || 0)) > 0)
    .map((config) => {
      const subtopicPaths = normalizeStringArray(config.subtopicPaths);
      const legacySubtopic = String(config.subtopic || '').trim();
      return formatCompactScopeLine(
        Number(config.count || 0),
        config.subjectName || subjectNameById[config.subjectId || ''] || 'Subject',
        config.topicName || 'All topics',
        subtopicPaths.length > 0 ? subtopicPaths : legacySubtopic ? [legacySubtopic] : []
      );
    });

type OfferHierarchyTopic = {
  key: string;
  name: string;
  subtopics: string[];
};

type OfferHierarchySubject = {
  key: string;
  name: string;
  topics: OfferHierarchyTopic[];
};

type OfferQuestionScopeRow = {
  id: string;
  subjectName: string;
  topicName?: string;
  subtopicPaths?: string[];
  count: number;
};

type OfferQuestionScopeTopicGroup = {
  key: string;
  name: string;
  count: number;
  subtopics: string[];
};

type OfferQuestionScopeSubjectGroup = {
  key: string;
  name: string;
  count: number;
  topics: OfferQuestionScopeTopicGroup[];
};

const TOPIC_PLACEHOLDER_NAMES = new Set(['all topics', 'all selected topics', 'topic']);

const normalizeTopicDisplayName = (value?: string | null) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return TOPIC_PLACEHOLDER_NAMES.has(trimmed.toLowerCase()) ? '' : trimmed;
};

const normalizeSubtopicDisplayList = (value: unknown) =>
  Array.from(
    new Set(
      normalizeStringArray(value)
        .map((path) => splitSubtopicPath(path).join(' > ') || path)
        .filter(Boolean)
    )
  );

const buildOfferScopeHierarchy = (
  offer: TeacherOffer,
  subjectNameById: Record<string, string>
): OfferHierarchySubject[] => {
  const subjectMap = new Map<string, { name: string; topics: Map<string, OfferHierarchyTopic> }>();

  const ensureSubject = (subjectName?: string | null) => {
    const name = String(subjectName || '').trim();
    if (!name) return null;
    const key = name.toLowerCase();
    if (!subjectMap.has(key)) {
      subjectMap.set(key, { name, topics: new Map<string, OfferHierarchyTopic>() });
    }
    return subjectMap.get(key) || null;
  };

  const addScope = (subjectName?: string | null, topicName?: string | null, subtopics?: unknown) => {
    const subjectEntry = ensureSubject(subjectName);
    if (!subjectEntry) return;
    const normalizedTopicName = normalizeTopicDisplayName(topicName);
    if (!normalizedTopicName) return;

    const topicKey = normalizedTopicName.toLowerCase();
    const existingTopic = subjectEntry.topics.get(topicKey) || {
      key: `${subjectEntry.name.toLowerCase()}-${topicKey}`,
      name: normalizedTopicName,
      subtopics: [],
    };

    normalizeSubtopicDisplayList(subtopics).forEach((subtopic) => {
      if (!existingTopic.subtopics.includes(subtopic)) {
        existingTopic.subtopics.push(subtopic);
      }
    });

    subjectEntry.topics.set(topicKey, existingTopic);
  };

  (offer.subjectNames || []).forEach((subjectName) => {
    ensureSubject(subjectName);
  });

  (offer.subjectIds || []).forEach((subjectId) => {
    ensureSubject(subjectNameById[subjectId] || '');
  });

  (offer.premiumPracticePack?.subjectConfigs || []).forEach((config) => {
    ensureSubject(config.subjectName || subjectNameById[config.subjectId] || 'Subject');
  });

  (offer.premiumPracticePack?.topicConfigs || []).forEach((config) => {
    addScope(
      config.subjectName || subjectNameById[config.subjectId] || 'Subject',
      config.topicName,
      config.subtopics
    );
  });

  (offer.premiumCustomMockPack?.subjectConfigs || []).forEach((config) => {
    const subjectName = config.subjectName || subjectNameById[config.subjectId] || 'Subject';
    ensureSubject(subjectName);
    addScope(subjectName, config.topicName, config.subtopicPaths?.length ? config.subtopicPaths : (config.subtopic ? [config.subtopic] : []));
  });

  return Array.from(subjectMap.entries())
    .map(([key, subject]) => ({
      key,
      name: subject.name,
      topics: Array.from(subject.topics.values()).sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

const buildPracticeQuestionScopeRows = (
  offer: TeacherOffer,
  subjectNameById: Record<string, string>
): OfferQuestionScopeRow[] => {
  const practicePack = offer.premiumPracticePack;
  if (!practicePack) return [];

  const topicRows = (practicePack.topicConfigs || [])
    .filter((config) => Math.max(0, Number(config.count || 0)) > 0)
    .map((config, index) => ({
      id: `practice-topic-${config.topicId || index}`,
      subjectName: config.subjectName || subjectNameById[config.subjectId] || 'Subject',
      topicName: normalizeTopicDisplayName(config.topicName),
      subtopicPaths: normalizeSubtopicDisplayList(config.subtopics),
      count: Math.max(0, Number(config.count || 0)),
    }));

  if (topicRows.length > 0) return topicRows;

  return (practicePack.subjectConfigs || [])
    .filter((config) => Math.max(0, Number(config.count || 0)) > 0)
    .map((config, index) => ({
      id: `practice-subject-${config.subjectId || index}`,
      subjectName: config.subjectName || subjectNameById[config.subjectId] || 'Subject',
      topicName: '',
      subtopicPaths: [],
      count: Math.max(0, Number(config.count || 0)),
    }));
};

const buildCustomMockQuestionScopeRows = (
  offer: TeacherOffer,
  subjectNameById: Record<string, string>
): OfferQuestionScopeRow[] =>
  (offer.premiumCustomMockPack?.subjectConfigs || [])
    .filter((config) => Math.max(0, Number(config.count || 0)) > 0)
    .map((config, index) => ({
      id: `custom-mock-${config.subjectId || index}-${config.topicId || 'root'}`,
      subjectName: config.subjectName || subjectNameById[config.subjectId] || 'Subject',
      topicName: normalizeTopicDisplayName(config.topicName),
      subtopicPaths: normalizeSubtopicDisplayList(
        config.subtopicPaths?.length ? config.subtopicPaths : (config.subtopic ? [config.subtopic] : [])
      ),
      count: Math.max(0, Number(config.count || 0)),
    }));

const buildQuestionScopeGroups = (rows: OfferQuestionScopeRow[]): OfferQuestionScopeSubjectGroup[] => {
  const subjectMap = new Map<string, { name: string; count: number; topics: Map<string, OfferQuestionScopeTopicGroup> }>();

  rows
    .filter((row) => Math.max(0, Number(row.count || 0)) > 0)
    .forEach((row) => {
      const subjectName = String(row.subjectName || '').trim() || 'Subject';
      const subjectKey = subjectName.toLowerCase();
      const subjectEntry = subjectMap.get(subjectKey) || {
        name: subjectName,
        count: 0,
        topics: new Map<string, OfferQuestionScopeTopicGroup>(),
      };
      subjectEntry.count += Math.max(0, Number(row.count || 0));

      const topicName = normalizeTopicDisplayName(row.topicName);
      if (topicName) {
        const topicKey = topicName.toLowerCase();
        const topicEntry = subjectEntry.topics.get(topicKey) || {
          key: `${subjectKey}-${topicKey}`,
          name: topicName,
          count: 0,
          subtopics: [],
        };
        topicEntry.count += Math.max(0, Number(row.count || 0));
        normalizeSubtopicDisplayList(row.subtopicPaths).forEach((subtopic) => {
          if (!topicEntry.subtopics.includes(subtopic)) {
            topicEntry.subtopics.push(subtopic);
          }
        });
        subjectEntry.topics.set(topicKey, topicEntry);
      }

      subjectMap.set(subjectKey, subjectEntry);
    });

  return Array.from(subjectMap.entries())
    .map(([key, subject]) => ({
      key,
      name: subject.name,
      count: subject.count,
      topics: Array.from(subject.topics.values()).sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

function StudentOfferScopeHierarchy({
  examTypeName,
  curriculumName,
  subjects,
}: {
  examTypeName?: string;
  curriculumName?: string;
  subjects: OfferHierarchySubject[];
}) {
  return (
    <div className="space-y-3">
      {examTypeName ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/75">Exam</p>
          <p className="mt-1 text-base font-semibold text-white">{examTypeName}</p>
        </div>
      ) : null}

      {curriculumName ? (
        <div className="ml-4 border-l border-white/10 pl-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Curriculum</p>
          <p className="mt-1 text-sm font-medium text-white">{curriculumName}</p>

          {subjects.length > 0 ? (
            <div className="mt-3 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Subjects</p>
              {subjects.map((subject) => (
                <div key={subject.key} className="ml-4 border-l border-white/10 pl-4">
                  <p className="text-sm font-medium text-white">{subject.name}</p>

                  {subject.topics.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Topics</p>
                      {subject.topics.map((topic) => (
                        <div key={topic.key} className="ml-4 border-l border-white/10 pl-4">
                          <p className="text-sm text-slate-100">{topic.name}</p>

                          {topic.subtopics.length > 0 ? (
                            <div className="mt-2 space-y-1">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Subtopics</p>
                              {topic.subtopics.map((subtopic) => (
                                <p key={`${topic.key}-${subtopic}`} className="ml-4 text-sm text-slate-300">
                                  {subtopic}
                                </p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StudentOfferQuestionScopeList({
  groups,
}: {
  groups: OfferQuestionScopeSubjectGroup[];
}) {
  return (
    <div className="space-y-3">
      {groups.map((subject) => (
        <div key={subject.key} className="rounded-xl border border-white/10 bg-black/15 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">{subject.name}</p>
            <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-100">
              {subject.count} question{subject.count === 1 ? '' : 's'}
            </Badge>
          </div>

          {subject.topics.length > 0 ? (
            <div className="mt-3 space-y-3">
              {subject.topics.map((topic) => (
                <div key={topic.key} className="ml-4 border-l border-white/10 pl-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-100">{topic.name}</p>
                    <span className="text-xs text-slate-400">{topic.count} question{topic.count === 1 ? '' : 's'}</span>
                  </div>

                  {topic.subtopics.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {topic.subtopics.map((subtopic) => (
                        <p key={`${topic.key}-${subtopic}`} className="ml-4 text-sm text-slate-300">
                          {subtopic}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

const buildStudentQuestionScopeHighlights = (groups: OfferQuestionScopeSubjectGroup[]) =>
  groups.flatMap((subject) => {
    if (subject.topics.length === 0) {
      return [`${subject.name} • ${subject.count} question${subject.count === 1 ? '' : 's'}`];
    }

    return subject.topics.map((topic) => {
      const parts = [subject.name, topic.name].filter(Boolean);
      if (topic.subtopics.length > 0) {
        parts.push(summarizeOfferItems(topic.subtopics, 1));
      }
      return `${parts.join(' • ')} • ${topic.count} question${topic.count === 1 ? '' : 's'}`;
    });
  });

function StudentOfferPackageDetails({
  offer,
  teacherName,
  normalizedPrice,
  isPurchased,
  isBuying,
  onBuy,
  subjectNameById,
  offerContentLoading,
  offerCoursePreviews,
  offerCrashCoursePreviews,
  offerMockTestPreviews,
  offerLiveBatchPreviews,
}: {
  offer: TeacherOffer;
  teacherName: string;
  normalizedPrice: number;
  isPurchased: boolean;
  isBuying: boolean;
  onBuy: (offer: TeacherOffer) => void;
  subjectNameById: Record<string, string>;
  offerContentLoading: boolean;
  offerCoursePreviews: OfferCoursePreview[];
  offerCrashCoursePreviews: OfferCoursePreview[];
  offerMockTestPreviews: OfferMockTestPreview[];
  offerLiveBatchPreviews: OfferLiveBatchPreview[];
}) {
  const counts = countTeacherOfferSelections(offer);
  const practicePack = offer.premiumPracticePack;
  const customMockPack = offer.premiumCustomMockPack;
  const practiceQuestionCount = Math.max(0, Number(practicePack?.totalQuestions ?? counts.premiumPracticeSessionCount ?? 0));
  const customMockQuestionCount = Math.max(0, Number(customMockPack?.totalQuestions ?? counts.premiumCustomMockQuestionCount ?? 0));
  const practiceScopeGroups = buildQuestionScopeGroups(buildPracticeQuestionScopeRows(offer, subjectNameById));
  const customMockScopeGroups = buildQuestionScopeGroups(buildCustomMockQuestionScopeRows(offer, subjectNameById));
  const courseNames = (offerCoursePreviews.length > 0
    ? offerCoursePreviews.map((course) => String(course.title || '').trim()).filter(Boolean)
    : (offer.courses || []).map((course) => String(course.title || '').trim()).filter(Boolean));
  const crashCourseNames = (offerCrashCoursePreviews.length > 0
    ? offerCrashCoursePreviews.map((course) => String(course.title || '').trim()).filter(Boolean)
    : (offer.crashCourses || []).map((course) => String(course.title || '').trim()).filter(Boolean));
  const mockTestNames = (offerMockTestPreviews.length > 0
    ? offerMockTestPreviews.map((test) => String(test.title || '').trim()).filter(Boolean)
    : (offer.mockTests || []).map((test) => String(test.title || '').trim()).filter(Boolean));
  const liveBatchNames = (offerLiveBatchPreviews.length > 0
    ? offerLiveBatchPreviews.map((batch) => {
        const title = String(batch.title || '').trim();
        const sessionCount = Math.max(0, Number(batch.includedSessions || 0));
        if (!title) return '';
        return sessionCount > 0 ? `${title} (${sessionCount} sessions)` : title;
      }).filter(Boolean)
    : (offer.liveBatches || []).map((batch) => {
        const title = String(batch.title || '').trim();
        const sessionCount = Math.max(0, Number(batch.includedSessions || 0));
        if (!title) return '';
        return sessionCount > 0 ? `${title} (${sessionCount} sessions)` : title;
      }).filter(Boolean));
  const includedSections = [
    { key: 'courses', title: 'Courses', icon: BookOpen, items: courseNames },
    { key: 'crash-courses', title: 'Crash Courses', icon: PackagePlus, items: crashCourseNames },
    { key: 'mock-tests', title: 'Mock Tests', icon: Target, items: mockTestNames },
    { key: 'live-batches', title: 'Live Batches', icon: Video, items: liveBatchNames },
  ].filter((section) => section.items.length > 0);
  const subjectBadges = Array.from(
    new Set(
      [
        ...(offer.subjectNames || []),
        ...practiceScopeGroups.map((subject) => subject.name),
        ...customMockScopeGroups.map((subject) => subject.name),
      ]
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );
  const practiceHighlights = buildStudentQuestionScopeHighlights(practiceScopeGroups);
  const customMockHighlights = buildStudentQuestionScopeHighlights(customMockScopeGroups);
  const totalInclusions =
    includedSections.length
    + (practiceQuestionCount > 0 ? 1 : 0)
    + (customMockQuestionCount > 0 ? 1 : 0);
  const hasQuestionAccess = practiceQuestionCount > 0 || customMockQuestionCount > 0;
  const hasOfferContent = includedSections.length > 0 || hasQuestionAccess;

  return (
    <>
      <DialogHeader className="space-y-0 text-left">
        <div className="rounded-[28px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_28%),linear-gradient(180deg,rgba(4,15,38,0.98),rgba(2,8,25,0.96))] p-5 shadow-[0_28px_60px_-40px_rgba(6,182,212,0.85)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-3">
              <Badge variant="outline" className="w-fit rounded-full border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-cyan-100">
                Offer Package
              </Badge>
              <div className="space-y-2">
                <DialogTitle className="text-3xl font-semibold tracking-tight text-white">
                  {offer.title || 'Untitled Offer'}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 text-sm text-slate-300">
                  <UserRound className="h-4 w-4 text-cyan-100/80" />
                  Package by {teacherName}
                </DialogDescription>
                <p className="text-sm text-slate-300">
                  A prepaid learning package with included access that unlocks after purchase.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {offer.examTypeName ? (
                  <Badge className="rounded-full border border-cyan-300/30 bg-cyan-500/12 px-3 py-1 text-cyan-50">
                    {offer.examTypeName}
                  </Badge>
                ) : null}
                {offer.className ? (
                  <Badge className="rounded-full border border-slate-600/70 bg-slate-900/70 px-3 py-1 text-slate-100">
                    {offer.className}
                  </Badge>
                ) : null}
                {subjectBadges.map((subjectName) => (
                  <Badge
                    key={`${offer.id}-subject-${subjectName}`}
                    variant="outline"
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200"
                  >
                    {subjectName}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="min-w-[200px] rounded-[24px] border border-cyan-300/25 bg-cyan-500/10 px-5 py-4 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/70">Package Price</p>
              <p className="mt-2 text-4xl font-semibold text-cyan-50">
                INR {normalizedPrice.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </DialogHeader>

      <div className={`grid gap-4 ${hasQuestionAccess ? 'xl:grid-cols-[1.15fr_0.85fr]' : ''}`}>
        <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,20,45,0.94),rgba(5,12,28,0.96))] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/75">What&apos;s Inside</p>
              <p className="mt-2 text-lg font-semibold text-white">Everything unlocked with this package</p>
              <p className="mt-1 text-sm text-slate-300">
                Clean access summary for the student after purchase.
              </p>
            </div>
            <Badge variant="outline" className="rounded-full border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-cyan-50">
              {totalInclusions} inclusion{totalInclusions === 1 ? '' : 's'}
            </Badge>
          </div>

          {offerContentLoading ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={`offer-detail-skeleton-${index}`} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : hasOfferContent ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {includedSections.map((section) => {
                const Icon = section.icon;
                const visibleItems = section.items.slice(0, 3);
                const hiddenCount = Math.max(0, section.items.length - visibleItems.length);

                return (
                  <div
                    key={section.key}
                    className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-500/10">
                          <Icon className="h-4 w-4 text-cyan-100" />
                        </span>
                        {section.title}
                      </div>
                      <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-slate-200">
                        {section.items.length}
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-2">
                      {visibleItems.map((item) => (
                        <p key={`${section.key}-${item}`} className="text-sm text-slate-200">
                          {item}
                        </p>
                      ))}
                      {hiddenCount > 0 ? (
                        <p className="text-sm text-slate-400">+{hiddenCount} more</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {!hasQuestionAccess && includedSections.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-4 text-sm text-slate-300">
                  No items have been added to this package yet.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/15 p-4 text-sm text-slate-300">
              No items have been added to this package yet.
            </div>
          )}
        </div>

        {hasQuestionAccess ? (
          <div className="space-y-4">
            {practiceQuestionCount > 0 ? (
              <div className="rounded-[26px] border border-amber-300/20 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.15),transparent_35%),linear-gradient(180deg,rgba(61,33,7,0.88),rgba(15,23,42,0.94))] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                      <TicketPercent className="h-4 w-4" />
                      Practice Session Questions
                    </p>
                    <p className="mt-1 text-sm text-amber-50/85">
                      Included prepaid questions for premium practice sessions.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-300/20 bg-black/20 px-4 py-3 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/70">Included</p>
                    <p className="mt-1 text-2xl font-semibold text-amber-50">{practiceQuestionCount}</p>
                  </div>
                </div>

                {practiceHighlights.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {practiceHighlights.slice(0, 4).map((line) => (
                      <div key={`practice-highlight-${line}`} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-amber-50/90">
                        {line}
                      </div>
                    ))}
                    {practiceHighlights.length > 4 ? (
                      <p className="text-xs text-amber-50/65">+{practiceHighlights.length - 4} more included areas</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-amber-50/85">
                    Available under the selected offer subjects.
                  </div>
                )}
              </div>
            ) : null}

            {customMockQuestionCount > 0 ? (
              <div className="rounded-[26px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_35%),linear-gradient(180deg,rgba(4,26,42,0.9),rgba(15,23,42,0.95))] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                      <Layers3 className="h-4 w-4" />
                      Custom Mock Test Questions
                    </p>
                    <p className="mt-1 text-sm text-cyan-50/85">
                      Included prepaid questions for building custom mock tests.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-cyan-300/20 bg-black/20 px-4 py-3 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Included</p>
                    <p className="mt-1 text-2xl font-semibold text-cyan-50">{customMockQuestionCount}</p>
                  </div>
                </div>

                {customMockHighlights.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {customMockHighlights.slice(0, 4).map((line) => (
                      <div key={`custom-highlight-${line}`} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-cyan-50/90">
                        {line}
                      </div>
                    ))}
                    {customMockHighlights.length > 4 ? (
                      <p className="text-xs text-cyan-50/65">+{customMockHighlights.length - 4} more included areas</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-cyan-50/85">
                    Available under the selected offer subjects.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <DialogFooter className="gap-2 sm:justify-end">
        {isPurchased ? (
          <Button asChild className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 text-slate-950 hover:from-emerald-300 hover:via-cyan-300 hover:to-sky-400">
            <Link href="/my-practice">Open My Practice</Link>
          </Button>
        ) : (
          <Button
            type="button"
            className="bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 text-slate-950 hover:from-cyan-300 hover:via-sky-300 hover:to-blue-400"
            onClick={() => onBuy(offer)}
            disabled={isBuying}
          >
            {isBuying ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Buy Package
              </>
            )}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

export default function StudentOffersPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const isRoleLoading = isAdminLoading || isTeacherLoading;
  const shouldRedirectToDashboard = !isRoleLoading && (isTeacher || isAdmin);

  const [examTypeId, setExamTypeId] = useState('');
  const [classId, setClassId] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [buyingOfferId, setBuyingOfferId] = useState('');

  const examTypesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types')) : null), [firestore]);
  const classesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes')) : null), [firestore]);
  const subjectsQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects')) : null), [firestore]);
  const offersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'teacher_offers'), where('status', '==', 'active')) : null),
    [firestore]
  );
  const usersQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'users')) : null), [firestore]);
  const purchasedTeacherOffersQuery = useMemoFirebase(
    () => (firestore && user?.uid ? query(collection(firestore, 'users', user.uid, 'purchased_teacher_offers')) : null),
    [firestore, user?.uid]
  );
  const teacherOfferPurchasesQuery = useMemoFirebase(
    () => (firestore && user?.uid ? query(collection(firestore, 'users', user.uid, 'teacher_offer_purchases')) : null),
    [firestore, user?.uid]
  );

  const { data: examTypes, isLoading: examLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classes, isLoading: classLoading } = useCollection<ClassItem>(classesQuery);
  const { data: subjects, isLoading: subjectLoading } = useCollection<Subject>(subjectsQuery);
  const { data: offers, isLoading: offersLoading } = useCollection<TeacherOffer>(offersQuery);
  const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersQuery);
  const { data: purchasedTeacherOffers } = useCollection<TeacherOfferPurchase>(purchasedTeacherOffersQuery);
  const { data: teacherOfferPurchases } = useCollection<TeacherOfferPurchase>(teacherOfferPurchasesQuery);

  const sortedExamTypes = useMemo(
    () => [...(examTypes || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [examTypes]
  );
  const sortedClasses = useMemo(
    () => [...(classes || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [classes]
  );
  const sortedSubjects = useMemo(
    () => [...(subjects || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [subjects]
  );
  const examNameById = useMemo(
    () => Object.fromEntries((sortedExamTypes || []).map((item) => [item.id, item.name])),
    [sortedExamTypes]
  );
  const classNameById = useMemo(
    () => Object.fromEntries((sortedClasses || []).map((item) => [item.id, item.name])),
    [sortedClasses]
  );
  const subjectNameById = useMemo(
    () => Object.fromEntries((sortedSubjects || []).map((item) => [item.id, item.name])),
    [sortedSubjects]
  );

  const filteredClasses = useMemo(
    () => (examTypeId ? sortedClasses.filter((item) => item.examTypeId === examTypeId) : []),
    [sortedClasses, examTypeId]
  );
  const filteredSubjects = useMemo(
    () => (classId ? sortedSubjects.filter((item) => item.classId === classId) : []),
    [sortedSubjects, classId]
  );

  useEffect(() => {
    if (classId && !filteredClasses.some((item) => item.id === classId)) {
      setClassId('');
    }
  }, [classId, filteredClasses]);

  useEffect(() => {
    if (!shouldRedirectToDashboard) return;
    router.replace('/dashboard');
  }, [router, shouldRedirectToDashboard]);

  useEffect(() => {
    const availableSubjectIds = new Set(filteredSubjects.map((item) => item.id));
    setSelectedSubjectIds((current) => current.filter((subjectId) => availableSubjectIds.has(subjectId)));
  }, [filteredSubjects]);

  const teacherProfileById = useMemo(
    () => Object.fromEntries((users || []).map((profile) => [profile.id, profile])),
    [users]
  );
  const offerById = useMemo(
    () => Object.fromEntries((offers || []).map((offer) => [String(offer.id || '').trim(), offer]).filter((entry) => entry[0])),
    [offers]
  );

  useEffect(() => {
    if (selectedOfferId && !offerById[selectedOfferId]) {
      setSelectedOfferId('');
    }
  }, [offerById, selectedOfferId]);

  const filteredOffers = useMemo(() => {
    return [...(offers || [])]
      .filter((offer) => offer.status === 'active')
      .filter((offer) => {
        const teacherProfile = teacherProfileById[String(offer.createdByTeacherId || '')];
        return teacherProfile?.status !== 'blocked';
      })
      .filter((offer) => (!examTypeId ? true : offer.examTypeId === examTypeId))
      .filter((offer) => (!classId ? true : offer.classId === classId))
      .filter((offer) => {
        if (selectedSubjectIds.length === 0) return true;
        const offerSubjectIds = new Set(offer.subjectIds || []);
        return selectedSubjectIds.every((subjectId) => offerSubjectIds.has(subjectId));
      })
      .sort((left, right) => {
        const leftTime = toDate(left.updatedAt)?.getTime() || toDate(left.createdAt)?.getTime() || 0;
        const rightTime = toDate(right.updatedAt)?.getTime() || toDate(right.createdAt)?.getTime() || 0;
        return rightTime - leftTime;
      });
  }, [offers, teacherProfileById, examTypeId, classId, selectedSubjectIds]);
  const selectedOffer = selectedOfferId ? offerById[selectedOfferId] || null : null;
  const [offerContentLoading, setOfferContentLoading] = useState(false);
  const [offerCoursePreviews, setOfferCoursePreviews] = useState<OfferCoursePreview[]>([]);
  const [offerCrashCoursePreviews, setOfferCrashCoursePreviews] = useState<OfferCoursePreview[]>([]);
  const [offerMockTestPreviews, setOfferMockTestPreviews] = useState<OfferMockTestPreview[]>([]);
  const [offerLiveBatchPreviews, setOfferLiveBatchPreviews] = useState<OfferLiveBatchPreview[]>([]);
  const purchasedOfferIds = useMemo(() => {
    const ids = new Set<string>();
    [...(purchasedTeacherOffers || []), ...(teacherOfferPurchases || [])]
      .filter((purchase) => purchase.status === 'paid')
      .forEach((purchase) => {
        const offerId = String(purchase.offerId || purchase.teacherOfferId || '').trim();
        if (offerId) ids.add(offerId);
      });
    return ids;
  }, [purchasedTeacherOffers, teacherOfferPurchases]);

  const uniqueTeacherCount = useMemo(
    () => new Set(filteredOffers.map((offer) => offer.createdByTeacherId).filter(Boolean)).size,
    [filteredOffers]
  );

  const selectedExam = useMemo(
    () => sortedExamTypes.find((item) => item.id === examTypeId) || null,
    [sortedExamTypes, examTypeId]
  );
  const selectedClass = useMemo(
    () => sortedClasses.find((item) => item.id === classId) || null,
    [sortedClasses, classId]
  );
  const activeFilterCount = Number(Boolean(examTypeId)) + Number(Boolean(classId)) + selectedSubjectIds.length;

  useEffect(() => {
    if (!selectedOffer || !firestore) {
      setOfferContentLoading(false);
      setOfferCoursePreviews([]);
      setOfferCrashCoursePreviews([]);
      setOfferMockTestPreviews([]);
      setOfferLiveBatchPreviews([]);
      return;
    }

    let isActive = true;
    const teacherName = buildTeacherName(teacherProfileById[String(selectedOffer.createdByTeacherId || '').trim()]);

    const loadCoursePreviews = async (
      items: NonNullable<TeacherOffer['courses']> | NonNullable<TeacherOffer['crashCourses']> | undefined,
      isCrashCourse: boolean
    ): Promise<OfferCoursePreview[]> => {
      const hydrated = await Promise.all(
        (items || []).map(async (item): Promise<OfferCoursePreview | null> => {
          const id = String(item.id || '').trim();
          const fallbackTitle = String(item.title || '').trim() || (isCrashCourse ? 'Crash course' : 'Course');
          if (!id) return null;

          try {
            const snapshot = await getDoc(doc(firestore, 'courses', id));
            if (snapshot.exists()) {
              const data = snapshot.data() as Record<string, unknown>;
              const publicationStatus = String(data.publicationStatus || 'published').trim().toLowerCase();
              const preview = {
                id,
                title: String(data.title || fallbackTitle).trim() || fallbackTitle,
                description: String(data.description || '').trim(),
                teacherName: String(data.teacherName || teacherName).trim() || teacherName,
                accessLevel: data.accessLevel === 'paid' ? 'paid' : 'free',
                subscriptionAttached: data.subscriptionAttached === true,
                publicationStatus,
                thumbnailUrl: String(data.thumbnailUrl || '').trim(),
                imageUrl: String(data.imageUrl || '').trim(),
                classLevel: String(data.classLevel || '').trim(),
                classId: String(data.classId || selectedOffer.classId || '').trim(),
                examTypeId: String(data.examTypeId || selectedOffer.examTypeId || '').trim(),
                subjectIds: normalizeStringArray(data.subjectIds),
                isCrashCourse: data.isCrashCourse === true || isCrashCourse,
              } satisfies OfferCoursePreview;
              if (isCourseHiddenFromStudents(preview)) return null;
              return preview;
            }
          } catch {}

          return null;
        })
      );

      return hydrated.filter(Boolean) as OfferCoursePreview[];
    };

    const loadMockTestPreviews = async (items: NonNullable<TeacherOffer['mockTests']> | undefined): Promise<OfferMockTestPreview[]> => {
      const hydrated = await Promise.all(
        (items || []).map(async (item): Promise<OfferMockTestPreview | null> => {
          const id = String(item.id || '').trim();
          const fallbackTitle = String(item.title || '').trim() || 'Mock test';
          if (!id) return null;

          try {
            const snapshot = await getDoc(doc(firestore, 'mock_tests', id));
            if (snapshot.exists()) {
              const data = snapshot.data() as Record<string, unknown>;
              const config = data.config && typeof data.config === 'object' ? (data.config as Record<string, unknown>) : {};
              return {
                id,
                title: String(data.title || fallbackTitle).trim() || fallbackTitle,
                thumbnailUrl: String(data.thumbnailUrl || '').trim(),
                imageUrl: String(data.imageUrl || '').trim(),
                accessLevel: data.accessLevel === 'paid' ? 'paid' : 'free',
                publicationStatus: data.publicationStatus === 'draft' ? 'draft' : 'published',
                examTypeId: String(data.examTypeId || selectedOffer.examTypeId || '').trim(),
                classId: String(data.classId || selectedOffer.classId || '').trim(),
                questionIds: normalizeStringArray(config.questionIds),
                duration: Number.isFinite(Number(config.duration)) ? Number(config.duration) : null,
              } satisfies OfferMockTestPreview;
            }
          } catch {}

          return {
            id,
            title: fallbackTitle,
            accessLevel: 'paid',
            publicationStatus: 'published',
            examTypeId: String(selectedOffer.examTypeId || '').trim(),
            classId: String(selectedOffer.classId || '').trim(),
            questionIds: [],
            duration: null,
          } satisfies OfferMockTestPreview;
        })
      );

      return hydrated.filter(Boolean) as OfferMockTestPreview[];
    };

    const loadLiveBatchPreviews = async (items: NonNullable<TeacherOffer['liveBatches']> | undefined): Promise<OfferLiveBatchPreview[]> => {
      const hydrated = await Promise.all(
        (items || []).map(async (item): Promise<OfferLiveBatchPreview | null> => {
          const id = String(item.id || '').trim();
          const fallbackTitle = String(item.title || '').trim() || 'Live batch';
          const includedSessions = Math.max(0, Number(item.includedSessions || 0));
          const totalSessions = Math.max(0, Number(item.totalSessions || 0));
          if (!id) return null;

          try {
            const snapshot = await getDoc(doc(firestore, 'live_batches', id));
            if (snapshot.exists()) {
              const data = snapshot.data() as Record<string, unknown>;
              return {
                id,
                title: String(data.title || fallbackTitle).trim() || fallbackTitle,
                description: String(data.description || '').trim(),
                accessLevel: data.accessLevel === 'paid' ? 'paid' : 'free',
                subscriptionAttached: data.subscriptionAttached === true,
                publicationStatus: data.publicationStatus === 'draft' ? 'draft' : 'published',
                examTypeId: String(data.examTypeId || selectedOffer.examTypeId || '').trim(),
                classId: String(data.classId || selectedOffer.classId || '').trim(),
                batchStartDate: String(data.batchStartDate || '').trim(),
                subjectIds: normalizeStringArray(data.subjectIds),
                thumbnailUrl: String(data.thumbnailUrl || '').trim(),
                totalSessions,
                includedSessions,
              } satisfies OfferLiveBatchPreview;
            }
          } catch {}

          return {
            id,
            title: fallbackTitle,
            accessLevel: 'paid',
            publicationStatus: 'published',
            examTypeId: String(selectedOffer.examTypeId || '').trim(),
            classId: String(selectedOffer.classId || '').trim(),
            totalSessions,
            includedSessions,
          } satisfies OfferLiveBatchPreview;
        })
      );

      return hydrated.filter(Boolean) as OfferLiveBatchPreview[];
    };

    setOfferContentLoading(true);
    void (async () => {
      try {
        const [coursesLoaded, crashCoursesLoaded, mockTestsLoaded, liveBatchesLoaded] = await Promise.all([
          loadCoursePreviews(selectedOffer.courses, false),
          loadCoursePreviews(selectedOffer.crashCourses, true),
          loadMockTestPreviews(selectedOffer.mockTests),
          loadLiveBatchPreviews(selectedOffer.liveBatches),
        ]);

        if (!isActive) return;
        setOfferCoursePreviews(coursesLoaded);
        setOfferCrashCoursePreviews(crashCoursesLoaded);
        setOfferMockTestPreviews(mockTestsLoaded);
        setOfferLiveBatchPreviews(liveBatchesLoaded);
      } finally {
        if (isActive) setOfferContentLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [firestore, selectedOffer, teacherProfileById]);

  const toggleSubject = (subjectId: string, checked: boolean) => {
    setSelectedSubjectIds((current) =>
      checked
        ? (current.includes(subjectId) ? current : [...current, subjectId])
        : current.filter((item) => item !== subjectId)
    );
  };

  const resetFilters = () => {
    setExamTypeId('');
    setClassId('');
    setSelectedSubjectIds([]);
  };

  const handleBuyOffer = async (offer: TeacherOffer) => {
    const offerId = String(offer.id || '').trim();
    const teacherId = String(offer.createdByTeacherId || '').trim();
    const teacherName = buildTeacherName(teacherProfileById[teacherId]);
    const amount = Math.max(0, Number(offer.price || 0));
    const currency = String(offer.currency || 'INR').trim() || 'INR';

    if (!user?.uid) {
      toast({
        variant: 'destructive',
        title: 'Sign in required',
        description: 'Please sign in before buying a teacher package.',
      });
      router.push('/login');
      return;
    }
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Database unavailable',
        description: 'Could not connect to the app database.',
      });
      return;
    }
    if (!offerId || !teacherId) {
      toast({
        variant: 'destructive',
        title: 'Invalid package',
        description: 'This package is missing its teacher or package id.',
      });
      return;
    }
    if (purchasedOfferIds.has(offerId)) {
      toast({
        title: 'Package already unlocked',
        description: 'This package is already available in your My Practice library.',
      });
      router.push('/my-practice');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid package price',
        description: 'This package cannot be purchased because its price is not valid.',
      });
      return;
    }
    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      toast({
        variant: 'destructive',
        title: 'Razorpay not configured',
        description: 'Payment gateway key is missing for this app.',
      });
      return;
    }
    if (typeof window === 'undefined' || !window.Razorpay) {
      toast({
        variant: 'destructive',
        title: 'Payment gateway unavailable',
        description: 'Could not load Razorpay. Refresh the page and try again.',
      });
      return;
    }

    const normalizedContact = normalizeRazorpayContact(user.phoneNumber);
    setBuyingOfferId(offerId);
    const orderResult = await createRazorpayOrder(amount, currency);
    if (orderResult.error || !orderResult.orderId) {
      toast({
        variant: 'destructive',
        title: 'Payment initialization failed',
        description: orderResult.error || 'Could not create the payment order.',
      });
      setBuyingOfferId('');
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: Math.round(amount * 100),
      currency,
      name: 'DCAM Classes',
      description: `Teacher package: ${offer.title || 'Offer'}`,
      order_id: orderResult.orderId,
      handler: async (response: any) => {
        const paymentId = String(response.razorpay_payment_id || '').trim();
        const razorpayOrderId = String(response.razorpay_order_id || '').trim();
        const razorpaySignature = String(response.razorpay_signature || '').trim();
        if (!paymentId || !razorpayOrderId || !razorpaySignature) {
          toast({
            variant: 'destructive',
            title: 'Payment reference missing',
            description: 'The payment completed but verification details are missing.',
          });
          setBuyingOfferId('');
          return;
        }
        const paidAt = new Date().toISOString();
        const purchasePayload = {
          id: paymentId,
          offerId,
          teacherOfferId: offerId,
          teacherId,
          teacherName,
          title: offer.title || 'Teacher Offer',
          status: 'paid' as const,
          grossAmount: amount,
          totalAmountPaid: amount,
          currency,
          purchasedAt: paidAt,
          updatedAt: paidAt,
          examTypeId: String(offer.examTypeId || '').trim(),
          examTypeName: String(offer.examTypeName || '').trim(),
          classId: String(offer.classId || '').trim(),
          className: String(offer.className || '').trim(),
          offerSnapshot: offer,
        };

        try {
          const verifiedWrites: Array<{ path: string; merge: boolean; data: Record<string, unknown> }> = [
            {
              path: `users/${user.uid}/purchased_teacher_offers/${paymentId}`,
              merge: true,
              data: purchasePayload,
            },
            {
              path: `users/${user.uid}/teacher_offer_purchases/${paymentId}`,
              merge: true,
              data: purchasePayload,
            },
          ];

          [...(offer.courses || []), ...(offer.crashCourses || [])].forEach((course) => {
            const courseId = String(course?.id || '').trim();
            if (!courseId) return;
            verifiedWrites.push({
              path: `users/${user.uid}/purchased_courses/${courseId}`,
              merge: true,
              data: {
                id: courseId,
                courseId,
                teacherId: teacherId || null,
                offerId,
                offerPurchaseId: paymentId,
                purchasedAt: paidAt,
                source: 'teacher_offer',
              },
            });
          });

          (offer.mockTests || []).forEach((mockTest) => {
            const mockTestId = String(mockTest?.id || '').trim();
            if (!mockTestId) return;
            verifiedWrites.push({
              path: `users/${user.uid}/purchased_mock_tests/${mockTestId}`,
              merge: true,
              data: {
                id: mockTestId,
                testId: mockTestId,
                teacherId: teacherId || null,
                offerId,
                offerPurchaseId: paymentId,
                purchasedAt: paidAt,
                source: 'teacher_offer',
              },
            });
          });

          (offer.liveBatches || []).forEach((liveBatch) => {
            const batchId = String(liveBatch?.id || '').trim();
            if (!batchId) return;
            const includedSessions = Math.max(0, Number(liveBatch.includedSessions || 0));
            const totalSessionsInBatch = Math.max(0, Number(liveBatch.totalSessions || 0));
            const historyEntry = {
              purchasedAt: paidAt,
              sessionsPurchased: includedSessions,
              sessionFee: 0,
              amountPaid: 0,
              paymentId: `teacher_offer_${paymentId}_${batchId}`,
              planId: null,
            };

            verifiedWrites.push({
              path: `users/${user.uid}/purchased_live_batches/${batchId}`,
              merge: true,
              data: {
                id: batchId,
                batchId,
                liveBatchId: batchId,
                teacherId: teacherId || null,
                offerId,
                offerPurchaseId: paymentId,
                purchasedAt: paidAt,
                sessionsPurchased: includedSessions,
                totalSessionsInBatch,
                sessionPurchaseHistory: includedSessions > 0 ? [historyEntry] : [],
                latestPurchase: includedSessions > 0 ? historyEntry : null,
                source: 'teacher_offer',
              },
            });

            verifiedWrites.push({
              path: `users/${user.uid}/enrolled_live_batches/${batchId}`,
              merge: true,
              data: {
                id: batchId,
                batchId,
                title: String(liveBatch.title || '').trim() || 'Live Batch',
                teacherId,
                teacherName,
                accessLevel: 'paid',
                enrolledAt: paidAt,
                paidAt,
                paymentPlanId: null,
                hiddenFromMyBatch: false,
                hiddenFromMyBatchAt: null,
                sessionsPurchased: includedSessions,
                sessionFee: 0,
                totalSessionsInBatch,
                amountPaid: 0,
                sessionPurchaseHistory: includedSessions > 0 ? [historyEntry] : [],
                latestPurchase: includedSessions > 0 ? historyEntry : null,
                offerId,
                offerPurchaseId: paymentId,
                source: 'teacher_offer',
              },
            });
          });

          if (offer.premiumPracticePack && Number(offer.premiumPracticePack.totalQuestions || 0) > 0) {
            const practicePurchaseId = `offer_${paymentId}_premium_practice`;
            const normalizedTopicConfigs = (offer.premiumPracticePack.topicConfigs || [])
              .map((config) => ({
                subjectId: String(config.subjectId || '').trim(),
                topicId: String(config.topicId || '').trim(),
                subtopics: Array.isArray(config.subtopics) ? config.subtopics.map((value) => String(value || '').trim()).filter(Boolean) : [],
                questionBankSource: config.questionBankSource === 'teacher_official' ? 'teacher_official' : 'student_plus_official',
                questionType: config.questionType === 'MCQ' || config.questionType === 'Numerical' ? config.questionType : 'All',
                difficultyLevel: QUESTION_DIFFICULTY,
                previousYearMode: config.previousYearMode === 'pyq' ? 'pyq' : 'all',
                previousYears: Array.isArray(config.previousYears) ? config.previousYears.map((value) => String(value || '').trim()).filter(Boolean) : [],
                count: Math.max(0, Number(config.count || 0)),
              }))
              .filter((config) => config.subjectId && config.topicId && config.count > 0);

            verifiedWrites.push({
              path: `users/${user.uid}/premium_practice_session_purchases/${practicePurchaseId}`,
              merge: true,
              data: {
                id: practicePurchaseId,
                studentId: user.uid,
                teacherId,
                teacherName,
                examTypeId: String(offer.examTypeId || '').trim(),
                examTypeName: String(offer.examTypeName || '').trim(),
                classId: String(offer.classId || '').trim(),
                className: String(offer.className || '').trim(),
                practiceMode: 'premium',
                status: 'paid',
                questionCount: Math.max(0, Number(offer.premiumPracticePack.totalQuestions || 0)),
                questionCountByDifficulty: mergeLegacyDifficultyCounts(offer.premiumPracticePack.questionCountByDifficulty),
                includedQuestionCount: Math.max(0, Number(offer.premiumPracticePack.totalQuestions || 0)),
                includedQuestionCountByDifficulty: mergeLegacyDifficultyCounts(offer.premiumPracticePack.questionCountByDifficulty),
                perQuestionPriceByDifficulty: offer.premiumPracticePack.perQuestionPriceByDifficulty || {},
                grossAmount: Number(offer.premiumPracticePack.estimatedAmount || 0),
                attemptsPaidAmount: 0,
                totalAmountPaid: Number(offer.premiumPracticePack.estimatedAmount || 0),
                currency,
                questionBankSource: offer.premiumPracticePack.questionBankSource || 'student_plus_official',
                topicConfigs: normalizedTopicConfigs,
                includedTopicConfigs: normalizedTopicConfigs,
                perQuestionTimeSeconds: Number(offer.premiumPracticePack.perQuestionTimeSeconds || 0) > 0
                  ? Math.floor(Number(offer.premiumPracticePack.perQuestionTimeSeconds || 0))
                  : null,
                attemptPricing: offer.premiumPracticePack.attemptPricing || null,
                purchasedAt: paidAt,
                createdAt: paidAt,
                updatedAt: paidAt,
                offerId,
                offerPurchaseId: paymentId,
              },
            });
          }

          if (offer.premiumCustomMockPack && Number(offer.premiumCustomMockPack.totalQuestions || 0) > 0) {
            const premiumMockFeatureId = `offer_${paymentId}_premium_custom_mock`;
            const includedQuestionCountByDifficulty = mergeLegacyDifficultyCounts({
              easy: (offer.premiumCustomMockPack.subjectConfigs || []).reduce(
                (sum, config) => sum + Math.max(0, Number(config.count || 0)),
                0
              ),
            });

            verifiedWrites.push({
              path: `users/${user.uid}/premium_mock_feature_purchases/${premiumMockFeatureId}`,
              merge: true,
              data: {
                id: premiumMockFeatureId,
                teacherId,
                teacherName,
                examTypeId: String(offer.examTypeId || '').trim(),
                examTypeName: String(offer.examTypeName || '').trim(),
                classId: String(offer.classId || '').trim(),
                className: String(offer.className || '').trim(),
                premiumCombinationKey: `${teacherId}__${String(offer.examTypeId || '').trim()}__${String(offer.classId || '').trim()}`,
                premiumCustomMockTestId: '',
                testTitle: String(offer.premiumCustomMockPack.title || offer.title || 'Premium Custom Mock Access').trim(),
                amount: Number(offer.premiumCustomMockPack.estimatedAmount || 0),
                questionCount: Math.max(0, Number(offer.premiumCustomMockPack.totalQuestions || 0)),
                includedQuestionCount: Math.max(0, Number(offer.premiumCustomMockPack.totalQuestions || 0)),
                includedQuestionCountByDifficulty: includedQuestionCountByDifficulty,
                questionAmountPaid: Number(offer.premiumCustomMockPack.estimatedAmount || 0),
                attemptAmountPaid: 0,
                currency,
                questionBankSource: offer.premiumCustomMockPack.questionBankSource || 'student_plus_official',
                duration: Number(offer.premiumCustomMockPack.duration || 0) > 0 ? Number(offer.premiumCustomMockPack.duration || 0) : null,
                marksPerQuestion: Number(offer.premiumCustomMockPack.marksPerQuestion || 0) > 0 ? Number(offer.premiumCustomMockPack.marksPerQuestion || 0) : null,
                negativeMarksPerQuestion: Number(offer.premiumCustomMockPack.negativeMarksPerQuestion || 0) >= 0
                  ? Number(offer.premiumCustomMockPack.negativeMarksPerQuestion || 0)
                  : null,
                attemptPricing: offer.premiumCustomMockPack.attemptPricing || null,
                subjectConfigs: offer.premiumCustomMockPack.subjectConfigs || [],
                includedSubjectConfigs: offer.premiumCustomMockPack.subjectConfigs || [],
                paidAt: paidAt,
                createdAt: paidAt,
                updatedAt: paidAt,
                status: 'paid',
                offerId,
                offerPurchaseId: paymentId,
              },
            });
          }

          const idToken = await user.getIdToken(true);
          const completionResult = await completeVerifiedPayment({
            idToken,
            orderId: razorpayOrderId,
            paymentId,
            signature: razorpaySignature,
            grossAmount: amount,
            currency,
            paymentData: {
              id: paymentId,
              type: 'teacher_offer',
              status: 'paid',
              userId: user.uid,
              userEmail: user.email || '',
              teacherId,
              teacherName,
              linkedContentType: 'teacher_offer',
              linkedContentId: offerId,
              offerId,
              offerTitle: offer.title || 'Teacher Offer',
              grossAmount: amount,
              currency,
              razorpayOrderId,
              razorpayPaymentId: paymentId,
              purchasedAt: paidAt,
              examTypeId: String(offer.examTypeId || '').trim(),
              classId: String(offer.classId || '').trim(),
            },
            writes: verifiedWrites,
            revenueSplit: {
              teacherId,
              linkedContentType: 'teacher_offer',
              linkedContentId: offerId,
              saleType: 'teacher_offer',
              purchasedAt: paidAt,
              userEmail: user.email || '',
              studentName: user.displayName || '',
              studentEmail: user.email || '',
              metadata: {
                offerId,
                offerTitle: offer.title || 'Teacher Offer',
                teacherId,
                teacherName,
                examTypeId: String(offer.examTypeId || '').trim(),
                classId: String(offer.classId || '').trim(),
                bundleCounts: countTeacherOfferSelections(offer),
              },
            },
          });
          if (!completionResult.success) {
            throw new Error(completionResult.error || 'Could not complete the verified payment.');
          }

          await sendSelfBellNotification(user, {
            title: 'Congratulations on unlocking the offer',
            message: `${offer.title || 'Your teacher offer'} is now available in My Practice.`,
            href: '/my-practice',
            notificationType: 'teacher_offer_purchased',
            dedupeKey: `teacher-offer:${paymentId}`,
            contentType: 'teacher_offer',
            contentId: offerId,
            teacherId,
            metadata: {
              offerId,
              offerTitle: offer.title || 'Teacher Offer',
            },
          });

          toast({
            title: 'Package purchased',
            description: 'The teacher package is now unlocked and available in My Practice.',
          });
          setSelectedOfferId('');
          router.push('/my-practice');
        } catch (error: any) {
          toast({
            variant: 'destructive',
            title: 'Payment recorded but package unlock failed',
            description: error?.message || 'Please contact support with your payment reference.',
          });
        } finally {
          setBuyingOfferId('');
        }
      },
      prefill: {
        name: user.displayName || 'DCAM User',
        email: user.email || '',
        contact: normalizedContact,
      },
      readonly: {
        contact: false,
        email: false,
        name: false,
      },
      notes: {
        offerId,
        offerTitle: offer.title || 'Teacher Offer',
        teacherId,
        studentId: user.uid,
      },
      modal: {
        ondismiss: () => {
          setBuyingOfferId('');
        },
      },
      theme: {
        color: '#0ea5e9',
      },
    };

    if (selectedOfferId) {
      setSelectedOfferId('');
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }

    const razorpay = new window.Razorpay(options);
    razorpay.on('payment.failed', (response: any) => {
      toast({
        variant: 'destructive',
        title: 'Payment failed',
        description: response?.error?.description || 'Payment was not completed.',
      });
      setBuyingOfferId('');
    });
    razorpay.open();
  };

  const loading = examLoading || classLoading || subjectLoading || offersLoading || usersLoading;

  if (shouldRedirectToDashboard) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Offers" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="border-border/70">
            <CardContent className="p-6 text-muted-foreground">Redirecting to Dashboard...</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Offers" />
      <main className="relative flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_36%),radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_34%)] p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Card className="overflow-hidden border-cyan-400/35 bg-gradient-to-r from-sky-950/55 via-blue-950/40 to-indigo-950/55 shadow-[0_24px_56px_-30px_rgba(14,165,233,0.75)]">
            <CardContent className="p-6 md:p-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <p className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-100">
                    <Sparkles className="h-3.5 w-3.5" />
                    Teacher Offers
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Browse Teacher Offers By Exam, Curriculum, and Subject</h2>
                  <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
                    Filter active offers created by teachers and compare bundled courses, crash courses, mock tests, live batches, and premium packs.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-full border-cyan-300/35 bg-cyan-500/15 px-3 py-1 text-cyan-100">
                    {filteredOffers.length} matching offers
                  </Badge>
                  <Badge variant="secondary" className="rounded-full border-indigo-300/35 bg-indigo-500/15 px-3 py-1 text-indigo-100">
                    {uniqueTeacherCount} teacher{uniqueTeacherCount === 1 ? '' : 's'}
                  </Badge>
                  <Badge variant="secondary" className="rounded-full border-sky-300/35 bg-sky-500/15 px-3 py-1 text-sky-100">
                    Active only
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full border-border/70 bg-background/35 px-3 py-1.5 text-[12px]">
                {selectedExam?.name || 'All exams'}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-background/35 px-3 py-1.5 text-[12px]">
                {selectedClass?.name || 'All curricula'}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-background/35 px-3 py-1.5 text-[12px]">
                {selectedSubjectIds.length > 0 ? `${selectedSubjectIds.length} subject filter${selectedSubjectIds.length > 1 ? 's' : ''}` : 'All subjects'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {activeFilterCount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full border-border/70 bg-white/[0.03] px-5 text-foreground/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-white/[0.06]"
                  onClick={resetFilters}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-cyan-300/45 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-5 font-semibold text-slate-950 shadow-[0_16px_34px_-14px_rgba(56,189,248,0.9)] transition-all duration-300 hover:-translate-y-[1px] hover:from-cyan-300 hover:via-sky-300 hover:to-blue-400"
                onClick={() => setShowFilters((current) => !current)}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
                <span className="ml-2 rounded-full border border-slate-950/10 bg-slate-950/10 px-2 py-0.5 text-[11px] text-slate-950/80">
                  {activeFilterCount}
                </span>
              </Button>
            </div>
          </div>

          {showFilters ? (
            <Card className="border-border/80 bg-gradient-to-b from-slate-900/88 to-slate-950/72 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.95)]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <PackagePlus className="h-5 w-5 text-primary" />
                  Offer Filters
                </CardTitle>
                <CardDescription>Set exam, curriculum, and optional subject filters to narrow down the visible teacher offers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {loading ? (
                  <Skeleton className="h-44 w-full" />
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Select value={examTypeId} onValueChange={setExamTypeId}>
                        <SelectTrigger className="h-12 rounded-xl border-border/70 bg-slate-950/70">
                          <SelectValue placeholder="Select exam" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedExamTypes.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={classId} onValueChange={setClassId} disabled={!examTypeId || filteredClasses.length === 0}>
                        <SelectTrigger className="h-12 rounded-xl border-border/70 bg-slate-950/70">
                          <SelectValue placeholder={examTypeId ? 'Select curriculum/class' : 'Select exam first'} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredClasses.length > 0 ? (
                            filteredClasses.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__no_curriculum__" disabled>
                              No curriculum available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-slate-900/55 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">Subjects</p>
                          <p className="text-xs text-muted-foreground">Optional. If you select more than one subject, only offers covering all selected subjects will remain.</p>
                        </div>
                        <Badge variant="outline" className="rounded-full border-cyan-300/30 bg-cyan-500/10 text-cyan-100">
                          {selectedSubjectIds.length} selected
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        {filteredSubjects.length === 0 ? (
                          <p className="text-sm text-muted-foreground md:col-span-3">
                            {!examTypeId
                              ? 'Select an exam first.'
                              : !classId
                                ? 'Select a curriculum/class to unlock subjects.'
                                : 'No subjects are configured for this curriculum yet.'}
                          </p>
                        ) : (
                          filteredSubjects.map((subject) => {
                            const checked = selectedSubjectIds.includes(subject.id);
                            return (
                              <label
                                key={subject.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                                  checked
                                    ? 'border-cyan-300/55 bg-cyan-500/14'
                                    : 'border-border/60 bg-background/20 hover:border-cyan-300/45 hover:bg-cyan-500/8'
                                }`}
                              >
                                <Checkbox checked={checked} onCheckedChange={(value) => toggleSubject(subject.id, !!value)} className="mt-0.5" />
                                <span className="text-sm font-medium">{subject.name}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">Matching Teacher Offers</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Active offers matching your current exam, curriculum, and subject scope.
                </p>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {filteredOffers.length} offers
              </Badge>
            </div>

            {loading ? (
              <div className="grid justify-items-start gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-48 w-full max-w-[296px] rounded-2xl" />
                ))}
              </div>
            ) : filteredOffers.length === 0 ? (
              <Card className="border-dashed border-border/70 bg-card/60">
                <CardContent className="py-12 text-center">
                  <p className="text-base font-medium">No active offers match the current filters.</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Change exam, curriculum, or subject filters to see other teacher bundles.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid justify-items-start gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {filteredOffers.map((offer) => {
                  const teacher = teacherProfileById[String(offer.createdByTeacherId || '')];
                  const teacherName = buildTeacherName(teacher);
                  const isPurchased = purchasedOfferIds.has(String(offer.id || '').trim());
                  const scopeSubjects = (offer.subjectNames || []).filter(Boolean);
                  const courseNames = (offer.courses || []).map((course) => String(course.title || '').trim()).filter(Boolean);
                  const crashCourseNames = (offer.crashCourses || []).map((course) => String(course.title || '').trim()).filter(Boolean);
                  const mockTestNames = (offer.mockTests || []).map((test) => String(test.title || '').trim()).filter(Boolean);
                  const liveBatchNames = (offer.liveBatches || [])
                    .map((batch) => {
                      const title = String(batch.title || '').trim();
                      const sessionCount = Math.max(0, Number(batch.includedSessions || 0));
                      if (!title) return '';
                      return sessionCount > 0 ? `${title} | ${sessionCount} sessions` : title;
                    })
                    .filter(Boolean);
                  const practiceQuestionLines = buildCompactPracticePackLines(offer, subjectNameById);
                  const customMockQuestionLines = buildCompactCustomMockLines(offer, subjectNameById);
                  const inclusionRows = [
                    { label: 'Courses', items: courseNames },
                    { label: 'Crash Courses', items: crashCourseNames },
                    { label: 'Mock Tests', items: mockTestNames },
                    { label: 'Live Batches', items: liveBatchNames },
                    { label: 'Practice Session Questions', items: practiceQuestionLines },
                    { label: 'Custom Mock Test Questions', items: customMockQuestionLines },
                  ].filter((section) => section.items.length > 0);
                  const visibleInclusionRows = inclusionRows.slice(0, 4);
                  const hiddenInclusionRowCount = Math.max(0, inclusionRows.length - visibleInclusionRows.length);

                  return (
                    <Card
                      key={offer.id || `${offer.createdByTeacherId}-${offer.title}-${offer.price}`}
                      className="group relative w-full max-w-[296px] overflow-hidden border border-cyan-400/18 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(6,18,45,0.96))] shadow-[0_18px_36px_-26px_rgba(14,165,233,0.42)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:shadow-[0_22px_42px_-26px_rgba(34,211,238,0.42)]"
                    >
                      <div className="pointer-events-none absolute inset-0">
                        <div className="absolute -right-8 top-0 h-20 w-20 rounded-full bg-cyan-400/12 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="absolute -left-6 bottom-0 h-16 w-16 rounded-full bg-blue-500/10 blur-3xl" />
                      </div>
                      <CardHeader className="relative space-y-3 p-4 pb-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 space-y-2">
                            <Badge variant="outline" className="w-fit rounded-full border-cyan-300/25 bg-cyan-500/8 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                              Teacher Bundle
                            </Badge>
                            <div className="min-w-0">
                              <CardTitle className="line-clamp-2 text-[1.08rem] font-semibold leading-tight tracking-tight">
                                {offer.title || 'Untitled Offer'}
                              </CardTitle>
                              <CardDescription className="mt-1.5 flex items-center gap-2 text-sm text-slate-300">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-500/10">
                                  <UserRound className="h-3.5 w-3.5 text-cyan-100" />
                                </span>
                                <span className="truncate font-medium text-slate-200">
                                  {teacherName}
                                </span>
                              </CardDescription>
                            </div>
                          </div>
                          <div className="shrink-0 rounded-xl border border-cyan-300/25 bg-gradient-to-br from-cyan-500/16 via-sky-500/12 to-blue-500/10 px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Price</p>
                            <p className="mt-1 text-base font-semibold text-cyan-50">INR {Number(offer.price || 0).toLocaleString()}</p>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="relative space-y-2.5 p-4 pt-0">
                        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">Offer Scope</p>
                          <div className="mt-2.5 space-y-2">
                            <div className="flex items-start gap-3">
                              <p className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Exam</p>
                              <p className="text-sm font-medium text-slate-50">{offer.examTypeName || 'All exams'}</p>
                            </div>
                            <div className="ml-2 border-l border-white/8 pl-4">
                              <div className="flex items-start gap-3">
                                <p className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Curriculum</p>
                                <p className="text-sm font-medium text-slate-50">{offer.className || 'All curricula'}</p>
                              </div>
                              <div className="mt-2 flex items-start gap-3">
                                <p className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Subjects</p>
                                <p className="line-clamp-2 text-sm font-medium leading-5 text-slate-50">
                                  {scopeSubjects.length > 0 ? summarizeOfferItems(scopeSubjects, 2) : 'All teacher-selected subjects'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">What&apos;s Inside This Offer</p>
                            {hiddenInclusionRowCount > 0 ? (
                              <Badge variant="outline" className="rounded-full border-cyan-300/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-100">
                                +{hiddenInclusionRowCount} more
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-2.5 divide-y divide-white/8">
                            {visibleInclusionRows.length > 0 ? visibleInclusionRows.map((section) => (
                              <div
                                key={`${offer.id}-${section.label}`}
                                className="py-2 first:pt-0 last:pb-0"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{section.label}</p>
                                  <span className="text-[10px] font-medium text-slate-500">{section.items.length}</span>
                                </div>
                                <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-100">
                                  {summarizeOfferItems(section.items, section.label.includes('Questions') ? 1 : 2)}
                                </p>
                              </div>
                            )) : (
                              <div className="rounded-lg border border-dashed border-white/8 bg-slate-950/35 px-3 py-3 text-sm text-slate-300">
                                Offer details are being prepared.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                          <div className="grid grid-cols-1 gap-2">
                            <Button
                              type="button"
                              className="h-9 w-full rounded-lg border border-cyan-300/35 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-3 text-sm font-semibold text-slate-950 shadow-[0_14px_30px_-16px_rgba(56,189,248,0.95)] transition-all duration-300 hover:-translate-y-[1px] hover:from-cyan-300 hover:via-sky-300 hover:to-blue-400"
                              onClick={() => setSelectedOfferId(String(offer.id || '').trim())}
                            >
                              <span className="flex w-full items-center justify-between gap-3">
                                <span>View Package</span>
                                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-950/10 bg-slate-950/10">
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </span>
                              </span>
                            </Button>
                            {isPurchased ? (
                              <Button asChild variant="outline" className="h-9 rounded-lg border-emerald-300/35 bg-emerald-500/10 text-sm text-emerald-50 hover:bg-emerald-500/15">
                                <Link href="/my-practice">Open My Practice</Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
      <Dialog open={!!selectedOffer} onOpenChange={(open) => !open && setSelectedOfferId('')}>
        <DialogContent className="max-h-[88vh] max-w-6xl overflow-y-auto border-cyan-400/25 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(6,18,45,0.96))] text-slate-50">
          {selectedOffer ? (
            (() => {
              const selectedTeacherId = String(selectedOffer.createdByTeacherId || '').trim();
              const selectedTeacher = teacherProfileById[selectedTeacherId];
              const selectedTeacherName = buildTeacherName(selectedTeacher);
              const counts = countTeacherOfferSelections(selectedOffer);
              const includedLiveSessions = (selectedOffer.liveBatches || []).reduce(
                (sum: number, batch: NonNullable<TeacherOffer['liveBatches']>[number]) => sum + Math.max(0, Number(batch.includedSessions || 0)),
                0
              );
              const isPurchased = purchasedOfferIds.has(String(selectedOffer.id || '').trim());
              const isBuying = buyingOfferId === String(selectedOffer.id || '').trim();
              const normalizedPrice = Math.max(0, Number(selectedOffer.price || 0));
              const practicePack = selectedOffer.premiumPracticePack;
              const customMockPack = selectedOffer.premiumCustomMockPack;
              const hasHydratedContent =
                offerCoursePreviews.length > 0
                || offerCrashCoursePreviews.length > 0
                || offerMockTestPreviews.length > 0
                || offerLiveBatchPreviews.length > 0;
              return (
                <>
                  <StudentOfferPackageDetails
                    offer={selectedOffer}
                    teacherName={selectedTeacherName}
                    normalizedPrice={normalizedPrice}
                    isPurchased={isPurchased}
                    isBuying={isBuying}
                    onBuy={handleBuyOffer}
                    subjectNameById={subjectNameById}
                    offerContentLoading={offerContentLoading}
                    offerCoursePreviews={offerCoursePreviews}
                    offerCrashCoursePreviews={offerCrashCoursePreviews}
                    offerMockTestPreviews={offerMockTestPreviews}
                    offerLiveBatchPreviews={offerLiveBatchPreviews}
                  />
                  {false ? (
                    <>
                  <DialogHeader className="space-y-3 text-left">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <Badge variant="outline" className="w-fit rounded-full border-cyan-300/30 bg-cyan-500/10 text-cyan-100">
                          Teacher Package
                        </Badge>
                        <DialogTitle className="text-2xl font-semibold tracking-tight">
                          {selectedOffer.title || 'Untitled Offer'}
                        </DialogTitle>
                        <DialogDescription className="text-slate-300">
                          Package by {selectedTeacherName}. Review the included content, premium packs, and scope before checkout.
                        </DialogDescription>
                      </div>
                      <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-3 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Package Price</p>
                        <p className="mt-1 text-2xl font-semibold text-cyan-50">
                          INR {normalizedPrice.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[selectedOffer.examTypeName, selectedOffer.className, ...(selectedOffer.subjectNames || [])].filter(Boolean).map((item) => (
                        <Badge
                          key={`${selectedOffer.id}-${item}`}
                          variant="secondary"
                          className="rounded-full border border-slate-700/70 bg-slate-900/55 px-2.5 py-1 text-[11px] text-slate-100"
                        >
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </DialogHeader>

                  <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/75">Courses</p>
                          <p className="mt-2 text-2xl font-semibold">{counts.coursesCount}</p>
                        </div>
                        <div className="rounded-2xl border border-orange-300/20 bg-orange-500/10 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100/75">Crash</p>
                          <p className="mt-2 text-2xl font-semibold">{counts.crashCoursesCount}</p>
                        </div>
                        <div className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-100/75">Mocks</p>
                          <p className="mt-2 text-2xl font-semibold">{counts.mockTestsCount}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/75">Live</p>
                          <p className="mt-2 text-2xl font-semibold">{includedLiveSessions}</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">What this package contains</p>
                            <p className="mt-1 text-xs text-slate-300">
                              Detailed previews of the exact courses, tests, batches, and premium packs unlocked after purchase.
                            </p>
                          </div>
                          <Badge variant="outline" className="rounded-full border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100">
                            {counts.totalSelections} unlock{counts.totalSelections === 1 ? '' : 's'}
                          </Badge>
                        </div>

                        <div className="mt-4 space-y-5">
                          {offerContentLoading ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              {Array.from({ length: 4 }).map((_, index) => (
                                <Skeleton key={`offer-content-skeleton-${index}`} className="h-52 rounded-2xl" />
                              ))}
                            </div>
                          ) : null}

                          {!offerContentLoading && offerCoursePreviews.length > 0 ? (
                            <section className="space-y-3">
                              <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
                                <BookOpen className="h-4 w-4" />
                                Courses
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                {offerCoursePreviews.map((course) => (
                                  <Card key={`course-preview-${course.id}`} className="overflow-hidden border-cyan-300/20 bg-gradient-to-b from-cyan-500/12 via-slate-950/85 to-slate-950/95">
                                    <div className="relative h-32 overflow-hidden border-b border-cyan-300/10">
                                      {course.thumbnailUrl || course.imageUrl ? (
                                        <img src={course.thumbnailUrl || course.imageUrl} alt={course.title} className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.25),transparent_35%),linear-gradient(180deg,rgba(6,22,45,0.96),rgba(2,6,23,0.98))]">
                                          <BookOpen className="h-8 w-8 text-cyan-100/70" />
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                                      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                                        <Badge className="border-cyan-300/35 bg-slate-950/75 text-cyan-50">
                                          {course.accessLevel === 'paid' ? 'Premium Course' : 'Free Course'}
                                        </Badge>
                                      </div>
                                    </div>
                                    <CardContent className="space-y-3 p-4">
                                      <div>
                                        <p className="line-clamp-2 text-base font-semibold text-white">{course.title}</p>
                                        <p className="mt-1 text-xs text-slate-300">by {course.teacherName || selectedTeacherName}</p>
                                      </div>
                                      <p className="line-clamp-2 min-h-[40px] text-sm text-slate-300">
                                        {course.description || 'Structured teacher-led course included as part of this package.'}
                                      </p>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="rounded-xl border border-cyan-300/15 bg-slate-950/60 px-3 py-2 text-slate-300">
                                          Class
                                          <p className="mt-1 font-semibold text-white">
                                            {course.classLevel || classNameById[course.classId || ''] || selectedOffer.className || 'Curriculum'}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-cyan-300/15 bg-slate-950/60 px-3 py-2 text-slate-300">
                                          Status
                                          <p className="mt-1 font-semibold text-white">
                                            {course.subscriptionAttached === false && course.accessLevel === 'paid' ? 'Needs subscription' : 'Included'}
                                          </p>
                                        </div>
                                      </div>
                                      {course.subjectIds?.length ? (
                                        <div className="flex flex-wrap gap-1.5">
                                          {course.subjectIds
                                            .map((subjectId) => subjectNameById[subjectId])
                                            .filter(Boolean)
                                            .slice(0, 4)
                                            .map((subjectName) => (
                                              <Badge key={`${course.id}-${subjectName}`} variant="outline" className="border-cyan-300/25 bg-cyan-500/10 text-cyan-50">
                                                {subjectName}
                                              </Badge>
                                            ))}
                                        </div>
                                      ) : null}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </section>
                          ) : null}

                          {!offerContentLoading && offerCrashCoursePreviews.length > 0 ? (
                            <section className="space-y-3">
                              <div className="flex items-center gap-2 text-sm font-medium text-orange-100">
                                <PackagePlus className="h-4 w-4" />
                                Crash Courses
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                {offerCrashCoursePreviews.map((course) => (
                                  <Card key={`crash-preview-${course.id}`} className="overflow-hidden border-orange-300/20 bg-gradient-to-b from-orange-500/12 via-slate-950/85 to-slate-950/95">
                                    <div className="relative h-32 overflow-hidden border-b border-orange-300/10">
                                      {course.thumbnailUrl || course.imageUrl ? (
                                        <img src={course.thumbnailUrl || course.imageUrl} alt={course.title} className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.22),transparent_35%),linear-gradient(180deg,rgba(60,24,12,0.92),rgba(15,23,42,0.98))]">
                                          <PackagePlus className="h-8 w-8 text-orange-100/75" />
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                                      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                                        <Badge className="border-orange-300/35 bg-orange-500/20 text-orange-50">Crash Course</Badge>
                                        <Badge className="border-slate-700/80 bg-slate-950/75 text-slate-100">
                                          {course.accessLevel === 'paid' ? 'Premium' : 'Free'}
                                        </Badge>
                                      </div>
                                    </div>
                                    <CardContent className="space-y-3 p-4">
                                      <div>
                                        <p className="line-clamp-2 text-base font-semibold text-white">{course.title}</p>
                                        <p className="mt-1 text-xs text-slate-300">by {course.teacherName || selectedTeacherName}</p>
                                      </div>
                                      <p className="line-clamp-2 min-h-[40px] text-sm text-slate-300">
                                        {course.description || 'Short-duration intensive course included for focused preparation.'}
                                      </p>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="rounded-xl border border-orange-300/15 bg-slate-950/60 px-3 py-2 text-slate-300">
                                          Exam
                                          <p className="mt-1 font-semibold text-white">
                                            {examNameById[course.examTypeId || ''] || selectedOffer.examTypeName || 'Exam'}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-orange-300/15 bg-slate-950/60 px-3 py-2 text-slate-300">
                                          Curriculum
                                          <p className="mt-1 font-semibold text-white">
                                            {course.classLevel || classNameById[course.classId || ''] || selectedOffer.className || 'Curriculum'}
                                          </p>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </section>
                          ) : null}

                          {!offerContentLoading && offerMockTestPreviews.length > 0 ? (
                            <section className="space-y-3">
                              <div className="flex items-center gap-2 text-sm font-medium text-violet-100">
                                <Target className="h-4 w-4" />
                                Teacher-Created Mock Tests
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                {offerMockTestPreviews.map((test) => (
                                  <Card key={`mock-preview-${test.id}`} className="overflow-hidden border-violet-300/20 bg-gradient-to-b from-violet-500/12 via-slate-950/85 to-slate-950/95">
                                    {(test.thumbnailUrl || test.imageUrl) ? (
                                      <div className="relative h-32 overflow-hidden border-b border-violet-300/10">
                                        <img src={test.thumbnailUrl || test.imageUrl} alt={test.title} className="h-full w-full object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                                      </div>
                                    ) : null}
                                    <CardContent className="space-y-3 p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="line-clamp-2 text-base font-semibold text-white">{test.title}</p>
                                          <p className="mt-1 text-xs text-slate-300">
                                            {examNameById[test.examTypeId || ''] || selectedOffer.examTypeName || 'Exam'} | {classNameById[test.classId || ''] || selectedOffer.className || 'Curriculum'}
                                          </p>
                                        </div>
                                        <Badge className={test.accessLevel === 'paid' ? 'border-violet-300/35 bg-violet-500/20 text-violet-50' : 'border-emerald-300/35 bg-emerald-500/20 text-emerald-50'}>
                                          {test.accessLevel === 'paid' ? 'Premium' : 'Free'}
                                        </Badge>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="rounded-xl border border-violet-300/15 bg-slate-950/60 px-3 py-2 text-slate-300">
                                          Questions
                                          <p className="mt-1 font-semibold text-white">{test.questionIds?.length || 0}</p>
                                        </div>
                                        <div className="rounded-xl border border-violet-300/15 bg-slate-950/60 px-3 py-2 text-slate-300">
                                          Duration
                                          <p className="mt-1 font-semibold text-white">{formatTestDurationLabel(test.duration)}</p>
                                        </div>
                                      </div>
                                      <p className="text-xs text-slate-300">
                                        Standalone teacher mock that becomes available directly after package purchase.
                                      </p>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </section>
                          ) : null}

                          {!offerContentLoading && offerLiveBatchPreviews.length > 0 ? (
                            <section className="space-y-3">
                              <div className="flex items-center gap-2 text-sm font-medium text-emerald-100">
                                <Video className="h-4 w-4" />
                                Live Batches
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                {offerLiveBatchPreviews.map((batch) => (
                                  <Card key={`batch-preview-${batch.id}`} className="overflow-hidden border-emerald-300/20 bg-gradient-to-b from-emerald-500/12 via-slate-950/85 to-slate-950/95">
                                    <div className="relative h-32 overflow-hidden border-b border-emerald-300/10">
                                      {batch.thumbnailUrl ? (
                                        <img src={batch.thumbnailUrl} alt={batch.title} className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.24),transparent_35%),linear-gradient(180deg,rgba(3,46,40,0.95),rgba(2,6,23,0.98))]">
                                          <Video className="h-8 w-8 text-emerald-100/75" />
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                                      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                                        <Badge className={batch.accessLevel === 'paid' ? 'border-emerald-300/35 bg-emerald-500/20 text-emerald-50' : 'border-cyan-300/35 bg-cyan-500/20 text-cyan-50'}>
                                          {batch.accessLevel === 'paid' ? 'Premium Batch' : 'Free Batch'}
                                        </Badge>
                                      </div>
                                    </div>
                                    <CardContent className="space-y-3 p-4">
                                      <div>
                                        <p className="line-clamp-2 text-base font-semibold text-white">{batch.title}</p>
                                        <p className="mt-1 line-clamp-2 text-sm text-slate-300">
                                          {batch.description || 'Interactive live batch with teacher-led sessions and classroom access.'}
                                        </p>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="rounded-xl border border-emerald-300/15 bg-slate-950/60 px-3 py-2 text-slate-300">
                                          Sessions
                                          <p className="mt-1 font-semibold text-white">
                                            {Math.max(0, Number(batch.includedSessions || 0))} / {Math.max(0, Number(batch.totalSessions || 0))}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-emerald-300/15 bg-slate-950/60 px-3 py-2 text-slate-300">
                                          Curriculum
                                          <p className="mt-1 font-semibold text-white">
                                            {classNameById[batch.classId || ''] || selectedOffer.className || 'Curriculum'}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                                        {formatBatchStartDate(batch.batchStartDate) ? (
                                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-50">
                                            <CalendarClock className="h-3.5 w-3.5" />
                                            Starts {formatBatchStartDate(batch.batchStartDate)}
                                          </span>
                                        ) : null}
                                        {(batch.subjectIds || [])
                                          .map((subjectId) => subjectNameById[subjectId])
                                          .filter(Boolean)
                                          .slice(0, 4)
                                          .map((subjectName) => (
                                            <Badge key={`${batch.id}-${subjectName}`} variant="outline" className="border-emerald-300/20 bg-emerald-500/10 text-emerald-50">
                                              {subjectName}
                                            </Badge>
                                          ))}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </section>
                          ) : null}

                          {!offerContentLoading && !hasHydratedContent ? (
                            <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/45 p-5 text-sm text-slate-300">
                              No course, mock-test, or live-batch previews were found for this package. Premium packs, if included, are still shown on the right.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {practicePack?.totalQuestions ? (
                        <div className="rounded-3xl border border-amber-300/25 bg-[linear-gradient(180deg,rgba(120,53,15,0.3),rgba(15,23,42,0.92))] p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                                <TicketPercent className="h-4 w-4" />
                                {practicePack.title || 'Premium Practice Pack'}
                              </p>
                              <p className="mt-1 text-xs text-amber-50/80">
                                Appears in My Practice as a premium practice card immediately after purchase.
                              </p>
                            </div>
                            <Badge className="border-amber-300/35 bg-amber-500/15 text-amber-50">Practice unlock</Badge>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-xl border border-amber-300/20 bg-slate-950/35 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-amber-100/70">Questions</p>
                              <p className="mt-1 font-semibold">{practicePack.totalQuestions}</p>
                            </div>
                            <div className="rounded-xl border border-amber-300/20 bg-slate-950/35 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-amber-100/70">Timer</p>
                              <p className="mt-1 font-semibold">{formatPracticeTimerLabel(practicePack.perQuestionTimeSeconds)}</p>
                            </div>
                            <div className="rounded-xl border border-amber-300/20 bg-slate-950/35 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-amber-100/70">Question Bank</p>
                              <p className="mt-1 font-semibold">{getQuestionBankSourceLabel(practicePack.questionBankSource)}</p>
                            </div>
                            <div className="rounded-xl border border-amber-300/20 bg-slate-950/35 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-amber-100/70">Attempts</p>
                              <p className="mt-1 font-semibold">{formatPremiumPracticeAttemptPricingRule(practicePack.attemptPricing)}</p>
                            </div>
                          </div>

                          {practicePack.questionCountByDifficulty ? (
                            <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                              <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-emerald-50">
                                Standard
                                <p className="mt-1 text-sm font-semibold">{mergeLegacyDifficultyCounts(practicePack.questionCountByDifficulty).easy}</p>
                              </div>
                            </div>
                          ) : null}

                          {(practicePack.topicConfigs?.length || practicePack.subjectConfigs?.length) ? (
                            <OfferQuestionCoverageSummary
                              title="Question Coverage Snapshot"
                              description="Students can see the exact prepaid practice footprint by exam, curriculum, subject, topic, and branch."
                              accent="amber"
                              examTypeName={selectedOffer.examTypeName}
                              curriculumName={selectedOffer.className}
                              totalQuestions={practicePack.totalQuestions}
                              rows={
                                practicePack.topicConfigs?.length
                                  ? practicePack.topicConfigs.map((config: OfferPracticeTopicConfig, index: number) => ({
                                      id: `practice-topic-${config.topicId || index}`,
                                      subjectName: config.subjectName || subjectNameById[config.subjectId] || 'Subject',
                                      topicName: config.topicName || 'Topic',
                                      subtopicPaths: config.subtopics,
                                      count: Math.max(0, Number(config.count || 0)),
                                    }))
                                  : practicePack.subjectConfigs.map((config: OfferPracticeSubjectConfig, index: number) => ({
                                      id: `practice-subject-${config.subjectId || index}`,
                                      subjectName: config.subjectName || subjectNameById[config.subjectId] || 'Subject',
                                      topicName: 'All selected topics',
                                      subtopicPaths: [],
                                      count: Math.max(0, Number(config.count || 0)),
                                    }))
                              }
                              className="mt-4"
                            />
                          ) : null}
                        </div>
                      ) : counts.premiumPracticeSessionCount > 0 ? (
                        <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4">
                          <p className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                            <TicketPercent className="h-4 w-4" />
                            Premium Practice Pack
                          </p>
                          <p className="mt-3 text-sm text-amber-50/85">
                            {counts.premiumPracticeSessionCount} premium practice questions are bundled in this package.
                          </p>
                        </div>
                      ) : null}

                      {customMockPack?.totalQuestions ? (
                        <div className="rounded-3xl border border-cyan-300/25 bg-[linear-gradient(180deg,rgba(8,47,73,0.45),rgba(15,23,42,0.92))] p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                                <Layers3 className="h-4 w-4" />
                                {customMockPack.title || 'Premium Custom Mock Access'}
                              </p>
                              <p className="mt-1 text-xs text-cyan-50/80">
                                Unlocks prepaid premium custom-mock question coverage that the student can use later inside the custom mock builder.
                              </p>
                            </div>
                            <Badge className="border-cyan-300/35 bg-cyan-500/15 text-cyan-50">Custom mock unlock</Badge>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
                            <div className="rounded-xl border border-cyan-300/20 bg-slate-950/35 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-cyan-100/70">Questions</p>
                              <p className="mt-1 font-semibold">{customMockPack.totalQuestions}</p>
                            </div>
                            <div className="rounded-xl border border-cyan-300/20 bg-slate-950/35 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-cyan-100/70">Attempts</p>
                              <p className="mt-1 font-semibold">{formatPremiumCustomMockAttemptPricingRule(customMockPack.attemptPricing)}</p>
                            </div>
                            <div className="rounded-xl border border-cyan-300/15 bg-slate-950/60 px-3 py-2 text-slate-300">
                              Question Bank
                              <p className="mt-1 font-semibold text-white">{getQuestionBankSourceLabel(customMockPack.questionBankSource)}</p>
                            </div>
                          </div>

                          {customMockPack.subjectConfigs?.length ? (
                            <OfferQuestionCoverageSummary
                              title="Question Coverage Snapshot"
                              description="The prepaid custom-mock coverage is displayed clearly by exam, curriculum, subject, topic, and subtopic branch."
                              accent="cyan"
                              examTypeName={selectedOffer.examTypeName}
                              curriculumName={selectedOffer.className}
                              totalQuestions={customMockPack.totalQuestions}
                              rows={customMockPack.subjectConfigs.map((config: OfferCustomMockSectionConfig, index: number) => ({
                                id: `custom-mock-section-${config.subjectId || index}-${config.topicId || 'root'}`,
                                subjectName: config.subjectName || subjectNameById[config.subjectId] || 'Subject',
                                topicName: config.topicName || 'Topic',
                                subtopicPaths: config.subtopicPaths?.length ? config.subtopicPaths : (config.subtopic ? [config.subtopic] : []),
                                count: Math.max(0, Number(config.count || 0)),
                              }))}
                              className="mt-4"
                            />
                          ) : null}
                        </div>
                      ) : counts.premiumCustomMockQuestionCount > 0 ? (
                        <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-4">
                          <p className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                            <Layers3 className="h-4 w-4" />
                            Premium Custom Mock Pack
                          </p>
                          <p className="mt-3 text-sm text-cyan-50/85">
                            {counts.premiumCustomMockQuestionCount} premium custom-mock questions are bundled in this package.
                          </p>
                        </div>
                      ) : null}

                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-sm font-semibold">Package Summary</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-300">
                          <p>{counts.totalSelections} included items across courses, tests, batches, and premium packs.</p>
                          <p>Teacher: {selectedTeacherName}</p>
                          <p>Price: INR {normalizedPrice.toLocaleString()}</p>
                          <p>
                            Scope: {[selectedOffer.examTypeName, selectedOffer.className, ...(selectedOffer.subjectNames || [])].filter(Boolean).join(' | ') || 'General package'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="gap-2 sm:justify-between">
                    {selectedTeacherId ? (
                      <Button asChild variant="outline" className="border-slate-600/80 bg-slate-900/70 text-slate-100 hover:bg-slate-800/80">
                        <Link href={`/teachers/${encodeURIComponent(selectedTeacherId)}`}>View Teacher Profile</Link>
                      </Button>
                    ) : (
                      <Button variant="outline" disabled className="border-slate-600/80 bg-slate-900/70 text-slate-100">
                        Teacher Profile Unavailable
                      </Button>
                    )}
                    {isPurchased ? (
                      <Button asChild className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 text-slate-950 hover:from-emerald-300 hover:via-cyan-300 hover:to-sky-400">
                        <Link href="/my-practice">Open My Practice</Link>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 text-slate-950 hover:from-cyan-300 hover:via-sky-300 hover:to-blue-400"
                        onClick={() => handleBuyOffer(selectedOffer)}
                        disabled={isBuying}
                      >
                        {isBuying ? (
                          <>
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Buy Package
                          </>
                        )}
                      </Button>
                    )}
                  </DialogFooter>
                    </>
                  ) : null}
                </>
              );
            })()
          ) : null}
        </DialogContent>
      </Dialog>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
    </div>
  );
}
