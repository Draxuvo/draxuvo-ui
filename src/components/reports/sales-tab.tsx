"use client";
// Ventas de mostrador (spec 050): importe, ventas y unidades del periodo, por producto y por cajero. Las ventas canceladas
// no cuentan. Cada tabla se exporta a CSV.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { reportsService } from "@/services/reports";
import { formatCurrency } from "@/lib/reports/format";
import type { SalesReport } from "@/types";
import type { CsvColumn } from "@/lib/reports/csv";
import { ExportCsvButton } from "./export-csv-button";
import { ReportState } from "./report-state";
import { ReportTable, type Column } from "./report-table";
import { StatTile } from "./stat-tile";
import type { TabProps } from "./tab-props";

type ProductRow = SalesReport["by_product"][number];
type CashierRow = SalesReport["by_cashier"][number];

export function SalesTab({ period, companyId }: TabProps) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const { range } = period;

  const query = useQuery({
    queryKey: ["reports", "sales", range.from, range.to, companyId],
    queryFn: () => reportsService.sales(range, companyId),
    placeholderData: keepPreviousData,
  });
  const report = query.data;
  const products = report?.by_product ?? [];
  const cashiers = report?.by_cashier ?? [];
  const money = (value: number) => formatCurrency(value, locale);
  const cents = (value: number) => formatCurrency(value, locale, true);

  const productColumns: Column<ProductRow>[] = [
    {
      key: "product",
      header: t("sales.colProduct"),
      render: (row) => (
        <>
          <p>{row.name}</p>
          {row.sku && <p className="font-mono text-xs text-muted-foreground">{row.sku}</p>}
        </>
      ),
    },
    { key: "units", header: t("sales.colUnits"), align: "right", render: (row) => row.units },
    { key: "revenue", header: t("sales.colRevenue"), align: "right", render: (row) => <span className="font-medium">{cents(row.revenue)}</span>, total: cents(report?.total_revenue ?? 0) },
  ];
  const productCsv: CsvColumn<ProductRow>[] = [
    { header: t("sales.colProduct"), value: (row) => row.name },
    { header: t("sales.colSku"), value: (row) => row.sku ?? "" },
    { header: t("sales.colUnits"), value: (row) => row.units },
    { header: t("sales.colRevenue"), value: (row) => row.revenue },
  ];
  const cashierColumns: Column<CashierRow>[] = [
    { key: "cashier", header: t("sales.colCashier"), render: (row) => row.name ?? t("sales.unknownCashier") },
    { key: "sales", header: t("sales.colSales"), align: "right", render: (row) => row.sales },
    { key: "revenue", header: t("sales.colRevenue"), align: "right", render: (row) => <span className="font-medium">{cents(row.revenue)}</span> },
  ];
  const cashierCsv: CsvColumn<CashierRow>[] = [
    { header: t("sales.colCashier"), value: (row) => row.name ?? "" },
    { header: t("sales.colSales"), value: (row) => row.sales },
    { header: t("sales.colRevenue"), value: (row) => row.revenue },
  ];

  return (
    <ReportState
      isLoading={query.isLoading}
      isError={query.isError}
      hasData={!!report}
      isEmpty={!!report && report.total_sales === 0}
      onRetry={() => query.refetch()}
      period={period}
    >
      {report && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile hero label={t("sales.revenue")} value={money(report.total_revenue)} />
            <StatTile label={t("sales.count")} value={report.total_sales} />
            <StatTile label={t("sales.units")} value={report.units} />
          </div>
          <ReportTable
            title={t("sales.byProduct")}
            actions={<ExportCsvButton table={t("sales.byProductTable")} range={range} columns={productCsv} rows={products} />}
            columns={productColumns}
            rows={products}
            rowKey={(row) => row.product_id ?? row.name}
            totalLabel={t("total")}
            empty={t("sales.empty")}
          />
          <ReportTable
            title={t("sales.byCashier")}
            actions={<ExportCsvButton table={t("sales.byCashierTable")} range={range} columns={cashierCsv} rows={cashiers} />}
            columns={cashierColumns}
            rows={cashiers}
            rowKey={(row) => row.user_id ?? "none"}
            empty={t("sales.empty")}
          />
        </>
      )}
    </ReportState>
  );
}
