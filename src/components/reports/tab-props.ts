import type { ReportPeriod } from "@/hooks/use-report-period";

export interface TabProps {
  period: ReportPeriod;
  /** Solo el super admin: la empresa elegida en la página. */
  companyId?: number;
}
