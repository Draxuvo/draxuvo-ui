import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../messages/es.json";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult & { queryClient: QueryClient } {
  const queryClient = createTestQueryClient();
  const result = render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    ),
  });
  return { ...result, queryClient };
}
