"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { differenceInDays } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getSubscription } from "@/services/subscription";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function SubscriptionGuard() {
  const t = useTranslations("subscription");
  const { user, logout } = useAuthStore();

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
    retry: false,
    enabled: !!user && user.role !== "super_admin",
  });

  if (!subscription) return null;

  const isTrial = subscription.status === "trialing";
  const daysLeft =
    isTrial && subscription.trial_ends_at
      ? Math.max(
          0,
          differenceInDays(new Date(subscription.trial_ends_at), new Date()),
        )
      : null;

  const isExpired =
    subscription.status === "expired" || (isTrial && daysLeft === 0);

  if (!isExpired) return null;

  return (
    <Dialog open modal>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <DialogTitle className="text-base">
              {t("expiredModalTitle")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-zinc-600 pl-13">
            {t("expiredModalDesc")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={logout}>
            {t("logout")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
