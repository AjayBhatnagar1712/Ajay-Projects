import type { Metadata } from 'next';
import MainLayoutShell from '@/components/main-layout-shell';
import { noIndexRobots } from '@/lib/site-metadata';

export const metadata: Metadata = {
  robots: noIndexRobots,
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayoutShell>{children}</MainLayoutShell>;
}
