// src/app/[locale]/(dashboard)/personal/nomina/[runId]/recibo/[paymentId]/page.tsx
// Recibo de una línea de nómina pagada (spec 037). Solo administrador y dueño; los demás roles vuelven a Personal.
"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useAppRouter } from "@/hooks/use-router";
import { useAuthStore } from "@/store/auth";
import { Receipt } from "@/components/payroll/receipt";

const PAYROLL_ROLES = new Set(["admin", "owner"]);

export default function ReceiptPage() {
  const { runId, paymentId } = useParams<{ runId: string; paymentId: string }>();
  const role = useAuthStore((s) => s.role);
  const router = useAppRouter();
  const allowed = !!role && PAYROLL_ROLES.has(role);

  useEffect(() => {
    if (role && !allowed) router.replace("/personal");
  }, [role, allowed, router]);

  if (!allowed) return null;
  return <Receipt runId={Number(runId)} paymentId={Number(paymentId)} />;
}
