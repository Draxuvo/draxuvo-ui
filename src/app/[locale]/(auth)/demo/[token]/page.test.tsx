import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useParams: () => ({ token: "abc123" }) }));
vi.mock("@/services/demo", () => ({
  demoService: { resolveInvite: vi.fn(), open: vi.fn(), finish: vi.fn() },
}));

import { demoService } from "@/services/demo";
import DemoInvitePage from "./page";

const axiosError = (status: number, code?: string) =>
  Object.assign(new Error("x"), { isAxiosError: true, response: { status, data: { error: { details: code ? { code } : undefined } } } });

beforeEach(() => vi.clearAllMocks());

describe("Invitación a la demo", () => {
  it("una invitación válida muestra su plan y ofrece entrar", async () => {
    vi.mocked(demoService.resolveInvite).mockResolvedValue({ plan: "pro", scenario: "pro_restaurant" });
    renderWithProviders(<DemoInvitePage />);

    expect(await screen.findByRole("button", { name: "Entrar a la demo" })).toBeInTheDocument();
    expect(demoService.resolveInvite).toHaveBeenCalledWith("abc123");
    expect(screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "Pro · Restaurante")).toBeInTheDocument();
  });

  it.each([
    [404, undefined, "No encontramos esta invitación"],
    [410, "invite_expired", "Esta invitación ya venció"],
    [410, "invite_revoked", "Esta invitación ya no está disponible"],
  ])("con %s %s avisa y ofrece otra demo o crear la cuenta", async (status, code, text) => {
    vi.mocked(demoService.resolveInvite).mockRejectedValue(axiosError(status, code));
    renderWithProviders(<DemoInvitePage />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(text));
    expect(screen.getByRole("link", { name: "Probar otra demo" })).toHaveAttribute("href", "/es/demo");
    expect(screen.getByRole("link", { name: "Crear mi cuenta" })).toHaveAttribute("href", "/es/registro");
    expect(screen.queryByRole("button", { name: "Entrar a la demo" })).not.toBeInTheDocument();
  });
});
