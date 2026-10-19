'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Lock,
  MessageSquareText,
  SendHorizonal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useFirestore, useMemoFirebase, useDoc, useUser } from '@/firebase';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  STUDENT_ASSISTANT_GUIDE_STEPS,
  STUDENT_ASSISTANT_GUIDE_VERSION,
  STUDENT_ASSISTANT_SUGGESTED_PROMPTS,
  getStudentAssistantActionsByIds,
  getStudentAssistantPageContext,
  getSuggestedStudentAssistantActions,
  type StudentAssistantAction,
} from '@/lib/student-assistant';

type StudentAssistantProfile = {
  firstName?: string;
  lastName?: string;
  roleId?: 'student' | 'teacher' | 'admin';
  status?: string;
  subscriptionStatus?: string;
  studentAssistantGuideCompletedAt?: string;
  studentAssistantGuideVersion?: string;
};

type AssistantMessageFeedback = 'helpful' | 'not_helpful';

type AssistantMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  actions?: StudentAssistantAction[];
  feedback?: AssistantMessageFeedback | null;
};

type AssistantSession = {
  id: string;
  sessionNumber: number;
  title: string;
  startedAt: string;
  lastActiveAt: string;
  endedAt?: string;
  messages: AssistantMessage[];
};

type StudentAssistantApiResponse = {
  answer: string;
  suggestedActions: StudentAssistantAction[];
};

type GuidePlacement = 'top' | 'bottom' | 'left' | 'right';

type GuideLayout = {
  top: number;
  left: number;
  placement: GuidePlacement;
  arrowOffset: number;
};

const BOT_MESSAGES_STORAGE_PREFIX = 'dcam_student_assistant_messages_v1_';
const BOT_SESSIONS_STORAGE_PREFIX = 'dcam_student_assistant_sessions_v1_';
const GUIDE_ROUTE = '/dashboard';
const MAX_SESSION_COUNT = 12;
const MAX_MESSAGES_PER_SESSION = 14;
const GUIDE_TARGET_RETRY_LIMIT = 20;
const HIDDEN_PATH_PATTERNS = [
  /^\/test\/.+/i,
  /^\/mock-tests\/[^/]+\/start$/i,
  /^\/practice\/session/i,
  /^\/start-practice-session(?:\/|$)/i,
  /^\/custom-mock-session$/i,
];

function buildMessageId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function trimText(text: string, limit: number) {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

function buildIntroMessage(name?: string, pathname?: string | null): AssistantMessage {
  const pageContext = getStudentAssistantPageContext(pathname);
  const firstName = (name || '').trim();

  return {
    id: buildMessageId('assistant'),
    role: 'assistant',
    content: `${firstName ? `Hi ${firstName}. ` : ''}I can guide you through DCAM features like custom mock tests, subscriptions, courses, teachers, batches, chat, and doubts. You're on ${pageContext.label} right now.`,
    actions: pageContext.relatedActions.slice(0, 3),
    feedback: null,
  };
}

function buildHelpFollowUpMessage(): AssistantMessage {
  return {
    id: buildMessageId('assistant'),
    role: 'assistant',
    content:
      'You can open the Help page from the button below, or use the Help option in the left sidebar under Exam Bulletin.',
    actions: getStudentAssistantActionsByIds(['help']),
    feedback: 'helpful',
  };
}

function sanitizeStoredMessages(value: unknown): AssistantMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is AssistantMessage => {
      return (
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as AssistantMessage).id === 'string' &&
        typeof (entry as AssistantMessage).content === 'string' &&
        ((entry as AssistantMessage).role === 'assistant' || (entry as AssistantMessage).role === 'user')
      );
    })
    .map((entry) => ({
      ...entry,
      feedback:
        entry.feedback === 'helpful' || entry.feedback === 'not_helpful'
          ? entry.feedback
          : null,
    }))
    .slice(-MAX_MESSAGES_PER_SESSION);
}

function sortAssistantSessions(sessions: AssistantSession[]) {
  return [...sessions].sort((left, right) => {
    const leftTime = new Date(left.lastActiveAt || left.startedAt).getTime();
    const rightTime = new Date(right.lastActiveAt || right.startedAt).getTime();
    return rightTime - leftTime;
  });
}

function buildSessionTitle(messages: AssistantMessage[], sessionNumber: number) {
  const firstUserMessage = messages.find((message) => message.role === 'user')?.content.trim();
  if (firstUserMessage) {
    return trimText(firstUserMessage, 48);
  }

  return sessionNumber === 1 ? 'New chat' : `New chat ${sessionNumber}`;
}

function sanitizeStoredSessions(value: unknown): AssistantSession[] {
  if (!Array.isArray(value)) return [];

  const sessions = value
    .filter((entry): entry is AssistantSession => {
      return (
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as AssistantSession).id === 'string' &&
        typeof (entry as AssistantSession).sessionNumber === 'number' &&
        typeof (entry as AssistantSession).title === 'string' &&
        typeof (entry as AssistantSession).startedAt === 'string' &&
        typeof (entry as AssistantSession).lastActiveAt === 'string' &&
        Array.isArray((entry as AssistantSession).messages)
      );
    })
    .map((entry) => ({
      ...entry,
      endedAt: typeof entry.endedAt === 'string' ? entry.endedAt : undefined,
      messages: sanitizeStoredMessages(entry.messages).slice(-MAX_MESSAGES_PER_SESSION),
    }))
    .filter((entry) => entry.messages.length > 0);

  return sortAssistantSessions(sessions).slice(0, MAX_SESSION_COUNT);
}

function buildLegacySession(messages: AssistantMessage[], pageLabel: string): AssistantSession | null {
  if (messages.length === 0) return null;

  const now = new Date().toISOString();
  return {
    id: buildMessageId('session'),
    sessionNumber: 1,
    title: buildSessionTitle(messages, 1),
    startedAt: now,
    lastActiveAt: now,
    endedAt: now,
    messages: messages.slice(-MAX_MESSAGES_PER_SESSION),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getGuideTargetElement(targetId: string) {
  return document.querySelector<HTMLElement>(`[data-student-tour="${targetId}"]`);
}

function isSidebarGuideTarget(targetId?: string | null) {
  return !!targetId && targetId.endsWith('-nav');
}

function isMobileSidebarOpen() {
  return !!document.querySelector('[data-sidebar="sidebar"][data-mobile="true"]');
}

function setMobileSidebarVisibility(shouldOpen: boolean) {
  const sidebarTrigger = getGuideTargetElement('sidebar-trigger');
  if (!sidebarTrigger) return;

  const isOpen = isMobileSidebarOpen();
  if (isOpen === shouldOpen) return;

  sidebarTrigger.click();
}

function computeGuideLayout(input: {
  targetRect: DOMRect;
  panelWidth: number;
  panelHeight: number;
  preferredPlacement: GuidePlacement;
  isMobile: boolean;
}): GuideLayout {
  const { targetRect, panelWidth, panelHeight, preferredPlacement, isMobile } = input;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const viewportPadding = 12;
  const gap = isMobile ? 14 : 18;
  const safePanelWidth = Math.max(1, Math.min(panelWidth || 1, Math.max(1, viewportWidth - viewportPadding * 2)));
  const safePanelHeight = Math.max(1, Math.min(panelHeight || 1, Math.max(1, viewportHeight - viewportPadding * 2)));
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  const placements: GuidePlacement[] = isMobile
    ? [preferredPlacement, 'bottom', 'top']
    : [preferredPlacement, 'right', 'bottom', 'top', 'left'];

  const uniquePlacements = placements.filter((placement, index) => placements.indexOf(placement) === index);

  const buildPosition = (placement: GuidePlacement) => {
    switch (placement) {
      case 'top':
        return {
          top: targetRect.top - safePanelHeight - gap,
          left: targetCenterX - safePanelWidth / 2,
        };
      case 'bottom':
        return {
          top: targetRect.bottom + gap,
          left: targetCenterX - safePanelWidth / 2,
        };
      case 'left':
        return {
          top: targetCenterY - safePanelHeight / 2,
          left: targetRect.left - safePanelWidth - gap,
        };
      case 'right':
      default:
        return {
          top: targetCenterY - safePanelHeight / 2,
          left: targetRect.right + gap,
        };
    }
  };

  const fitsViewport = (top: number, left: number) =>
    top >= viewportPadding &&
    left >= viewportPadding &&
    top + safePanelHeight <= viewportHeight - viewportPadding &&
    left + safePanelWidth <= viewportWidth - viewportPadding;

  const fallbackPlacement = uniquePlacements[0] || 'bottom';
  const selectedPlacement =
    uniquePlacements.find((placement) => {
      const candidate = buildPosition(placement);
      return fitsViewport(candidate.top, candidate.left);
    }) || fallbackPlacement;

  const rawPosition = buildPosition(selectedPlacement);
  const top = clamp(rawPosition.top, viewportPadding, Math.max(viewportPadding, viewportHeight - safePanelHeight - viewportPadding));
  const left = clamp(rawPosition.left, viewportPadding, Math.max(viewportPadding, viewportWidth - safePanelWidth - viewportPadding));

  const arrowOffset =
    selectedPlacement === 'top' || selectedPlacement === 'bottom'
      ? clamp(targetCenterX - left, 28, Math.max(28, safePanelWidth - 28))
      : clamp(targetCenterY - top, 28, Math.max(28, safePanelHeight - 28));

  return {
    top,
    left,
    placement: selectedPlacement,
    arrowOffset,
  };
}

function getArrowStyle(layout: GuideLayout): CSSProperties {
  switch (layout.placement) {
    case 'top':
      return { bottom: -8, left: layout.arrowOffset - 8 };
    case 'bottom':
      return { top: -8, left: layout.arrowOffset - 8 };
    case 'left':
      return { right: -8, top: layout.arrowOffset - 8 };
    case 'right':
    default:
      return { left: -8, top: layout.arrowOffset - 8 };
  }
}

export default function StudentAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const firestore = useFirestore();
  const { user } = useUser();
  const { isTeacherRole, isPendingTeacher, isRejectedTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sessions, setSessions] = useState<AssistantSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const [isGuideReplayActive, setIsGuideReplayActive] = useState(false);
  const [isGuideSaving, setIsGuideSaving] = useState(false);
  const [isReplyLoading, setIsReplyLoading] = useState(false);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [guideTargetRect, setGuideTargetRect] = useState<DOMRect | null>(null);
  const [guideLayout, setGuideLayout] = useState<GuideLayout | null>(null);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const guideCardRef = useRef<HTMLDivElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<StudentAssistantProfile>(userDocRef);

  const isHiddenPath = HIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
  const isRoleLoading = isTeacherLoading || isAdminLoading || isProfileLoading;
  const isStudentEligible =
    !isRoleLoading &&
    !!user &&
    !isAdmin &&
    !isTeacherRole &&
    !isPendingTeacher &&
    !isRejectedTeacher &&
    !isHiddenPath &&
    profile?.roleId !== 'teacher' &&
    profile?.roleId !== 'admin';

  const guideCompleted =
    profile?.studentAssistantGuideVersion === STUDENT_ASSISTANT_GUIDE_VERSION &&
    !!profile?.studentAssistantGuideCompletedAt;
  const isGuideActive = isStudentEligible && !guideCompleted;
  const isGuideRunning = isGuideActive || isGuideReplayActive;
  const messagesStorageKey = user?.uid ? `${BOT_MESSAGES_STORAGE_PREFIX}${user.uid}` : '';
  const sessionsStorageKey = user?.uid ? `${BOT_SESSIONS_STORAGE_PREFIX}${user.uid}` : '';
  const pageContext = getStudentAssistantPageContext(pathname);
  const sortedSessions = useMemo(() => sortAssistantSessions(sessions), [sessions]);
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [activeSessionId, sessions]
  );
  const selectedSession = useMemo(() => {
    if (selectedSessionId) {
      return sessions.find((session) => session.id === selectedSessionId) || activeSession || sortedSessions[0] || null;
    }

    return activeSession || sortedSessions[0] || null;
  }, [activeSession, selectedSessionId, sessions, sortedSessions]);
  const selectedSessionMessages = selectedSession?.messages || [];
  const isSelectedSessionActive = !!selectedSession && selectedSession.id === activeSessionId;
  const selectedSessionHasUserMessage = selectedSessionMessages.some((message) => message.role === 'user');
  const latestFeedbackTarget = useMemo(() => {
    for (let index = selectedSessionMessages.length - 1; index >= 0; index -= 1) {
      const candidate = selectedSessionMessages[index];
      if (candidate.role !== 'assistant') continue;

      const hasEarlierUserMessage = selectedSessionMessages
        .slice(0, index)
        .some((message) => message.role === 'user');

      if (hasEarlierUserMessage) {
        return candidate;
      }
    }

    return null;
  }, [selectedSessionMessages]);
  const shouldAskFeedback =
    !!latestFeedbackTarget &&
    latestFeedbackTarget.feedback == null &&
    isSelectedSessionActive &&
    selectedSessionHasUserMessage;

  const currentGuideStep = STUDENT_ASSISTANT_GUIDE_STEPS[guideStepIndex];
  const activeGuideTargetId = useMemo(() => {
    if (!currentGuideStep) return null;
    return isMobile ? currentGuideStep.mobileTargetId || currentGuideStep.targetId : currentGuideStep.targetId;
  }, [currentGuideStep, isMobile]);
  const activeGuidePlacement = useMemo<GuidePlacement>(() => {
    if (!currentGuideStep) return 'bottom';
    return isMobile
      ? currentGuideStep.mobilePlacement || currentGuideStep.preferredPlacement || 'bottom'
      : currentGuideStep.preferredPlacement || 'bottom';
  }, [currentGuideStep, isMobile]);
  const isSidebarGuideStep = isSidebarGuideTarget(activeGuideTargetId);

  useEffect(() => {
    const lastGuideStepIndex = STUDENT_ASSISTANT_GUIDE_STEPS.length - 1;
    if (lastGuideStepIndex < 0) return;
    if (guideStepIndex <= lastGuideStepIndex) return;
    setGuideStepIndex(lastGuideStepIndex);
  }, [guideStepIndex]);

  useEffect(() => {
    if (!sessionsStorageKey || typeof window === 'undefined') {
      setSessions([]);
      setActiveSessionId(null);
      setSelectedSessionId(null);
      setHasHydratedStorage(true);
      return;
    }

    try {
      const rawSessions = window.localStorage.getItem(sessionsStorageKey);
      if (rawSessions) {
        setSessions(sanitizeStoredSessions(JSON.parse(rawSessions)));
      } else {
        const rawMessages = messagesStorageKey ? window.localStorage.getItem(messagesStorageKey) : null;
        const legacyMessages = rawMessages ? sanitizeStoredMessages(JSON.parse(rawMessages)) : [];
        const migratedSession = buildLegacySession(legacyMessages, pageContext.label);

        setSessions(migratedSession ? [migratedSession] : []);
      }
    } catch {
      setSessions([]);
      setActiveSessionId(null);
      setSelectedSessionId(null);
    } finally {
      setHasHydratedStorage(true);
    }
  }, [messagesStorageKey, pageContext.label, sessionsStorageKey]);

  useEffect(() => {
    if (!sessionsStorageKey || typeof window === 'undefined' || !hasHydratedStorage) return;

    window.localStorage.setItem(
      sessionsStorageKey,
      JSON.stringify(sortAssistantSessions(sessions).slice(0, MAX_SESSION_COUNT))
    );

    if (messagesStorageKey) {
      window.localStorage.removeItem(messagesStorageKey);
    }
  }, [hasHydratedStorage, messagesStorageKey, sessions, sessionsStorageKey]);

  useEffect(() => {
    if (!isChatOpen || !guideCompleted || !isSelectedSessionActive) return;
    const timer = window.setTimeout(() => {
      composerRef.current?.focus();
    }, 120);
    return () => {
      window.clearTimeout(timer);
    };
  }, [guideCompleted, isChatOpen, isSelectedSessionActive]);

  useEffect(() => {
    if (!guideCompleted || !isChatOpen || !isSelectedSessionActive) return;
    const timer = window.setTimeout(() => {
      const viewport = messagesViewportRef.current;
      if (!viewport) return;
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: 'smooth',
      });
    }, 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, [guideCompleted, isChatOpen, isReplyLoading, isSelectedSessionActive, selectedSessionId, selectedSessionMessages]);

  useEffect(() => {
    if (!isGuideRunning || pathname !== GUIDE_ROUTE || !isMobile) return;

    const timer = window.setTimeout(() => {
      setMobileSidebarVisibility(isSidebarGuideStep);
    }, 40);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isGuideRunning, isMobile, isSidebarGuideStep, pathname]);

  useEffect(() => {
    if (!isGuideRunning || pathname !== GUIDE_ROUTE || !activeGuideTargetId) return;

    let timer = 0;
    let retryCount = 0;

    const scrollTargetIntoView = () => {
      const target = getGuideTargetElement(activeGuideTargetId);
      if (!target) {
        retryCount += 1;
        if (retryCount <= GUIDE_TARGET_RETRY_LIMIT) {
          timer = window.setTimeout(scrollTargetIntoView, 140);
        }
        return;
      }

      target.scrollIntoView({
        behavior: 'smooth',
        block: isMobile ? 'center' : 'nearest',
        inline: 'nearest',
      });
    };

    timer = window.setTimeout(scrollTargetIntoView, isMobile && isSidebarGuideStep ? 280 : 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeGuideTargetId, isGuideRunning, isMobile, isSidebarGuideStep, pathname]);

  useEffect(() => {
    if (!isGuideRunning || pathname !== GUIDE_ROUTE || !activeGuideTargetId) {
      setGuideTargetRect(null);
      setGuideLayout(null);
      return;
    }

    let animationFrameId = 0;
    let settleTimerId = 0;
    let retryTimerId = 0;
    let retryCount = 0;

    const measure = () => {
      try {
        const target = getGuideTargetElement(activeGuideTargetId);
        const panel = guideCardRef.current;

        if (!target || !panel) {
          retryCount += 1;
          if (retryCount <= GUIDE_TARGET_RETRY_LIMIT) {
            retryTimerId = window.setTimeout(scheduleMeasure, 140);
          } else {
            setGuideTargetRect(null);
            setGuideLayout(null);
          }
          return;
        }

        retryCount = 0;
        const nextTargetRect = target.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const panelWidth = Math.max(280, Math.min(panelRect.width || 368, window.innerWidth - 24));
        const panelHeight = Math.max(160, Math.min(panelRect.height || 260, window.innerHeight - 24));

        setGuideTargetRect(nextTargetRect);
        setGuideLayout(
          computeGuideLayout({
            targetRect: nextTargetRect,
            panelWidth,
            panelHeight,
            preferredPlacement: activeGuidePlacement,
            isMobile,
          })
        );
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Could not measure student guide target.', error);
        }
        setGuideTargetRect(null);
        setGuideLayout(null);
        return;
      }
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    settleTimerId = window.setTimeout(scheduleMeasure, 280);

    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, true);

    return () => {
      window.clearTimeout(settleTimerId);
      window.clearTimeout(retryTimerId);
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
    };
  }, [activeGuidePlacement, activeGuideTargetId, isGuideRunning, isMobile, pathname]);

  const quickPrompts = useMemo(() => {
    const prompts =
      pageContext.relatedActions.length > 0
        ? [`What can I do on ${pageContext.label}?`, ...STUDENT_ASSISTANT_SUGGESTED_PROMPTS]
        : STUDENT_ASSISTANT_SUGGESTED_PROMPTS;

    return Array.from(new Set(prompts)).slice(0, 4);
  }, [pageContext.label, pageContext.relatedActions.length]);

  if (isRoleLoading || !isStudentEligible) {
    return null;
  }

  if (isGuideRunning && pathname !== GUIDE_ROUTE) {
    return null;
  }

  const updateActiveSession = (updater: (session: AssistantSession) => AssistantSession) => {
    if (!activeSessionId) return;

    setSessions((current) =>
      sortAssistantSessions(
        current.map((session) => (session.id === activeSessionId ? updater(session) : session))
      ).slice(0, MAX_SESSION_COUNT)
    );
  };

  const createNewSession = () => {
    const sessionNumber =
      sortedSessions.reduce((highest, session) => Math.max(highest, session.sessionNumber), 0) + 1;
    const now = new Date().toISOString();
    const sessionId = buildMessageId('session');
    const introMessage = buildIntroMessage(profile?.firstName, pathname);
    const newSession: AssistantSession = {
      id: sessionId,
      sessionNumber,
      title: buildSessionTitle([introMessage], sessionNumber),
      startedAt: now,
      lastActiveAt: now,
      messages: [introMessage],
    };

    setSessions((current) => sortAssistantSessions([newSession, ...current]).slice(0, MAX_SESSION_COUNT));
    setActiveSessionId(sessionId);
    setSelectedSessionId(sessionId);
    return sessionId;
  };

  const finalizeActiveSession = () => {
    if (!activeSessionId) return;

    setSessions((current) => {
      const session = current.find((entry) => entry.id === activeSessionId);
      if (!session) return current;

      const hasUserMessages = session.messages.some((message) => message.role === 'user');
      if (!hasUserMessages) {
        return current.filter((entry) => entry.id !== activeSessionId);
      }

      const now = new Date().toISOString();
      return sortAssistantSessions(
        current.map((entry) =>
          entry.id === activeSessionId
            ? {
                ...entry,
                endedAt: now,
                lastActiveAt: now,
              }
            : entry
        )
      ).slice(0, MAX_SESSION_COUNT);
    });

    setActiveSessionId(null);
    setSelectedSessionId(null);
  };

  const openChatPanel = () => {
    if (!guideCompleted || !hasHydratedStorage) return;

    if (activeSession) {
      setSelectedSessionId(activeSession.id);
    } else {
      createNewSession();
    }

    setIsChatOpen(true);
  };

  const closeChatPanel = () => {
    finalizeActiveSession();
    setIsChatOpen(false);
  };

  const handleChatPanelChange = (nextOpen: boolean) => {
    if (nextOpen) {
      openChatPanel();
      return;
    }

    closeChatPanel();
  };

  const handleAssistantActionClick = (href: string) => {
    closeChatPanel();
    router.push(href);
  };

  const handleHelpfulFeedback = (feedback: AssistantMessageFeedback) => {
    if (!activeSessionId || !latestFeedbackTarget) return;

    updateActiveSession((session) => {
      const now = new Date().toISOString();
      const nextMessages = session.messages.map((message) =>
        message.id === latestFeedbackTarget.id
          ? {
              ...message,
              feedback,
            }
          : message
      );

      const messagesWithHelpFollowUp =
        feedback === 'not_helpful'
          ? [...nextMessages.slice(-(MAX_MESSAGES_PER_SESSION - 1)), buildHelpFollowUpMessage()]
          : nextMessages;

      return {
        ...session,
        lastActiveAt: now,
        title: buildSessionTitle(messagesWithHelpFollowUp, session.sessionNumber),
        messages: messagesWithHelpFollowUp,
      };
    });
  };

  const startGuideReplay = () => {
    closeChatPanel();
    setGuideStepIndex(0);
    setIsGuideReplayActive(true);
    if (pathname !== GUIDE_ROUTE) {
      router.push(GUIDE_ROUTE);
    }
  };

  const handleGuideComplete = async () => {
    if (isGuideReplayActive) {
      setGuideStepIndex(0);
      setIsGuideReplayActive(false);
      setIsGuideSaving(false);
      return;
    }

    if (!userDocRef) return;

    setIsGuideSaving(true);
    try {
      await setDoc(
        userDocRef,
        {
          studentAssistantGuideCompletedAt: new Date().toISOString(),
          studentAssistantGuideVersion: STUDENT_ASSISTANT_GUIDE_VERSION,
        },
        { merge: true }
      );

      setIsChatOpen(false);
    } finally {
      setIsGuideSaving(false);
    }
  };

  const appendAssistantMessage = (content: string, actions: StudentAssistantAction[] = []) => {
    if (!activeSessionId) return;

    updateActiveSession((session) => {
      const nextMessages = [
        ...session.messages.slice(-(MAX_MESSAGES_PER_SESSION - 1)),
        {
          id: buildMessageId('assistant'),
          role: 'assistant',
          content,
          actions,
          feedback: null,
        } satisfies AssistantMessage,
      ];

      return {
        ...session,
        lastActiveAt: new Date().toISOString(),
        title: buildSessionTitle(nextMessages, session.sessionNumber),
        messages: nextMessages,
      };
    });
  };

  const sendMessage = async (prompt?: string) => {
    if (!guideCompleted || isReplyLoading || !activeSessionId || !activeSession || !isSelectedSessionActive) return;

    const message = (prompt ?? input).trim();
    if (!message) return;

    const nextUserMessage: AssistantMessage = {
      id: buildMessageId('user'),
      role: 'user',
      content: message,
      feedback: null,
    };

    const nextMessages = [...activeSession.messages.slice(-(MAX_MESSAGES_PER_SESSION - 1)), nextUserMessage];
    updateActiveSession((session) => ({
      ...session,
      lastActiveAt: new Date().toISOString(),
      title: buildSessionTitle(nextMessages, session.sessionNumber),
      messages: nextMessages,
    }));

    setSelectedSessionId(activeSessionId);
    setInput('');
    setIsReplyLoading(true);

    try {
      const response = await fetch('/api/student-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          pathname,
          conversation: nextMessages.slice(-6).map((entry) => ({
            role: entry.role,
            content: entry.content,
          })),
          userContext: {
            firstName: profile?.firstName || '',
            roleId: profile?.roleId || 'student',
            subscriptionStatus: profile?.subscriptionStatus || 'unknown',
            accountStatus: profile?.status || 'active',
            completedGuide: guideCompleted,
          },
        }),
      });

      const payload = (await response.json()) as StudentAssistantApiResponse;
      const fallbackActions =
        payload?.suggestedActions?.length > 0
          ? payload.suggestedActions
          : getSuggestedStudentAssistantActions({
              message,
              pathname,
              limit: 3,
            });

      appendAssistantMessage(
        payload?.answer || 'I hit a temporary issue, but I can still help you navigate DCAM.',
        fallbackActions
      );
    } catch {
      appendAssistantMessage(
        'I hit a temporary issue, but I can still help you navigate DCAM. Try opening one of the suggested student pages below.',
        getSuggestedStudentAssistantActions({
          message,
          pathname,
          limit: 3,
        })
      );
    } finally {
      setIsReplyLoading(false);
    }
  };

  const spotlightPadding = currentGuideStep?.spotlightPadding ?? 10;
  const spotlightStyle: CSSProperties | undefined = guideTargetRect
    ? {
        top: Math.max(8, guideTargetRect.top - spotlightPadding),
        left: Math.max(8, guideTargetRect.left - spotlightPadding),
        width: guideTargetRect.width + spotlightPadding * 2,
        height: guideTargetRect.height + spotlightPadding * 2,
        boxShadow: '0 0 0 9999px rgba(2, 8, 23, 0.72)',
      }
    : undefined;
  const guidePanelStyle: CSSProperties | undefined = guideLayout
    ? {
        top: guideLayout.top,
        left: guideLayout.left,
      }
    : {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };

  const renderGuideOverlay = () => {
    if (!currentGuideStep) return null;

    return (
      <>
        <div className="fixed inset-0 z-[60]" aria-hidden="true" />
        {spotlightStyle ? (
          <div
            className="pointer-events-none fixed z-[61] rounded-[24px] border border-cyan-200/90 bg-white/[0.02] shadow-[0_0_0_1px_rgba(103,232,249,0.35),0_0_28px_rgba(34,211,238,0.22)] transition-all duration-300"
            style={spotlightStyle}
            aria-hidden="true"
          />
        ) : null}
        <div
          ref={guideCardRef}
          className="fixed z-[62] w-[min(23rem,calc(100vw-1.5rem))] rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-5 text-slate-50 shadow-[0_36px_100px_-38px_rgba(2,8,23,1)] backdrop-blur-xl"
          style={guidePanelStyle}
          role="dialog"
          aria-modal="true"
          aria-label="First-time DCAM guide"
        >
          {guideLayout ? (
            <div
              className="absolute h-4 w-4 rotate-45 rounded-[4px] border border-white/10 bg-slate-950/95"
              style={getArrowStyle(guideLayout)}
              aria-hidden="true"
            />
          ) : null}

          <div className="relative space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/12 text-cyan-100 ring-1 ring-cyan-300/20">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.24em] text-cyan-100"
                    >
                      {currentGuideStep.sectionLabel}
                    </Badge>
                  </div>
                  <h3 className="mt-3 text-[1.15rem] font-semibold tracking-tight text-slate-50">
                    {currentGuideStep.title}
                  </h3>
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-slate-300">
                {guideStepIndex + 1} / {STUDENT_ASSISTANT_GUIDE_STEPS.length}
              </div>
            </div>

            <p className="text-sm leading-6 text-slate-300/84">{currentGuideStep.body}</p>

            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 transition-all"
                style={{
                  width: `${((guideStepIndex + 1) / STUDENT_ASSISTANT_GUIDE_STEPS.length) * 100}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full px-3 text-slate-300 hover:bg-white/[0.06] hover:text-slate-50"
                onClick={() => setGuideStepIndex((current) => Math.max(0, current - 1))}
                disabled={guideStepIndex === 0 || isGuideSaving}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>

              {guideStepIndex < STUDENT_ASSISTANT_GUIDE_STEPS.length - 1 ? (
                <Button
                  type="button"
                  className="h-11 rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-4 text-sm font-semibold text-slate-950 shadow-[0_18px_36px_-20px_rgba(56,189,248,1)] hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400"
                  onClick={() =>
                    setGuideStepIndex((current) =>
                      Math.min(STUDENT_ASSISTANT_GUIDE_STEPS.length - 1, current + 1)
                    )
                  }
                  disabled={isGuideSaving}
                >
                  Continue
                  <span className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/15">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-11 rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-4 text-sm font-semibold text-slate-950 shadow-[0_18px_36px_-20px_rgba(56,189,248,1)] hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400"
                  onClick={() => {
                    void handleGuideComplete();
                  }}
                  disabled={isGuideSaving}
                >
                  {isGuideSaving ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Unlock Ask DCAM
                </Button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderChat = () => (
    <div className="flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]">
      <div className="border-b border-white/10 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 via-sky-400/15 to-blue-500/20 text-cyan-100 ring-1 ring-cyan-300/15">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-slate-50">Ask DCAM</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full border-cyan-300/20 bg-cyan-400/10 px-2.5 text-[11px] text-cyan-100 hover:bg-cyan-400/16 hover:text-cyan-50"
                  onClick={startGuideReplay}
                >
                  Guide again
                </Button>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">{selectedSession?.title || 'New chat'}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-slate-50"
            onClick={closeChatPanel}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close Ask DCAM</span>
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-40 shrink-0 border-r border-white/10 bg-slate-950/25 md:flex md:flex-col">
          <div className="border-b border-white/10 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sessions</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <div className="space-y-1.5">
              {sortedSessions.map((session) => {
                const isSelected = session.id === selectedSession?.id;
                const isLive = session.id === activeSessionId;

                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className={cn(
                      'w-full rounded-xl px-3 py-2 text-left transition',
                      isSelected ? 'bg-cyan-400/10 text-slate-50' : 'text-slate-300 hover:bg-white/[0.05]'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-cyan-100" />
                      <span className="truncate text-xs font-medium">
                        Session {session.sessionNumber}
                      </span>
                      {isLive ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> : null}
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      {trimText(session.title, 22)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="border-b border-white/10 px-3 py-2 md:hidden">
            <div className="flex gap-2 overflow-x-auto">
              {sortedSessions.map((session) => {
                const isSelected = session.id === selectedSession?.id;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs transition',
                      isSelected
                        ? 'border-cyan-300/25 bg-cyan-400/10 text-slate-50'
                        : 'border-white/10 bg-white/[0.03] text-slate-300'
                    )}
                  >
                    Session {session.sessionNumber}
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={messagesViewportRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-3 pb-3">
              {!isSelectedSessionActive && activeSession ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-xs text-slate-400">Viewing older session</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full px-3 text-xs text-slate-100 hover:bg-white/[0.06]"
                    onClick={() => setSelectedSessionId(activeSession.id)}
                  >
                    Current
                  </Button>
                </div>
              ) : null}

              {isSelectedSessionActive && selectedSessionMessages.length <= 1 ? (
                <div className="flex flex-wrap gap-2">
                  {quickPrompts.slice(0, 3).map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-white/10 bg-white/[0.03] text-xs text-slate-200 hover:bg-white/[0.08] hover:text-white"
                      onClick={() => {
                        void sendMessage(prompt);
                      }}
                      disabled={isReplyLoading}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              ) : null}

              {selectedSessionMessages.map((message) => (
                <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[88%] rounded-[20px] px-3.5 py-2.5 text-sm leading-6 shadow-sm',
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 text-slate-950 shadow-[0_16px_36px_-24px_rgba(56,189,248,1)]'
                        : 'border border-white/10 bg-white/[0.04] text-slate-100'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.actions && message.actions.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.actions.map((action) => (
                          <Button
                            key={`${message.id}_${action.id}`}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full border-white/10 bg-white/[0.03] px-3 text-xs text-slate-100 hover:bg-white/[0.08]"
                            onClick={() => {
                              handleAssistantActionClick(action.href);
                            }}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {isReplyLoading ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center rounded-[20px] border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-300">
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              ) : null}

              {shouldAskFeedback ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <p className="text-sm font-medium text-slate-100">Helpful?</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full border-white/10 bg-transparent px-3 text-xs text-slate-100 hover:bg-white/[0.08]"
                      onClick={() => handleHelpfulFeedback('helpful')}
                    >
                      <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
                      Yes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full border-white/10 bg-transparent px-3 text-xs text-slate-100 hover:bg-white/[0.08]"
                      onClick={() => handleHelpfulFeedback('not_helpful')}
                    >
                      <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />
                      No
                    </Button>
                  </div>
                </div>
              ) : null}

              {!shouldAskFeedback && latestFeedbackTarget?.feedback && isSelectedSessionActive ? (
                <p className="text-xs text-slate-500">Feedback saved</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 px-3 py-3">
        <div className="rounded-[22px] border border-white/10 bg-slate-950/70 p-2.5 shadow-[0_20px_40px_-32px_rgba(2,8,23,1)]">
          <Textarea
            ref={composerRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            placeholder={
              isSelectedSessionActive
                ? 'Ask about a DCAM feature...'
                : 'Open current session to continue...'
            }
            className="min-h-[74px] max-h-40 resize-none rounded-2xl border border-white/6 bg-white/[0.02] px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-400 focus-visible:ring-cyan-300/40"
            disabled={isReplyLoading || !isSelectedSessionActive}
          />
          <div className="mt-2 flex items-center justify-end gap-3">
            <Button
              type="button"
              className="h-10 rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-3.5 text-sm font-semibold text-slate-950 hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400"
              onClick={() => {
                void sendMessage();
              }}
              disabled={isReplyLoading || !input.trim() || !isSelectedSessionActive}
            >
              {isReplyLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const floatingButton = (
    <div
      data-student-tour="assistant-launcher"
      className="fixed bottom-[5.25rem] right-4 z-40 md:bottom-6 md:right-6"
    >
      <Button
        type="button"
        onClick={() => {
          if (isChatOpen) {
            closeChatPanel();
            return;
          }

          openChatPanel();
        }}
        disabled={!guideCompleted}
        aria-disabled={!guideCompleted}
        className={cn(
          'h-12 rounded-full border border-cyan-300/30 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-3.5 text-slate-950 shadow-[0_18px_40px_-18px_rgba(56,189,248,0.95)] hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400',
          isMobile ? 'w-12 px-0' : 'gap-2',
          !guideCompleted ? 'cursor-not-allowed opacity-95 hover:from-cyan-300 hover:via-sky-400 hover:to-blue-500' : ''
        )}
      >
        {!guideCompleted ? <Lock className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
        {!isMobile ? <span className="text-sm font-semibold">Ask DCAM</span> : null}
        {!guideCompleted ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[1.45rem] items-center justify-center rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-100">
            Locked
          </span>
        ) : null}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {floatingButton}
        {isGuideRunning ? renderGuideOverlay() : null}
        <Sheet open={guideCompleted && isChatOpen} onOpenChange={handleChatPanelChange}>
          <SheetContent side="bottom" className="h-[76vh] rounded-t-[28px] border-x-0 border-b-0 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>DCAM Guide</SheetTitle>
              <SheetDescription>Student help assistant for DCAM Classes</SheetDescription>
            </SheetHeader>
            {renderChat()}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <>
      {floatingButton}
      {isGuideRunning ? renderGuideOverlay() : null}
      {guideCompleted && isChatOpen ? (
        <div className="fixed bottom-22 right-4 z-40 h-[min(72vh,640px)] w-[min(24.5rem,calc(100vw-2rem))] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/95 shadow-[0_34px_90px_-34px_rgba(2,8,23,1)] backdrop-blur-xl md:bottom-20 md:right-6">
          {renderChat()}
        </div>
      ) : null}
    </>
  );
}
