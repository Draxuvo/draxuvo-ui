// src/app/[locale]/(dashboard)/ordenes/[id]/page.tsx
"use client";
import { use, useState } from "react";
import { OrderView } from "@/components/work-orders/order-view";
import { OrderForm } from "@/components/work-orders/order-form";
import type { WorkOrder } from "@/types";

// En Next 16 `params` es una promesa; en un componente cliente se lee con `use`.
export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [editing, setEditing] = useState<WorkOrder | null>(null);

  return (
    <>
      <OrderView id={Number(id)} backHref="/ordenes" onEdit={setEditing} />
      <OrderForm
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        order={editing ?? undefined}
      />
    </>
  );
}
