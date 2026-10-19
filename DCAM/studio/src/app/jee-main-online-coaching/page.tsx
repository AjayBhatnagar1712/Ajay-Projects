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

const title = 'JEE Main Online Coaching, Mock Tests, and Practice';
const description =
  'Explore how DCAM Classes supports JEE Main preparation with online coaching workflows, Physics Chemistry Mathematics practice, live batches, mock tests, and organized student progress tracking.';

const faqs = [
  {
    question: 'Is DCAM Classes useful for JEE Main preparation?',
    answer:
      'Yes. DCAM Classes supports JEE Main preparation with teacher-led learning, live batches, mock tests, practice sessions, and a more organized preparation workflow.',
  },
  {
    question: 'Can students practice PCM topics for JEE Main on DCAM?',
    answer:
      'Yes. Students can prepare through practice sessions, mock tests, and teacher-guided learning that support Physics, Chemistry, and Mathematics preparation.',
  },
  {
    question: 'Does DCAM support both study and testing for JEE Main?',
    answer:
      'Yes. DCAM combines courses, batches, practice, mock tests, and follow-up support so students can continue JEE Main preparation in one platform.',
  },
  {
    question: 'Can teachers run JEE Main coaching programs on DCAM?',
    answer:
      'Yes. Teachers can create courses, run live batches, publish tests, and support JEE Main students through a more structured online coaching flow.',
  },
];

export const metadata: Metadata = buildPageMetadata({
  title: `${title} | DCAM Classes`,
  description,
  path: '/jee-main-online-coaching',
  keywords: [
    'JEE Main online coaching',
    'JEE Main preparation',
    'JEE Main mock tests',
    'JEE coaching platform',
    'online coaching for JEE Main',
    'Physics Chemistry Mathematics preparation',
  ],
});

export default function JeeMainOnlineCoachingPage() {
  return (
    <>
      <JsonLd
        data={[
          buildOrganizationStructuredData(),
          buildCollectionPageStructuredData({
            title,
            description,
            path: '/jee-main-online-coaching',
          }),
          buildServiceStructuredData({
            name: title,
            description,
            path: '/jee-main-online-coaching',
            serviceType: 'JEE Main online coaching and exam preparation platform',
            audienceType: 'Students preparing for JEE Main and teachers coaching JEE Main aspirants',
          }),
          buildBreadcrumbStructuredData([
            { name: 'Home', path: '/' },
            { name: 'JEE Main Online Coaching', path: '/jee-main-online-coaching' },
          ]),
          buildFaqStructuredData(faqs),
        ]}
      />
      <PublicMarketingPage
        badge="JEE Main"
        title="Online coaching, PCM practice, mock tests, and structured preparation support for JEE Main"
        description={description}
        highlights={[
          'JEE Main preparation works better when concepts, practice, and testing stay connected in one workflow.',
          'Students need speed, accuracy, revision discipline, and test review rather than only scattered study material.',
          'DCAM gives teachers and coaching teams a structured online setup for guiding JEE Main aspirants.',
        ]}
        featuresTitle="How JEE Main preparation works on DCAM"
        featuresDescription="The platform is designed to support disciplined PCM preparation, revision, testing, and coaching continuity."
        features={[
          {
            title: 'PCM Learning Flow',
            description: 'Teachers can organize JEE Main learning through Physics, Chemistry, and Mathematics focused courses and guided study paths.',
          },
          {
            title: 'Live Batches',
            description: 'Students can attend scheduled online classes and keep preparation disciplined through teacher-led batch learning.',
          },
          {
            title: 'Daily Practice',
            description: 'Practice sessions help students keep solving questions regularly instead of depending only on classroom learning.',
          },
          {
            title: 'Mock Tests',
            description: 'Mock tests help students improve speed, accuracy, and attempt strategy for the JEE Main pattern.',
          },
          {
            title: 'Analysis and Review',
            description: 'After tests, students can review answers, explanations, and performance trends to understand where marks are being lost.',
          },
          {
            title: 'Preparation Continuity',
            description: 'Courses, tests, practice, and updates stay in one account so students can continue preparation more consistently.',
          },
        ]}
        audiences={[
          {
            title: 'For Students',
            description: 'Students can prepare for JEE Main with a more organized online system.',
            points: [
              'Follow a connected path from learning to practice to mock-test review.',
              'Use live batches and teacher support to stay disciplined across PCM subjects.',
              'Track preparation progress without depending on disconnected apps or notes.',
            ],
          },
          {
            title: 'For Teachers',
            description: 'Teachers can run JEE Main coaching programs with clearer academic structure.',
            points: [
              'Create courses, run batches, and publish JEE Main-oriented tests in one place.',
              'Support students with ongoing practice, test analysis, and progress review.',
              'Present your coaching workflow more clearly to students and parents looking for online guidance.',
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
            href: '/neet-online-coaching',
            label: 'NEET Online Coaching',
            description: 'See how DCAM supports medical entrance preparation with PCB-focused learning and tests.',
          },
          {
            href: '/mock-test-series',
            label: 'Mock Test Series',
            description: 'Review how timed tests, solution analysis, and performance tracking work on DCAM.',
          },
          {
            href: '/jee-neet-coaching-guide',
            label: 'JEE and NEET Coaching Guide',
            description: 'Compare online and offline coaching factors before choosing the right preparation setup.',
          },
        ]}
      />
    </>
  );
}
