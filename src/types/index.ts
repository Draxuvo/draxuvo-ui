// src/types/index.ts
export interface User {
  id: number;
  email: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  phone?: string;
  description?: string;
  avatar_url?: string;
  /** Compatibilidad: `super_admin` o el rol en la primera empresa. Usa `useAuthStore().role`. */
  role: Role;
  active: boolean;
  companies: UserCompany[];
  /** Apariencia del panel de esta persona (spec 006). */
  preferences?: { theme: string; color_mode: string };
}

export type CompanyRole = "staff" | "manager" | "admin" | "owner";
export type Role = CompanyRole | "super_admin";

/** Membresía del usuario: la empresa con el rol que tiene en ella (R16). */
export interface UserCompany {
  id: number;
  name: string;
  slug: string;
  role: CompanyRole;
  parent_company_id: number | null;
  order_mode: OrderMode;
}

/** Persona del equipo de la empresa activa (`/company/members`). */
export interface CompanyMember {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  role: CompanyRole;
  active: boolean;
}

/** Empresa principal o sucursal (`/company/branches`, R17). */
export interface Branch {
  id: number;
  name: string;
  slug: string;
  parent_company_id: number | null;
}

export interface Company {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  order_mode?: OrderMode;
  users_count?: number;
  created_at: string;
}

export interface AdminUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  second_last_name: string;
  phone: string;
  role: CompanyRole;
  active: boolean;
  // El rol de la persona en cada empresa (user_companies.role); `role` es el de la primera.
  companies: (Pick<Company, "id" | "name" | "slug"> & { role: CompanyRole })[];
  created_at: string;
}

export type EmployeeStatus = "active" | "inactive";

export interface Employee {
  id: number;
  name: string;
  position?: string;
  department?: string;
  salary?: number | string;
  email?: string;
  phone?: string;
  status: EmployeeStatus;
  created_at: string;
}

export type AttendanceType = "normal" | "late" | "absent";

export interface Attendance {
  id: number;
  employee_id: number;
  company_id: number;
  attendance_type: AttendanceType;
  checkin_at: string;
  checkout_at: string | null;
  open: boolean;
  duration_minutes: number | null;
  lat: string | null;
  lng: string | null;
  created_at: string;
  updated_at: string;
  employee: { id: number; name: string; position: string | null };
}

/** Un turno de quien consulta (spec 026). */
export interface MyShift {
  id: number;
  checkin_at: string;
  checkout_at: string | null;
  open: boolean;
  duration_minutes: number | null;
}

/** Estado de hoy de quien consulta: GET /my_attendance/today (spec 026). */
export interface MyAttendance {
  eligible: boolean;
  state: "none" | "working" | "done";
  current: MyShift | null;
  last: MyShift | null;
  server_time: string;
}

// Tipos de producto de la empresa (spec 016): sus reglas deciden menú, existencia y decimales.
export interface ProductTypeRules {
  sellable: boolean;
  /** Aparece en el menú del servicio (Tomar pedido); solo aplica a los tipos que se venden (spec 032). */
  in_menu?: boolean;
  counted: boolean;
  fractional: boolean;
}

export interface ProductTypeRef extends ProductTypeRules {
  id: number;
  name: string;
  /** Icono sugerido del tipo: clave del catálogo (spec 026). */
  icon?: string | null;
}

export interface UnitRef {
  key: string;
  name: string;
}

export interface ProductType extends ProductTypeRef {
  kind: "sold" | "counted_sold" | "supply" | null;
  default_unit: UnitRef | null;
  active: boolean;
  position: number;
  products_count: number;
}

export interface ProductTypePayload extends Partial<ProductTypeRules> {
  name?: string;
  default_unit_key?: string;
  active?: boolean;
  position?: number;
  icon?: string | null;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  /** `null` cuando el tipo no se cuenta (spec 016). */
  stock: number | null;
  min_stock: number | null;
  unit_cost: number;
  low_stock: boolean;
  product_type?: ProductTypeRef | null;
  unit?: UnitRef | null;
  price?: number;
  category?: string;
  description?: string;
  /** Icono propio: clave del catálogo (spec 026); sin él se usa el del tipo. */
  icon?: string | null;
  available?: boolean;
  /** Restaurante: estación que prepara el producto y si descuenta inventario al cerrar la cuenta. */
  station_id?: number | null;
  tracks_stock?: boolean;
  available_qty?: number | null;
  sold_out?: boolean;
  low?: boolean;
}

export interface MenuCategory {
  category: string;
  items: Product[];
}

export interface StockMovement {
  id: number;
  product_id: number;
  movement_type: "entry" | "exit" | "adjustment";
  qty: number;
  note?: string;
  created_at: string;
}

export interface PaginationInfo {
  page_size: number;
  page_index: number;
  total: number;
  page_start: number;
  page_end: number;
  pages_total: number;
}

export interface PaginatedResponse<T> {
  info: PaginationInfo;
  results: T[];
}

export interface ApiError {
  message: string;
  details?: string | string[] | { code: string; module?: ModuleKey };
}

export type PlanKey = "basic" | "pro" | "enterprise";
export type BillingCycle = "monthly" | "annual";
export type ModuleKey =
  | "employees"
  | "attendance"
  | "inventory"
  | "work_orders"
  | "tickets"
  | "reports"
  | "restaurant"
  | "terminals"
  | "whatsapp"
  | "multi_company";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired" | "suspended";

export interface PlanPrice {
  amount_cents: number;
  iva_cents: number;
  total_cents: number;
}

export interface Plan {
  key: PlanKey;
  modules: ModuleKey[];
  prices: Record<BillingCycle, PlanPrice>;
}

export interface PlansResponse {
  iva_rate: number;
  plans: Plan[];
  modules: ModuleKey[];
}

export interface Subscription {
  id?: number;
  plan: PlanKey;
  billing_cycle: BillingCycle | null;
  status: SubscriptionStatus;
  cancel_at_period_end: boolean;
  amount_cents: number;
  iva_cents: number;
  total_cents: number;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  active_modules: ModuleKey[];
  available_modules: ModuleKey[];
  active_access: boolean;
  trial_days_remaining?: number;
  /** Sucursal: la suscripción es la de la empresa principal y el cobro se administra allá. */
  managed_by_parent?: boolean;
  /** Suspendida por falta de pago (spec 031). `pay_url` es la factura pendiente (solo dueño y administrador). */
  suspended_at?: string | null;
  suspension_reason?: "plan_change" | "payment_overdue" | null;
  cancels_at?: string | null;
  pay_url?: string | null;
  /** Cobro normal fallido: fecha desde la que corre la gracia y cuándo termina (7 días). */
  past_due_since?: string | null;
  grace_ends_at?: string | null;
}

export interface CheckoutResponse {
  checkout_url: string;
}

export interface PortalResponse {
  portal_url: string;
}

export interface ModulesResponse {
  active_modules: ModuleKey[];
  available_modules: ModuleKey[];
  disabled_modules: ModuleKey[];
}

export interface RegistrationPayload {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  password: string;
  company_name: string;
  plan: PlanKey;
  billing_cycle: BillingCycle;
}

/** Alias usado en tasks.md (T045). */
export type RegistrationRequest = RegistrationPayload;

export interface AuthResponse {
  token: string;
  user: User;
}

export type WorkOrderStatus = "open" | "in_progress" | "done" | "paid" | "cancelled";
export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";
export type PaymentMethod = "cash" | "card" | "transfer";
export type OrderMode = "service" | "order";
export type WorkOrderEventKind =
  | "created" | "started" | "finished" | "reopened" | "charged"
  | "voided" | "cancelled" | "reassigned" | "note" | "photo"
  | "item_added" | "item_updated" | "item_removed";
export type WorkOrderAction =
  | "start" | "finish" | "reopen" | "charge" | "void_charge" | "cancel"
  | "edit" | "delete" | "add_item" | "edit_items" | "edit_steps" | "check_steps"
  | "add_note" | "add_photo" | "change_items";

export interface PersonRef {
  id: number;
  name: string;
}

export interface WorkOrderItem {
  id: number;
  description: string;
  quantity: number;
  unit?: string;
  unit_price?: number;
  subtotal?: number;
  position: number;
  product_id?: number;
  product?: Pick<Product, "id" | "name" | "sku" | "icon"> & { type_icon?: string | null };
}

export interface WorkOrderStep {
  id: number;
  description: string;
  position: number;
  done: boolean;
  done_at?: string;
  done_by?: PersonRef;
}

export interface WorkOrderPhoto {
  id: number;
  url: string;
  description?: string;
  uploaded_by: PersonRef;
  created_at: string;
}

export interface WorkOrderEvent {
  id: number;
  kind: WorkOrderEventKind;
  actor: PersonRef | null;
  data: Record<string, unknown>;
  created_at: string;
}

export interface WorkOrder {
  id: number;
  title: string;
  description?: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  due_date?: string;
  completed_at?: string;
  notes?: string;
  progress: number;
  total?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  employee?: PersonRef | null;
  created_by?: PersonRef | null;
  items_count: number;
  steps_count: number;
  steps_done: number;
  created_at: string;
  // Solo en el detalle
  items?: WorkOrderItem[];
  steps?: WorkOrderStep[];
  photos?: WorkOrderPhoto[];
  events?: WorkOrderEvent[];
  ticket?: Ticket | null;
  allowed_actions?: WorkOrderAction[];
  charge_blocked_reason?: "no_items" | null;
  cancel_reason?: string | null;
}

export interface WorkOrderSummary {
  counts: {
    open: number;
    in_progress: number;
    done: number;
    paid_today: number;
    cancelled: number;
    unassigned: number;
  };
  to_charge_total: number;
}

export interface DashboardStats {
  employees: {
    total: number;
    active: number;
    inactive: number;
  };
  users: {
    total: number;
    by_role: Record<User["role"], number>;
  };
  work_orders: {
    total: number;
    by_status: Record<WorkOrderStatus, number>;
    by_priority: Record<WorkOrderPriority, number>;
    to_charge: number;
    to_charge_total: number;
  };
  tickets: {
    total: number;
    pending: number;
    paid: number;
    voided: number;
    total_revenue: number;
    pending_revenue: number;
  };
  inventory: {
    total: number;
    available: number;
    unavailable: number;
    low_stock: number;
    out_of_stock: number;
    /** Productos y valor a costo por tipo (spec 016); `value` es null en tipos que no se cuentan. */
    by_type?: Array<{ id: number; name: string; counted: boolean; products: number; value: number | null }>;
  };
  attendance: {
    today: { total: number; normal: number; late: number; absent: number };
    this_month: number;
  };
  active_modules: ModuleKey[];
}

/** Rango que devuelven los reportes (fechas ISO con hora). */
export interface ReportRange {
  from: string;
  to: string;
}

/** Contrato real de `GET /reports/summary` (specs/028-reportes-rediseno/contracts/reports-api.md). */
export interface ReportSummary {
  period: ReportRange & { type: string };
  /** Cada bloque viene solo si su módulo está activo en el plan de la empresa (spec 033). */
  income?: { total_revenue: number; tickets_paid: number; pending_revenue: number; tickets_pending: number };
  work_orders?: { total: number; total_billed: number; by_status: Record<string, number> };
  expenses?: { payroll: number; inventory_cost: number; total: number };
  attendance?: { total: number; normal: number; late: number; absent: number };
  /** Foto de hoy del inventario (no depende del periodo). */
  inventory?: { value: number; counted_products: number; low_stock: number };
  /** Solo con `compare=true`: ingresos y gastos del periodo anterior de igual duración (los que existan). */
  previous?: {
    period: ReportRange;
    income?: { total_revenue: number; pending_revenue: number };
    expenses?: { payroll: number; inventory_cost: number; total: number };
  };
}

export interface IncomeBreakdownRow {
  id: number;
  folio: string;
  total: number;
  paid_at: string;
  work_order: { id: number | null; title: string; employee: string | null };
}

export interface IncomeReport {
  period: ReportRange;
  total_revenue: number;
  total_tickets: number;
  by_period: Array<{ period: string; revenue: number; count: number }>;
  breakdown: IncomeBreakdownRow[];
  /** Pagos no anulados del rango por método y, en tarjeta, por terminal (spec 015). */
  by_method?: Array<{ method: PaymentMethod; label: string; total: number; count: number }>;
  by_terminal?: Array<{ terminal: PaymentTerminalRef | null; total: number; count: number }>;
}

export interface ExpensesReport {
  period: ReportRange;
  total_expenses: number;
  /** `payroll` e `inventory_cost` vienen solo si su módulo está activo (spec 033). */
  payroll?: {
    total: number;
    headcount: number;
    employees: Array<{ id: number; name: string; position: string | null; department: string | null; salary: number }>;
  };
  inventory_cost?: {
    total: number;
    by_period: Array<{ period: string; cost: number; count: number }>;
    movements: Array<{
      id: number;
      created_at: string;
      product_name: string;
      sku: string;
      qty: number;
      unit_cost: number;
      cost: number;
      note: string | null;
    }>;
  };
}

/** Contrato de `GET /reports/inventory` (specs/033-reportes-plan-basico/contracts/reports-api.md). */
export interface InventoryProductRef {
  id: number;
  name: string;
  sku: string;
  unit: string | null;
}

export interface InventoryReport {
  period: ReportRange;
  stock: {
    counted_products: number;
    value: number;
    without_cost: number;
    low_stock: Array<InventoryProductRef & { stock: number; min_stock: number }>;
  };
  movements: {
    truncated: boolean;
    rows: Array<InventoryProductRef & { entries: number; exits: number; adjustments: number }>;
  };
}

export interface PayrollEmployee {
  id: number;
  name: string;
  position: string | null;
  department: string | null;
  salary: number;
  days_present: number;
  hours_worked: number;
  /** La API sigue enviándolos, pero Reportes no los muestra (no hay horario; spec 028). */
  attendance: { normal: number; late: number; absent: number };
}

export interface PayrollReport {
  period: ReportRange;
  total_payroll: number;
  headcount: number;
  employees: PayrollEmployee[];
}

export type TicketStatus = "pending" | "paid" | "voided";

export interface TicketItem {
  id?: number;
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  subtotal: number;
}

export interface Ticket {
  id: number;
  folio: string;
  work_order_id?: number | null;
  work_order?: {
    id: number;
    title: string;
    description?: string;
    employee?: { id: number; name: string };
    priority?: WorkOrderPriority;
    status?: WorkOrderStatus;
    customer_phone?: string;
  } | null;
  /** Ticket de una cuenta de restaurante (sin orden de trabajo). */
  check?: { id: number; table: string | null; takeout_name: string | null; waiter: PersonRef | null } | null;
  /** Pagos del cobro: de la cuenta o de la orden (spec 015). Los anulados traen `voided_at`. */
  payments?: TicketPayment[];
  status: TicketStatus;
  total: number;
  items?: TicketItem[];
  notes?: string;
  created_at: string;
  paid_at?: string;
  payment_method?: PaymentMethod | "mixed";
  payment_method_label?: string;
  amount_received?: number;
  change_given?: number;
  charged_by?: PersonRef;
  voided_at?: string;
  voided_by?: PersonRef;
  void_reason?: string;
}

// ── Filtros de lista (contracts/ui-routes.md). Los nombres son los de la API (R5). ──

/** Paginación que cada lista pasa a la API. `page_size` no va en la URL. */
export interface ListParams {
  page?: number;
  page_size?: number;
}

export interface EmployeeFilters {
  status?: EmployeeStatus;
  search?: string;
}

export interface ProductFilters {
  low_stock?: boolean;
  out_of_stock?: boolean;
  /** Pestaña de tipo en Inventario (spec 016). */
  product_type_id?: number;
  /** Solo productos de tipos que se venden (selectores de catálogo). */
  sellable?: boolean;
  /** `true` = disponibles; `false` = no disponibles (fila del resumen de inventario). */
  available?: boolean;
  search?: string;
}

export interface WorkOrderFilters {
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  employee_id?: number;
  search?: string;
  unassigned?: boolean;
  /** `YYYY-MM-DD`; con `status=paid`, las cobradas ese día. */
  paid_on?: string;
  sort_by?: "urgency" | "created_at" | "due_date";
}

export interface TicketFilters {
  status?: TicketStatus;
  search?: string;
}

export interface AttendanceFilters {
  /** `YYYY-MM-DD`, día completo en America/Mexico_City. */
  from?: string;
  /** `YYYY-MM-DD`, inclusivo. */
  to?: string;
  employee_id?: number;
  type?: AttendanceType;
}

export const EMPLOYEE_STATUSES: readonly EmployeeStatus[] = ["active", "inactive"];
export const WORK_ORDER_STATUSES: readonly WorkOrderStatus[] = ["open", "in_progress", "done", "paid", "cancelled"];
export const WORK_ORDER_PRIORITIES: readonly WorkOrderPriority[] = ["low", "medium", "high", "urgent"];
export const TICKET_STATUSES: readonly TicketStatus[] = ["pending", "paid", "voided"];
export const PAYMENT_METHODS: readonly PaymentMethod[] = ["cash", "card", "transfer"];
export const ORDER_MODES: readonly OrderMode[] = ["service", "order"];
export const ATTENDANCE_TYPES: readonly AttendanceType[] = ["normal", "late", "absent"];

// ── Restaurante (specs/013-restaurante-comandas/contracts/restaurant-api.md) ──

export type ItemStatus = "draft" | "new" | "preparing" | "ready" | "delivered" | "cancelled";
export type CheckStatus = "open" | "closed" | "cancelled";

export type StationKind = "kitchen" | "bar" | "other";

export interface Station {
  id: number;
  name: string;
  kind: StationKind;
  is_default: boolean;
  active: boolean;
  position: number;
}

/** Estado de la mesa que calcula la API a partir de su cuenta abierta (spec 032). */
export type TableState = "free" | "occupied" | "to_pay";

export interface DiningTable {
  id: number;
  name: string;
  active: boolean;
  position: number;
  state?: TableState;
}

export interface CheckItem {
  id: number;
  name: string;
  product_id?: number | null;
  icon?: string | null;
  type_icon?: string | null;
  quantity: number;
  unit_price: string;
  note: string | null;
  status: ItemStatus;
  station: { id: number; name: string } | null;
  kitchen_order_number: number | null;
  sent_at: string | null;
  ready_at: string | null;
  allowed_actions: ("deliver" | "cancel")[];
}

export interface CheckPayment {
  id?: number;
  method: PaymentMethod;
  amount: string;
  reference: string | null;
  amount_received: string | null;
  change_given: string | null;
  terminal?: PaymentTerminalRef | null;
}

// Terminales de cobro del negocio (spec 015).
export type TerminalProvider =
  | "bbva" | "banorte" | "santander" | "banamex" | "getnet" | "mercado_pago" | "clip" | "other";

export const TERMINAL_PROVIDERS: readonly TerminalProvider[] = [
  "bbva", "banorte", "santander", "banamex", "getnet", "mercado_pago", "clip", "other",
];

export interface PaymentTerminalRef {
  id: number;
  name: string;
  provider: TerminalProvider;
}

export interface PaymentTerminal extends PaymentTerminalRef {
  provider_label: string;
  active: boolean;
  /** Solo para admin y dueño. */
  payments_count?: number;
}

/** Un pago del cobro de una orden; el de una cuenta trae solo los campos de CheckPayment. */
export interface TicketPayment extends CheckPayment {
  method_label?: string;
  authorization_code?: string | null;
  card_last4?: string | null;
  source?: "manual";
  created_by?: PersonRef | null;
  created_at?: string;
  voided_at?: string | null;
}

/** Un pago en el cuerpo de POST /work_orders/:id/charge. */
export interface ChargePaymentInput {
  method: PaymentMethod;
  amount?: number;
  amount_received?: number;
  terminal_id?: number;
  authorization_code?: string;
  card_last4?: string;
  reference?: string;
}

export interface Check {
  id: number;
  status: CheckStatus;
  table: { id: number; name: string } | null;
  takeout_name: string | null;
  waiter: PersonRef | null;
  opened_at: string;
  total: string;
  paid: string;
  balance: string;
  items: CheckItem[];
  payments: CheckPayment[];
  ticket_id: number | null;
  allowed_actions: ("add_item" | "send" | "pay" | "reassign" | "cancel" | "close")[];
}

export interface ItemCounts {
  new: number;
  preparing: number;
  ready: number;
  delivered: number;
}

export interface CheckSummary {
  id: number;
  /** Mesero y total solo llegan de las cuentas propias o a quien es jefe (spec 032, FR-019b). */
  waiter?: PersonRef | null;
  opened_at: string;
  total?: string;
  counts: ItemCounts;
  mine: boolean;
}

export interface TableSummary extends DiningTable {
  check: CheckSummary | null;
}

export interface TakeoutSummary extends CheckSummary {
  takeout_name: string;
}

export interface RoundResponse {
  kitchen_order: { id: number; number: number; sent_at: string };
  sent: { id: number; name: string; quantity: number; station: { id: number; name: string } | null }[];
  rejected: { id: number; name: string; reason: string; available_qty: number | null }[];
  check: Check;
}

export interface PaymentResponse {
  payment: CheckPayment;
  check: { status: CheckStatus; total: string; paid: string; balance: string };
  ticket: Ticket | null;
}

export interface ReadyItem {
  id: number;
  name: string;
  quantity: number;
  check_id: number;
  table: string | null;
  takeout_name: string | null;
  ready_at: string;
}

/** Resumen vivo del servicio; solo lo recibe dueño, administrador y gerente. */
export interface ServiceOverview {
  open_checks: number;
  to_pay_total: string;
  pending_comandas: number;
  oldest_open_minutes: number | null;
}

export interface TablesResponse {
  results: TableSummary[];
  takeouts: TakeoutSummary[];
  ready_items: ReadyItem[];
  stock_alerts?: number;
  overview?: ServiceOverview;
}

export interface BoardItem {
  id: number;
  name: string;
  quantity: number;
  note: string | null;
  status: "new" | "preparing" | "ready" | "cancelled";
}

export interface BoardOrder {
  id: number;
  number: number;
  sent_at: string;
  table: string | null;
  takeout_name: string | null;
  waiter: string | null;
  items: BoardItem[];
}

export interface StationBoard {
  station: { id: number; name: string; kind?: StationKind };
  server_time: string;
  orders: BoardOrder[];
}

export interface StockAlert {
  id: number;
  name: string;
  stock: number;
  min_stock: number | null;
  sold_out: boolean;
}
