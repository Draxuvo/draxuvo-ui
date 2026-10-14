"use client";
// Tarjeta "Apariencia" (perfil y mi perfil): modo y galería de temas. Aplica al instante y guarda
// en la cuenta por separado; si el guardado falla, la elección se queda en este dispositivo.
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { THEME_KEYS, COLOR_MODES, type Appearance } from "@/lib/appearance";
import { profileService } from "@/services/profile";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { useAppearance } from "./appearance-provider";
import { ThemeSwatch } from "./theme-swatch";

export function AppearanceCard() {
  const t = useTranslations("appearance");
  const { theme, mode, setAppearance } = useAppearance();
  const setUser = useAuthStore((state) => state.setUser);

  const save = useMutation({
    mutationFn: (next: Appearance) => profileService.saveAppearance({ theme: next.theme, color_mode: next.mode }),
    onSuccess: (user) => setUser(user),
    onError: () => toast.error(t("saveFailed")),
  });

  function choose(next: Appearance) {
    if (next.theme === theme && next.mode === mode) return;
    setAppearance(next);
    save.mutate(next);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("modeLabel")}</legend>
          <div className="inline-flex flex-wrap gap-1 rounded-etiqueta border border-border bg-muted p-1">
            {COLOR_MODES.map((value) => (
              <label key={value} className="cursor-pointer">
                <input
                  type="radio"
                  name="color-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => choose({ theme, mode: value })}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "inline-block rounded-interior px-3 py-1.5 text-sm font-medium transition-colors duration-120 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                    mode === value ? "bg-card text-card-foreground shadow-etiqueta" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`modes.${value}`)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("themeLabel")}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {THEME_KEYS.map((key) => {
              const active = theme === key;
              const name = t(`themes.${key}.name`);
              return (
                <label key={key} className="block cursor-pointer">
                  <input
                    type="radio"
                    name="color-theme"
                    value={key}
                    checked={active}
                    onChange={() => choose({ theme: key, mode })}
                    aria-label={`${name}. ${t(`themes.${key}.desc`)}`}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "block space-y-2 rounded-etiqueta border-2 bg-card p-2 transition-colors duration-120 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                      active ? "border-foreground" : "border-border hover:border-muted-foreground",
                    )}
                  >
                    <ThemeSwatch theme={key} light={t("previewLight")} dark={t("previewDark")} />
                    <span className="flex items-center justify-between gap-2 px-0.5">
                      <span className="font-heading text-base leading-none font-semibold">{name}</span>
                      {active && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                          <Check className="size-3" strokeWidth={2.5} aria-hidden="true" />
                          {t("active")}
                        </span>
                      )}
                    </span>
                    <span className="block px-0.5 text-xs text-muted-foreground">{t(`themes.${key}.desc`)}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}
