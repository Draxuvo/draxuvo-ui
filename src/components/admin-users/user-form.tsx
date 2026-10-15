// src/components/admin-users/user-form.tsx
"use client";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Mail } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminUsersService } from "@/services/admin-users";
import { companiesService } from "@/services/companies";
import type { AdminUser } from "@/types";

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: AdminUser | null;
}

export function UserForm({ open, onOpenChange, user }: UserFormProps) {
  const t = useTranslations("adminUsers");
  const qc = useQueryClient();
  const isEdit = !!user;

  const { data: userData } = useQuery({
    queryKey: ["admin-users", user?.id],
    queryFn: () => adminUsersService.getById(user!.id),
    enabled: open && isEdit,
  });

  const { data: companiesData } = useQuery({
    queryKey: ["companies", "all"],
    queryFn: () => companiesService.list(1, "", 100),
    enabled: open,
  });

  const companies = companiesData?.results ?? [];

  const schema = z.object({
    first_name: z.string().min(1, t("firstNameRequired")),
    last_name: z.string().min(1, t("lastNameRequired")),
    second_last_name: z.string().min(1, t("secondLastNameRequired")),
    phone: z.string().min(1, t("phoneRequired")),
    email: z.string().email(t("emailInvalid")),
    role: z.enum(["staff", "manager", "admin", "owner"]),
    active: z.boolean(),
    company_ids: z.array(z.number()),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: "staff", active: true, company_ids: [] },
  });

  const selectedCompanyIds = useWatch({ control, name: "company_ids" }) ?? [];

  const toggleCompany = (id: number, checked: boolean) => {
    const current = getValues("company_ids") ?? [];
    setValue(
      "company_ids",
      checked ? [...current, id] : current.filter((cid) => cid !== id),
      { shouldValidate: true },
    );
  };

  useEffect(() => {
    if (!open) return;
    const src = isEdit ? userData : null;
    reset({
      first_name: src?.first_name ?? "",
      last_name: src?.last_name ?? "",
      second_last_name: src?.second_last_name ?? "",
      phone: src?.phone ?? "",
      email: src?.email ?? "",
      role: src?.role ?? "staff",
      active: src?.active ?? true,
      company_ids: src?.companies?.map((c) => c.id) ?? [],
    });
  }, [open, userData, isEdit, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        first_name: values.first_name,
        last_name: values.last_name,
        second_last_name: values.second_last_name,
        phone: values.phone,
        email: values.email,
        role: values.role,
        active: values.active,
        company_ids: values.company_ids,
      };
      return isEdit
        ? adminUsersService.update(user!.id, payload)
        : adminUsersService.create(payload);
    },
    onSuccess: () => {
      if (isEdit) {
        toast.success(t("updateSuccess"));
      } else {
        toast.success(t("createSuccess"), { description: t("createEmailSent") });
      }
      qc.invalidateQueries({ queryKey: ["admin-users"] });
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

            {/* Nombre + Apellido paterno */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  {t("firstName")}
                </Label>
                <Input placeholder={t("firstNamePlaceholder")} {...register("first_name")} />
                {errors.first_name && (
                  <p className="text-xs text-destructive">{errors.first_name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  {t("lastName")}
                </Label>
                <Input placeholder={t("lastNamePlaceholder")} {...register("last_name")} />
                {errors.last_name && (
                  <p className="text-xs text-destructive">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            {/* Apellido materno + Teléfono */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  {t("secondLastName")}
                </Label>
                <Input placeholder={t("secondLastNamePlaceholder")} {...register("second_last_name")} />
                {errors.second_last_name && (
                  <p className="text-xs text-destructive">{errors.second_last_name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  {t("phone")}
                </Label>
                <Input type="tel" placeholder={t("phonePlaceholder")} {...register("phone")} />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                {t("email")}
              </Label>
              <Input type="email" placeholder={t("emailPlaceholder")} {...register("email")} />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Email notice (only on create) */}
            {!isEdit && (
              <div className="flex items-start gap-2.5 rounded-lg bg-estado-progreso border border-estado-progreso-border px-3.5 py-3">
                <Mail size={14} className="text-estado-progreso-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-estado-progreso-foreground leading-relaxed">
                  {t("createEmailNotice")}
                </p>
              </div>
            )}

            {/* Rol + Estado */}
            <div className={`grid gap-4 ${isEdit ? "grid-cols-2" : "grid-cols-1"}`}>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  {t("role")}
                </Label>
                <select
                  {...register("role")}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="staff">{t("roles.staff")}</option>
                  <option value="manager">{t("roles.manager")}</option>
                  <option value="admin">{t("roles.admin")}</option>
                  <option value="owner">{t("roles.owner")}</option>
                </select>
              </div>

              {isEdit && (
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
              )}
            </div>

            {/* Empresas */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                {t("company")}
              </Label>
              <div className="rounded-md border border-input bg-background overflow-y-auto max-h-40 divide-y divide-border">
                {companies.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground italic">{t("noCompany")}</p>
                ) : (
                  companies.map((c) => {
                    const checked = selectedCompanyIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <span
                          className={`flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0 ${
                            checked
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-input bg-background"
                          }`}
                        >
                          {checked && <Check size={11} strokeWidth={3} />}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={(e) => toggleCompany(c.id, e.target.checked)}
                        />
                        <span className="text-sm text-foreground">{c.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          <div className="px-6 py-4 border-t border-border/60 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
