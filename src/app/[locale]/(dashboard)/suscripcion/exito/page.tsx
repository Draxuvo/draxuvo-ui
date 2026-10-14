"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAppRouter } from "@/hooks/use-router";
import { useAuthStore } from "@/store/auth";
import { getSubscription } from "@/services/subscription";

const POLL_MS = 2000;
const MAX_WAIT_MS = 60_000;

export default function SuscripcionExitoPage() {
  const t = useTranslations("subscription");
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const [timedOut, setTimedOut] = useState(false);

  // El estado solo cambia por webhook: se descarta la caché y se consulta hasta ver `active`.
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["subscription", companyId] });
    const timer = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, [queryClient, companyId]);

  const { data, isFetchedAfterMount } = useQuery({
    queryKey: ["subscription", companyId],
    queryFn: getSubscription,
    retry: false,
    refetchInterval: (query) =>
      timedOut || query.state.data?.status === "active" ? false : POLL_MS,
  });

  const confirmed = isFetchedAfterMount && data?.status === "active";

  useEffect(() => {
    if (confirmed) router.replace("/suscripcion");
  }, [confirmed, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Loader2 size={32} className={timedOut ? "text-muted-foreground" : "animate-spin text-muted-foreground"} />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">{t("processingTitle")}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {timedOut ? t("processingSlow") : t("processingDesc")}
        </p>
      </div>
      {timedOut && (
        <Button variant="outline" onClick={() => router.push("/suscripcion")}>
          {t("cancelledBack")}
        </Button>
      )}
    </div>
  );
}
