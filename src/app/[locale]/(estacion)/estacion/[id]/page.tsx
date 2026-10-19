// src/app/[locale]/(estacion)/estacion/[id]/page.tsx
"use client";
import { use } from "react";
import { StationBoard } from "@/components/restaurant/station-board";

export default function EstacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <StationBoard stationId={Number(id)} />;
}
