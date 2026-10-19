import { NextResponse } from 'next/server';
import {
  createNoticeSlug,
  type ExamOfficialLink,
  type NoticeCategory,
  type NoticeItem,
  type ExamSection,
  type NoticeBoardResponse,
  NOTICE_BOARD_DAILY_REVALIDATE_SECONDS,
  getNoticeBoardDateKey,
} from '@/lib/notice-board';

export const runtime = 'nodejs';
export const revalidate = 86400;

type ExamFeedSection = Omit<ExamSection, 'updates'> & {
  feedQuery: string;
  aliases: string[];
  excludedTerms?: string[];
  officialResultUrl?: string;
  archiveCurrentCycleAfterMonth?: number;
};

const GOOGLE_NEWS_RSS_BASE = 'https://news.google.com/rss/search';
const NOTICE_BOARD_RESPONSE_HEADERS = {
  'cache-control': `public, max-age=3600, s-maxage=${NOTICE_BOARD_DAILY_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
};

const EXAM_SECTIONS: ExamFeedSection[] = [
  {
    id: 'jee-main',
    examName: 'JEE Main',
    officialInfoUrl: 'https://jeemain.nta.nic.in/',
    officialApplyUrl: 'https://examinationservices.nic.in/jeemain',
    officialResultUrl: 'https://jeemain.nta.nic.in/',
    feedQuery: 'JEE Main',
    aliases: ['jee main', 'jee mains'],
    excludedTerms: ['jee advanced'],
    archiveCurrentCycleAfterMonth: 7,
  },
  {
    id: 'jee-advanced',
    examName: 'JEE Advanced',
    officialInfoUrl: 'https://jeeadv.ac.in/',
    officialApplyUrl: 'https://jeeadv.ac.in/',
    officialResultUrl: 'https://results.jeeadv.ac.in/',
    feedQuery: 'JEE Advanced',
    aliases: ['jee advanced'],
    archiveCurrentCycleAfterMonth: 7,
  },
  {
    id: 'neet-ug',
    examName: 'NEET UG',
    officialInfoUrl: 'https://neet.nta.nic.in/',
    officialApplyUrl: 'https://examinationservices.nic.in/neet',
    officialResultUrl: 'https://neet.nta.nic.in/',
    feedQuery: 'NEET UG',
    aliases: ['neet ug', 'neet-ug'],
  },
  {
    id: 'cuet-ug',
    examName: 'CUET UG',
    officialInfoUrl: 'https://cuet.nta.nic.in/',
    officialApplyUrl: 'https://examinationservices.nic.in/cuet',
    officialResultUrl: 'https://cuet.nta.nic.in/',
    feedQuery: 'CUET UG',
    aliases: ['cuet ug', 'cuet-ug'],
  },
  {
    id: 'viteee',
    examName: 'VITEEE',
    officialInfoUrl: 'https://viteee.vit.ac.in/',
    officialApplyUrl: 'https://viteee.vit.ac.in/',
    feedQuery: 'VITEEE',
    aliases: ['viteee'],
  },
  {
    id: 'bitsat',
    examName: 'BITSAT',
    officialInfoUrl: 'https://www.bitsadmission.com/',
    officialApplyUrl: 'https://www.bitsadmission.com/',
    feedQuery: 'BITSAT',
    aliases: ['bitsat'],
  },
  {
    id: 'wbjee',
    examName: 'WBJEE',
    officialInfoUrl: 'https://wbjeeb.nic.in/',
    officialApplyUrl: 'https://wbjeeb.nic.in/',
    feedQuery: 'WBJEE',
    aliases: ['wbjee'],
  },
  {
    id: 'comedk-uget',
    examName: 'COMEDK UGET',
    officialInfoUrl: 'https://www.comedk.org/',
    officialApplyUrl: 'https://www.comedk.org/',
    feedQuery: 'COMEDK UGET',
    aliases: ['comedk uget', 'comedk'],
  },
  {
    id: 'srmjeee',
    examName: 'SRMJEEE',
    officialInfoUrl: 'https://applications.srmist.edu.in/',
    officialApplyUrl: 'https://applications.srmist.edu.in/',
    feedQuery: 'SRMJEEE',
    aliases: ['srmjeee'],
  },
  {
    id: 'met-manipal',
    examName: 'MET (Manipal)',
    officialInfoUrl: 'https://manipal.edu/mu/admission.html',
    officialApplyUrl: 'https://apply.manipal.edu/',
    feedQuery: 'Manipal MET',
    aliases: ['manipal met', 'manipal entrance test'],
  },
  {
    id: 'nda',
    examName: 'NDA',
    officialInfoUrl: 'https://www.upsc.gov.in/',
    officialApplyUrl: 'https://upsconline.nic.in/',
    feedQuery: 'NDA exam',
    aliases: ['nda exam', 'nda 1', 'nda 2', 'nda 20', 'national defence academy'],
  },
  {
    id: 'cbse-class-12',
    examName: 'CBSE Class 12',
    officialInfoUrl: 'https://www.cbse.gov.in/',
    officialApplyUrl: 'https://www.cbse.gov.in/',
    feedQuery: 'CBSE Class 12',
    aliases: ['cbse class 12', 'cbse 12th'],
  },
];

function buildFeedUrl(query: string) {
  const currentYear = new Date().getFullYear();
  const params = new URLSearchParams({
    q: `${query} (${currentYear} OR ${currentYear + 1}) (registration OR \"admit card\" OR \"answer key\" OR result OR counselling OR schedule) when:45d`,
    hl: 'en-IN',
    gl: 'IN',
    ceid: 'IN:en',
  });
  return `${GOOGLE_NEWS_RSS_BASE}?${params.toString()}`;
}

function decodeEntities(raw: string) {
  return raw
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(raw: string) {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTagValue(itemXml: string, tag: string) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = itemXml.match(regex);
  return stripHtml(decodeEntities(match?.[1] || ''));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function detectDates(text: string) {
  const compact = text.replace(/\s+/g, ' ');
  const numeric = compact.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g) || [];
  const longMonth =
    compact.match(
      /\b\d{1,2}\s+(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{4}\b/gi
    ) || [];
  const monthFirst =
    compact.match(
      /\b(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{1,2},\s+\d{4}\b/gi
    ) || [];

  return unique([...numeric, ...longMonth, ...monthFirst]);
}

function inferDateByContext(text: string, keywords: RegExp) {
  const normalized = text.replace(/\s+/g, ' ');
  const contextRegex = new RegExp(
    `${keywords.source}[^.\\n]{0,110}?(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{1,2}\\s+(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\\s+\\d{4}|(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\\s+\\d{1,2},\\s+\\d{4})`,
    'i'
  );
  return normalized.match(contextRegex)?.[1];
}

function tryParseDate(input: string) {
  if (!input) return null;

  const normalized = input.trim().replace(/\s+/g, ' ');
  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) return direct;

  const slash = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!slash) return null;

  const day = Number(slash[1]);
  const month = Number(slash[2]) - 1;
  const year = slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3]);
  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function looksWithinDeadline(formCloseDate?: string) {
  if (!formCloseDate) return true;

  const parsed = tryParseDate(formCloseDate);
  if (!parsed) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return parsed.getTime() >= today.getTime();
}

function daysSince(value?: string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - parsed.getTime()) / (24 * 60 * 60 * 1000));
}

function isCurrentExamCycle(text: string, section: ExamFeedSection) {
  const currentYear = new Date().getFullYear();
  const years = Array.from(text.matchAll(/\b(20\d{2})\b/g), (match) => Number(match[1]));
  const currentMonth = new Date().getMonth() + 1;
  const minimumYear = section.archiveCurrentCycleAfterMonth && currentMonth > section.archiveCurrentCycleAfterMonth
    ? currentYear + 1
    : currentYear;
  return years.length === 0 || years.some((year) => year >= minimumYear && year <= currentYear + 1);
}

function matchesExam(text: string, section: ExamFeedSection) {
  const normalized = text.toLowerCase();
  const firstAliasPosition = section.aliases.reduce((closest, alias) => {
    const position = normalized.indexOf(alias);
    return position >= 0 ? Math.min(closest, position) : closest;
  }, Number.POSITIVE_INFINITY);
  const includesExcludedTerm = (section.excludedTerms || []).some((term) => normalized.includes(term));
  return firstAliasPosition <= 20 && !includesExcludedTerm;
}

function inferCategory(text: string): NoticeCategory | null {
  const normalized = text.toLowerCase();
  const candidates: Array<[NoticeCategory, RegExp]> = [
    ['registration', /\b(registration|application form|apply now|application window|form filling)\b/],
    ['admit-card', /\b(admit card|hall ticket|city intimation)\b/],
    ['answer-key', /\b(answer key|response sheet|recorded response)\b/],
    ['result', /\b(result|scorecard|score card|rank card|rankcard)\b/],
    ['counselling', /\b(counselling|counseling|seat allotment|choice filling)\b/],
    ['schedule', /\b(exam date|schedule|datesheet|date sheet|timetable|time table)\b/],
  ];

  return candidates
    .map(([category, pattern]) => ({ category, position: normalized.search(pattern) }))
    .filter((candidate) => candidate.position >= 0)
    .sort((left, right) => left.position - right.position)[0]?.category || null;
}

function relativeDeadlineHasPassed(text: string, publishedAt?: string) {
  const normalized = text.toLowerCase();
  const age = daysSince(publishedAt);
  if (/\b(today|tomorrow|last chance|ends soon|closing soon)\b/.test(normalized) && age > 2) return true;

  const closesInDays = normalized.match(/\b(?:closes|ends)\s+in\s+(\d{1,2})\s+days?\b/);
  return closesInDays ? age > Number(closesInDays[1]) + 1 : false;
}

function cleanFeedTitle(title: string, source?: string) {
  if (!source) return title.trim();
  return title.replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*$`, 'i'), '').trim();
}

function buildDcamSummary(examName: string, category: NoticeCategory, formCloseDate?: string) {
  const categoryCopy: Record<NoticeCategory, string> = {
    registration: 'registration and application window',
    'admit-card': 'admit card and exam access',
    'answer-key': 'answer key and response review',
    result: 'result and scorecard',
    counselling: 'counselling and admission process',
    schedule: 'exam schedule and important dates',
    notice: 'official examination notice',
  };
  const deadline = formCloseDate ? ` The detected deadline is ${formCloseDate}.` : '';
  return `DCAM exam desk update on the ${examName} ${categoryCopy[category]}.${deadline} Use the official links on this page before taking action.`;
}

function isLikelyOpenApplication(text: string) {
  const normalized = text.toLowerCase();

  const openSignals = [
    'application open',
    'applications open',
    'registration open',
    'registration started',
    'registration begins',
    'registration began',
    'application started',
    'application begins',
    'apply now',
    'online application',
    'form filling started',
    'forms available',
    'registration live',
    'application live',
    'extended till',
    'extended to',
    'application window open',
  ];

  const closedSignals = [
    'registration closed',
    'application closed',
    'window closed',
    'last date over',
    'deadline passed',
    'admit card',
    'answer key',
    'result declared',
    'results declared',
    'counselling',
    'counseling',
    'exam city intimation',
    'seat allotment',
    'answer-key',
  ];

  const hasOpenSignal = openSignals.some((signal) => normalized.includes(signal));
  const hasClosedSignal = closedSignals.some((signal) => normalized.includes(signal));
  return hasOpenSignal && !hasClosedSignal;
}

function parseRss(xml: string, maxItems: number, section: ExamFeedSection): NoticeItem[] {
  const items: NoticeItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null = itemRegex.exec(xml);

  while (match && items.length < maxItems) {
    const itemXml = match[1];
    const title = getTagValue(itemXml, 'title');
    const link = getTagValue(itemXml, 'link');
    const description = getTagValue(itemXml, 'description');
    const publishedAt = getTagValue(itemXml, 'pubDate');
    const source = getTagValue(itemXml, 'source');
    const combined = `${title}. ${description}`;
    const detectedDates = detectDates(combined);
    const formStartDate = inferDateByContext(
      combined,
      /(registration\s+start|registration\s+open|application\s+start|application\s+open|form\s+start|from)\b/i
    );
    const formCloseDate = inferDateByContext(
      combined,
      /(last\s+date|closing\s+date|deadline|form\s+close|till|extended\s+to|apply\s+till)\b/i
    );

    const category = inferCategory(combined);
    const recentlyPublished = daysSince(publishedAt) <= 45;
    const registrationIsOpen = category !== 'registration' || isLikelyOpenApplication(combined) || Boolean(formCloseDate);
    const relevant = Boolean(category) && matchesExam(combined, section) && isCurrentExamCycle(combined, section);

    if (
      title &&
      link &&
      category &&
      relevant &&
      recentlyPublished &&
      registrationIsOpen &&
      looksWithinDeadline(formCloseDate) &&
      !relativeDeadlineHasPassed(combined, publishedAt)
    ) {
      const cleanTitle = cleanFeedTitle(title, source);
      items.push({
        title: cleanTitle,
        link,
        slug: createNoticeSlug(cleanTitle, publishedAt),
        category,
        source,
        publishedAt,
        summary: buildDcamSummary(section.examName, category, formCloseDate),
        detectedDates,
        formStartDate,
        formCloseDate,
      });
    }

    match = itemRegex.exec(xml);
  }

  return items;
}

function dedupeByLink(items: NoticeItem[]) {
  const seen = new Set<string>();
  const result: NoticeItem[] = [];

  for (const item of items) {
    if (seen.has(item.link)) continue;
    seen.add(item.link);
    result.push(item);
  }

  return result;
}

function buildOfficialLinks(section: ExamFeedSection): ExamOfficialLink[] {
  return [
    { id: 'notices', label: 'Official notices', url: section.officialInfoUrl },
    { id: 'registration', label: 'Registration portal', url: section.officialApplyUrl },
    { id: 'results', label: 'Result & scorecard', url: section.officialResultUrl || section.officialInfoUrl },
  ];
}

async function fetchFeedXml(url: string) {
  const response = await fetch(url, {
    next: { revalidate: NOTICE_BOARD_DAILY_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(10000),
    headers: {
      'user-agent': 'DCAM-NoticeBoard/1.3',
      accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Feed fetch failed: ${response.status}`);
  }

  return response.text();
}

async function buildSection(section: ExamFeedSection): Promise<ExamSection> {
  try {
    const xml = await fetchFeedXml(buildFeedUrl(section.feedQuery));
    const updates = dedupeByLink(parseRss(xml, 6, section)).sort((left, right) => {
      const leftDate = tryParseDate(left.formCloseDate || '')?.getTime() || Number.MAX_SAFE_INTEGER;
      const rightDate = tryParseDate(right.formCloseDate || '')?.getTime() || Number.MAX_SAFE_INTEGER;
      return leftDate - rightDate;
    });

    return {
      id: section.id,
      examName: section.examName,
      officialInfoUrl: section.officialInfoUrl,
      officialApplyUrl: section.officialApplyUrl,
      officialLinks: buildOfficialLinks(section),
      updates,
    };
  } catch {
    return {
      id: section.id,
      examName: section.examName,
      officialInfoUrl: section.officialInfoUrl,
      officialApplyUrl: section.officialApplyUrl,
      officialLinks: buildOfficialLinks(section),
      updates: [],
    };
  }
}

async function buildNoticeBoardPayload(): Promise<NoticeBoardResponse> {
  const builtSections = await Promise.all(EXAM_SECTIONS.map(buildSection));
  const sections = builtSections.filter((section) => section.updates.length > 0);

  return {
    automated: true,
    fetchedAt: new Date().toISOString(),
    cacheDate: getNoticeBoardDateKey(),
    revalidateSeconds: NOTICE_BOARD_DAILY_REVALIDATE_SECONDS,
    sections,
  };
}

export async function GET() {
  try {
    const payload = await buildNoticeBoardPayload();
    return NextResponse.json(payload, {
      headers: NOTICE_BOARD_RESPONSE_HEADERS,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        automated: true,
        fetchedAt: new Date().toISOString(),
        cacheDate: getNoticeBoardDateKey(),
        revalidateSeconds: NOTICE_BOARD_DAILY_REVALIDATE_SECONDS,
        sections: [],
        error: error?.message || 'Failed to fetch the daily exam bulletin.',
      },
      {
        status: 200,
        headers: NOTICE_BOARD_RESPONSE_HEADERS,
      }
    );
  }
}
