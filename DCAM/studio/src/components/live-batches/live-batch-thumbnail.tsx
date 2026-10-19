'use client';

import { useEffect, useMemo, useState } from 'react';
import { ImageOff, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

type LiveBatchThumbnailVariant = 'card' | 'hero';

type LiveBatchThumbnailProps = {
  src?: string | null;
  alt: string;
  title?: string;
  subtitle?: string;
  className?: string;
  imageClassName?: string;
  variant?: LiveBatchThumbnailVariant;
  decorative?: boolean;
};

const containerStyles: Record<LiveBatchThumbnailVariant, string> = {
  card: 'h-48 sm:h-52',
  hero: 'min-h-[220px] sm:min-h-[260px] lg:min-h-[320px]',
};

const fallbackTextStyles: Record<LiveBatchThumbnailVariant, string> = {
  card: 'max-w-xs',
  hero: 'max-w-2xl',
};

export default function LiveBatchThumbnail({
  src,
  alt,
  title,
  subtitle,
  className,
  imageClassName,
  variant = 'card',
  decorative = false,
}: LiveBatchThumbnailProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const normalizedSrc = useMemo(() => (typeof src === 'string' ? src.trim() : ''), [src]);
  const showImage = normalizedSrc.length > 0 && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [normalizedSrc]);

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.24),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.22),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.94))]',
        containerStyles[variant],
        className,
      )}
    >
      {showImage ? (
        <>
          <img
            src={normalizedSrc}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.16),rgba(2,6,23,0.36)_72%,rgba(2,6,23,0.72))]" />
          <div className="relative flex h-full w-full items-center justify-center p-3 sm:p-4">
            <img
              src={normalizedSrc}
              alt={decorative ? '' : alt}
              aria-hidden={decorative ? 'true' : undefined}
              loading="lazy"
              onError={() => setImageFailed(true)}
              className={cn(
                'h-full w-full object-contain object-center drop-shadow-[0_20px_38px_rgba(2,6,23,0.55)]',
                imageClassName,
              )}
            />
          </div>
        </>
      ) : decorative ? (
        <>
          <div className="absolute -right-10 top-0 h-32 w-32 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.18),rgba(2,6,23,0.62)_78%,rgba(2,6,23,0.88))]" />
        </>
      ) : (
        <>
          <div className="absolute -right-10 top-0 h-32 w-32 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative flex h-full w-full items-center justify-center px-6 py-8 text-center">
            <div className={cn('space-y-3', fallbackTextStyles[variant])}>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100">
                <ImageOff className="h-6 w-6" />
              </div>
              <p className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/85">
                <Sparkles className="h-3.5 w-3.5" />
                Live Batch Cover
              </p>
              <div className="space-y-1.5">
                <p className="text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">
                  {title || 'Live Batch'}
                </p>
                {subtitle ? (
                  <p className="text-sm leading-6 text-slate-300">
                    {subtitle}
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-slate-300">
                    Thumbnail preview will appear here once the teacher uploads a live batch cover.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
