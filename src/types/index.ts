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
  lat: string | null;
  lng: string | null;
  created_at: string;
  updated_at: string;
  employee: { id: number; name: string; position: string | null };
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  stock: number;
  min_stock: number;
  unit_cost: number;
  low_stock: boolean;
  price?: number;
  category?: string;
  description?: string;
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
  | "whatsapp"
  | "multi_company";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired";

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
  | "voided" | "cancelled" | "reassigned" | "note" | "photo";
export type WorkOrderAction =
  | "start" | "finish" | "reopen" | "charge" | "void_charge" | "cancel"
  | "edit" | "delete" | "add_item" | "edit_items" | "edit_steps" | "check_steps"
  | "add_note" | "add_photo";

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
  product?: Pick<Product, "id" | "name" | "sku">;
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
  };
  attendance: {
    today: { total: number; normal: number; late: number; absent: number };
    this_month: number;
  };
  active_modules: ModuleKey[];
}

export interface ReportSummary {
  income: {
    paid_revenue: number;
    pending_revenue: number;
    total_revenue: number;
  };
  work_orders: {
    total: number;
    by_status: Record<string, number>;
    total_billed: number;
  };
  expenses: {
    payroll_total: number;
    inventory_cost: number;
    total: number;
  };
  attendance: {
    normal: number;
    late: number;
    absent: number;
    total: number;
  };
}

export interface IncomePaidTicket {
  id: number;
  folio: string;
  total: number;
  paid_at: string;
  employee?: { id: number; name: string };
  work_order?: { id: number; title: string };
}

export interface IncomeReport {
  groups: Array<{ period: string; total: number; count: number }>;
  tickets: IncomePaidTicket[];
}

export interface ExpensesReport {
  groups: Array<{ period: string; payroll: number; inventory: number; total: number }>;
  payroll: Array<{ id: number; name: string; salary: number; status: string }>;
  inventory_movements: Array<{
    id: number;
    product: { id: number; name: string; sku: string };
    qty: number;
    unit_cost: number;
    total_cost: number;
    created_at: string;
  }>;
}

export interface PayrollEmployee {
  id: number;
  name: string;
  salary: number;
  days_present: number;
  hours_worked: number;
  attendance: { normal: number; late: number; absent: number };
}

export interface PayrollReport {
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
  payments?: CheckPayment[];
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

export interface Station {
  id: number;
  name: string;
  is_default: boolean;
  active: boolean;
  position: number;
}

export interface DiningTable {
  id: number;
  name: string;
  active: boolean;
  position: number;
}

export interface CheckItem {
  id: number;
  name: string;
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
  waiter: PersonRef | null;
  opened_at: string;
  total: string;
  counts: ItemCounts;
  mine: boolean;
}

export interface TableSummary extends DiningTable {
  check: CheckSummary | null;
}

export interface TakeoutSummary extends CheckSummary {
  takeout_name: string;
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

export interface TablesResponse {
  results: TableSummary[];
  takeouts: TakeoutSummary[];
  ready_items: ReadyItem[];
  stock_alerts?: number;
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
  station: { id: number; name: string };
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
