import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site-metadata';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#050913',
    theme_color: '#0b1220',
    icons: [
      {
        src: '/edu-cap-icon.svg?v=20260227',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
