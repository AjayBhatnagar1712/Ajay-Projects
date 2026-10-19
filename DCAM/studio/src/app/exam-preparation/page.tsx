import type { Metadata } from 'next';
import JsonLd from '@/components/json-ld';
import PublicMarketingPage from '@/components/public-marketing-page';
import {
  buildCollectionPageStructuredData,
  buildFaqStructuredData,
  buildOrganizationStructuredData,
  buildPageMetadata,
} from '@/lib/site-metadata';

const title = 'Online Exam Preparation Platform';
const description =
  'Explore how DCAM Classes supports online exam preparation with structured courses, live batches, daily practice, teacher discovery, mock tests, and organized progress tracking.';

const faqs = [
  {
    question: 'How does DCAM support exam preparation?',
    answer:
      'DCAM supports exam preparation through teacher-led courses, live batches, practice sessions, mock tests, exam bulletins, and organized progress tracking in one platform.',
  },
  {
    question: 'Can students use DCAM for different competitive exams?',
    answer:
      'Yes. DCAM is built for multiple exam categories and helps students follow structured study flows with learning content, tests, and revision support.',
  },
  {
    question: 'Does DCAM help students find teachers and batches?',
    answer:
      'Yes. Students can discover teachers, explore learning programs, join relevant live batches, and continue preparation in a more organized way.',
  },
  {
    question: 'Is DCAM only for self-study?',
    answer:
      'No. DCAM combines self-study tools with teacher-led learning, so students can use courses, classes, practice, mock tests, and doubt support together.',
  },
];

export const metadata: Metadata = buildPageMetadata({
  title: `${title} | DCAM Classes`,
  description,
  path: '/exam-preparation',
  keywords: [
    'online exam preparation platform',
    'study app for competitive exams',
    'online study platform',
    'coaching classes online',
    'exam preparation website',
  ],
});

export default function ExamPreparationPage() {
  return (
    <>
      <JsonLd
        data={[
          buildOrganizationStructuredData(),
          buildCollectionPageStructuredData({
            title,
            description,
            path: '/exam-preparation',
          }),
          buildFaqStructuredData(faqs),
        ]}
      />
      <PublicMarketingPage
        badge="Exam Preparation"
        title="A structured online exam preparation platform for students, teachers, and coaching-led learning"
        description={description}
        highlights={[
          'Courses, live batches, practice, and tests stay connected in one learning flow.',
          'Students can prepare with teacher guidance instead of switching between disconnected tools.',
          'Public-facing platform pages now explain the real exam workflow clearly for search and AI discovery.',
        ]}
        featuresTitle="How the preparation journey works on DCAM"
        featuresDescription="DCAM is built to make exam preparation organized, measurable, and easier to continue every day."
        features={[
          {
            title: 'Teacher Discovery',
            description: 'Students can discover teachers and choose the right academic support for their exam goal and subject needs.',
          },
          {
            title: 'Courses and Learning Paths',
            description: 'Courses can be arranged into modules and learning steps so preparation feels structured instead of scattered.',
          },
          {
            title: 'Live Batches',
            description: 'Students can join live batches and scheduled classes for discipline, continuity, and guided revision.',
          },
          {
            title: 'Daily Practice',
            description: 'Practice sessions and question banks help students keep a steady preparation rhythm outside class hours.',
          },
          {
            title: 'Mock Tests and Review',
            description: 'Regular tests, custom mocks, and solution review help students improve speed, accuracy, and confidence.',
          },
          {
            title: 'Exam Updates',
            description: 'Important notices, deadlines, and bulletin updates help students stay aligned with real exam timelines.',
          },
        ]}
        audiences={[
          {
            title: 'For Students',
            description: 'Students can use DCAM as a complete study and exam-preparation workspace.',
            points: [
              'Join the right course or live batch without losing track of your exam plan.',
              'Attempt mock tests, review solutions, and continue daily practice in one account.',
              'Stay informed with exam bulletins, notices, and timeline-based preparation support.',
            ],
          },
          {
            title: 'For Teachers',
            description: 'Teachers can create a more organized learning experience instead of managing everything manually.',
            points: [
              'Build courses, batches, practice sets, and tests with exam-focused structure.',
              'Present your teaching programs professionally to students looking for guidance.',
              'Support students through content, live classes, updates, and measurable progress review.',
            ],
          },
        ]}
        faqs={faqs}
        primaryCta={{ href: '/student-registration', label: 'Start As Student' }}
        secondaryCta={{ href: '/teacher-registration', label: 'Join As Teacher' }}
        relatedLinks={[
          {
            href: '/jee-main-online-coaching',
            label: 'JEE Main Online Coaching',
            description: 'Explore the JEE Main-focused preparation flow on DCAM for PCM learning, tests, and continuity.',
          },
          {
            href: '/neet-online-coaching',
            label: 'NEET Online Coaching',
            description: 'Review how DCAM supports PCB learning, tests, and NEET preparation continuity.',
          },
          {
            href: '/online-coaching-platform',
            label: 'Online Coaching Platform',
            description: 'Explore the teaching and delivery side of DCAM for classes, batches, and content.',
          },
        ]}
      />
    </>
  );
}
