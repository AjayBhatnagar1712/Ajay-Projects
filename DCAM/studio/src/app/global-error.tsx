'use client';

import { useEffect } from 'react';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Global error boundary:', error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 space-y-3">
          <h1 className="text-2xl font-semibold">Application Error</h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred while rendering this page.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Reload Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
