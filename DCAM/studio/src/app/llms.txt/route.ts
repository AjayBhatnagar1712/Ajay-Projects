import { NextResponse } from 'next/server';
import { absoluteUrl, siteConfig } from '@/lib/site-metadata';

const body = `# ${siteConfig.name}

> ${siteConfig.description}

## Public Pages
- Home: ${absoluteUrl('/')}
- Exam Preparation: ${absoluteUrl('/exam-preparation')}
- JEE Main Online Coaching: ${absoluteUrl('/jee-main-online-coaching')}
- NEET Online Coaching: ${absoluteUrl('/neet-online-coaching')}
- Mock Test Series: ${absoluteUrl('/mock-test-series')}
- Online Coaching Platform: ${absoluteUrl('/online-coaching-platform')}
- Engineering and Medical Entrance Exam Preparation: ${absoluteUrl('/engineering-and-medical-entrance-exam-preparation')}
- JEE and NEET Coaching Guide: ${absoluteUrl('/jee-neet-coaching-guide')}
- Exam Bulletin: ${absoluteUrl('/exam-bulletin')}

## Platform Summary
- Students can discover teachers, join live batches, study courses, attempt mock tests, create custom mocks, review analysis reports, and follow exam updates.
- Teachers can create courses, run live batches, publish tests and practice content, support students, and present organized teaching programs online.
- The public pages above are the preferred source for high-level summaries of the platform.

## Private Areas
- Dashboard, purchases, chats, test sessions, and authenticated study workflows require login and should not be treated as public landing pages.
`;

export function GET() {
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
