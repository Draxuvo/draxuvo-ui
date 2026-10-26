// src/components/demo/invite-dialog.tsx
// Crear una invitación a la demo (spec 039, equipo comercial). El enlace con el token se muestra una sola vez.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_PLANS, DEMO_SCENARIOS } from "@/lib/demo";
import { demoService } from "@/services/demo";
import type { DemoInvite, DemoPlan, DemoScenario } from "@/types";

const SELECT =
  "h-10 w-full rounded-etiqueta border border-input bg-card px-2 text-sm foco-etiqueta hover:border-foreground/40";

export function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("demo.admin.dialog");
  const tp = useTranslations("plans");
  const ts = useTranslations("demo.entry.scenarios");
  const qc = useQueryClient();

  const [plan, setPlan] = useState<DemoPlan>("pro");
  const [scenario, setScenario] = useState<DemoScenario>("pro_service");
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("14");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<DemoInvite | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: () => demoService.createInvite({ plan, scenario, label: label.trim(), expires_in_days: Number(days) }),
    onSuccess: (invite) => {
      setCreated(invite);
      qc.invalidateQueries({ queryKey: ["demo-invites"] });
    },
    onError: () => setError(t("errorGeneric")),
  });

  function reset() {
    setPlan("pro");
    setScenario("pro_service");
    setLabel("");
    setDays("14");
    setError(null);
    setCreated(null);
    setCopied(false);
  }

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function pickPlan(next: DemoPlan) {
    setPlan(next);
    setScenario(DEMO_SCENARIOS[next][0]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const length = label.trim().length;
    const n = Number(days);
    if (length < 2 || length > 120) return setError(t("errorLabel"));
    if (!Number.isInteger(n) || n < 1 || n > 60) return setError(t("errorDays"));
    setError(null);
    create.mutate();
  }

  async function copy() {
    if (!created?.url) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
      toast.success(t("copied"));
    } catch {
      // Sin permiso de portapapeles el enlace sigue visible para copiarlo a mano.
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("doneTitle")}</DialogTitle>
              <DialogDescription>{t("doneBody")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="invite-link">{t("link")}</Label>
              <div className="flex gap-2">
                <Input id="invite-link" readOnly value={created.url ?? ""} onFocus={(e) => e.currentTarget.select()} />
                <Button type="button" variant="outline" onClick={copy} className="shrink-0 gap-2">
                  {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                  {t("copy")}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => close(false)}>{t("close")}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-plan">{t("plan")}</Label>
                <select id="invite-plan" className={SELECT} value={plan} onChange={(e) => pickPlan(e.target.value as DemoPlan)}>
                  {DEMO_PLANS.map((key) => (
                    <option key={key} value={key}>
                      {tp(key)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-scenario">{t("scenario")}</Label>
                <select
                  id="invite-scenario"
                  className={SELECT}
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value as DemoScenario)}
                  disabled={DEMO_SCENARIOS[plan].length === 1}
                >
                  {DEMO_SCENARIOS[plan].map((key) => (
                    <option key={key} value={key}>
                      {ts(key)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-label">{t("label")}</Label>
              <Input id="invite-label" value={label} maxLength={120} placeholder={t("labelPlaceholder")} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-days">{t("days")}</Label>
              <Input id="invite-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className="w-28" />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? t("creating") : t("create")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
