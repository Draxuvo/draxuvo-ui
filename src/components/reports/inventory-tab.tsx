"use client";
// Inventario (spec 033): foto de hoy (existencias, valor, bajo el mínimo) y movimientos del periodo.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { reportsService } from "@/services/reports";
import { formatCurrency } from "@/lib/reports/format";
import type { InventoryReport } from "@/types";
import type { CsvColumn } from "@/lib/reports/csv";
import { ExportCsvButton } from "./export-csv-button";
import { ReportState } from "./report-state";
import { ReportTable, type Column } from "./report-table";
import { StatTile } from "./stat-tile";
import type { TabProps } from "./tab-props";

type LowStock = InventoryReport["stock"]["low_stock"][number];
type Movement = InventoryReport["movements"]["rows"][number];

export function InventoryTab({ period, companyId }: TabProps) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const { range } = period;

  const query = useQuery({
    queryKey: ["reports", "inventory", range.from, range.to, companyId],
    queryFn: () => reportsService.inventory(range, companyId),
    placeholderData: keepPreviousData,
  });
  const report = query.data;
  const lowStock = report?.stock.low_stock ?? [];
  const movements = report?.movements.rows ?? [];
  const unit = (u: string | null) => u ?? "";

  const productCell = (p: { name: string; sku: string }) => (
    <>
      <p>{p.name}</p>
      <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
    </>
  );
  const lowColumns: Column<LowStock>[] = [
    { key: "product", header: t("inventory.colProduct"), render: productCell },
    { key: "stock", header: t("inventory.colStock"), align: "right", render: (p) => <span className="font-medium">{p.stock} {unit(p.unit)}</span> },
    { key: "min", header: t("inventory.colMin"), align: "right", render: (p) => `${p.min_stock} ${unit(p.unit)}` },
  ];
  const lowCsv: CsvColumn<LowStock>[] = [
    { header: t("inventory.colProduct"), value: (p) => p.name },
    { header: t("inventory.colSku"), value: (p) => p.sku },
    { header: t("inventory.colUnit"), value: (p) => p.unit ?? "" },
    { header: t("inventory.colStock"), value: (p) => p.stock },
    { header: t("inventory.colMin"), value: (p) => p.min_stock },
  ];
  const moveColumns: Column<Movement>[] = [
    { key: "product", header: t("inventory.colProduct"), render: productCell },
    { key: "entries", header: t("inventory.colEntries"), align: "right", render: (m) => m.entries },
    { key: "exits", header: t("inventory.colExits"), align: "right", render: (m) => m.exits },
    { key: "adjustments", header: t("inventory.colAdjustments"), align: "right", render: (m) => m.adjustments },
  ];
  const moveCsv: CsvColumn<Movement>[] = [
    { header: t("inventory.colProduct"), value: (m) => m.name },
    { header: t("inventory.colSku"), value: (m) => m.sku },
    { header: t("inventory.colUnit"), value: (m) => m.unit ?? "" },
    { header: t("inventory.colEntries"), value: (m) => m.entries },
    { header: t("inventory.colExits"), value: (m) => m.exits },
    { header: t("inventory.colAdjustments"), value: (m) => m.adjustments },
  ];

  return (
    <ReportState
      isLoading={query.isLoading}
      isError={query.isError}
      hasData={!!report}
      isEmpty={false}
      onRetry={() => query.refetch()}
      period={period}
    >
      {report && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile hero label={t("inventory.value")} value={formatCurrency(report.stock.value, locale)}>
              {report.stock.without_cost > 0 && <p>{t("inventory.withoutCost", { count: report.stock.without_cost })}</p>}
            </StatTile>
            <StatTile label={t("inventory.products")} value={report.stock.counted_products} />
            <StatTile label={t("inventory.lowStock")} value={report.stock.low_stock.length} />
          </div>
          <ReportTable
            title={t("inventory.lowStockTitle")}
            subtitle={t("inventory.today")}
            actions={<ExportCsvButton table={t("inventory.lowStockTable")} range={range} columns={lowCsv} rows={lowStock} />}
            columns={lowColumns}
            rows={lowStock}
            rowKey={(p) => p.id}
            empty={t("inventory.lowStockEmpty")}
          />
          <ReportTable
            title={t("inventory.movementsTitle")}
            subtitle={report.movements.truncated ? t("inventory.truncated") : undefined}
            actions={<ExportCsvButton table={t("inventory.movementsTable")} range={range} columns={moveCsv} rows={movements} />}
            columns={moveColumns}
            rows={movements}
            rowKey={(m) => m.id}
            empty={t("inventory.movementsEmpty")}
          />
        </>
      )}
    </ReportState>
  );
}
