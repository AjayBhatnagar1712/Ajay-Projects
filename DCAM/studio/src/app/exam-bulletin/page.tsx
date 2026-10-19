import type { Metadata } from 'next';
import JsonLd from '@/components/json-ld';
import ExamBulletinContent from '@/components/exam-bulletin-content';
import {
  buildCollectionPageStructuredData,
  buildFaqStructuredData,
  buildOrganizationStructuredData,
  buildPageMetadata,
} from '@/lib/site-metadata';

const title = 'Exam Bulletin, Notices, and Deadline Updates';
const description =
  'Browse the live DCAM Classes exam bulletin for exam notices, application windows, and important deadline updates in one organized view.';

const faqs = [
  {
    question: 'What is the DCAM exam bulletin?',
    answer:
      'The DCAM exam bulletin is a live bulletin page that helps students track important exam notices, application windows, and deadline-related updates.',
  },
  {
    question: 'Can I view the exam bulletin without logging in?',
    answer:
      'Yes. Guests can open the public exam bulletin page, while signed-in learners are taken to the in-app bulletin inside their DCAM workspace.',
  },
  {
    question: 'How often does the exam bulletin refresh?',
    answer:
      'The bulletin refreshes once per day and then stays stable for the rest of the day so students do not trigger a full reload every time they open it.',
  },
  {
    question: 'What happens after I log in?',
    answer:
      'After login, the bulletin is available inside the DCAM app experience along with courses, practice, mock tests, batches, and the rest of the student workspace.',
  },
];

export const metadata: Metadata = buildPageMetadata({
  title: `${title} | DCAM Classes`,
  description,
  path: '/exam-bulletin',
  keywords: [
    'exam bulletin',
    'exam notice updates',
    'application date updates',
    'exam deadline reminders',
    'student exam notifications',
  ],
});

export default function ExamBulletinPage() {
  return (
    <>
      <JsonLd
        data={[
          buildOrganizationStructuredData(),
          buildCollectionPageStructuredData({
            title,
            description,
            path: '/exam-bulletin',
          }),
          buildFaqStructuredData(faqs),
        ]}
      />
      <ExamBulletinContent mode="public" />
    </>
  );
}
