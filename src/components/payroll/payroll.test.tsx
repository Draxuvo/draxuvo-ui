import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { PayrollPayment, PayrollRun } from "@/types";

let search = "";
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/es/personal",
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/components/subscription/module-locked", () => ({
  ModuleLocked: () => <p>bloqueado</p>,
  useModuleGate: () => ({ enabled: true, isLocked: () => false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/payroll", () => ({
  payrollService: {
    list: vi.fn(), get: vi.fn(), create: vi.fn(), discard: vi.fn(), refreshEmployees: vi.fn(), approve: vi.fn(),
    cancel: vi.fn(), payAll: vi.fn(), exportCsv: vi.fn(), setDaysPaid: vi.fn(), removeLine: vi.fn(), pay: vi.fn(),
    receipt: vi.fn(), addAdjustment: vi.fn(), updateAdjustment: vi.fn(), removeAdjustment: vi.fn(), employeeHistory: vi.fn(),
  },
}));

import { payrollService } from "@/services/payroll";
import { PayrollTab } from "./payroll-tab";
import { Receipt } from "./receipt";

const api = vi.mocked(payrollService);

const line = (over: Partial<PayrollPayment> = {}): PayrollPayment => ({
  id: 11, payroll_run_id: 1, employee_id: 5, employee_name: "Ana Ruiz", monthly_salary_cents: 1_200_000, period_days: 15,
  days_paid: 15, salary_cents: 600_000, bonus_cents: 0, deduction_cents: 0, net_cents: 600_000, days_attended: 10,
  hours_worked: 80, status: "pending", method: null, reference: null, paid_on: null, paid_by: null, adjustments: [], ...over,
});

const run = (over: Partial<PayrollRun> = {}): PayrollRun => ({
  id: 1, period_type: "biweekly", starts_on: "2026-10-01", ends_on: "2026-10-15", status: "draft", total_cents: 600_000,
  lock_version: 3, payments_count: 1, paid_count: 0, paid_cents: 0, created_by: { id: 1, name: "Dueño" }, approved_by: null,
  approved_at: null, cancelled_at: null, cancel_reason: null, created_at: "2026-10-01T10:00:00Z", payments: [line()], events: [], ...over,
});

const page = (results: PayrollRun[]) => ({ info: { page_index: 1, pages_total: 1, page_start: 1, page_end: results.length, total: results.length } as never, results });

beforeEach(() => {
  search = "";
  vi.clearAllMocks();
  api.list.mockResolvedValue(page([run({ payments: undefined })]));
  api.get.mockResolvedValue(run());
});

describe("Nómina (spec 037)", () => {
  it("lista las corridas con periodo, estado, pagadas y total", async () => {
    renderWithProviders(<PayrollTab />);

    const row = (await screen.findByText(/01 oct 2026/)).closest("tr")!;
    expect(row).toHaveTextContent("Quincenal");
    expect(row).toHaveTextContent("Borrador");
    expect(row).toHaveTextContent("0 de 1");
    expect(row).toHaveTextContent("$6,000.00");
  });

  it("sin corridas guía a crear la primera", async () => {
    api.list.mockResolvedValue(page([]));
    renderWithProviders(<PayrollTab />);

    expect(await screen.findByText("Aún no hay corridas de nómina")).toBeInTheDocument();
  });

  it("un error de carga ofrece reintentar", async () => {
    api.list.mockRejectedValueOnce(new Error("x"));
    renderWithProviders(<PayrollTab />);

    await userEvent.click(await screen.findByRole("button", { name: "Reintentar", hidden: false }));
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it("abre el detalle de una corrida con ?run=", async () => {
    search = "tab=nomina&run=1";
    renderWithProviders(<PayrollTab />);

    expect(await screen.findByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeInTheDocument();
    expect(api.list).not.toHaveBeenCalled();
  });

  it("cambiar los días a pagar manda el lock_version de la corrida", async () => {
    search = "run=1";
    api.setDaysPaid.mockResolvedValue(line({ days_paid: 8 }));
    renderWithProviders(<PayrollTab />);

    const input = await screen.findByRole("textbox", { name: "Ana Ruiz" });
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.blur(input);

    await waitFor(() => expect(api.setDaysPaid).toHaveBeenCalledWith(11, 8, 3));
  });

  it("un valor de días fuera de rango no se manda", async () => {
    search = "run=1";
    renderWithProviders(<PayrollTab />);

    const input = await screen.findByRole("textbox", { name: "Ana Ruiz" });
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.blur(input);

    expect(api.setDaysPaid).not.toHaveBeenCalled();
    expect(input).toHaveValue("15");
  });

  it("aprobar pide confirmación y manda el lock_version con una llave de idempotencia", async () => {
    search = "run=1";
    api.approve.mockResolvedValue(run({ status: "approved" }));
    renderWithProviders(<PayrollTab />);

    await userEvent.click(await screen.findByRole("button", { name: "Aprobar" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("$6,000.00");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(api.approve).toHaveBeenCalledWith(1, 3, expect.any(String)));
  });

  it("avisa de la línea sin salario", async () => {
    search = "run=1";
    api.get.mockResolvedValue(run({ payments: [line({ monthly_salary_cents: 0, salary_cents: 0, net_cents: 0 })] }));
    renderWithProviders(<PayrollTab />);

    expect(await screen.findByText(/Sin salario capturado/)).toBeInTheDocument();
  });

  it("aprobada: paga una línea con método, fecha y referencia", async () => {
    search = "run=1";
    api.get.mockResolvedValue(run({ status: "approved" }));
    api.pay.mockResolvedValue(line({ status: "paid" }));
    renderWithProviders(<PayrollTab />);

    await userEvent.click(await screen.findByRole("button", { name: "Pagar" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Método"), "transfer");
    await userEvent.type(within(dialog).getByLabelText("Referencia (opcional)"), "SPEI 9");
    await userEvent.click(within(dialog).getByRole("button", { name: "Registrar pago" }));

    await waitFor(() =>
      expect(api.pay).toHaveBeenCalledWith(11, expect.objectContaining({ method: "transfer", reference: "SPEI 9" }), expect.any(String)),
    );
  });

  it("pagar todos manda los pendientes de la corrida", async () => {
    search = "run=1";
    api.get.mockResolvedValue(run({ status: "approved" }));
    api.payAll.mockResolvedValue(run({ status: "paid" }));
    renderWithProviders(<PayrollTab />);

    await userEvent.click(await screen.findByRole("button", { name: "Pagar todos" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("1 pagos pendientes por $6,000.00");
    await userEvent.click(within(dialog).getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(api.payAll).toHaveBeenCalledWith(1, expect.objectContaining({ method: "cash" }), undefined, expect.any(String)));
  });

  it("una línea pagada no se edita y ofrece su recibo", async () => {
    search = "run=1";
    api.get.mockResolvedValue(run({ status: "paid", payments: [line({ status: "paid", method: "cash", paid_on: "2026-10-16" })] }));
    renderWithProviders(<PayrollTab />);

    expect(await screen.findByText(/Pagada · Efectivo/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Ana Ruiz" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Recibo/ })).toHaveAttribute("href", "/es/personal/nomina/1/recibo/11");
    expect(screen.queryByRole("button", { name: /Quitar línea/ })).not.toBeInTheDocument();
  });

  it("cancelar una corrida aprobada exige el motivo", async () => {
    search = "run=1";
    api.get.mockResolvedValue(run({ status: "approved" }));
    api.cancel.mockResolvedValue(run({ status: "cancelled" }));
    renderWithProviders(<PayrollTab />);

    await userEvent.click(await screen.findByRole("button", { name: "Cancelar corrida" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Cancelar corrida" });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Motivo"), "Periodo equivocado");
    await userEvent.click(confirm);

    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith(1, "Periodo equivocado"));
  });

  it("ajustes: pide nota y monto, y manda los centavos", async () => {
    search = "run=1";
    api.addAdjustment.mockResolvedValue({} as never);
    renderWithProviders(<PayrollTab />);

    await userEvent.click(await screen.findByRole("button", { name: /Ajustes: Ana Ruiz/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Agregar ajuste" }));
    expect(await within(dialog).findByText("La nota es obligatoria")).toBeInTheDocument();
    expect(api.addAdjustment).not.toHaveBeenCalled();

    await userEvent.type(within(dialog).getByLabelText("Monto (MXN)"), "500.50");
    await userEvent.type(within(dialog).getByLabelText("Nota"), "Puntualidad");
    await userEvent.click(within(dialog).getByRole("button", { name: "Agregar ajuste" }));

    await waitFor(() =>
      expect(api.addAdjustment).toHaveBeenCalledWith(11, { kind: "bonus", amount_cents: 50_050, note: "Puntualidad", corrects_payment_id: undefined }),
    );
  });

  it("la bitácora muestra quién hizo cada cosa", async () => {
    search = "run=1";
    api.get.mockResolvedValue(
      run({ events: [{ id: 1, action: "created", details: {}, user: { id: 1, name: "Dueño" }, created_at: "2026-10-01T10:00:00Z" }] }),
    );
    renderWithProviders(<PayrollTab />);

    expect(await screen.findByText("Corrida creada")).toBeInTheDocument();
    expect(screen.getByText(/Dueño ·/)).toBeInTheDocument();
  });

  it("nueva corrida valida las fechas y crea el borrador", async () => {
    api.create.mockResolvedValue(run());
    renderWithProviders(<PayrollTab />);

    await userEvent.click(await screen.findByRole("button", { name: "Nueva corrida" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear borrador" }));
    expect((await within(dialog).findAllByText("Elige las fechas del periodo")).length).toBeGreaterThan(0);

    fireEvent.change(within(dialog).getByLabelText("Del"), { target: { value: "2026-10-01" } });
    fireEvent.change(within(dialog).getByLabelText("Al"), { target: { value: "2026-10-15" } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear borrador" }));

    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ period_type: "biweekly", starts_on: "2026-10-01", ends_on: "2026-10-15" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(expect.stringContaining("run=1"), { scroll: false }));
  });
});

describe("Recibo de nómina", () => {
  it("muestra el desglose, el método y la referencia", async () => {
    api.receipt.mockResolvedValue(
      line({
        status: "paid", method: "transfer", reference: "SPEI 9", paid_on: "2026-10-16", bonus_cents: 50_000, net_cents: 650_000,
        run: { id: 1, period_type: "biweekly", starts_on: "2026-10-01", ends_on: "2026-10-15" }, company: { name: "Volta" },
      }),
    );
    renderWithProviders(<Receipt runId={1} paymentId={11} />);

    const article = await screen.findByRole("article", { name: "Recibo de nómina" });
    expect(article).toHaveTextContent("Volta");
    expect(article).toHaveTextContent("Ana Ruiz");
    expect(article).toHaveTextContent("$6,500.00");
    expect(article).toHaveTextContent("Transferencia");
    expect(article).toHaveTextContent("SPEI 9");
  });
});
