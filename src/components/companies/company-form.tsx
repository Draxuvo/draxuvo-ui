// src/components/companies/company-form.tsx
"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { companiesService } from "@/services/companies";
import type { Company } from "@/types";

interface CompanyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company | null;
}

export function CompanyForm({ open, onOpenChange, company }: CompanyFormProps) {
  const t = useTranslations("companies");
  const qc = useQueryClient();
  const isEdit = !!company;

  const { data: companyData } = useQuery({
    queryKey: ["companies", company?.id],
    queryFn: () => companiesService.getById(company!.id),
    enabled: open && isEdit,
  });

  const schema = z.object({
    name: z.string().min(1, t("nameRequired")),
    active: z.boolean(),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { active: true },
  });

  useEffect(() => {
    if (!open) return;
    const src = isEdit ? companyData : null;
    reset({
      name: src?.name ?? "",
      active: src?.active ?? true,
    });
  }, [open, companyData, isEdit, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit
        ? companiesService.update(company!.id, values)
        : companiesService.create(values),
    onSuccess: () => {
      toast.success(isEdit ? t("updateSuccess") : t("createSuccess"));
      qc.invalidateQueries({ queryKey: ["companies"] });
      onOpenChange(false);
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-5 border-b border-border/60">
          <SheetTitle className="text-base">
            {isEdit ? t("editTitle") : t("createTitle")}
          </SheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEdit ? t("editSubtitle") : t("createSubtitle")}
          </p>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col flex-1"
        >
          <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                {t("name")}
              </Label>
              <Input placeholder={t("namePlaceholder")} {...register("name")} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  {t("status")}
                </Label>
                <select
                  {...register("active", { setValueAs: (v) => v === "true" })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="true">{t("active")}</option>
                  <option value="false">{t("inactive")}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border/60 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
