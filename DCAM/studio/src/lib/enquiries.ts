export type EnquiryType = 'student' | 'teacher';
export type EnquiryStatus = 'open' | 'resolved';
export type EnquirySource = 'website' | 'website_home' | 'student_help';
export type PreferredClassType = 'regular' | 'online' | 'both';
export type PlanToStart = 'immediate' | 'later';

export type EnquiryAttachment = {
  name: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
};

export type EnquiryAttachmentUploadTarget = {
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  attachment: Omit<EnquiryAttachment, 'sizeBytes'>;
};

export type EnquiryRecord = {
  id: string;
  enquiryType: EnquiryType;
  name: string;
  email: string;
  phoneNumber: string;
  message: string;
  attachments: EnquiryAttachment[];
  status: EnquiryStatus;
  createdAt: string;
  createdAtMs: number;
  resolvedAt?: string | null;
  resolvedAtMs?: number | null;
  resolvedBy?: string | null;
  resolvedByEmail?: string | null;
  source: EnquirySource;
  submittedByUserId?: string | null;
  submittedByRoleId?: 'student' | null;
  studentCoachingEnquiry?: {
    examTypeId: string;
    examName: string;
    classId: string;
    className: string;
    subjectIds: string[];
    subjectNames: string[];
    preferredClassType: PreferredClassType;
    planToStart: PlanToStart;
    preferredStartDate?: string | null;
  } | null;
};

export const MAX_ENQUIRY_ATTACHMENTS = 5;
type EnquiryAttachmentInput = {
  name: string;
  size: number;
};

export const enquiryTypeContent: Record<
  EnquiryType,
  {
    label: string;
    shortLabel: string;
    pageTitle: string;
    pageDescription: string;
    heroTag: string;
    submitLabel: string;
    successTitle: string;
    successMessage: string;
    homeDescription: string;
    href: string;
  }
> = {
  student: {
    label: 'Student Enquiry',
    shortLabel: 'Student',
    pageTitle: 'Student Enquiry',
    pageDescription: 'Share your question and we will review it from the student support side.',
    heroTag: 'Student support',
    submitLabel: 'Send student enquiry',
    successTitle: 'Student enquiry sent',
    successMessage: 'Your message is now in the DCAM support queue.',
    homeDescription: 'Account, access, purchases, batches, and platform help.',
    href: '/student-enquiry',
  },
  teacher: {
    label: 'Teacher Enquiry',
    shortLabel: 'Teacher',
    pageTitle: 'Teacher Enquiry',
    pageDescription: 'Share your question and we will review it from the teacher support side.',
    heroTag: 'Teacher support',
    submitLabel: 'Send teacher enquiry',
    successTitle: 'Teacher enquiry sent',
    successMessage: 'Your message is now in the DCAM support queue.',
    homeDescription: 'Onboarding, approval, content, batches, and account help.',
    href: '/teacher-enquiry',
  },
};

export function formatEnquiryFileSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '0 B';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateEnquiryAttachments(files: EnquiryAttachmentInput[]) {
  if (files.length > MAX_ENQUIRY_ATTACHMENTS) {
    return `Attach up to ${MAX_ENQUIRY_ATTACHMENTS} files only.`;
  }

  return '';
}

export function validateEnquiryMessage(message: string, hasAttachments: boolean) {
  const normalizedMessage = message.trim();

  if (!normalizedMessage && !hasAttachments) {
    return 'Write a message or attach a file.';
  }

  if (normalizedMessage.length > 4000) {
    return 'Message is too long.';
  }

  return '';
}

export function getPreferredClassTypeLabel(value?: PreferredClassType | null) {
  if (value === 'regular') return 'Regular classes';
  if (value === 'online') return 'Online classes';
  if (value === 'both') return 'Regular or online classes';
  return '';
}

export function getPlanToStartLabel(value?: PlanToStart | null) {
  if (value === 'immediate') return 'Immediate';
  if (value === 'later') return 'Later';
  return '';
}

export function formatEnquiryDate(value?: string | null) {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

export function sanitizeEnquiryFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120) || 'attachment';
}

export function getEnquirySourceLabel(source: EnquirySource) {
  if (source === 'student_help') {
    return 'Already Student';
  }
  if (source === 'website_home') {
    return 'Homepage';
  }

  return 'Website';
}
