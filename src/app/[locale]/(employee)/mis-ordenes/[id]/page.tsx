// src/app/[locale]/(employee)/mis-ordenes/[id]/page.tsx
"use client";
import { use } from "react";
import { OrderView } from "@/components/work-orders/order-view";

export default function MiOrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <OrderView id={Number(id)} backHref="/mis-ordenes" />;
}
