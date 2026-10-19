import type { Metadata } from 'next';

export const siteConfig = {
  name: 'DCAM Classes',
  shortName: 'DCAM',
  url: 'https://dcamclasses.in',
  locale: 'en_IN',
  logoPath: '/edu-cap-icon.svg?v=20260227',
  description:
    'DCAM Classes is an online exam preparation and coaching platform for students and teachers with courses, live batches, mock tests, daily practice, custom analysis, and guidance for JEE Main, NEET, engineering, medical, and other competitive exams.',
} as const;

export const defaultKeywords = [
  'DCAM Classes',
  'online exam preparation',
  'study platform',
  'online coaching',
  'online coaching institute',
  'coaching institute platform',
  'mock tests',
  'test series',
  'exam preparation app',
  'live batches',
  'online courses',
  'student learning platform',
  'teacher coaching platform',
  'competitive exam preparation',
  'JEE Main preparation',
  'NEET preparation',
  'engineering entrance exam preparation',
  'medical entrance exam preparation',
];

export const noIndexRobots: NonNullable<Metadata['robots']> = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};

export function absoluteUrl(path = '/') {
  return new URL(path, siteConfig.url).toString();
}

type BuildPageMetadataOptions = {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  noIndex?: boolean;
  type?: 'website' | 'article';
};

export function buildPageMetadata({
  title,
  description,
  path = '/',
  keywords = [],
  noIndex = false,
  type = 'website',
}: BuildPageMetadataOptions): Metadata {
  const url = absoluteUrl(path);

  return {
    title,
    description,
    keywords: Array.from(new Set([...defaultKeywords, ...keywords])),
    alternates: {
      canonical: url,
    },
    openGraph: {
      type,
      locale: siteConfig.locale,
      siteName: siteConfig.name,
      title,
      description,
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: noIndex
      ? noIndexRobots
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            noimageindex: false,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
  };
}

export type FaqItem = {
  question: string;
  answer: string;
};

export function buildOrganizationStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': ['EducationalOrganization', 'Organization'],
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl(siteConfig.logoPath),
    description: siteConfig.description,
    areaServed: 'India',
    inLanguage: 'en-IN',
    knowsAbout: [
      'Online exam preparation',
      'Mock tests',
      'Live batches',
      'Courses',
      'Practice sessions',
      'Teacher-led coaching',
      'JEE Main preparation',
      'NEET preparation',
      'Engineering entrance exams',
      'Medical entrance exams',
    ],
  };
}

export function buildWebSiteStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: 'en-IN',
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteConfig.url,
    },
  };
}

export function buildCollectionPageStructuredData({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url: absoluteUrl(path),
    description,
    inLanguage: 'en-IN',
    isPartOf: {
      '@type': 'WebSite',
      name: siteConfig.name,
      url: siteConfig.url,
    },
  };
}

export function buildWebPageStructuredData({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    url: absoluteUrl(path),
    description,
    inLanguage: 'en-IN',
    isPartOf: {
      '@type': 'WebSite',
      name: siteConfig.name,
      url: siteConfig.url,
    },
    about: {
      '@type': 'EducationalOrganization',
      name: siteConfig.name,
      url: siteConfig.url,
    },
  };
}

export function buildServiceStructuredData({
  name,
  description,
  path,
  serviceType,
  audienceType,
}: {
  name: string;
  description: string;
  path: string;
  serviceType: string;
  audienceType: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    url: absoluteUrl(path),
    description,
    serviceType,
    areaServed: 'India',
    provider: {
      '@type': 'EducationalOrganization',
      name: siteConfig.name,
      url: siteConfig.url,
    },
    audience: {
      '@type': 'Audience',
      audienceType,
    },
  };
}

export function buildBreadcrumbStructuredData(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildFaqStructuredData(faqItems: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export const publicSitemapEntries = [
  { path: '/', changeFrequency: 'weekly' as const, priority: 1 },
  { path: '/exam-preparation', changeFrequency: 'weekly' as const, priority: 0.95 },
  { path: '/jee-main-online-coaching', changeFrequency: 'weekly' as const, priority: 0.94 },
  { path: '/neet-online-coaching', changeFrequency: 'weekly' as const, priority: 0.94 },
  { path: '/mock-test-series', changeFrequency: 'weekly' as const, priority: 0.9 },
  { path: '/online-coaching-platform', changeFrequency: 'weekly' as const, priority: 0.9 },
  { path: '/engineering-and-medical-entrance-exam-preparation', changeFrequency: 'weekly' as const, priority: 0.89 },
  { path: '/jee-neet-coaching-guide', changeFrequency: 'weekly' as const, priority: 0.88 },
  { path: '/exam-bulletin', changeFrequency: 'daily' as const, priority: 0.85 },
  { path: '/student-enquiry', changeFrequency: 'monthly' as const, priority: 0.78 },
  { path: '/teacher-enquiry', changeFrequency: 'monthly' as const, priority: 0.78 },
  { path: '/login', changeFrequency: 'monthly' as const, priority: 0.74 },
  { path: '/signup', changeFrequency: 'monthly' as const, priority: 0.74 },
];
