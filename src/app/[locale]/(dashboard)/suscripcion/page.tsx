import { getTranslations } from "next-intl/server";
import { SubscriptionDetail } from "@/components/subscription/subscription-detail";
import { ModuleSettings } from "@/components/subscription/module-settings";

export default async function SuscripcionPage() {
  const t = await getTranslations("subscription");
  return (
    <div className="max-w-2xl">
      <h1 className="sr-only">{t("pageTitle")}</h1>
      <SubscriptionDetail />
      <ModuleSettings />
    </div>
  );
}
