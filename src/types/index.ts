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
  role: "staff" | "manager" | "admin" | "owner" | "super_admin";
  active: boolean;
  companies: Company[];
}

export interface Company {
  id: number;
  name: string;
  slug: string;
  active: boolean;
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
  role: "staff" | "manager" | "admin" | "owner";
  active: boolean;
  companies: Pick<Company, "id" | "name" | "slug">[];
  created_at: string;
}

export interface Employee {
  id: number;
  name: string;
  position?: string;
  department?: string;
  salary?: number | string;
  email?: string;
  phone?: string;
  status: "active" | "inactive";
  created_at: string;
}

export interface Attendance {
  id: number;
  employee_id: number;
  checkin_at: string;
  checkout_at?: string;
  lat?: number;
  lng?: number;
  attendance_type: "normal" | "late" | "absent";
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

export interface WorkOrderItem {
  id: number;
  description: string;
  quantity: number;
  unit?: string;
  unit_price?: number;
  subtotal?: number;
  status: "pending" | "completed";
  position: number;
  product_id?: number;
  product?: Pick<Product, "id" | "name" | "sku">;
  completed_at?: string;
}

export interface WorkOrder {
  id: number;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "in_review" | "completed" | "cancelled";
  due_date?: string;
  completed_at?: string;
  notes?: string;
  progress: number;
  total?: number;
  employee?: { id: number; name: string };
  items?: WorkOrderItem[];
  items_count: number;
  items_done: number;
  created_at: string;
}

export interface DashboardStats {
  employees: {
    total: number;
    active: number;
    inactive: number;
  };
  users: {
    total: number;
    by_role: Record<string, number>;
  };
  work_orders: {
    total: number;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
  };
  tickets: {
    total: number;
    pending: number;
    paid: number;
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

export interface TicketItem {
  id: number;
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  subtotal: number;
}

export interface Ticket {
  id: number;
  folio: string;
  work_order_id: number;
  work_order?: {
    id: number;
    title: string;
    description?: string;
    employee?: { id: number; name: string };
  };
  status: "pending" | "paid";
  total: number;
  items?: TicketItem[];
  notes?: string;
  created_at: string;
  paid_at?: string;
}
