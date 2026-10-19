import type { Metadata } from 'next';
import JsonLd from '@/components/json-ld';
import PublicEnquiryForm from '@/components/public-enquiry-form';
import {
  buildOrganizationStructuredData,
  buildPageMetadata,
  buildWebPageStructuredData,
} from '@/lib/site-metadata';

const title = 'Student Enquiry | DCAM Classes';
const description = 'Send a student enquiry to DCAM Classes for account, access, batches, purchases, or platform help.';

export const metadata: Metadata = buildPageMetadata({
  title,
  description,
  path: '/student-enquiry',
  keywords: ['student enquiry', 'dcam classes support', 'student help'],
});

type StudentEnquiryPageProps = {
  searchParams?: Promise<{
    source?: string;
  }>;
};

export default async function StudentEnquiryPage({ searchParams }: StudentEnquiryPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const isHomeEnquiry = resolvedSearchParams.source === 'home';

  return (
    <>
      <JsonLd
        data={[
          buildOrganizationStructuredData(),
          buildWebPageStructuredData({
            title,
            description,
            path: '/student-enquiry',
          }),
        ]}
      />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_18%),linear-gradient(180deg,_#04101b_0%,_#081827_42%,_#08131f_100%)] px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="sr-only">{title}</h1>
          <PublicEnquiryForm
            enquiryType="student"
            source={isHomeEnquiry ? 'website_home' : 'website'}
            variant={isHomeEnquiry ? 'home_student' : 'support'}
          />
        </div>
      </main>
    </>
  );
}
