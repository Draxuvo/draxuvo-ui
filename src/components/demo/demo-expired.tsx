// src/components/demo/demo-expired.tsx
// «Tu demostración terminó» (spec 039): bloquea la pantalla cuando la API dice que la demo venció, terminó o ya se
// borró. Ofrece abrir otra o crear la cuenta; ninguna de las dos necesita que la demo anterior siga viva.
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEMO_EXPIRED_EVENT, readDemoInfo } from "@/lib/demo";
import { useLeaveDemo } from "@/hooks/use-demo";

export function DemoExpired() {
  const t = useTranslations("demo.expired");
  const { leave, pending } = useLeaveDemo();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const onExpired = () => setExpired(true);
    window.addEventListener(DEMO_EXPIRED_EVENT, onExpired);
    // No espera a que la API lo diga: salta justo cuando llega la hora en que termina la demo.
    const info = readDemoInfo();
    const timer = info ? window.setTimeout(onExpired, Math.max(new Date(info.expiresAt).getTime() - Date.now(), 0)) : undefined;
    return () => {
      window.removeEventListener(DEMO_EXPIRED_EVENT, onExpired);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!expired) return null;
  const plan = readDemoInfo()?.plan;

  return (
    <Dialog open modal>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-alerta/10">
              <Clock size={20} strokeWidth={1.75} className="text-alerta" aria-hidden />
            </div>
            <DialogTitle className="text-base">{t("title")}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">{t("body")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={pending} onClick={() => void leave("left", plan, `/demo${plan ? `?plan=${plan}` : ""}`)}>
            {t("another")}
          </Button>
          <Button disabled={pending} onClick={() => void leave("signup", plan)}>
            {t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
