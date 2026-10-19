import type { Metadata } from 'next';
import { noIndexRobots } from '@/lib/site-metadata';

export const metadata: Metadata = {
  robots: noIndexRobots,
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-screen items-center justify-center bg-background p-4">{children}</div>;
}
