import type { Metadata } from 'next';
import JsonLd from '@/components/json-ld';
import PublicMarketingPage from '@/components/public-marketing-page';
import {
  buildCollectionPageStructuredData,
  buildFaqStructuredData,
  buildOrganizationStructuredData,
  buildPageMetadata,
} from '@/lib/site-metadata';

const title = 'Online Coaching Platform for Teachers and Institutes';
const description =
  'Discover how DCAM Classes helps teachers and coaching teams run online courses, live batches, mock tests, notices, and structured student learning from one platform.';

const faqs = [
  {
    question: 'Is DCAM suitable for online coaching teachers?',
    answer:
      'Yes. DCAM is suitable for individual teachers and coaching-led teams that want to manage courses, batches, tests, notices, and student engagement in one platform.',
  },
  {
    question: 'Can teachers create courses and live batches on DCAM?',
    answer:
      'Yes. Teachers can create courses, schedule live batches, publish mock tests, and organize academic delivery through a single workflow.',
  },
  {
    question: 'Can coaching institutes use DCAM for student management?',
    answer:
      'DCAM supports structured learning delivery, communication, and student-facing program presentation, which makes it useful for organized coaching operations.',
  },
  {
    question: 'What makes DCAM helpful for online teaching?',
    answer:
      'DCAM brings content, classes, tests, notices, and student learning continuity together so teachers do not have to rely on scattered tools.',
  },
];

export const metadata: Metadata = buildPageMetadata({
  title: `${title} | DCAM Classes`,
  description,
  path: '/online-coaching-platform',
  keywords: [
    'online coaching platform',
    'coaching institute software',
    'teacher platform',
    'online teaching platform for exams',
    'coaching management platform',
  ],
});

export default function OnlineCoachingPlatformPage() {
  return (
    <>
      <JsonLd
        data={[
          buildOrganizationStructuredData(),
          buildCollectionPageStructuredData({
            title,
            description,
            path: '/online-coaching-platform',
          }),
          buildFaqStructuredData(faqs),
        ]}
      />
      <PublicMarketingPage
        badge="Coaching Platform"
        title="An online coaching platform for teachers, batches, courses, tests, and student guidance"
        description={description}
        highlights={[
          'Teachers can deliver learning, testing, and communication from one platform instead of separate tools.',
          'Students see a more organized academic journey with clear programs, classes, and follow-up.',
          'Public coaching-focused content now explains the real platform clearly for search discovery.',
        ]}
        featuresTitle="What teachers and coaching teams can do on DCAM"
        featuresDescription="DCAM is built to make online coaching delivery feel organized, professional, and easier to scale."
        features={[
          {
            title: 'Course Publishing',
            description: 'Teachers can create structured courses and arrange content into lessons, modules, and guided learning flow.',
          },
          {
            title: 'Live Batch Delivery',
            description: 'Live batches and scheduled classes help coaching teams deliver disciplined learning with better visibility.',
          },
          {
            title: 'Mock Tests and Practice',
            description: 'Teachers can publish mock tests and practice sessions that connect directly to the student learning path.',
          },
          {
            title: 'Teacher Discovery and Presence',
            description: 'The platform supports teacher-facing pages and listings so students can understand who they want to learn from.',
          },
          {
            title: 'Exam Notices and Communication',
            description: 'Bulletins, notices, and academic updates help teachers guide students at the right time during the exam cycle.',
          },
          {
            title: 'Learning Continuity',
            description: 'Students can move from course to batch to mock test without losing continuity, making the coaching experience smoother.',
          },
        ]}
        audiences={[
          {
            title: 'For Students',
            description: 'Students get a more reliable and organized coaching experience.',
            points: [
              'See the teacher, the program, and the learning path in one place.',
              'Move smoothly between classes, study content, practice, tests, and notices.',
              'Use one account to stay connected to the full coaching journey.',
            ],
          },
          {
            title: 'For Teachers',
            description: 'Teachers and institutes can operate online more professionally with less fragmentation.',
            points: [
              'Create courses, run live batches, publish tests, and communicate updates with one system.',
              'Present teaching programs clearly so students and parents understand the offering faster.',
              'Support more students without losing academic structure or follow-up quality.',
            ],
          },
        ]}
        faqs={faqs}
        primaryCta={{ href: '/teacher-registration', label: 'Start Teaching On DCAM' }}
        secondaryCta={{ href: '/student-registration', label: 'Register As Student' }}
        relatedLinks={[
          {
            href: '/jee-main-online-coaching',
            label: 'JEE Main Online Coaching',
            description: 'See how JEE Main preparation can be delivered through courses, batches, tests, and practice.',
          },
          {
            href: '/neet-online-coaching',
            label: 'NEET Online Coaching',
            description: 'Review how NEET preparation fits into the coaching and delivery workflows on DCAM.',
          },
          {
            href: '/mock-test-series',
            label: 'Mock Test Series',
            description: 'Understand the testing and analysis workflow teachers can provide through DCAM.',
          },
        ]}
      />
    </>
  );
}
