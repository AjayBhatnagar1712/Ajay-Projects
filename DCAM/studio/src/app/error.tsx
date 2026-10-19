'use client';

import { useEffect } from 'react';

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: AppErrorProps) {
  useEffect(() => {
    console.error('Route error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          The page failed to load. Try again once.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
