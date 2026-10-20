// src/app/[locale]/(dashboard)/terminales/page.tsx
// Terminales de cobro de la empresa activa (spec 015, US2): admin y dueño las dan de alta con su proveedor
// para que el operador elija en cuál cobró. Draxuvo no se conecta con ellas en esta fase.
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TerminalForm } from "@/components/terminals/terminal-form";
import { TerminalList } from "@/components/terminals/terminal-list";
import { usePaymentTerminals } from "@/hooks/use-payment-terminals";
import { useAppRouter } from "@/hooks/use-router";
import { useAuthStore } from "@/store/auth";
import type { PaymentTerminal } from "@/types";

const ADMIN_ROLES = new Set(["admin", "owner", "super_admin"]);

export default function TerminalesPage() {
  const t = useTranslations("terminals");
  const router = useAppRouter();
  const role = useAuthStore((s) => s.role);
  const canManage = !!role && ADMIN_ROLES.has(role);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentTerminal | null>(null);

  // Manager y staff no administran terminales (staff ya lo bloquea proxy.ts; la API también).
  useEffect(() => {
    if (role && !canManage) router.replace(role === "staff" ? "/mis-ordenes" : "/inicio");
  }, [role, canManage, router]);

  const { data, isLoading, isError } = usePaymentTerminals({ includeInactive: true, enabled: canManage });

  if (!canManage) return null;

  function openForm(terminal: PaymentTerminal | null) {
    setEditing(terminal);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium text-foreground">{t("title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button className="min-h-11 gap-1.5" onClick={() => openForm(null)}>
          <Plus size={16} aria-hidden="true" />
          {t("new")}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-etiqueta" />
          ))}
        </div>
      ) : isError ? (
        <p role="alert" className="text-destructive">
          {t("loadError")}
        </p>
      ) : (
        <TerminalList terminals={data ?? []} onEdit={(terminal) => openForm(terminal)} />
      )}

      <TerminalForm open={formOpen} onOpenChange={setFormOpen} terminal={editing} />
    </div>
  );
}
