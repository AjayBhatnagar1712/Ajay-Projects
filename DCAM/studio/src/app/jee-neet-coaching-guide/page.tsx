import type { Metadata } from 'next';
import JsonLd from '@/components/json-ld';
import PublicMarketingPage from '@/components/public-marketing-page';
import {
  absoluteUrl,
  buildBreadcrumbStructuredData,
  buildCollectionPageStructuredData,
  buildFaqStructuredData,
  buildOrganizationStructuredData,
  buildPageMetadata,
  siteConfig,
} from '@/lib/site-metadata';
import {
  seoFooterActions,
  seoHeaderActions,
  seoHeroPrimaryCta,
  seoHeroSecondaryCta,
  seoHeroTertiaryCta,
} from '@/lib/public-page-ctas';

const title = 'How to Choose the Best JEE Main and NEET Coaching: Online vs Offline';
const description =
  'Read a practical guide for choosing JEE Main or NEET coaching by comparing online and offline learning, mock tests, doubt support, revision systems, and student progress tracking.';

const faqs = [
  {
    question: 'What should students compare before choosing JEE Main or NEET coaching?',
    answer:
      'Students should compare subject depth, teacher quality, batch discipline, doubt support, mock-test quality, analysis workflows, revision systems, and whether the coaching format matches their schedule and study style.',
  },
  {
    question: 'Is online coaching better than offline coaching for JEE Main or NEET?',
    answer:
      'Not always. The better choice depends on the student. Online coaching may help with flexibility and continuity, while offline coaching may suit students who need physical classroom discipline. The best option is the one that helps the student stay consistent and improve through practice and review.',
  },
  {
    question: 'Why are mock tests and analysis important when choosing coaching?',
    answer:
      'Mock tests and analysis show whether a coaching system helps students improve speed, accuracy, attempt planning, and weak-area revision instead of only delivering lectures.',
  },
  {
    question: 'How does DCAM fit into JEE Main and NEET coaching decisions?',
    answer:
      'DCAM is an online preparation and coaching platform that supports courses, live batches, practice, mock tests, and structured preparation continuity for students and teachers.',
  },
];

export const metadata: Metadata = buildPageMetadata({
  title: `${title} | DCAM Classes`,
  description,
  path: '/jee-neet-coaching-guide',
  keywords: [
    'best JEE coaching',
    'best NEET coaching',
    'online vs offline coaching for JEE',
    'online vs offline coaching for NEET',
    'how to choose JEE coaching',
    'how to choose NEET coaching',
  ],
  type: 'article',
});

export default function JeeNeetCoachingGuidePage() {
  return (
    <>
      <JsonLd
        data={[
          buildOrganizationStructuredData(),
          buildCollectionPageStructuredData({
            title,
            description,
            path: '/jee-neet-coaching-guide',
          }),
          buildBreadcrumbStructuredData([
            { name: 'Home', path: '/' },
            { name: 'JEE and NEET Coaching Guide', path: '/jee-neet-coaching-guide' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: title,
            description,
            mainEntityOfPage: absoluteUrl('/jee-neet-coaching-guide'),
            inLanguage: 'en-IN',
            author: {
              '@type': 'Organization',
              name: siteConfig.name,
              url: siteConfig.url,
            },
            publisher: {
              '@type': 'Organization',
              name: siteConfig.name,
              url: siteConfig.url,
            },
          },
          buildFaqStructuredData(faqs),
        ]}
      />
      <PublicMarketingPage
        badge="Coaching Guide"
        title="How to choose the best JEE Main and NEET coaching: what to compare in online and offline options"
        description={description}
        highlights={[
          'Students should compare teaching quality, tests, doubt handling, and consistency support instead of judging only by advertisements.',
          'The right coaching system is the one that improves preparation discipline, not just the one with the loudest marketing claim.',
          'Online and offline coaching each have strengths, so students should choose based on fit, continuity, and measurable improvement.',
        ]}
        featuresTitle="What to compare before choosing coaching"
        featuresDescription="A good coaching decision usually comes from comparing real preparation support, not only popularity."
        features={[
          {
            title: 'Teacher and Subject Depth',
            description: 'Check whether students get strong concept teaching in the subjects that matter for their exam, not only surface-level lectures.',
          },
          {
            title: 'Mock Tests and Analysis',
            description: 'A strong coaching system should include tests, answer review, and performance analysis that lead to better decisions after each attempt.',
          },
          {
            title: 'Doubt Support',
            description: 'Students improve faster when doubts are cleared on time and confusion does not keep piling up before exams.',
          },
          {
            title: 'Revision and Practice Rhythm',
            description: 'Good coaching should support repeated revision, question practice, and a realistic study pace instead of only content delivery.',
          },
          {
            title: 'Online vs Offline Fit',
            description: 'Choose the mode that fits the student best. Some need classroom structure, while others perform better with flexible online continuity.',
          },
          {
            title: 'Progress Visibility',
            description: 'Look for a system that helps students and parents understand progress, weak areas, and where preparation needs stronger follow-up.',
          },
        ]}
        audiences={[
          {
            title: 'For Students',
            description: 'Students should choose coaching that makes consistency easier, not harder.',
            points: [
              'Pick the format that fits your schedule, attention style, and revision discipline.',
              'Look for coaching that supports practice, testing, and feedback in addition to classes.',
              'Choose a system that helps you continue preparation steadily over months, not only for a few weeks.',
            ],
          },
          {
            title: 'For Parents',
            description: 'Parents can use clear decision criteria instead of relying only on broad marketing claims.',
            points: [
              'Ask how the coaching handles tests, doubt support, and student follow-up after weak performance.',
              'Check whether the system helps students stay organized across classes, practice, and revision.',
              'Prefer coaching where progress can be tracked and preparation gaps can be identified early.',
            ],
          },
        ]}
        faqs={faqs}
        headerActions={seoHeaderActions}
        primaryCta={seoHeroPrimaryCta}
        secondaryCta={seoHeroSecondaryCta}
        tertiaryCta={seoHeroTertiaryCta}
        footerActions={seoFooterActions}
        relatedLinks={[
          {
            href: '/jee-main-online-coaching',
            label: 'JEE Main Online Coaching',
            description: 'Review DCAM support for PCM learning, tests, and organized JEE Main preparation.',
          },
          {
            href: '/neet-online-coaching',
            label: 'NEET Online Coaching',
            description: 'Explore how DCAM supports NEET preparation with PCB practice, batches, and mock tests.',
          },
          {
            href: '/engineering-and-medical-entrance-exam-preparation',
            label: 'Engineering and Medical Entrance Preparation',
            description: 'See the broader competitive-exam preparation ecosystem available on DCAM.',
          },
        ]}
      />
    </>
  );
}
