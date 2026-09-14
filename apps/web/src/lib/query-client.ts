import { QueryClient } from "@tanstack/react-query";

// One client per page load. Defaults stay close to how the Dioxus loaders
// behave: data loads once per mount, no refetch on window focus, and a failed
// load surfaces immediately — `use_loader` never retries, so neither do we.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 30_000,
        retry: false,
      },
      mutations: { retry: false },
    },
  });
}
