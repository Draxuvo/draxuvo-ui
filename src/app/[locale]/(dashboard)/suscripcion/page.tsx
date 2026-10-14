import { SubscriptionDetail } from "@/components/subscription/subscription-detail";
import { ModuleSettings } from "@/components/subscription/module-settings";

export default function SuscripcionPage() {
  return (
    <div className="max-w-2xl">
      <SubscriptionDetail />
      <ModuleSettings />
    </div>
  );
}
