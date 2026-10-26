import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { DemoSessionResponse, User } from "@/types";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/services/demo", () => ({
  demoService: { open: vi.fn(), resolveInvite: vi.fn(), finish: vi.fn() },
}));

import { demoService } from "@/services/demo";
import { DemoEntry } from "./demo-entry";

const session = (over: Partial<DemoSessionResponse> = {}): DemoSessionResponse => ({
  token: "jwt",
  user: { id: 1, companies: [{ id: 9, name: "Demo", slug: "demo", role: "owner", parent_company_id: null, order_mode: "service", demo: true }] } as unknown as User,
  company_id: 9,
  plan: "pro",
  scenario: "pro_restaurant",
  expires_at: "2030-01-01T00:00:00Z",
  ...over,
});

const axiosError = (status: number) => Object.assign(new Error("x"), { isAxiosError: true, response: { status, data: {} } });

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuthStore.setState({ user: null, token: null, selectedCompanyId: null, role: null });
});

describe("DemoEntry", () => {
  it("con el plan elegido en la URL arranca en él y Pro pregunta el giro", () => {
    renderWithProviders(<DemoEntry initialPlan="pro" />);

    expect(screen.getByLabelText(/^Pro/)).toBeChecked();
    expect(screen.getByLabelText(/^Servicio técnico/)).toBeChecked();
    expect(screen.getByLabelText(/^Restaurante/)).toBeInTheDocument();
  });

  it("Básico y Empresa tienen un solo giro y no lo preguntan", () => {
    renderWithProviders(<DemoEntry initialPlan="basic" />);

    expect(screen.queryByText("¿Qué tipo de negocio?")).not.toBeInTheDocument();
  });

  it("abre la demo del plan y giro elegidos sin pedir contacto, guarda la sesión y entra al inicio", async () => {
    vi.mocked(demoService.open).mockResolvedValue(session());
    renderWithProviders(<DemoEntry initialPlan="pro" />);

    fireEvent.click(screen.getByLabelText(/^Restaurante/));
    fireEvent.click(screen.getByRole("button", { name: "Entrar a la demo" }));

    await waitFor(() => expect(demoService.open).toHaveBeenCalledTimes(1));
    expect(vi.mocked(demoService.open).mock.calls[0][0]).toEqual({ locale: "es", plan: "pro", scenario: "pro_restaurant", contact: undefined });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/es/inicio"));
    expect(useAuthStore.getState().token).toBe("jwt");
    expect(JSON.parse(localStorage.getItem("draxuvo_demo") ?? "{}")).toMatchObject({ plan: "pro", scenario: "pro_restaurant" });
  });

  it("cambiar de plan reinicia el giro al primero de ese plan", async () => {
    vi.mocked(demoService.open).mockResolvedValue(session({ plan: "enterprise", scenario: "enterprise_restaurant" }));
    renderWithProviders(<DemoEntry initialPlan="pro" />);

    fireEvent.click(screen.getByLabelText(/^Empresa/));
    fireEvent.click(screen.getByRole("button", { name: "Entrar a la demo" }));

    await waitFor(() => expect(demoService.open).toHaveBeenCalled());
    expect(vi.mocked(demoService.open).mock.calls[0][0]).toMatchObject({ plan: "enterprise", scenario: "enterprise_restaurant" });
  });

  it("el contacto es opcional: si se deja, viaja solo con lo que se escribió y el teléfono en dígitos", async () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_URL", "https://draxuvo.test/privacidad");
    vi.mocked(demoService.open).mockResolvedValue(session());
    renderWithProviders(<DemoEntry initialPlan="basic" />);

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "  Ana  " } });
    fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "55 1234 5678" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar a la demo" }));

    await waitFor(() => expect(demoService.open).toHaveBeenCalled());
    expect(vi.mocked(demoService.open).mock.calls[0][0].contact).toEqual({ name: "Ana", phone: "5512345678" });
  });

  it("un correo o un teléfono inválidos se avisan y no abren la demo", async () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_URL", "https://draxuvo.test/privacidad");
    renderWithProviders(<DemoEntry initialPlan="basic" />);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "no-es-correo" } });
    fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar a la demo" }));

    expect(await screen.findByText("Ingresa un correo válido")).toBeInTheDocument();
    expect(screen.getByText("El teléfono debe tener 10 dígitos")).toBeInTheDocument();
    expect(demoService.open).not.toHaveBeenCalled();
  });

  it("muestra un mensaje claro si hay demasiadas aperturas (429) o demasiadas demos (503)", async () => {
    vi.mocked(demoService.open).mockRejectedValueOnce(axiosError(429)).mockRejectedValueOnce(axiosError(503));
    renderWithProviders(<DemoEntry initialPlan="basic" />);

    fireEvent.click(screen.getByRole("button", { name: "Entrar a la demo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Abriste muchas demos seguidas");

    fireEvent.click(screen.getByRole("button", { name: "Entrar a la demo" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Hay muchas demos abiertas"));
    expect(replace).not.toHaveBeenCalled();
  });

  it("con una sesión real abierta pide confirmar antes de reemplazarla", async () => {
    useAuthStore.setState({
      token: "real",
      user: { id: 2, companies: [{ id: 1, name: "Mi negocio", slug: "m", role: "owner", parent_company_id: null, order_mode: "service" }] } as unknown as User,
    });
    vi.mocked(demoService.open).mockResolvedValue(session());
    renderWithProviders(<DemoEntry initialPlan="basic" />);

    fireEvent.click(screen.getByRole("button", { name: "Entrar a la demo" }));
    expect(await screen.findByText("Ya tienes una sesión abierta")).toBeInTheDocument();
    expect(demoService.open).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByText("Ya tienes una sesión abierta")).not.toBeInTheDocument());
    expect(demoService.open).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Entrar a la demo" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Entrar a la demo" }));
    await waitFor(() => expect(demoService.open).toHaveBeenCalledTimes(1));
  });

  it("una sesión de demo ya abierta no pide confirmación", async () => {
    useAuthStore.setState({
      token: "demo",
      user: { id: 2, companies: [{ id: 9, name: "Demo", slug: "d", role: "owner", parent_company_id: null, order_mode: "service", demo: true }] } as unknown as User,
    });
    vi.mocked(demoService.open).mockResolvedValue(session());
    renderWithProviders(<DemoEntry initialPlan="basic" />);

    fireEvent.click(screen.getByRole("button", { name: "Entrar a la demo" }));

    await waitFor(() => expect(demoService.open).toHaveBeenCalled());
    expect(screen.queryByText("Ya tienes una sesión abierta")).not.toBeInTheDocument();
  });

  it("con una invitación el plan va fijo y se abre con su token", async () => {
    vi.mocked(demoService.open).mockResolvedValue(session());
    renderWithProviders(<DemoEntry invite={{ token: "abc123", plan: "pro", scenario: "pro_restaurant" }} />);

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "Pro · Restaurante")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entrar a la demo" }));

    await waitFor(() => expect(demoService.open).toHaveBeenCalled());
    expect(vi.mocked(demoService.open).mock.calls[0][0]).toEqual({ locale: "es", invite_token: "abc123", contact: undefined });
  });

  it("ofrece crear la cuenta con el plan elegido", () => {
    renderWithProviders(<DemoEntry initialPlan="enterprise" />);

    expect(screen.getByRole("link", { name: "Mejor crear mi cuenta gratis" })).toHaveAttribute("href", "/es/registro?plan=enterprise");
  });

  it("sin aviso de privacidad publicado no pide ningún dato de contacto y la demo es anónima", async () => {
    vi.mocked(demoService.open).mockResolvedValue(session());
    renderWithProviders(<DemoEntry initialPlan="basic" />);

    expect(screen.queryByLabelText("Correo electrónico")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("WhatsApp")).not.toBeInTheDocument();
    expect(screen.queryByText("aviso de privacidad")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entrar a la demo" }));

    await waitFor(() => expect(demoService.open).toHaveBeenCalled());
    expect(vi.mocked(demoService.open).mock.calls[0][0].contact).toBeUndefined();
  });

  it("con el aviso publicado pide el contacto y enlaza al aviso", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_URL", "https://draxuvo.test/privacidad");
    renderWithProviders(<DemoEntry initialPlan="basic" />);

    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "aviso de privacidad" })).toHaveAttribute("href", "https://draxuvo.test/privacidad");
  });
});
