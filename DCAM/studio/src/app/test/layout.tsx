
import type { Metadata } from 'next';
import { noIndexRobots } from '@/lib/site-metadata';

export const metadata: Metadata = {
  robots: noIndexRobots,
};

export default function TestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <main className="min-h-screen">{children}</main>
    </div>
  );
}
