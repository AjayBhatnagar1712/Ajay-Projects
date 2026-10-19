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

const title = 'Engineering and Medical Entrance Exam Preparation Platform';
const description =
  'Discover how DCAM Classes supports engineering and medical entrance exam preparation with online coaching workflows, live batches, courses, practice sessions, mock tests, and exam update support for JEE Main, NEET, and related goals.';

const faqs = [
  {
    question: 'Can students use DCAM for engineering and medical entrance exams?',
    answer:
      'Yes. DCAM supports engineering and medical entrance preparation through courses, live batches, practice sessions, mock tests, and teacher-guided learning workflows.',
  },
  {
    question: 'Does DCAM support JEE Main and NEET related preparation?',
    answer:
      'Yes. DCAM includes public preparation pages and platform workflows relevant to JEE Main, NEET, and other competitive-exam learning journeys.',
  },
  {
    question: 'Is DCAM only for test practice?',
    answer:
      'No. DCAM combines learning content, batch-based teaching, practice, tests, and progress continuity instead of offering only isolated mock tests.',
  },
  {
    question: 'Can teachers and coaching teams run exam programs on DCAM?',
    answer:
      'Yes. Teachers and coaching teams can create courses, live batches, tests, and student support workflows for competitive exam preparation.',
  },
];

export const metadata: Metadata = buildPageMetadata({
  title: `${title} | DCAM Classes`,
  description,
  path: '/engineering-and-medical-entrance-exam-preparation',
  keywords: [
    'engineering entrance exam preparation',
    'medical entrance exam preparation',
    'JEE Main preparation platform',
    'NEET preparation platform',
    'competitive exam coaching platform',
    'online coaching for engineering and medical exams',
  ],
});

export default function EngineeringAndMedicalEntranceExamPreparationPage() {
  return (
    <>
      <JsonLd
        data={[
          buildOrganizationStructuredData(),
          buildCollectionPageStructuredData({
            title,
            description,
            path: '/engineering-and-medical-entrance-exam-preparation',
          }),
          buildServiceStructuredData({
            name: title,
            description,
            path: '/engineering-and-medical-entrance-exam-preparation',
            serviceType: 'Engineering and medical entrance exam preparation platform',
            audienceType: 'Students, teachers, and coaching teams working on engineering and medical entrance exams',
          }),
          buildBreadcrumbStructuredData([
            { name: 'Home', path: '/' },
            {
              name: 'Engineering and Medical Entrance Exam Preparation',
              path: '/engineering-and-medical-entrance-exam-preparation',
            },
          ]),
          buildFaqStructuredData(faqs),
        ]}
      />
      <PublicMarketingPage
        badge="Engineering & Medical Exams"
        title="An online preparation platform for engineering and medical entrance exam journeys"
        description={description}
        highlights={[
          'Students preparing for competitive exams need classes, practice, mock tests, and guidance to stay connected instead of fragmented.',
          'Engineering and medical entrance preparation becomes easier to continue when learning and testing live inside one system.',
          'DCAM supports coaching-led delivery as well as student-side preparation workflows for major competitive goals.',
        ]}
        featuresTitle="How exam preparation stays organized on DCAM"
        featuresDescription="DCAM is built to reduce fragmentation and help students continue preparation with better structure."
        features={[
          {
            title: 'Exam-Focused Programs',
            description: 'Teachers can publish programs aligned to engineering and medical entrance goals instead of generic teaching flows.',
          },
          {
            title: 'Courses and Batches',
            description: 'Students can move between courses and live batches without losing continuity in the study journey.',
          },
          {
            title: 'Practice and Tests',
            description: 'Daily practice, mock tests, and custom test flows help students improve question handling and readiness.',
          },
          {
            title: 'Performance Review',
            description: 'Analysis workflows help students and teachers understand weak areas and plan follow-up more clearly.',
          },
          {
            title: 'Exam Updates',
            description: 'Bulletin-style support helps students stay aware of important notices and deadlines while preparing.',
          },
          {
            title: 'Coaching Visibility',
            description: 'Teachers and institutes can present their exam programs more clearly to students and parents looking for guidance.',
          },
        ]}
        audiences={[
          {
            title: 'For Students',
            description: 'Students can use one platform for the broader competitive-exam preparation journey.',
            points: [
              'Follow a connected path from learning to practice to testing and revision.',
              'Use exam-specific preparation pages to understand where JEE Main and NEET support fit on DCAM.',
              'Stay organized with batches, practice history, tests, and important exam updates in one account.',
            ],
          },
          {
            title: 'For Teachers',
            description: 'Teachers and institutes can run more organized entrance-exam coaching programs.',
            points: [
              'Create course and batch experiences that match engineering and medical entrance exam goals.',
              'Support students with practice, tests, analysis, and academic communication through one system.',
              'Present your coaching offering more professionally for students comparing options online.',
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
            description: 'See how DCAM supports PCM learning, testing, and JEE Main preparation continuity.',
          },
          {
            href: '/neet-online-coaching',
            label: 'NEET Online Coaching',
            description: 'Explore how PCB learning, mock tests, and online coaching workflows support NEET aspirants.',
          },
          {
            href: '/jee-neet-coaching-guide',
            label: 'JEE and NEET Coaching Guide',
            description: 'Read a practical guide on choosing online or offline coaching support.',
          },
        ]}
      />
    </>
  );
}
