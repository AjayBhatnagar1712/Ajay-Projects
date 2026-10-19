import type { Metadata } from 'next';
import JsonLd from '@/components/json-ld';
import PublicMarketingPage from '@/components/public-marketing-page';
import {
  buildCollectionPageStructuredData,
  buildFaqStructuredData,
  buildOrganizationStructuredData,
  buildPageMetadata,
} from '@/lib/site-metadata';

const title = 'Online Mock Test Series and Custom Analysis';
const description =
  'Learn how DCAM Classes supports online mock test series with teacher-created tests, custom mock creation, answer review, solution images, and downloadable analysis reports.';

const faqs = [
  {
    question: 'Does DCAM offer online mock tests?',
    answer:
      'Yes. DCAM supports teacher-created mock tests, structured test attempts, answer review, and performance analysis for students preparing for exams.',
  },
  {
    question: 'Can students create custom mock tests on DCAM?',
    answer:
      'Yes. DCAM includes custom mock flows that let students build tests aligned to their preparation needs and then review detailed analysis afterward.',
  },
  {
    question: 'Does the test analysis include solutions?',
    answer:
      'Yes. DCAM test analysis can include correct answers, explanation text, solution images, and downloadable PDF reports for review.',
  },
  {
    question: 'Why are mock tests important on DCAM?',
    answer:
      'Mock tests help students measure speed, accuracy, subject-wise performance, and exam readiness while giving teachers a clearer way to guide improvement.',
  },
];

export const metadata: Metadata = buildPageMetadata({
  title: `${title} | DCAM Classes`,
  description,
  path: '/mock-test-series',
  keywords: [
    'online mock test series',
    'exam test series platform',
    'custom mock test',
    'test analysis report',
    'practice test with solutions',
  ],
});

export default function MockTestSeriesPage() {
  return (
    <>
      <JsonLd
        data={[
          buildOrganizationStructuredData(),
          buildCollectionPageStructuredData({
            title,
            description,
            path: '/mock-test-series',
          }),
          buildFaqStructuredData(faqs),
        ]}
      />
      <PublicMarketingPage
        badge="Mock Tests"
        title="Online mock tests, custom test creation, and detailed analysis reports in one exam workflow"
        description={description}
        highlights={[
          'Teacher-created tests and student custom mocks are both part of the same platform.',
          'Analysis reports help students review answers, explanations, and performance trends after every attempt.',
          'The mock-test page now gives search systems a clear public explanation of the real product capability.',
        ]}
        featuresTitle="How mock testing works on DCAM"
        featuresDescription="The platform is designed to make every test attempt more useful before, during, and after the exam session."
        features={[
          {
            title: 'Teacher-Created Tests',
            description: 'Teachers can publish structured mock tests aligned to exams, subjects, and student readiness levels.',
          },
          {
            title: 'Custom Mock Creation',
            description: 'Students can build custom mock tests based on their own preparation goals and teacher context.',
          },
          {
            title: 'Timed Test Experience',
            description: 'The test engine supports timed attempts, answer selection, review states, and exam-style navigation.',
          },
          {
            title: 'Solution Review',
            description: 'Students can review correct answers, explanation text, and attached solution images after submission.',
          },
          {
            title: 'Analysis PDF',
            description: 'Attempt analysis can be downloaded as a PDF for offline review, revision discussion, and future comparison.',
          },
          {
            title: 'Performance Tracking',
            description: 'Students and teachers can use attempt history and analysis patterns to identify where improvement is needed most.',
          },
        ]}
        audiences={[
          {
            title: 'For Students',
            description: 'Mock tests on DCAM are built to turn every attempt into a learning cycle.',
            points: [
              'Attempt full tests and custom mocks in a familiar exam-style interface.',
              'Review answers, solution explanations, and attached images after submitting the test.',
              'Use PDF analysis and attempt history to revise weak areas more systematically.',
            ],
          },
          {
            title: 'For Teachers',
            description: 'Teachers can publish tests and use the results to guide students with more precision.',
            points: [
              'Create exam-aligned mock tests that match the student preparation level.',
              'Support students with clear explanations and solution media inside the analysis flow.',
              'Use performance signals from attempts to plan revision, follow-up, and classroom focus.',
            ],
          },
        ]}
        faqs={faqs}
        primaryCta={{ href: '/signup', label: 'Create Account' }}
        secondaryCta={{ href: '/exam-preparation', label: 'View Exam Prep' }}
        relatedLinks={[
          {
            href: '/jee-main-online-coaching',
            label: 'JEE Main Online Coaching',
            description: 'See how mock tests connect to the wider JEE Main preparation journey on DCAM.',
          },
          {
            href: '/neet-online-coaching',
            label: 'NEET Online Coaching',
            description: 'Review how mock tests fit into the NEET preparation flow on DCAM.',
          },
          {
            href: '/exam-preparation',
            label: 'Exam Preparation Platform',
            description: 'See how tests fit into the wider preparation journey on DCAM.',
          },
        ]}
      />
    </>
  );
}
