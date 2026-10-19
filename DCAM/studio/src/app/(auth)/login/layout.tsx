import type { Metadata } from 'next';
import JsonLd from '@/components/json-ld';
import {
  buildOrganizationStructuredData,
  buildPageMetadata,
  buildWebPageStructuredData,
} from '@/lib/site-metadata';

const title = 'Login | DCAM Classes';
const description =
  'Log in to DCAM Classes to access your courses, exam bulletin, live batches, practice sessions, and mock tests.';

export const metadata: Metadata = buildPageMetadata({
  title,
  description,
  path: '/login',
  keywords: [
    'dcam classes login',
    'student login',
    'teacher login',
    'exam preparation login',
    'online coaching login',
  ],
});

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd
        data={[
          buildOrganizationStructuredData(),
          buildWebPageStructuredData({
            title,
            description,
            path: '/login',
          }),
        ]}
      />
      {children}
    </>
  );
}
