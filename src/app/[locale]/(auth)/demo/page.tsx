// src/app/[locale]/(auth)/demo/page.tsx
// Demo por plan (spec 039): pública, también para quien ya tiene sesión (la confirmación la pide el formulario).
"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DemoEntry } from "@/components/demo/demo-entry";
import { DemoShell } from "@/components/demo/demo-shell";
import { planFromParam } from "@/lib/demo";

function DemoPage() {
  const searchParams = useSearchParams();
  const plan = planFromParam(searchParams.get("plan")) ?? "pro";
  return (
    <DemoShell>
      {/* `key` reinicia el formulario si el plan de la URL cambia */}
      <DemoEntry key={plan} initialPlan={plan} />
    </DemoShell>
  );
}

export default function DemoRoute() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <DemoPage />
    </Suspense>
  );
}
