// src/components/admin-users/user-delete-dialog.tsx
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
import { adminUsersService } from "@/services/admin-users";
import type { AdminUser } from "@/types";

interface UserDeleteDialogProps {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
}

export function UserDeleteDialog({ user, onOpenChange }: UserDeleteDialogProps) {
  const t = useTranslations("adminUsers");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => adminUsersService.remove(user!.id),
    onSuccess: () => {
      toast.success(t("deleteSuccess"));
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      onOpenChange(false);
    },
  });

  const fullName = user
    ? `${user.first_name} ${user.last_name}`
    : "";

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("deleteConfirm", { name: fullName })}
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
