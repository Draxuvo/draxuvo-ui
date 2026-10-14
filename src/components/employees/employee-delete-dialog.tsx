// src/components/employees/employee-delete-dialog.tsx
"use client";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { employeesService } from "@/services/employees";
import type { Employee } from "@/types";

interface EmployeeDeleteDialogProps {
  employee: Employee | null;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeDeleteDialog({ employee, onOpenChange }: EmployeeDeleteDialogProps) {
  const t = useTranslations("employees");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => employeesService.remove(employee!.id),
    onSuccess: () => {
      toast.success(t("deleteSuccess"));
      qc.invalidateQueries({ queryKey: ["employees"] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={!!employee} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("deleteConfirm", { name: employee?.name ?? "" })}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? t("deleting") : t("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
