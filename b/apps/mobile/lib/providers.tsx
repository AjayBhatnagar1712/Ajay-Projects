import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { PaperRoot } from "@/lib/ui/PaperRoot";

type Props = {
  children: ReactNode;
};

export function AppProviders({ children }: Props) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <PaperRoot>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PaperRoot>
  );
}
