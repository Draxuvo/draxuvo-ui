"use client";
import { Suspense } from "react";
import { TakeOrderScreen } from "@/components/take-order/take-order-screen";

// `useSearchParams` (el origen "?from=") exige un límite de Suspense.
export default function PedidoPage() {
  return (
    <Suspense fallback={null}>
      <TakeOrderScreen />
    </Suspense>
  );
}
