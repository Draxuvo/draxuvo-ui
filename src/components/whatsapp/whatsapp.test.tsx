import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { WhatsappConnection, WhatsappGuideItem, WhatsappMessageType, WhatsappState } from "@/types";
import { ConnectionCard } from "./connection-card";
import { MessageTypeRow } from "./message-type-row";
import { TemplateGuideDialog } from "./template-guide-dialog";

const service = vi.hoisted(() => ({
  state: vi.fn(),
  guide: vi.fn(),
  saveConnection: vi.fn(),
  verifyConnection: vi.fn(),
  disconnect: vi.fn(),
  updateMessageType: vi.fn(),
  verifyMessageType: vi.fn(),
}));

vi.mock("@/services/whatsapp", () => ({ whatsappService: service }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const TOKEN = "EAAGtokensecreto1234567890";

function connection(over: Partial<WhatsappConnection> = {}): WhatsappConnection {
  return {
    status: "not_connected",
    enabled: false,
    managed: false,
    phone_number_id: null,
    waba_id: null,
    display_phone_number: null,
    verified_name: null,
    token_present: false,
    token_hint: null,
    error: null,
    last_verified_at: null,
    lock_version: 0,
    ...over,
  };
}

function state(over: Partial<WhatsappConnection> = {}, source: WhatsappState["source"] = "none"): WhatsappState {
  return { source, connection: connection(over), message_types: [], tests_remaining: 5 };
}

const connected = (over: Partial<WhatsappConnection> = {}) =>
  state({
    status: "connected",
    managed: true,
    phone_number_id: "104512345678901",
    waba_id: "109876543210987",
    display_phone_number: "+52 55 1234 5678",
    verified_name: "Draxuvo",
    token_present: true,
    token_hint: "7890",
    last_verified_at: "2026-10-28T17:30:00Z",
    lock_version: 3,
    ...over,
  }, "panel");

function apiError(status: number, details: Record<string, unknown>) {
  return new AxiosError("fail", "ERR", undefined, undefined, {
    status,
    data: { error: { status, message: "x", details } },
  } as AxiosResponse);
}

beforeEach(() => {
  Object.values(service).forEach((fn) => fn.mockReset());
});

describe("ConnectionCard (spec 047, US1)", () => {
  it("sin conexión invita a conectar y no ofrece acciones de una conexión", () => {
    renderWithProviders(<ConnectionCard state={state()} />);

    expect(screen.getByText("No conectada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verificar ahora" })).not.toBeInTheDocument();
  });

  it("conectada muestra nombre, número y la llave solo como los últimos 4", () => {
    renderWithProviders(<ConnectionCard state={connected()} />);

    expect(screen.getByText("Conectada")).toBeInTheDocument();
    expect(screen.getByText("Draxuvo")).toBeInTheDocument();
    expect(screen.getByText("+52 55 1234 5678")).toBeInTheDocument();
    expect(screen.getByText("••••7890")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verificar ahora" })).toBeInTheDocument();
  });

  it("con error muestra el motivo", () => {
    renderWithProviders(
      <ConnectionCard state={connected({ status: "error", error: { code: "190", message: "La llave venció" } })} />,
    );

    expect(screen.getByText("Con error")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("La llave venció");
  });

  it("con solo variables de entorno lo avisa y deja conectar desde el panel", () => {
    renderWithProviders(
      <ConnectionCard state={state({ token_present: true, phone_number_id: "104512345678901" }, "env")} />,
    );

    expect(screen.getByText(/variables de entorno del servidor/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar desde el panel" })).toBeInTheDocument();
  });

  it("al guardar manda la llave a la API y no la deja en la pantalla", async () => {
    const user = userEvent.setup();
    service.saveConnection.mockResolvedValue(connected());
    renderWithProviders(<ConnectionCard state={state()} />);

    await user.click(screen.getByRole("button", { name: "Conectar" }));
    const tokenField = screen.getByLabelText("Llave de acceso");
    expect(tokenField).toHaveAttribute("type", "password");
    await user.type(tokenField, TOKEN);
    await user.type(screen.getByLabelText("Identificador del número"), "104512345678901");
    await user.type(screen.getByLabelText("Identificador de la cuenta"), "109876543210987");
    await user.click(screen.getByRole("button", { name: "Verificar y guardar" }));

    await waitFor(() =>
      expect(service.saveConnection).toHaveBeenCalledWith({
        access_token: TOKEN,
        phone_number_id: "104512345678901",
        waba_id: "109876543210987",
        lock_version: 0,
      }),
    );
    await waitFor(() => expect(screen.queryByLabelText("Llave de acceso")).not.toBeInTheDocument());
    expect(document.body.innerHTML).not.toContain(TOKEN);
  });

  it("un rechazo de Meta muestra el motivo en español y no cierra el formulario", async () => {
    const user = userEvent.setup();
    service.saveConnection.mockRejectedValue(
      apiError(422, { code: "whatsapp_rejected", reason: "token_expired", meta_code: "190" }),
    );
    renderWithProviders(<ConnectionCard state={state()} />);

    await user.click(screen.getByRole("button", { name: "Conectar" }));
    await user.type(screen.getByLabelText("Llave de acceso"), TOKEN);
    await user.type(screen.getByLabelText("Identificador del número"), "104512345678901");
    await user.type(screen.getByLabelText("Identificador de la cuenta"), "109876543210987");
    await user.click(screen.getByRole("button", { name: "Verificar y guardar" }));

    expect(await screen.findByText(/La llave venció; genera una nueva en Meta\./)).toBeInTheDocument();
    expect(screen.getByText(/código de Meta 190/)).toBeInTheDocument();
    expect(screen.getByLabelText("Llave de acceso")).toBeInTheDocument();
  });

  it("valida en el formulario antes de llamar a la API", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectionCard state={state()} />);

    await user.click(screen.getByRole("button", { name: "Conectar" }));
    await user.click(screen.getByRole("button", { name: "Verificar y guardar" }));

    expect(screen.getByText("Captura la llave de acceso.")).toBeInTheDocument();
    expect(service.saveConnection).not.toHaveBeenCalled();
  });

  it("reemplazar la llave solo pide la llave y conserva el número", async () => {
    const user = userEvent.setup();
    service.saveConnection.mockResolvedValue(connected({ token_hint: "9999" }));
    renderWithProviders(<ConnectionCard state={connected()} />);

    await user.click(screen.getByRole("button", { name: "Reemplazar llave" }));
    expect(screen.queryByLabelText("Identificador del número")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Llave de acceso"), "EAAGotrallavenueva00009999");
    await user.click(screen.getByRole("button", { name: "Verificar y guardar" }));

    await waitFor(() =>
      expect(service.saveConnection).toHaveBeenCalledWith({ access_token: "EAAGotrallavenueva00009999", lock_version: 3 }),
    );
  });

  it("desconectar con el canal encendido avisa más fuerte y pide confirmar", async () => {
    const user = userEvent.setup();
    service.disconnect.mockResolvedValue(state());
    renderWithProviders(<ConnectionCard state={connected({ enabled: true })} />);

    await user.click(screen.getByRole("button", { name: "Desconectar" }));
    expect(screen.getByText(/El canal está encendido/)).toBeInTheDocument();
    expect(service.disconnect).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole("button", { name: "Desconectar" }).at(-1)!);

    await waitFor(() => expect(service.disconnect).toHaveBeenCalledWith({ confirm: true, lock_version: 3 }));
  });

  it("desconectar con el canal apagado no muestra la advertencia fuerte", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectionCard state={connected()} />);

    await user.click(screen.getByRole("button", { name: "Desconectar" }));

    expect(screen.queryByText(/El canal está encendido/)).not.toBeInTheDocument();
  });

  it("verificar ahora llama a la API", async () => {
    const user = userEvent.setup();
    service.verifyConnection.mockResolvedValue(connected());
    renderWithProviders(<ConnectionCard state={connected()} />);

    await user.click(screen.getByRole("button", { name: "Verificar ahora" }));

    await waitFor(() => expect(service.verifyConnection).toHaveBeenCalledTimes(1));
  });
});

function messageType(over: Partial<WhatsappMessageType> = {}): WhatsappMessageType {
  return {
    kind: "stock_alert",
    uses_template: true,
    enabled: false,
    template_name: "stock_bajo",
    template_language: "es_MX",
    template_status: "approved",
    template_detail: null,
    template_checked_at: "2026-10-28T17:31:00Z",
    expected_variables: 3,
    can_enable: true,
    blocked_reason: null,
    lock_version: 2,
    ...over,
  };
}

const stateWith = (type: WhatsappMessageType): WhatsappState => ({ ...connected(), message_types: [type] });

const guideItems: WhatsappGuideItem[] = [
  {
    kind: "stock_alert",
    name: "stock_bajo",
    language: "es_MX",
    category: "UTILITY",
    body: "Stock bajo en {{1}}: {{2}} producto(s) ({{3}}).",
    variables: [
      { position: 1, meaning: "Nombre de la empresa" },
      { position: 2, meaning: "Cantidad de productos" },
      { position: 3, meaning: "Nombres de los productos" },
    ],
  },
];

describe("MessageTypeRow (spec 047, US2)", () => {
  it.each([
    ["approved", "Aprobada"],
    ["pending", "Pendiente"],
    ["rejected", "Rechazada"],
    ["not_found", "No encontrada"],
    ["incompatible", "Incompatible"],
    ["unknown", "Sin verificar"],
  ] as const)("muestra el estado %s como «%s»", (status, label) => {
    renderWithProviders(<MessageTypeRow type={messageType({ template_status: status })} connected />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("muestra el motivo de un rechazo", () => {
    renderWithProviders(
      <MessageTypeRow type={messageType({ template_status: "rejected", template_detail: "REJECTED: INVALID_FORMAT" })} connected />,
    );

    expect(screen.getByText("REJECTED: INVALID_FORMAT")).toBeInTheDocument();
  });

  it("los tickets no usan plantilla", () => {
    renderWithProviders(
      <MessageTypeRow type={messageType({ kind: "ticket", uses_template: false, template_name: null, template_status: null })} connected />,
    );

    expect(screen.getByText(/Los tickets no usan plantilla/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre de la plantilla")).not.toBeInTheDocument();
  });

  it("cambiar el nombre llama al servicio con el lock_version", async () => {
    const user = userEvent.setup();
    service.updateMessageType.mockResolvedValue(stateWith(messageType({ template_name: "mi_aviso", template_status: "pending" })));
    renderWithProviders(<MessageTypeRow type={messageType()} connected />);

    expect(screen.getByRole("button", { name: "Guardar plantilla" })).toBeDisabled();
    const field = screen.getByLabelText("Nombre de la plantilla");
    await user.clear(field);
    await user.type(field, "mi_aviso");
    await user.click(screen.getByRole("button", { name: "Guardar plantilla" }));

    await waitFor(() =>
      expect(service.updateMessageType).toHaveBeenCalledWith("stock_alert", {
        template_name: "mi_aviso",
        template_language: "es_MX",
        lock_version: 2,
      }),
    );
  });

  it("valida el nombre y el idioma antes de llamar a la API", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MessageTypeRow type={messageType()} connected />);

    const language = screen.getByLabelText("Idioma");
    await user.clear(language);
    await user.type(language, "español");
    await user.click(screen.getByRole("button", { name: "Guardar plantilla" }));

    expect(screen.getByText(/formato de Meta/)).toBeInTheDocument();
    expect(service.updateMessageType).not.toHaveBeenCalled();
  });

  it("avisa que es el último estado conocido cuando Meta no respondió", () => {
    renderWithProviders(<MessageTypeRow type={messageType({ stale: true })} connected />);

    expect(screen.getByText(/se muestra el último estado conocido/)).toBeInTheDocument();
  });

  it("verificar ahora llama al servicio, y sin conexión está deshabilitado", async () => {
    const user = userEvent.setup();
    service.verifyMessageType.mockResolvedValue(stateWith(messageType()));
    const { unmount } = renderWithProviders(<MessageTypeRow type={messageType()} connected />);

    await user.click(screen.getByRole("button", { name: "Verificar ahora" }));
    await waitFor(() => expect(service.verifyMessageType).toHaveBeenCalledWith("stock_alert"));
    unmount();

    renderWithProviders(<MessageTypeRow type={messageType()} connected={false} />);
    expect(screen.getByRole("button", { name: "Verificar ahora" })).toBeDisabled();
  });
});

describe("TemplateGuideDialog (spec 047, US2)", () => {
  it("muestra nombre, idioma, categoría, texto y variables, y copia al portapapeles", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    service.guide.mockResolvedValue(guideItems);
    renderWithProviders(<TemplateGuideDialog open kind="stock_alert" onOpenChange={() => {}} />);

    expect(await screen.findByText("UTILITY")).toBeInTheDocument();
    expect(screen.getByText("Stock bajo en {{1}}: {{2}} producto(s) ({{3}}).")).toBeInTheDocument();
    expect(screen.getByText(/Nombre de la empresa/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copiar Texto del cuerpo" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Stock bajo en {{1}}: {{2}} producto(s) ({{3}})."));
  });
});
