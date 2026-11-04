import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import { getSubscription } from "@/services/subscription";
import { TrialBanner } from "./trial-banner";

vi.mock("next/navigation", () => ({ usePathname: () => "/es/inicio" }));
vi.mock("@/services/subscription", () => ({ getSubscription: vi.fn(), createPortal: vi.fn() }));

const subscription = vi.mocked(getSubscription);

type Sub = Awaited<ReturnType<typeof getSubscription>>;
const trial = (extra: Partial<Sub>) =>
  ({ status: "trialing", active_access: true, demo: false, managed_by_parent: false, ...extra }) as Sub;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  useAuthStore.setState({ user: { id: 1, role: "owner" } as never, role: "owner", selectedCompanyId: 7 });
});

// Spec 054: el encabezado y Suscripción cuentan los días de la prueba con la misma regla (la de la API).
describe("TrialBanner: días restantes", () => {
  it("usa trial_days_remaining de la API aunque falten menos de 30 días completos", async () => {
    // 29 días y 20 horas: antes el encabezado decía 29 (días completos) y Suscripción 30.
    vi.setSystemTime(new Date("2026-11-03T04:00:00Z"));
    subscription.mockResolvedValue(trial({ trial_ends_at: "2026-12-03T00:00:00Z", trial_days_remaining: 30 }));
    renderWithProviders(<TrialBanner />);

    expect(await screen.findByText("30")).toBeInTheDocument();
    expect(screen.getByText(/días de prueba restantes/)).toBeInTheDocument();
  });

  it("da el mismo número a cualquier hora del día", async () => {
    for (const hour of ["00:30", "12:00", "23:45"]) {
      vi.setSystemTime(new Date(`2026-11-03T${hour}:00Z`));
      subscription.mockResolvedValue(trial({ trial_ends_at: "2026-12-03T05:00:00Z", trial_days_remaining: 30 }));
      const { unmount } = renderWithProviders(<TrialBanner />);
      expect(await screen.findByText("30")).toBeInTheDocument();
      unmount();
    }
  });

  it("si la API no manda el campo, calcula con la fecha de fin", async () => {
    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
    subscription.mockResolvedValue(trial({ trial_ends_at: "2026-11-13T12:00:00Z", trial_days_remaining: undefined }));
    renderWithProviders(<TrialBanner />);
    expect(await screen.findByText("10")).toBeInTheDocument();
  });
});
