import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ThemeProvider } from '@/components/theme-provider';
import ChunkLoadRecovery from '@/components/chunk-load-recovery';
import RouteTransition from '@/components/route-transition';
import { absoluteUrl, buildPageMetadata, siteConfig } from '@/lib/site-metadata';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: 'DCAM Classes | Online Exam Preparation and Coaching Platform',
  description: siteConfig.description,
  applicationName: siteConfig.name,
  category: 'education',
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: absoluteUrl('/'),
  },
  openGraph: buildPageMetadata({
    title: 'DCAM Classes | Online Exam Preparation and Coaching Platform',
    description: siteConfig.description,
    path: '/',
  }).openGraph,
  twitter: buildPageMetadata({
    title: 'DCAM Classes | Online Exam Preparation and Coaching Platform',
    description: siteConfig.description,
    path: '/',
  }).twitter,
  robots: buildPageMetadata({
    title: 'DCAM Classes | Online Exam Preparation and Coaching Platform',
    description: siteConfig.description,
    path: '/',
  }).robots,
  icons: {
    icon: '/edu-cap-icon.svg?v=20260227',
    shortcut: '/edu-cap-icon.svg?v=20260227',
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0b1220" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <RouteTransition />
          <ChunkLoadRecovery />
          <FirebaseClientProvider>
            {children}
          </FirebaseClientProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
