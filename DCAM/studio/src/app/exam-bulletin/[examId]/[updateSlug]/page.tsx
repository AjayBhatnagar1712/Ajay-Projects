import type { Metadata } from 'next';
import ExamBulletinArticle from '@/components/exam-bulletin-article';
import { buildPageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Exam Update | DCAM Exam Bulletin',
  description: 'Read a current DCAM exam update and continue to verified official registration, notice, and result portals.',
  path: '/exam-bulletin',
  type: 'article',
  noIndex: true,
});

export default function ExamBulletinArticlePage() {
  return <ExamBulletinArticle />;
}
