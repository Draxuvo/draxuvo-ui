// src/components/people/access-section.tsx
// Acceso al panel dentro de la ficha del empleado (spec 036; antes la pestaña Acceso de Personal). Al crear, un
// interruptor y un rol; al editar, dar acceso, cambiar el rol o quitarlo. Nadie ofrece un rol mayor al suyo; los
// códigos de error de la API se muestran como mensajes propios (role_not_allowed, already_member, last_owner).
"use client";
import { useDemoInfo } from "@/hooks/use-demo";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth";
import { employeesService } from "@/services/employees";
import type { CompanyRole, Employee } from "@/types";
import { Select } from "@/components/ui/select";

const ROLES: CompanyRole[] = ["staff", "admin", "owner"];
const RANK: Record<CompanyRole, number> = { staff: 0, admin: 1, owner: 2 };
const ERROR_CODES = ["role_not_allowed", "already_member", "last_owner", "email_required", "no_user"] as const;

function errorCode(error: unknown): (typeof ERROR_CODES)[number] | "generic" {
  if (!isAxiosError(error)) return "generic";
  const code = error.response?.data?.error?.details?.code;
  return (ERROR_CODES as readonly string[]).includes(code) ? code : "generic";
}

/** Roles que quien consulta puede dar: hasta el suyo (el super admin, también en su empresa, llega a owner). */
export function useAssignableRoles(): CompanyRole[] {
  const { user, role } = useAuthStore();
  // Solo administrador y dueño administran el acceso; el super admin llega a owner.
  if (role !== "admin" && role !== "owner") return [];
  const isSuperAdmin = user?.role === "super_admin";
  const myRank = isSuperAdmin ? RANK.owner : RANK[role];
  return ROLES.filter((r) => RANK[r] <= myRank);
}

/** Rol del acceso al crear el empleado: se muestra solo con el interruptor encendido. */
export function CreateAccessFields({
  enabled,
  onEnabledChange,
  role,
  onRoleChange,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  role: CompanyRole;
  onRoleChange: (r: CompanyRole) => void;
}) {
  const t = useTranslations("employees.access");
  const tRoles = useTranslations("adminUsers.roles");
  const assignable = useAssignableRoles();

  return (
    <div className="space-y-3 rounded-etiqueta border border-border p-4">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        <span>
          <span className="block font-medium text-foreground">{t("give")}</span>
          <span className="block text-xs text-muted-foreground">{t("giveHint")}</span>
        </span>
      </label>
      {enabled && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">{t("role")}</Label>
          <Select aria-label={t("role")} value={role} onChange={(e) => onRoleChange(e.target.value as CompanyRole)}>
            {assignable.map((r) => (
              <option key={r} value={r}>
                {tRoles(r)}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">{t("roleHint")}</p>
        </div>
      )}
    </div>
  );
}

/** Acceso de un empleado que ya existe: dar, cambiar el rol o quitar. */
export function EditAccess({ employee }: { employee: Employee }) {
  const t = useTranslations("employees.access");
  const tRoles = useTranslations("adminUsers.roles");
  const td = useTranslations("demo");
  const { isDemo } = useDemoInfo();
  const qc = useQueryClient();
  const assignable = useAssignableRoles();
  const isSuperAdmin = useAuthStore((s) => s.user?.role === "super_admin");

  const access = employee.access;
  const [granting, setGranting] = useState(false);
  const [email, setEmail] = useState(employee.email ?? "");
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [role, setRole] = useState<CompanyRole>("staff");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const done = (message: string) => {
    // En una demo el correo de acceso no sale (spec 039): se dice que fue simulado.
    toast.success(isDemo ? td("simulated") : message);
    qc.invalidateQueries({ queryKey: ["employees"] });
  };
  const fail = (error: unknown) => {
    toast.error(t(`errors.${errorCode(error)}`));
    qc.invalidateQueries({ queryKey: ["employees"] });
  };

  const grant = useMutation({
    mutationFn: () => employeesService.grantAccess(employee.id, { email: email.trim(), phone: phone.trim() || undefined, role }),
    onSuccess: () => {
      setGranting(false);
      done(t("granted", { email }));
    },
    onError: fail,
  });
  const change = useMutation({
    mutationFn: (next: CompanyRole) => employeesService.changeAccess(employee.id, next),
    onSuccess: (updated) => done(t("roleUpdated", { name: employee.name, role: tRoles(updated.access?.role ?? "staff") })),
    onError: fail,
  });
  const revoke = useMutation({
    mutationFn: () => employeesService.revokeAccess(employee.id),
    onSuccess: () => {
      setConfirmRemove(false);
      done(t("revoked", { name: employee.name }));
    },
    onError: (e) => {
      setConfirmRemove(false);
      fail(e);
    },
  });

  return (
    <div className="space-y-3 rounded-etiqueta border border-border p-4" data-testid="employee-access">
      <p className="text-sm font-medium text-foreground">{t("title")}</p>

      {access ? (
        <>
          <p className="text-xs text-muted-foreground">{access.email}</p>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">{t("role")}</Label>
            <Select
              aria-label={t("roleOf", { name: employee.name })}
             
              value={access.role}
              disabled={change.isPending}
              onChange={(e) => change.mutate(e.target.value as CompanyRole)}
            >
              {/* El rol actual siempre se muestra, aunque sea mayor al que se puede asignar. */}
              {ROLES.filter((r) => assignable.includes(r) || r === access.role).map((r) => (
                <option key={r} value={r} disabled={!assignable.includes(r)}>
                  {tRoles(r)}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setConfirmRemove(true)}>
            {t("revoke")}
          </Button>
        </>
      ) : granting ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">{t("email")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">{t("phone")}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">{t("role")}</Label>
            <Select aria-label={t("role")} value={role} onChange={(e) => setRole(e.target.value as CompanyRole)}>
              {assignable.map((r) => (
                <option key={r} value={r}>
                  {tRoles(r)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setGranting(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" size="sm" disabled={grant.isPending || !email.trim() || !phone.trim()} onClick={() => grant.mutate()}>
              {grant.isPending ? t("sending") : t("send")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t("none")}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setGranting(true)}>
            {t("give")}
          </Button>
        </>
      )}

      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("revokeTitle")}</DialogTitle>
            <DialogDescription>{t("revokeBody", { name: employee.name })}</DialogDescription>
          </DialogHeader>
          {isSuperAdmin && access?.role === "owner" && (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
              {t("lastOwnerWarning")}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(false)} disabled={revoke.isPending}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={() => revoke.mutate()} disabled={revoke.isPending}>
              {revoke.isPending ? t("revoking") : t("revokeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
