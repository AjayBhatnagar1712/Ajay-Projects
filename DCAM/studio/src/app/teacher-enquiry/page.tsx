import type { Metadata } from 'next';
import JsonLd from '@/components/json-ld';
import PublicEnquiryForm from '@/components/public-enquiry-form';
import {
  buildOrganizationStructuredData,
  buildPageMetadata,
  buildWebPageStructuredData,
} from '@/lib/site-metadata';

const title = 'Teacher Enquiry | DCAM Classes';
const description = 'Send a teacher enquiry to DCAM Classes for onboarding, approval, teaching tools, or platform help.';

export const metadata: Metadata = buildPageMetadata({
  title,
  description,
  path: '/teacher-enquiry',
  keywords: ['teacher enquiry', 'teacher support', 'dcam classes teacher help'],
});

export default function TeacherEnquiryPage() {
  return (
    <>
      <JsonLd
        data={[
          buildOrganizationStructuredData(),
          buildWebPageStructuredData({
            title,
            description,
            path: '/teacher-enquiry',
          }),
        ]}
      />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.12),_transparent_18%),linear-gradient(180deg,_#04101b_0%,_#081827_42%,_#08131f_100%)] px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="sr-only">{title}</h1>
          <PublicEnquiryForm enquiryType="teacher" />
        </div>
      </main>
    </>
  );
}
