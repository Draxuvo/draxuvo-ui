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
import { cn } from "@/lib/utils";
import type { AdminUser, CompanyRole } from "@/types";
import { Select } from "@/components/ui/select";

const COMPANY_ROLES = ["staff", "admin", "owner"] as const satisfies readonly CompanyRole[];

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
    active: z.boolean(),
    // Una entrada por empresa marcada, con el rol de la persona en ella (spec 014).
    memberships: z.array(z.object({ company_id: z.number(), role: z.enum(COMPANY_ROLES) })),
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
    defaultValues: { active: true, memberships: [] },
  });

  const memberships = useWatch({ control, name: "memberships" }) ?? [];

  const toggleCompany = (id: number, checked: boolean) => {
    const current = getValues("memberships") ?? [];
    setValue(
      "memberships",
      checked
        ? [...current, { company_id: id, role: "staff" }]
        : current.filter((m) => m.company_id !== id),
      { shouldValidate: true },
    );
  };

  const setCompanyRole = (id: number, role: CompanyRole) => {
    setValue(
      "memberships",
      (getValues("memberships") ?? []).map((m) => (m.company_id === id ? { ...m, role } : m)),
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
      active: src?.active ?? true,
      memberships: src?.companies?.map((c) => ({ company_id: c.id, role: c.role })) ?? [],
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
        active: values.active,
        memberships: values.memberships,
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

            {/* Estado */}
            {isEdit && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    {t("status")}
                  </Label>
                  <Select
                    // setValueAs también recibe el booleano que llega por reset(); con solo
                    // `v === "true"` un usuario activo se guardaba como inactivo (spec 014).
                    {...register("active", { setValueAs: (v) => v === true || v === "true" })}
                  >
                    <option value="true">{t("active")}</option>
                    <option value="false">{t("inactive")}</option>
                  </Select>
                </div>
              </div>
            )}

            {/* Empresas, cada una con el rol de la persona en ella */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                {t("company")}
              </Label>
              <p className="text-xs text-muted-foreground">{t("companiesHint")}</p>
              <div className="rounded-md border border-input bg-background overflow-y-auto max-h-56 divide-y divide-border">
                {companies.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground italic">{t("noCompany")}</p>
                ) : (
                  companies.map((c) => {
                    const membership = memberships.find((m) => m.company_id === c.id);
                    const checked = !!membership;
                    return (
                      <div key={c.id} className="flex items-center gap-2 pr-2 hover:bg-muted/50 transition-colors">
                        <label className="flex flex-1 min-w-0 items-center gap-2.5 px-3 py-2 cursor-pointer">
                          <span
                            className={cn(
                              "flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0",
                              checked
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-input bg-background",
                            )}
                          >
                            {checked && <Check size={11} strokeWidth={3} />}
                          </span>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={(e) => toggleCompany(c.id, e.target.checked)}
                          />
                          <span className="text-sm text-foreground truncate">{c.name}</span>
                        </label>
                        {membership && (
                          <Select
                            aria-label={t("companyRole", { company: c.name })}
                            value={membership.role}
                            onChange={(e) => setCompanyRole(c.id, e.target.value as CompanyRole)}
                            className="w-auto shrink-0"
                          >
                            {COMPANY_ROLES.map((role) => (
                              <option key={role} value={role}>{t(`roles.${role}`)}</option>
                            ))}
                          </Select>
                        )}
                      </div>
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
