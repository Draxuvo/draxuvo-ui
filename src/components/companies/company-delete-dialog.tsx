// src/components/companies/company-delete-dialog.tsx
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
import { companiesService } from "@/services/companies";
import type { Company } from "@/types";

interface CompanyDeleteDialogProps {
  company: Company | null;
  onOpenChange: (open: boolean) => void;
}

export function CompanyDeleteDialog({
  company,
  onOpenChange,
}: CompanyDeleteDialogProps) {
  const t = useTranslations("companies");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => companiesService.remove(company!.id),
    onSuccess: () => {
      toast.success(t("deleteSuccess"));
      qc.invalidateQueries({ queryKey: ["companies"] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("deleteConfirm", { name: company?.name ?? "" })}
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
