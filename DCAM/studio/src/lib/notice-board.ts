export type NoticeItem = {
  title: string;
  link: string;
  slug?: string;
  category?: NoticeCategory;
  source?: string;
  publishedAt?: string;
  summary?: string;
  detectedDates: string[];
  formStartDate?: string;
  formCloseDate?: string;
};

export type NoticeCategory =
  | 'registration'
  | 'admit-card'
  | 'answer-key'
  | 'result'
  | 'counselling'
  | 'schedule'
  | 'notice';

export type ExamOfficialLink = {
  id: 'notices' | 'registration' | 'results';
  label: string;
  url: string;
};

export type ExamSection = {
  id: string;
  examName: string;
  officialInfoUrl: string;
  officialApplyUrl: string;
  officialLinks?: ExamOfficialLink[];
  updates: NoticeItem[];
};

export type NoticeBoardResponse = {
  automated: boolean;
  fetchedAt: string;
  cacheDate: string;
  revalidateSeconds: number;
  sections: ExamSection[];
  error?: string;
};

export const NOTICE_BOARD_LOCAL_STORAGE_KEY = 'dcam-notice-board-cache-v2';
export const NOTICE_BOARD_TIME_ZONE = 'Asia/Kolkata';
export const NOTICE_BOARD_DAILY_REVALIDATE_SECONDS = 24 * 60 * 60;

export function createNoticeSlug(title: string, publishedAt?: string) {
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 76)
    .replace(/-+$/g, '');
  const dateKey = publishedAt && !Number.isNaN(new Date(publishedAt).getTime())
    ? new Date(publishedAt).toISOString().slice(0, 10)
    : 'update';

  return `${titleSlug || 'exam-update'}-${dateKey}`;
}

export function getNoticeArticlePath(examId: string, item: Pick<NoticeItem, 'title' | 'slug' | 'publishedAt'>) {
  return `/exam-bulletin/${encodeURIComponent(examId)}/${encodeURIComponent(
    item.slug || createNoticeSlug(item.title, item.publishedAt)
  )}`;
}

export function getNoticeBoardDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NOTICE_BOARD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isNoticeBoardFreshForToday(
  value: Pick<NoticeBoardResponse, 'cacheDate'> | null | undefined,
  now = new Date()
) {
  return value?.cacheDate === getNoticeBoardDateKey(now);
}
