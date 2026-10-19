export type StudentAssistantAction = {
  id: string;
  label: string;
  href: string;
  description: string;
  keywords: string[];
};

export type StudentAssistantGuideStep = {
  id: string;
  sectionLabel: string;
  title: string;
  body: string;
  targetId: string;
  mobileTargetId?: string;
  preferredPlacement?: 'top' | 'bottom' | 'left' | 'right';
  mobilePlacement?: 'top' | 'bottom' | 'left' | 'right';
  spotlightPadding?: number;
};

export type StudentAssistantPageContext = {
  label: string;
  summary: string;
  relatedActions: StudentAssistantAction[];
};

export type StudentAssistantResponse = {
  answer: string;
  suggestedActions: StudentAssistantAction[];
};

type StudentAssistantWorkflow = {
  id: string;
  title: string;
  patterns: RegExp[];
  answer: string;
  actionIds: string[];
};

export const STUDENT_ASSISTANT_GUIDE_VERSION = '2026-04-dcam-student-assistant-v3';

export const STUDENT_ASSISTANT_ACTIONS: StudentAssistantAction[] = [
  {
    id: 'dashboard',
    label: 'Open Dashboard',
    href: '/dashboard',
    description: 'Use Dashboard as the main student home for shortcuts, reminders, and quick learning access.',
    keywords: ['dashboard', 'home', 'start', 'main page'],
  },
  {
    id: 'my-learning',
    label: 'My Learning',
    href: '/my-learning',
    description: 'Open your enrolled or purchased courses and continue learning from one place.',
    keywords: ['course', 'courses', 'learning', 'lecture', 'class notes'],
  },
  {
    id: 'my-practice',
    label: 'My Practice',
    href: '/my-practice',
    description: 'Review your saved practice flow and keep your daily preparation organized.',
    keywords: ['practice', 'question bank', 'practice history'],
  },
  {
    id: 'mock-tests',
    label: 'Mock Tests',
    href: '/mock-tests',
    description: 'Browse published mock tests and open test-specific pages, attempts, and reports.',
    keywords: ['mock test', 'test', 'analysis report', 'attempt history', 'result'],
  },
  {
    id: 'custom-mock',
    label: 'Custom Mock',
    href: '/dcam-custom-mock',
    description: 'Create a custom mock test based on your exam and curriculum preferences.',
    keywords: ['custom mock', 'build test', 'create test', 'personal test'],
  },
  {
    id: 'practice-session',
    label: 'Practice Session',
    href: '/dcam-practice-session',
    description: 'Launch a focused practice session from the DCAM question bank.',
    keywords: ['practice session', 'question bank', 'session'],
  },
  {
    id: 'my-batch',
    label: 'My Batch',
    href: '/my-batch',
    description: 'See your joined live batches and open their learning spaces.',
    keywords: ['my batch', 'joined batch', 'batch classroom'],
  },
  {
    id: 'find-batches',
    label: 'Explore Batches',
    href: '/my-batch/explore',
    description: 'Search live batches that match your exam, class, and subject goals.',
    keywords: ['live batch', 'batch', 'join class', 'batch search'],
  },
  {
    id: 'find-teachers',
    label: 'Find Teachers',
    href: '/find-teachers',
    description: 'Browse teacher profiles by exam, curriculum, and subject fit.',
    keywords: ['teacher', 'teachers', 'faculty', 'mentor', 'find teacher'],
  },
  {
    id: 'doubts',
    label: 'Doubts',
    href: '/doubts',
    description: 'Send doubt-related messages to teachers inside the platform.',
    keywords: ['doubt', 'ask teacher', 'support from teacher'],
  },
  {
    id: 'chat',
    label: 'Chat',
    href: '/chat',
    description: 'Open DCAM chat to continue platform communication and updates.',
    keywords: ['chat', 'message', 'messages', 'inbox'],
  },
  {
    id: 'curriculum',
    label: 'Curriculum',
    href: '/curriculum',
    description: 'Review the curriculum structure linked to your preparation path.',
    keywords: ['curriculum', 'syllabus navigation', 'class structure'],
  },
  {
    id: 'offers',
    label: 'Offers',
    href: '/offers',
    description: 'Check bundled offers and discounted combinations available to students.',
    keywords: ['offer', 'offers', 'discount', 'bundle'],
  },
  {
    id: 'subscription',
    label: 'Subscription',
    href: '/subscription',
    description: 'Check plans, payments, and access eligibility for subscription-based content.',
    keywords: ['subscription', 'plan', 'upgrade', 'payment', 'renew', 'billing'],
  },
  {
    id: 'notice-board',
    label: 'Notice Board',
    href: '/notice-board',
    description: 'Open the notice board for exam bulletin and notice-style updates inside DCAM.',
    keywords: ['notice', 'updates', 'bulletin', 'announcement'],
  },
  {
    id: 'help',
    label: 'Help Page',
    href: '/help',
    description: 'Open the Help page for student guidance, support directions, and platform usage help.',
    keywords: ['help', 'support page', 'guide', 'assistance'],
  },
  {
    id: 'profile',
    label: 'Profile',
    href: '/profile',
    description: 'Update your account profile details and review your saved identity information.',
    keywords: ['profile', 'account', 'name', 'email', 'phone', 'photo'],
  },
];

const STUDENT_ASSISTANT_ACTIONS_BY_ID = new Map(
  STUDENT_ASSISTANT_ACTIONS.map((action) => [action.id, action] as const)
);

type PageContextDefinition = {
  matches: (pathname: string) => boolean;
  label: string;
  summary: string;
  relatedActionIds: string[];
};

const PAGE_CONTEXTS: PageContextDefinition[] = [
  {
    matches: (pathname) => pathname === '/dashboard',
    label: 'Dashboard',
    summary: 'This is the student home where you can jump into learning, practice, batches, and account support.',
    relatedActionIds: ['dashboard', 'my-learning', 'my-practice'],
  },
  {
    matches: (pathname) => pathname === '/my-learning',
    label: 'My Learning',
    summary: 'This page is for enrolled or purchased courses that you can continue from one place.',
    relatedActionIds: ['my-learning', 'curriculum', 'subscription'],
  },
  {
    matches: (pathname) => pathname === '/my-practice',
    label: 'My Practice',
    summary: 'This page keeps your practice activity organized and helps you continue question work.',
    relatedActionIds: ['my-practice', 'practice-session', 'mock-tests'],
  },
  {
    matches: (pathname) => pathname === '/mock-tests',
    label: 'Mock Tests',
    summary: 'Use this page to browse available mock tests and open test-specific details.',
    relatedActionIds: ['mock-tests', 'custom-mock', 'subscription'],
  },
  {
    matches: (pathname) => /^\/mock-tests\/[^/]+/.test(pathname),
    label: 'Mock Test Details',
    summary: 'This area is for mock-test information, attempts, access checks, and report navigation inside DCAM.',
    relatedActionIds: ['mock-tests', 'custom-mock', 'subscription'],
  },
  {
    matches: (pathname) => pathname === '/dcam-custom-mock',
    label: 'Custom Mock Builder',
    summary: 'This page helps you generate your own custom mock flow from DCAM filters.',
    relatedActionIds: ['custom-mock', 'mock-tests', 'curriculum'],
  },
  {
    matches: (pathname) => pathname === '/dcam-practice-session',
    label: 'Practice Session Launcher',
    summary: 'This area starts focused practice from the DCAM question bank.',
    relatedActionIds: ['practice-session', 'my-practice', 'subscription'],
  },
  {
    matches: (pathname) => pathname === '/my-batch',
    label: 'My Batch',
    summary: 'This page lists your joined live batches and their learning access points.',
    relatedActionIds: ['my-batch', 'find-batches', 'chat'],
  },
  {
    matches: (pathname) => pathname.startsWith('/my-batch/explore'),
    label: 'Batch Explorer',
    summary: 'Use this page to search live batches and compare options before joining.',
    relatedActionIds: ['find-batches', 'find-teachers', 'subscription'],
  },
  {
    matches: (pathname) => pathname.startsWith('/live-batches/'),
    label: 'Live Batch Classroom',
    summary: 'This area is for classroom access, scheduled sessions, teacher communication, and linked tests.',
    relatedActionIds: ['my-batch', 'chat', 'doubts'],
  },
  {
    matches: (pathname) => pathname === '/find-teachers',
    label: 'Find Teachers',
    summary: 'Use this page to browse teachers by exam, curriculum, and subject fit.',
    relatedActionIds: ['find-teachers', 'doubts', 'chat'],
  },
  {
    matches: (pathname) => pathname.startsWith('/teachers/'),
    label: 'Teacher Profile',
    summary: 'This page shows a teacher profile along with their published DCAM content.',
    relatedActionIds: ['find-teachers', 'chat', 'doubts'],
  },
  {
    matches: (pathname) => pathname.startsWith('/chat'),
    label: 'Chat',
    summary: 'This page is for platform messages and communication threads inside DCAM.',
    relatedActionIds: ['chat', 'doubts', 'notice-board'],
  },
  {
    matches: (pathname) => pathname === '/doubts',
    label: 'Doubts',
    summary: 'Use this page to send and track teacher-facing doubt conversations.',
    relatedActionIds: ['doubts', 'find-teachers', 'chat'],
  },
  {
    matches: (pathname) => pathname === '/curriculum',
    label: 'Curriculum',
    summary: 'This page helps you browse the curriculum structure connected to your preparation path.',
    relatedActionIds: ['curriculum', 'my-learning', 'mock-tests'],
  },
  {
    matches: (pathname) => pathname === '/offers',
    label: 'Offers',
    summary: 'This page shows bundled offers and student-facing value combinations.',
    relatedActionIds: ['offers', 'subscription', 'my-learning'],
  },
  {
    matches: (pathname) => pathname === '/profile',
    label: 'Profile',
    summary: 'This page is where you review and update your account details.',
    relatedActionIds: ['profile', 'subscription', 'dashboard'],
  },
  {
    matches: (pathname) => pathname === '/subscription',
    label: 'Subscription',
    summary: 'This area explains plans, payments, and access-related student questions.',
    relatedActionIds: ['subscription', 'offers', 'profile'],
  },
  {
    matches: (pathname) => pathname === '/notice-board',
    label: 'Notice Board',
    summary: 'This page shows notice-style updates and bulletin content inside DCAM.',
    relatedActionIds: ['notice-board', 'chat', 'dashboard'],
  },
  {
    matches: (pathname) => pathname === '/help',
    label: 'Help',
    summary: 'This page gives students a guided place to understand DCAM features and where to go next for support.',
    relatedActionIds: ['help', 'dashboard', 'chat'],
  },
];

export const STUDENT_ASSISTANT_GUIDE_STEPS: StudentAssistantGuideStep[] = [
  {
    id: 'dashboard',
    sectionLabel: 'Sidebar',
    title: 'Dashboard',
    body: 'Your main student home inside DCAM.',
    targetId: 'dashboard-nav',
    preferredPlacement: 'right',
    mobilePlacement: 'bottom',
    spotlightPadding: 8,
  },
  {
    id: 'my-learning-nav',
    sectionLabel: 'Sidebar',
    title: 'My Learning',
    body: 'Open enrolled courses and continue quickly.',
    targetId: 'my-learning-nav',
    preferredPlacement: 'right',
    mobilePlacement: 'bottom',
    spotlightPadding: 8,
  },
  {
    id: 'my-practice-nav',
    sectionLabel: 'Sidebar',
    title: 'My Practice',
    body: 'Resume saved practice flow and question work.',
    targetId: 'my-practice-nav',
    preferredPlacement: 'right',
    mobilePlacement: 'bottom',
    spotlightPadding: 8,
  },
  {
    id: 'my-batch-nav',
    sectionLabel: 'Sidebar',
    title: 'My Batch',
    body: 'Enter joined live batches and class spaces.',
    targetId: 'my-batch-nav',
    preferredPlacement: 'right',
    mobilePlacement: 'bottom',
    spotlightPadding: 8,
  },
  {
    id: 'offers-nav',
    sectionLabel: 'Sidebar',
    title: 'Offers',
    body: 'Check bundled student plans and value.',
    targetId: 'offers-nav',
    preferredPlacement: 'right',
    mobilePlacement: 'bottom',
    spotlightPadding: 8,
  },
  {
    id: 'chat-nav',
    sectionLabel: 'Sidebar',
    title: 'Chat',
    body: 'View platform messages and conversations.',
    targetId: 'chat-nav',
    preferredPlacement: 'right',
    mobilePlacement: 'bottom',
    spotlightPadding: 8,
  },
  {
    id: 'doubts-nav',
    sectionLabel: 'Sidebar',
    title: 'Doubts',
    body: 'Send teacher-facing support queries here.',
    targetId: 'doubts-nav',
    preferredPlacement: 'right',
    mobilePlacement: 'bottom',
    spotlightPadding: 8,
  },
  {
    id: 'bulletin-nav',
    sectionLabel: 'Sidebar',
    title: 'Exam Bulletin',
    body: 'Read student notices, alerts, and updates.',
    targetId: 'notice-board-nav',
    preferredPlacement: 'right',
    mobilePlacement: 'bottom',
    spotlightPadding: 8,
  },
  {
    id: 'learning-shortcut',
    sectionLabel: 'Dashboard',
    title: 'Open My Learning',
    body: 'Use this shortcut to jump straight to courses.',
    targetId: 'my-learning-button',
    preferredPlacement: 'bottom',
    mobilePlacement: 'top',
    spotlightPadding: 12,
  },
  {
    id: 'mock-tests-shortcut',
    sectionLabel: 'Dashboard',
    title: 'Search Mock Tests',
    body: 'Browse published tests by exam and curriculum.',
    targetId: 'mock-tests-button',
    preferredPlacement: 'bottom',
    mobilePlacement: 'top',
    spotlightPadding: 12,
  },
  {
    id: 'custom-mock-shortcut',
    sectionLabel: 'Dashboard',
    title: 'Custom Mock Test',
    body: 'Build a personal mock in just a few steps.',
    targetId: 'custom-mock-button',
    preferredPlacement: 'bottom',
    mobilePlacement: 'top',
    spotlightPadding: 12,
  },
  {
    id: 'teachers-shortcut',
    sectionLabel: 'Dashboard',
    title: 'Search Teachers',
    body: 'Find teachers matched to your subject needs.',
    targetId: 'find-teachers-button',
    preferredPlacement: 'top',
    mobilePlacement: 'top',
    spotlightPadding: 12,
  },
  {
    id: 'practice-session-shortcut',
    sectionLabel: 'Dashboard',
    title: 'Start Practice Session',
    body: 'Launch focused question-bank practice here.',
    targetId: 'practice-session-button',
    preferredPlacement: 'top',
    mobilePlacement: 'top',
    spotlightPadding: 12,
  },
  {
    id: 'live-batches-shortcut',
    sectionLabel: 'Dashboard',
    title: 'Search Live Batches',
    body: 'Compare live batch options before joining.',
    targetId: 'live-batches-button',
    preferredPlacement: 'top',
    mobilePlacement: 'top',
    spotlightPadding: 12,
  },
  {
    id: 'assistant',
    sectionLabel: 'Assistant',
    title: 'Ask DCAM',
    body: 'Finish the tour to unlock platform help on student pages.',
    targetId: 'assistant-launcher',
    preferredPlacement: 'top',
    mobilePlacement: 'top',
    spotlightPadding: 10,
  },
];

export const STUDENT_ASSISTANT_SUGGESTED_PROMPTS = [
  'How do I make a custom mock test?',
  'Where do I find my purchased courses?',
  'How do I upgrade my subscription?',
  'Show me where to find teachers.',
  'Where can I see platform updates?',
];

const STUDENT_ASSISTANT_WORKFLOWS: StudentAssistantWorkflow[] = [
  {
    id: 'custom-mock-create',
    title: 'Create a custom mock test',
    patterns: [
      /\bcustom mock\b/,
      /\bmake (a )?custom mock\b/,
      /\bcreate (a )?custom mock\b/,
      /\bbuild (a )?custom mock\b/,
      /\bhow do i make .*mock\b/,
    ],
    answer:
      'To make a custom mock, open Custom Mock, choose Free or Premium, select your exam, curriculum, and subjects, then continue into the builder and create the test. After creation, you can reopen it later from My Practice.',
    actionIds: ['custom-mock', 'my-practice', 'mock-tests'],
  },
  {
    id: 'mock-analysis',
    title: 'Open mock test reports',
    patterns: [
      /\banalysis report\b/,
      /\bdownload .*report\b/,
      /\bmock .*report\b/,
      /\battempt history\b/,
      /\bresult\b/,
    ],
    answer:
      'To check a mock report, open Mock Tests or My Practice, choose the test, then open its attempt history or analysis screen. That is where DCAM keeps reports, review, and download options for completed attempts.',
    actionIds: ['mock-tests', 'my-practice', 'dashboard'],
  },
  {
    id: 'courses',
    title: 'Continue purchased courses',
    patterns: [/\bpurchased course\b/, /\benrolled course\b/, /\bmy learning\b/, /\bcourse\b/, /\blecture\b/],
    answer:
      'Open My Learning to continue your enrolled or purchased courses. It is the main place for course access, resumed progress, and linked learning content.',
    actionIds: ['my-learning', 'dashboard', 'offers'],
  },
  {
    id: 'practice-session',
    title: 'Start practice',
    patterns: [/\bpractice session\b/, /\bquestion bank\b/, /\bstart practice\b/, /\bpractice\b/],
    answer:
      'To start practice, open Practice Session from the dashboard or My Practice. From there, choose the scope you want and launch a focused question-bank session.',
    actionIds: ['practice-session', 'my-practice', 'dashboard'],
  },
  {
    id: 'teachers',
    title: 'Find teachers',
    patterns: [/\bfind teacher\b/, /\bsearch teacher\b/, /\bteacher\b/, /\bmentor\b/, /\bfaculty\b/],
    answer:
      'To find a teacher, open Find Teachers, filter by exam, curriculum, or subject, then open the profile that fits your preparation needs. You can continue from there into doubts, chat, or teacher content.',
    actionIds: ['find-teachers', 'doubts', 'chat'],
  },
  {
    id: 'batches',
    title: 'Join live batches',
    patterns: [/\blive batch\b/, /\bbatch\b/, /\bjoin class\b/, /\bclassroom\b/],
    answer:
      'Use Explore Batches to search live batches, then open the batch that matches your exam or subject goals. For already joined batches, use My Batch as your main classroom entry point.',
    actionIds: ['find-batches', 'my-batch', 'chat'],
  },
  {
    id: 'subscription',
    title: 'Manage subscription',
    patterns: [/\bsubscription\b/, /\bplan\b/, /\bupgrade\b/, /\brenew\b/, /\bbilling\b/, /\bpayment\b/],
    answer:
      'Open Subscription to check your plan, payment status, and upgrade path. If you want bundled value before upgrading, compare student options in Offers as well.',
    actionIds: ['subscription', 'offers', 'profile'],
  },
  {
    id: 'profile',
    title: 'Update profile',
    patterns: [/\bprofile\b/, /\baccount\b/, /\bphone\b/, /\bemail\b/, /\bphoto\b/, /\bname\b/],
    answer:
      'Open Profile to review or update your saved account details. If the issue is related to access or plan eligibility, check Subscription next.',
    actionIds: ['profile', 'subscription', 'dashboard'],
  },
  {
    id: 'chat-doubts',
    title: 'Use chat and doubts',
    patterns: [/\bchat\b/, /\bmessage\b/, /\bdoubt\b/, /\bsupport\b/],
    answer:
      'Use Chat for ongoing platform conversations and Doubts for teacher-facing help. If you need the right teacher first, open Find Teachers before starting the conversation.',
    actionIds: ['chat', 'doubts', 'find-teachers'],
  },
  {
    id: 'updates',
    title: 'Check updates',
    patterns: [/\bupdate\b/, /\bupdates\b/, /\bnotice\b/, /\bbulletin\b/, /\bannouncement\b/, /\bnotification\b/],
    answer:
      'For platform updates, check your notifications and open Notice Board. DCAM uses that area for student notices, alerts, and bulletin-style updates.',
    actionIds: ['notice-board', 'dashboard', 'chat'],
  },
];

type FallbackTopic = {
  keywords: string[];
  answer: string;
  actionIds: string[];
};

const FALLBACK_TOPICS: FallbackTopic[] = [
  {
    keywords: ['course', 'courses', 'my learning', 'lecture'],
    answer: 'Open My Learning to continue enrolled or purchased courses. If you are still exploring options, use Offers or browse teacher pages to compare what fits you best.',
    actionIds: ['my-learning', 'offers', 'find-teachers'],
  },
  {
    keywords: ['practice', 'question bank', 'practice session'],
    answer: 'Use My Practice for your running practice flow, or launch a fresh Practice Session if you want to work through the DCAM question bank again.',
    actionIds: ['my-practice', 'practice-session', 'dashboard'],
  },
  {
    keywords: ['mock', 'mock test', 'analysis', 'report', 'attempt'],
    answer: 'Use Mock Tests to browse test pages, attempts, and analysis-related navigation. If you want a self-built test, open Custom Mock instead.',
    actionIds: ['mock-tests', 'custom-mock', 'dashboard'],
  },
  {
    keywords: ['teacher', 'teachers', 'mentor', 'faculty'],
    answer: 'Use Find Teachers to browse teacher profiles and then open the teacher page that matches your exam or subject fit.',
    actionIds: ['find-teachers', 'doubts', 'chat'],
  },
  {
    keywords: ['batch', 'live batch', 'classroom', 'session'],
    answer: 'Use My Batch for the batches you already joined, or Explore Batches if you want to search for a new live batch before joining.',
    actionIds: ['my-batch', 'find-batches', 'chat'],
  },
  {
    keywords: ['subscription', 'plan', 'payment', 'billing', 'renew', 'upgrade'],
    answer: 'Open Subscription to check your plan, payment status, and access eligibility. Offers can also help if you are comparing value before upgrading.',
    actionIds: ['subscription', 'offers', 'profile'],
  },
  {
    keywords: ['profile', 'account', 'email', 'phone', 'photo', 'name'],
    answer: 'Open Profile to review or update your account details. If the question is about plan access, Subscription is the next page to check.',
    actionIds: ['profile', 'subscription', 'dashboard'],
  },
  {
    keywords: ['update', 'updates', 'notice', 'notification', 'announcement', 'bulletin'],
    answer: 'For updates inside DCAM, check your notifications and open Notice Board. I can also help you find the right student page if you tell me what kind of update you need.',
    actionIds: ['notice-board', 'chat', 'dashboard'],
  },
  {
    keywords: ['chat', 'message', 'messages', 'doubt', 'doubts'],
    answer: 'Use Chat for communication threads and Doubts for teacher-facing doubt support. If you need to find a teacher first, open Find Teachers.',
    actionIds: ['chat', 'doubts', 'find-teachers'],
  },
  {
    keywords: ['offer', 'offers', 'discount', 'bundle'],
    answer: 'Open Offers to compare bundled student options. If your question is about recurring access, Subscription is the better page to check next.',
    actionIds: ['offers', 'subscription', 'my-learning'],
  },
];

export function getStudentAssistantActionsByIds(actionIds: string[]): StudentAssistantAction[] {
  const uniqueActions: StudentAssistantAction[] = [];
  const seen = new Set<string>();

  actionIds.forEach((actionId) => {
    const action = STUDENT_ASSISTANT_ACTIONS_BY_ID.get(actionId);
    if (!action || seen.has(action.id)) return;
    seen.add(action.id);
    uniqueActions.push(action);
  });

  return uniqueActions;
}

export function getStudentAssistantPageContext(pathname?: string | null): StudentAssistantPageContext {
  const safePathname = String(pathname || '').trim() || '/dashboard';
  const definition = PAGE_CONTEXTS.find((candidate) => candidate.matches(safePathname));

  if (!definition) {
    return {
      label: 'DCAM Classes',
      summary: 'This is a student area inside DCAM Classes where you can navigate account, learning, practice, and support tools.',
      relatedActions: getStudentAssistantActionsByIds(['dashboard', 'my-learning', 'subscription']),
    };
  }

  return {
    label: definition.label,
    summary: definition.summary,
    relatedActions: getStudentAssistantActionsByIds(definition.relatedActionIds),
  };
}

export function getStudentAssistantKnowledgeText(): string {
  return STUDENT_ASSISTANT_ACTIONS.map((action) => {
    return `- ${action.label} (${action.href}): ${action.description}`;
  }).join('\n');
}

export function getStudentAssistantWorkflowText(): string {
  return STUDENT_ASSISTANT_WORKFLOWS.map((workflow) => {
    return `- ${workflow.title}: ${workflow.answer}`;
  }).join('\n');
}

const DCAM_SUPPORT_TERMS = Array.from(
  new Set(
    STUDENT_ASSISTANT_ACTIONS.flatMap((action) => [
      action.label.toLowerCase(),
      ...action.keywords.map((keyword) => keyword.toLowerCase()),
    ]).concat([
      'dcam',
      'dcam classes',
      'custom mock',
      'mock test',
      'my learning',
      'my practice',
      'my batch',
      'profile',
      'subscription',
      'offers',
      'analysis report',
      'attempt history',
      'notice board',
    ])
  )
);

const GENERIC_DCAM_REQUEST_PATTERNS = [
  /\bwhat can i do here\b/,
  /\bwhere am i\b/,
  /\bhow do i use this\b/,
  /\bhow do i use dcam\b/,
  /\bhow to use this\b/,
  /\bhow does this work\b/,
  /\bwhere should i go\b/,
  /\bwhich page\b/,
  /\bwhere can i find\b/,
  /\bshow me where\b/,
  /\bhelp me navigate\b/,
];

const FOLLOW_UP_REQUEST_PATTERNS = [
  /^\s*how\??\s*$/i,
  /^\s*next\??\s*$/i,
  /^\s*what next\??\s*$/i,
  /^\s*then what\??\s*$/i,
  /^\s*and then\??\s*$/i,
  /^\s*where next\??\s*$/i,
  /^\s*which one\??\s*$/i,
  /^\s*tell me more\??\s*$/i,
  /^\s*can you explain\??\s*$/i,
];

function hasDcamSupportSignal(text: string) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return false;

  return (
    GENERIC_DCAM_REQUEST_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    DCAM_SUPPORT_TERMS.some((term) => normalized.includes(term))
  );
}

export function isLikelyDcamSupportRequest(input: {
  message: string;
  conversation?: Array<{ role: 'assistant' | 'user'; content: string }>;
}): boolean {
  const message = String(input.message || '').trim().toLowerCase();
  if (!message) return false;

  if (hasDcamSupportSignal(message)) {
    return true;
  }

  const isFollowUp = FOLLOW_UP_REQUEST_PATTERNS.some((pattern) => pattern.test(message));
  if (!isFollowUp) {
    return false;
  }

  const recentConversationText = (input.conversation || [])
    .slice(-4)
    .map((entry) => entry.content)
    .join(' ');

  return hasDcamSupportSignal(recentConversationText);
}

export function getStudentAssistantTopicRedirectResponse(input: {
  pathname?: string | null;
}): StudentAssistantResponse {
  const pageContext = getStudentAssistantPageContext(input.pathname);
  const fallbackActions =
    pageContext.relatedActions.length > 0
      ? pageContext.relatedActions.slice(0, 3)
      : getStudentAssistantActionsByIds(['dashboard', 'custom-mock', 'subscription']);

  return {
    answer:
      'I can help only with DCAM Classes topics. Ask about custom mock tests, courses, subscriptions, teachers, batches, chat, doubts, reports, or how to use a DCAM page.',
    suggestedActions: fallbackActions,
  };
}

export function isAcademicExamHelpRequest(message: string): boolean {
  const normalized = message.toLowerCase();

  const hasAcademicVerb =
    /\b(solve|answer|explain|derive|prove|calculate|compute|teach|tutor|clarify|predict|rank|shortcut|trick)\b/.test(normalized)
    || normalized.includes('what is the answer')
    || normalized.includes('which option')
    || normalized.includes('help me with this question');
  const hasAcademicTopic =
    /\b(question|formula|equation|chapter|topic|concept|numerical|pyq|syllabus|physics|chemistry|math|mathematics|biology|jee|neet|cuet|bitsat|wbjee)\b/.test(normalized);
  const hasImageCue = /\b(image|screenshot|photo|attached)\b/.test(normalized);

  return (hasAcademicVerb && hasAcademicTopic) || (hasImageCue && hasAcademicTopic);
}

export function getSuggestedStudentAssistantActions(input: {
  message?: string;
  pathname?: string | null;
  limit?: number;
}): StudentAssistantAction[] {
  const message = String(input.message || '').toLowerCase();
  const limit = Math.max(1, Math.min(3, input.limit || 3));
  const pageContext = getStudentAssistantPageContext(input.pathname);
  const scoredActions = STUDENT_ASSISTANT_ACTIONS.map((action) => {
    let score = 0;

    action.keywords.forEach((keyword) => {
      if (message.includes(keyword)) {
        score += 3;
      }
    });

    if (pageContext.relatedActions.some((candidate) => candidate.id === action.id)) {
      score += 1;
    }

    if (message.includes(action.label.toLowerCase())) {
      score += 2;
    }

    return {
      action,
      score,
    };
  })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const matched = scoredActions.slice(0, limit).map((entry) => entry.action);
  if (matched.length >= limit) return matched;

  const relatedActions = pageContext.relatedActions.filter(
    (action) => !matched.some((matchedAction) => matchedAction.id === action.id)
  );

  return [...matched, ...relatedActions].slice(0, limit);
}

export function getStudentAssistantWorkflowResponse(input: {
  message: string;
}): StudentAssistantResponse | null {
  const normalizedMessage = String(input.message || '').trim().toLowerCase();
  if (!normalizedMessage) return null;

  const workflow = STUDENT_ASSISTANT_WORKFLOWS.find((candidate) =>
    candidate.patterns.some((pattern) => pattern.test(normalizedMessage))
  );

  if (!workflow) return null;

  return {
    answer: workflow.answer,
    suggestedActions: getStudentAssistantActionsByIds(workflow.actionIds),
  };
}

export function getStudentAssistantFallbackResponse(input: {
  message: string;
  pathname?: string | null;
}): StudentAssistantResponse {
  const message = String(input.message || '').trim().toLowerCase();
  const pageContext = getStudentAssistantPageContext(input.pathname);
  const workflowResponse = getStudentAssistantWorkflowResponse({ message });

  if (!message) {
    return {
      answer: `You are on ${pageContext.label}. ${pageContext.summary}`,
      suggestedActions: pageContext.relatedActions.slice(0, 3),
    };
  }

  if (workflowResponse) {
    return workflowResponse;
  }

  const topicMatch = FALLBACK_TOPICS.find((topic) =>
    topic.keywords.some((keyword) => message.includes(keyword))
  );

  if (topicMatch) {
    return {
      answer: topicMatch.answer,
      suggestedActions: getStudentAssistantActionsByIds(topicMatch.actionIds),
    };
  }

  if (message.includes('what can i do here') || message.includes('where am i') || message.includes('this page')) {
    return {
      answer: `${pageContext.label}: ${pageContext.summary}`,
      suggestedActions: pageContext.relatedActions.slice(0, 3),
    };
  }

  return {
    answer: `I can help with DCAM account use, navigation, subscriptions, teachers, batches, doubts, chat, and notices. Right now you are on ${pageContext.label}. ${pageContext.summary}`,
    suggestedActions: getSuggestedStudentAssistantActions({
      message,
      pathname: input.pathname,
      limit: 3,
    }),
  };
}
