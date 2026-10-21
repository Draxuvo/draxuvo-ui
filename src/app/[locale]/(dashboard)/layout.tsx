// src/app/[locale]/(dashboard)/layout.tsx
import { LayoutSidebar } from "@/components/layout/layout-sidebar";
import { Header } from "@/components/layout/header";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { TrialBanner } from "@/components/layout/trial-banner";
import { SubscriptionGuard } from "@/components/layout/subscription-guard";
import { EntryDialog } from "@/components/attendance/entry-dialog";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-svh bg-background text-foreground">
        <LayoutSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <TrialBanner />
          <SubscriptionGuard />
          <EntryDialog />
          <main className="min-w-0 flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
