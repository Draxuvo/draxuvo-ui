import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { User, WhatsappConnection, WhatsappEvent, WhatsappGuideItem, WhatsappMessageType, WhatsappState } from "@/types";
import WhatsappPage from "@/app/[locale]/(super-admin)/whatsapp/page";
import { ChannelSwitch } from "./channel-switch";
import { HistoryTable } from "./history-table";
import { ConnectionCard } from "./connection-card";
import { MessageTypeRow } from "./message-type-row";
import { TemplateGuideDialog } from "./template-guide-dialog";
import { TestDialog } from "./test-dialog";

const service = vi.hoisted(() => ({
  state: vi.fn(),
  guide: vi.fn(),
  saveConnection: vi.fn(),
  verifyConnection: vi.fn(),
  disconnect: vi.fn(),
  updateMessageType: vi.fn(),
  verifyMessageType: vi.fn(),
  setChannel: vi.fn(),
  testMessage: vi.fn(),
  events: vi.fn(),
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

function apiFailure(status: number, details: Record<string, unknown>) {
  return new AxiosError("fail", "ERR", undefined, undefined, {
    status,
    data: { error: { status, message: "x", details } },
  } as AxiosResponse);
}

describe("TestDialog (spec 047, US4)", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { phone: "5598765432" } as unknown as User });
  });

  const stockType = (): WhatsappMessageType => ({
    kind: "stock_alert",
    uses_template: true,
    enabled: false,
    template_name: "stock_bajo",
    template_language: "es_MX",
    template_status: "approved",
    template_detail: null,
    template_checked_at: null,
    expected_variables: 3,
    can_enable: true,
    blocked_reason: null,
    lock_version: 2,
  });

  function open(testsRemaining = 5) {
    return renderWithProviders(<TestDialog open kind="stock_alert" testsRemaining={testsRemaining} onOpenChange={() => {}} />);
  }

  it("prellena el teléfono del perfil y muestra las pruebas restantes", () => {
    open(4);

    expect(screen.getByLabelText("Teléfono de destino")).toHaveValue("5598765432");
    expect(screen.getByText("Te quedan 4 pruebas esta hora.")).toBeInTheDocument();
  });

  it("manda solo los dígitos y muestra «Enviado» con la hora", async () => {
    const user = userEvent.setup();
    service.testMessage.mockResolvedValue({ result: "sent", to: "••••5678", tests_remaining: 4 });
    open();

    const phone = screen.getByLabelText("Teléfono de destino");
    await user.clear(phone);
    await user.type(phone, "55 1234 5678");
    await user.click(screen.getByRole("button", { name: "Enviar prueba" }));

    await waitFor(() => expect(service.testMessage).toHaveBeenCalledWith("stock_alert", "5512345678"));
    expect(await screen.findByRole("status")).toHaveTextContent(/Enviado a ••••5678 a las/);
  });

  it("valida el teléfono antes de llamar a la API", async () => {
    const user = userEvent.setup();
    open();

    const phone = screen.getByLabelText("Teléfono de destino");
    await user.clear(phone);
    await user.type(phone, "123");
    await user.click(screen.getByRole("button", { name: "Enviar prueba" }));

    expect(screen.getByText("Escribe un número de 10 a 15 dígitos.")).toBeInTheDocument();
    expect(service.testMessage).not.toHaveBeenCalled();
  });

  it("muestra el motivo en español cuando Meta rechaza al destinatario", async () => {
    const user = userEvent.setup();
    service.testMessage.mockRejectedValue(
      apiFailure(422, { code: "test_failed", reason: "not_authorized_recipient", meta_code: "131030" }),
    );
    open();

    await user.click(screen.getByRole("button", { name: "Enviar prueba" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Meta rechazó la petición/);
  });

  it("la plantilla no aprobada se explica en palabras", async () => {
    const user = userEvent.setup();
    service.testMessage.mockRejectedValue(apiFailure(422, { code: "template_not_approved", template_status: "pending" }));
    open();

    await user.click(screen.getByRole("button", { name: "Enviar prueba" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La plantilla aún no está aprobada en Meta.");
  });

  it("con 429 muestra el mensaje de límite", async () => {
    const user = userEvent.setup();
    service.testMessage.mockRejectedValue(apiFailure(429, { code: "tests_limit" }));
    open();

    await user.click(screen.getByRole("button", { name: "Enviar prueba" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/límite de 5 pruebas por hora/);
  });

  it("sin pruebas restantes bloquea el envío y lo dice", () => {
    open(0);

    expect(screen.getByRole("button", { name: "Enviar prueba" })).toBeDisabled();
    expect(screen.getByText(/límite de 5 pruebas por hora/)).toBeInTheDocument();
  });

  it("el botón de la fila abre el diálogo y está deshabilitado sin conexión", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<MessageTypeRow type={stockType()} connected />);

    await user.click(screen.getByRole("button", { name: "Enviar prueba" }));
    expect(screen.getByText("Prueba de Aviso de stock bajo")).toBeInTheDocument();
    unmount();

    renderWithProviders(<MessageTypeRow type={stockType()} connected={false} />);
    expect(screen.getByRole("button", { name: "Enviar prueba" })).toBeDisabled();
  });
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

  it("un 100 de Meta dice que la llave puede no tener acceso a ese número, no solo que el ID está mal", async () => {
    const user = userEvent.setup();
    service.saveConnection.mockRejectedValue(
      apiError(422, { code: "whatsapp_rejected", reason: "invalid_number", meta_code: "100" }),
    );
    renderWithProviders(<ConnectionCard state={state()} />);

    await user.click(screen.getByRole("button", { name: "Conectar" }));
    await user.type(screen.getByLabelText("Llave de acceso"), TOKEN);
    await user.type(screen.getByLabelText("Identificador del número"), "104512345678901");
    await user.type(screen.getByLabelText("Identificador de la cuenta"), "109876543210987");
    await user.click(screen.getByRole("button", { name: "Verificar y guardar" }));

    expect(await screen.findByText(/la llave no tiene acceso a ese número/)).toBeInTheDocument();
    expect(screen.getByText(/código de Meta 100/)).toBeInTheDocument();
  });

  it("al conectar una cuenta de prueba de Meta avisa que no se pueden comprobar las plantillas", async () => {
    const user = userEvent.setup();
    service.saveConnection.mockResolvedValue({ ...connected(), notice: "test_account" });
    renderWithProviders(<ConnectionCard state={state()} />);

    await user.click(screen.getByRole("button", { name: "Conectar" }));
    await user.type(screen.getByLabelText("Llave de acceso"), TOKEN);
    await user.type(screen.getByLabelText("Identificador del número"), "104512345678901");
    await user.type(screen.getByLabelText("Identificador de la cuenta"), "109876543210987");
    await user.click(screen.getByRole("button", { name: "Verificar y guardar" }));

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("cuenta de prueba de Meta")));
  });

  it("al verificar una cuenta de prueba de Meta también lo avisa", async () => {
    const user = userEvent.setup();
    service.verifyConnection.mockResolvedValue({ ...connected(), notice: "test_account" });
    renderWithProviders(<ConnectionCard state={connected()} />);

    await user.click(screen.getByRole("button", { name: "Verificar ahora" }));

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("cuenta de prueba de Meta")));
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

describe("ChannelSwitch (spec 047, US3)", () => {
  it("sin conexión el interruptor general está bloqueado y dice por qué", () => {
    renderWithProviders(<ChannelSwitch state={state()} />);

    expect(screen.getByRole("switch", { name: "Enviar mensajes por WhatsApp" })).toBeDisabled();
    expect(screen.getByText(/primero conecta la cuenta/)).toBeInTheDocument();
  });

  it("con la conexión en error no se puede encender y se explica", () => {
    renderWithProviders(<ChannelSwitch state={connected({ status: "error" })} />);

    expect(screen.getByRole("switch", { name: "Enviar mensajes por WhatsApp" })).toBeDisabled();
    expect(screen.getByText(/corrige el error de la conexión/)).toBeInTheDocument();
  });

  it("encendido con la conexión en error avisa que no está disponible y no bloquea apagarlo", () => {
    renderWithProviders(<ChannelSwitch state={connected({ status: "error", enabled: true })} />);

    expect(screen.getByRole("switch", { name: "Enviar mensajes por WhatsApp" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent(/no está disponible mientras la conexión tenga un error/);
  });

  it("apagado con conexión válida dice «no disponible» y deja encender", async () => {
    const user = userEvent.setup();
    service.setChannel.mockResolvedValue(connected({ enabled: true }));
    renderWithProviders(<ChannelSwitch state={connected()} />);

    expect(screen.getByText(/No disponible: el interruptor general está apagado/)).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Enviar mensajes por WhatsApp" }));

    await waitFor(() => expect(service.setChannel).toHaveBeenCalledWith({ enabled: true, lock_version: 3 }));
  });

  it("apagar el general manda enabled: false", async () => {
    const user = userEvent.setup();
    service.setChannel.mockResolvedValue(connected());
    renderWithProviders(<ChannelSwitch state={connected({ enabled: true })} />);

    await user.click(screen.getByRole("switch", { name: "Enviar mensajes por WhatsApp" }));

    await waitFor(() => expect(service.setChannel).toHaveBeenCalledWith({ enabled: false, lock_version: 3 }));
  });
});

describe("MessageTypeRow switches (spec 047, US3)", () => {
  const switchName = "Enviar Aviso de stock bajo";

  it("un tipo sin plantilla aprobada no se puede encender y muestra el motivo", () => {
    renderWithProviders(
      <MessageTypeRow
        type={messageType({ template_status: "pending", can_enable: false, blocked_reason: "template_not_approved" })}
        connected
      />,
    );

    expect(screen.getByRole("switch", { name: switchName })).toBeDisabled();
    expect(screen.getByText("La plantilla aún no está aprobada en Meta.")).toBeInTheDocument();
  });

  it("sin conexión el motivo es que falta conectar", () => {
    renderWithProviders(
      <MessageTypeRow type={messageType({ can_enable: false, blocked_reason: "not_connected" })} connected={false} />,
    );

    expect(screen.getByText("Falta conectar la cuenta de WhatsApp.")).toBeInTheDocument();
  });

  it("apagar un tipo llama al servicio solo para ese tipo, con su lock_version", async () => {
    const user = userEvent.setup();
    service.updateMessageType.mockResolvedValue(stateWith(messageType({ enabled: false })));
    renderWithProviders(<MessageTypeRow type={messageType({ enabled: true })} connected />);

    await user.click(screen.getByRole("switch", { name: switchName }));

    await waitFor(() => expect(service.updateMessageType).toHaveBeenCalledWith("stock_alert", { enabled: false, lock_version: 2 }));
    expect(service.setChannel).not.toHaveBeenCalled();
  });

  it("un tipo encendido siempre se puede apagar, aunque ya no se pueda encender", () => {
    renderWithProviders(
      <MessageTypeRow type={messageType({ enabled: true, can_enable: false, blocked_reason: "connection_error" })} connected />,
    );

    expect(screen.getByRole("switch", { name: switchName })).toBeEnabled();
  });

  it("avisa cuando un tipo se apagó solo porque su plantilla dejó de servir", () => {
    renderWithProviders(
      <MessageTypeRow
        type={messageType({ template_status: "rejected", template_detail: "PAUSED", can_enable: false, blocked_reason: "template_not_approved" })}
        connected
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/Se apagó porque su plantilla dejó de servir/);
  });

  it("con solo variables de entorno no hay interruptores", () => {
    renderWithProviders(<MessageTypeRow type={messageType()} connected={false} controllable={false} />);

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});

function event(over: Partial<WhatsappEvent> = {}): WhatsappEvent {
  return {
    id: 1,
    action: "type_off",
    target: "stock_alert",
    result: "ok",
    user: { id: 9, name: "Super Admin" },
    data: {},
    meta_code: null,
    created_at: "2026-10-28T17:40:00Z",
    ...over,
  };
}

function page(results: WhatsappEvent[], total = results.length) {
  return { info: { page_size: 10, page_index: 1, total, page_start: 1, page_end: results.length, pages_total: Math.ceil(total / 10) }, results };
}

describe("HistoryTable (spec 047, US5)", () => {
  it("cuenta cada cambio en palabras, con quién lo hizo y el detalle", async () => {
    service.events.mockResolvedValue(
      page([
        event({ id: 3, action: "template_changed", data: { from: { name: "stock_bajo" }, to: { name: "mi_aviso" } } }),
        event({ id: 2, action: "test_sent", target: "ticket", data: { to: "••••5678" } }),
        event({ id: 1, action: "auto_off", user: null, result: "failed", meta_code: "132001", data: { reason: "template_missing" } }),
      ]),
    );
    renderWithProviders(<HistoryTable />);

    expect(await screen.findByText("Cambió la plantilla de Aviso de stock bajo")).toBeInTheDocument();
    expect(screen.getByText("stock_bajo → mi_aviso")).toBeInTheDocument();
    expect(screen.getByText("Mandó una prueba de Ticket")).toBeInTheDocument();
    expect(screen.getByText("A ••••5678")).toBeInTheDocument();
    expect(screen.getByText("Se apagó solo Aviso de stock bajo")).toBeInTheDocument();
    expect(screen.getByText("Draxuvo (automático)")).toBeInTheDocument();
    expect(screen.getByText(/código de Meta 132001/)).toBeInTheDocument();
    expect(screen.getAllByText("Super Admin")).toHaveLength(2);
  });

  it("los eventos de la conexión nombran «la conexión»", async () => {
    service.events.mockResolvedValue(page([event({ action: "verified", target: "connection" })]));
    renderWithProviders(<HistoryTable />);

    expect(await screen.findByText("Verificó la conexión")).toBeInTheDocument();
  });

  it("sin cambios muestra el vacío", async () => {
    service.events.mockResolvedValue(page([]));
    renderWithProviders(<HistoryTable />);

    expect(await screen.findByText("Aún no hay cambios registrados.")).toBeInTheDocument();
  });

  it("ante un error ofrece reintentar", async () => {
    const user = userEvent.setup();
    service.events.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(page([event()]));
    renderWithProviders(<HistoryTable />);

    expect(await screen.findByText("No se pudo cargar el historial.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Apagó Aviso de stock bajo")).toBeInTheDocument();
  });

  it("pagina de 10 en 10", async () => {
    const user = userEvent.setup();
    service.events.mockResolvedValue(page([event()], 25));
    renderWithProviders(<HistoryTable />);

    expect(await screen.findByText("Página 1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => expect(service.events).toHaveBeenCalledWith({ page: 2, page_size: 10 }));
  });
});

describe("página /whatsapp (spec 047)", () => {
  it("quien no es super admin ve un aviso y no se consulta la API", () => {
    useAuthStore.setState({ user: { role: "owner" } as unknown as User });
    renderWithProviders(<WhatsappPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("Solo para el equipo de Draxuvo");
    expect(service.state).not.toHaveBeenCalled();
  });

  it("el super admin ve conexión, interruptor, mensajes e historial", async () => {
    useAuthStore.setState({ user: { role: "super_admin" } as unknown as User });
    service.state.mockResolvedValue(stateWith(messageType()));
    service.events.mockResolvedValue(page([event()]));
    renderWithProviders(<WhatsappPage />);

    expect(await screen.findByRole("heading", { name: "Conexión" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Enviar mensajes por WhatsApp" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mensajes" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Historial" })).toBeInTheDocument();
  });
});

describe("conflicto de edición 409 (spec 047, US5)", () => {
  it("avisa que alguien cambió esto, muestra el valor vigente y deja volver a intentar con el nuevo lock_version", async () => {
    const user = userEvent.setup();
    const current = stateWith(messageType({ template_name: "plantilla_de_otra_persona", lock_version: 7 }));
    service.updateMessageType
      .mockRejectedValueOnce(apiFailure(409, { code: "stale_object", current }))
      .mockResolvedValue(current);
    const { queryClient } = renderWithProviders(<MessageTypeRow type={messageType()} connected />);

    const field = screen.getByLabelText("Nombre de la plantilla");
    await user.clear(field);
    await user.type(field, "mi_aviso");
    await user.click(screen.getByRole("button", { name: "Guardar plantilla" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Alguien cambió esto hace un momento/);
    // El estado vigente queda en caché para que la pantalla lo muestre antes de pisarlo.
    expect(queryClient.getQueryData(["whatsapp"])).toEqual(current);
    expect(service.updateMessageType).toHaveBeenCalledTimes(1);
  });
});
