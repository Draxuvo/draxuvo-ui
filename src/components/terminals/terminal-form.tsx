// src/components/terminals/terminal-form.tsx — alta y edición de una terminal de cobro (spec 015, FR-018).
"use client";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCreateTerminal, useUpdateTerminal } from "@/hooks/use-payment-terminals";
import { TERMINAL_PROVIDERS, type PaymentTerminal, type TerminalProvider } from "@/types";

const SELECT =
  "h-11 w-full rounded-etiqueta border border-border bg-card px-3 text-sm text-foreground foco-etiqueta";

interface TerminalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terminal?: PaymentTerminal | null;
}

export function TerminalForm({ open, onOpenChange, terminal }: TerminalFormProps) {
  // Se vuelve a montar con `key` al abrir otra terminal, así los valores iniciales siempre son los suyos.
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <TerminalFields key={terminal?.id ?? "new"} terminal={terminal} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

type Values = { name: string; provider: TerminalProvider; active: boolean };

function TerminalFields({ terminal, onDone }: { terminal?: PaymentTerminal | null; onDone: () => void }) {
  const t = useTranslations("terminals");
  const create = useCreateTerminal();
  const update = useUpdateTerminal();

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("nameRequired")).max(60, t("nameTooLong")),
        provider: z.enum(TERMINAL_PROVIDERS as unknown as [TerminalProvider, ...TerminalProvider[]]),
        active: z.boolean(),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: terminal?.name ?? "", provider: terminal?.provider ?? "bbva", active: terminal?.active ?? true },
  });

  async function onSubmit(values: Values) {
    const data = { name: values.name.trim(), provider: values.provider, active: values.active };
    try {
      if (terminal) await update.mutateAsync({ id: terminal.id, data });
      else await create.mutateAsync(data);
      toast.success(t("saved"));
      onDone();
    } catch (error) {
      // Un nombre repetido llega como error de validación del campo `name`.
      const details = isAxiosError(error) ? error.response?.data?.error?.details : undefined;
      if (details && typeof details === "object" && "name" in details) setError("name", { message: t("nameTaken") });
    }
  }

  return (
    <>
      <SheetHeader className="border-b border-border/60 px-6 py-5">
        <SheetTitle className="text-base">{terminal ? t("edit") : t("new")}</SheetTitle>
        <SheetDescription className="text-xs text-muted-foreground">{t("formHint")}</SheetDescription>
      </SheetHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col">
        <div className="flex-1 space-y-5 px-6 py-6">
          <div className="space-y-1.5">
            <Label htmlFor="terminal-name" className="text-xs font-medium text-foreground">
              {t("name")}
            </Label>
            <Input id="terminal-name" className="h-11" placeholder={t("namePlaceholder")} {...register("name")} />
            {errors.name && (
              <p role="alert" className="text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="terminal-provider" className="text-xs font-medium text-foreground">
              {t("provider")}
            </Label>
            <select id="terminal-provider" className={SELECT} {...register("provider")}>
              {TERMINAL_PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {t(`providers.${provider}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="terminal-active" className="text-sm font-medium text-foreground">
              {t("active")}
            </Label>
            <Controller
              control={control}
              name="active"
              render={({ field }) => <Switch id="terminal-active" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border/60 px-6 py-4">
          <Button type="button" variant="outline" className="min-h-11" onClick={onDone}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="min-h-11" disabled={isSubmitting || create.isPending || update.isPending}>
            {t("save")}
          </Button>
        </div>
      </form>
    </>
  );
}
