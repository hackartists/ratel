import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@ratel/ts-bridges/runtime";

// One client per page load. Defaults stay close to how the Dioxus loaders
// behave: data loads once per mount, no refetch on window focus, and auth
// failures surface immediately instead of being retried.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}
