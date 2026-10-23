// src/components/employees/employee-form.tsx
"use client";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
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
import { employeesService } from "@/services/employees";
import { CreateAccessFields, EditAccess, useAssignableRoles } from "@/components/people/access-section";
import type { CompanyRole, Employee } from "@/types";

interface EmployeeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
}

export function EmployeeForm({ open, onOpenChange, employee }: EmployeeFormProps) {
  const t = useTranslations("employees");
  const qc = useQueryClient();
  const isEdit = !!employee;
  const assignable = useAssignableRoles();
  const [giveAccess, setGiveAccess] = useState(false);
  const [accessRole, setAccessRole] = useState<CompanyRole>("staff");
  // El acceso del alta empieza apagado cada vez que el formulario se cierra.
  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setGiveAccess(false);
      setAccessRole("staff");
    }
    onOpenChange(value);
  };

  const { data: employeeData } = useQuery({
    queryKey: ["employees", employee?.id],
    queryFn: () => employeesService.getById(employee!.id),
    enabled: open && isEdit,
  });

  const schema = z.object({
    name: z.string().min(1, t("nameRequired")),
    position: z.string().optional(),
    department: z.string().optional(),
    salary: z.union([z.coerce.number().positive(), z.literal("")]).optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    status: z.enum(["active", "inactive"]),
  });

  type FormValues = {
    name: string;
    position?: string;
    department?: string;
    salary?: number | "";
    email?: string;
    phone?: string;
    status: "active" | "inactive";
  };

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { status: "active" },
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && !employeeData) return;
    const source = isEdit ? employeeData : null;
    reset({
      name: source?.name ?? "",
      position: source?.position ?? "",
      department: source?.department ?? "",
      salary: source?.salary ? Number(source.salary) : "",
      email: source?.email ?? "",
      phone: source?.phone ?? "",
      status: source?.status ?? "active",
    });
  }, [open, employeeData, isEdit, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        position: values.position || undefined,
        department: values.department || undefined,
        salary: values.salary ? Number(values.salary) : undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        status: values.status,
      };
      return isEdit
        ? employeesService.update(employee!.id, payload)
        : employeesService.create(payload, giveAccess ? { role: assignable.includes(accessRole) ? accessRole : "staff" } : undefined);
    },
    onSuccess: () => {
      toast.success(isEdit ? t("updateSuccess") : t("createSuccess"));
      qc.invalidateQueries({ queryKey: ["employees"] });
      handleOpenChange(false);
    },
  });

  // Dar acceso necesita correo y teléfono (la cuenta se crea con ellos).
  const submit = (v: FormValues) => {
    if (!isEdit && giveAccess) {
      if (!v.email) return setError("email", { message: t("access.emailNeeded") });
      if (!v.phone) return setError("phone", { message: t("access.phoneNeeded") });
    }
    mutation.mutate(v);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">

        <SheetHeader className="px-6 py-5 border-b border-border/60">
          <SheetTitle className="text-base">{isEdit ? t("editTitle") : t("createTitle")}</SheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEdit ? t("editSubtitle") : t("createSubtitle")}
          </p>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(submit)}
          className="flex flex-col flex-1"
        >
          <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto">

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">{t("name")}</Label>
              <Input placeholder={t("namePlaceholder")} {...register("name")} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{t("position")}</Label>
                <Input placeholder={t("positionPlaceholder")} {...register("position")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{t("department")}</Label>
                <Input placeholder={t("departmentPlaceholder")} {...register("department")} />
              </div>
            </div>

            <div className={`grid gap-4 ${isEdit ? "grid-cols-2" : "grid-cols-1"}`}>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{t("salary")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={t("salaryPlaceholder")}
                  {...register("salary")}
                />
              </div>
              {isEdit && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">{t("status")}</Label>
                  <select
                    {...register("status")}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="active">{t("active")}</option>
                    <option value="inactive">{t("inactive")}</option>
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{t("email")}</Label>
                <Input
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{t("phone")}</Label>
                <Input placeholder={t("phonePlaceholder")} {...register("phone")} />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>
            </div>

            {!isEdit && assignable.length > 0 && (
              <CreateAccessFields
                enabled={giveAccess}
                onEnabledChange={setGiveAccess}
                role={accessRole}
                onRoleChange={setAccessRole}
              />
            )}
            {isEdit && employeeData && assignable.length > 0 && <EditAccess employee={employeeData} />}

          </div>

          <div className="px-6 py-4 border-t border-border/60 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
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
