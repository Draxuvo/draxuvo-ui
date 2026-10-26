// src/components/layout/employee-shell.tsx
// Marco del personal (staff): el mismo esqueleto que el panel (riel en escritorio, cajón en
// celular) sobre anaquel, sin desbordar a 375px.
import { EmployeeSidebar } from "./employee-sidebar";
import { EmployeeHeader } from "./employee-header";
import { SidebarProvider } from "./sidebar-context";
import { EntryDialog } from "@/components/attendance/entry-dialog";
import { DemoBanner } from "@/components/demo/demo-banner";

export function EmployeeShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-svh bg-background text-foreground">
        <EmployeeSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <EmployeeHeader />
          <DemoBanner />
          <EntryDialog />
          <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
