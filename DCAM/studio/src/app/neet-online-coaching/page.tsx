import type { Metadata } from 'next';
import JsonLd from '@/components/json-ld';
import PublicMarketingPage from '@/components/public-marketing-page';
import {
  buildBreadcrumbStructuredData,
  buildCollectionPageStructuredData,
  buildFaqStructuredData,
  buildOrganizationStructuredData,
  buildPageMetadata,
  buildServiceStructuredData,
} from '@/lib/site-metadata';
import {
  seoFooterActions,
  seoHeaderActions,
  seoHeroPrimaryCta,
  seoHeroSecondaryCta,
  seoHeroTertiaryCta,
} from '@/lib/public-page-ctas';

const title = 'NEET Online Coaching, Mock Tests, and Practice';
const description =
  'Explore how DCAM Classes supports NEET preparation with online coaching workflows, Biology Chemistry Physics practice, live batches, mock tests, and organized progress tracking for medical aspirants.';

const faqs = [
  {
    question: 'Is DCAM Classes useful for NEET preparation?',
    answer:
      'Yes. DCAM Classes supports NEET preparation through teacher-led learning, practice sessions, live batches, mock tests, and organized revision support.',
  },
  {
    question: 'Can students prepare Biology, Chemistry, and Physics on DCAM?',
    answer:
      'Yes. Students can use courses, practice, tests, and batch-based guidance that support NEET preparation across Biology, Chemistry, and Physics.',
  },
  {
    question: 'Does DCAM help with NEET mock tests and analysis?',
    answer:
      'Yes. DCAM supports mock tests, answer review, solution explanations, and performance analysis so students can improve score-focused preparation.',
  },
  {
    question: 'Can teachers run NEET coaching programs on DCAM?',
    answer:
      'Yes. Teachers can create NEET-focused courses, live batches, tests, and academic guidance workflows on DCAM.',
  },
];

export const metadata: Metadata = buildPageMetadata({
  title: `${title} | DCAM Classes`,
  description,
  path: '/neet-online-coaching',
  keywords: [
    'NEET online coaching',
    'NEET preparation',
    'NEET mock tests',
    'medical entrance coaching',
    'online coaching for NEET',
    'Biology Chemistry Physics preparation',
  ],
});

export default function NeetOnlineCoachingPage() {
  return (
    <>
      <JsonLd
        data={[
          buildOrganizationStructuredData(),
          buildCollectionPageStructuredData({
            title,
            description,
            path: '/neet-online-coaching',
          }),
          buildServiceStructuredData({
            name: title,
            description,
            path: '/neet-online-coaching',
            serviceType: 'NEET online coaching and medical entrance exam preparation platform',
            audienceType: 'Students preparing for NEET and teachers coaching NEET aspirants',
          }),
          buildBreadcrumbStructuredData([
            { name: 'Home', path: '/' },
            { name: 'NEET Online Coaching', path: '/neet-online-coaching' },
          ]),
          buildFaqStructuredData(faqs),
        ]}
      />
      <PublicMarketingPage
        badge="NEET"
        title="Online coaching, PCB practice, mock tests, and structured preparation support for NEET"
        description={description}
        highlights={[
          'NEET preparation needs concept clarity, recall discipline, question practice, and repeated test review.',
          'Students should be able to move smoothly from learning to practice to score analysis instead of switching between scattered tools.',
          'DCAM gives teachers and coaching teams a structured online system for NEET-oriented learning delivery.',
        ]}
        featuresTitle="How NEET preparation works on DCAM"
        featuresDescription="The platform is designed to support Biology, Chemistry, and Physics preparation with stronger continuity and testing discipline."
        features={[
          {
            title: 'PCB Learning Flow',
            description: 'Teachers can organize NEET learning through subject-focused courses, modules, and revision-oriented guidance.',
          },
          {
            title: 'Live Batches',
            description: 'Students can attend scheduled online classes to maintain continuity and teacher-led academic discipline.',
          },
          {
            title: 'Question Practice',
            description: 'Regular practice sessions help students improve retention, accuracy, and confidence in NEET-style questions.',
          },
          {
            title: 'Mock Tests',
            description: 'Mock tests help students improve time use, score stability, and exam readiness before the actual NEET attempt.',
          },
          {
            title: 'Analysis and Review',
            description: 'Students can review their responses, learn from explanations, and identify weak areas that need revision.',
          },
          {
            title: 'Guided Continuity',
            description: 'Courses, practice, tests, and updates remain connected in one preparation flow instead of separate systems.',
          },
        ]}
        audiences={[
          {
            title: 'For Students',
            description: 'Students can prepare for NEET with a more focused and measurable workflow.',
            points: [
              'Study with teacher guidance while keeping practice and mock tests connected to the same account.',
              'Strengthen Biology, Chemistry, and Physics through repeated revision and test analysis.',
              'Reduce preparation confusion by keeping classes, tests, and progress in one platform.',
            ],
          },
          {
            title: 'For Teachers',
            description: 'Teachers can run NEET coaching programs with better structure and follow-up.',
            points: [
              'Create NEET-oriented courses, publish tests, and support batch-based medical entrance preparation.',
              'Guide students with practice, test analysis, and more organized revision workflows.',
              'Present your NEET coaching offering more clearly to students and parents looking for online support.',
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
            description: 'Explore DCAM support for engineering entrance preparation with PCM learning and tests.',
          },
          {
            href: '/mock-test-series',
            label: 'Mock Test Series',
            description: 'See how test attempts, solution review, and analysis reports support score improvement.',
          },
          {
            href: '/jee-neet-coaching-guide',
            label: 'JEE and NEET Coaching Guide',
            description: 'Compare online and offline coaching options before deciding what suits you best.',
          },
        ]}
      />
    </>
  );
}
