// src/components/business/logo-card.tsx
// Logo propio de la empresa (spec 063, US1): el dueño y el administrador lo suben, cambian y quitan. Cada acción se guarda
// al momento; después se vuelve a pedir la sesión para que el logo nuevo aparezca en el panel sin recargar (research R9).
"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { isAxiosError, isCancel } from "axios";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { companyLogoService } from "@/services/company-logo";
import { useAuthStore } from "@/store/auth";
import { CompanyMark } from "@/components/brand/company-mark";

export const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

/** Motivo por el que el navegador rechaza un archivo antes de subirlo; la API vuelve a validar por el contenido. */
export function logoProblem(file: File): "invalidType" | "tooLarge" | null {
  if (!LOGO_TYPES.includes(file.type)) return "invalidType";
  if (file.size > LOGO_MAX_BYTES) return "tooLarge";
  return null;
}

export function LogoCard({ companyName, logoUrl }: { companyName: string; logoUrl: string | null | undefined }) {
  const t = useTranslations("business.logo");
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);

  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);
  useEffect(() => () => abortRef.current?.abort(), []);

  function failure(err: unknown) {
    if (isCancel(err)) return;
    const code = isAxiosError(err) ? err.response?.data?.error?.details?.code : undefined;
    setError(code === "logo_invalid_type" ? t("invalidType") : code === "logo_too_large" ? t("tooLarge") : t("error"));
  }

  async function refreshSession() {
    try {
      await fetchMe();
    } catch {
      // La sesión se vuelve a leer en la siguiente carga; el logo ya quedó guardado.
    }
  }

  async function choose(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError(null);
    const problem = logoProblem(file);
    if (problem) return setError(t(problem));

    setLocalUrl(URL.createObjectURL(file));
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    try {
      await companyLogoService.upload(file, { onProgress: setProgress, signal: controller.signal });
      await refreshSession();
      toast.success(t("saved"));
    } catch (err) {
      setLocalUrl(null);
      failure(err);
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  }

  async function remove() {
    setConfirming(false);
    setError(null);
    setBusy(true);
    try {
      await companyLogoService.remove();
      setLocalUrl(null);
      await refreshSession();
      toast.success(t("removed"));
    } catch (err) {
      failure(err);
    } finally {
      setBusy(false);
    }
  }

  const uploading = progress !== null;
  const shown = uploading ? localUrl : logoUrl ?? null;
  const hasLogo = !!logoUrl;

  return (
    <section aria-labelledby={`${inputId}-title`} className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 id={`${inputId}-title`} className="text-base font-semibold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      {/* Vista previa en claro y en oscuro: el logo se ve completo, sin recortarse ni deformarse (FR-012). */}
      <div className="grid gap-3 sm:grid-cols-2">
        {(["light", "dark"] as const).map((mode) => (
          <div
            key={mode}
            data-mode={mode}
            className={mode === "light" ? "rounded-md border border-border bg-white p-4" : "rounded-md border border-border bg-neutral-900 p-4"}
          >
            <p className={mode === "light" ? "mb-2 text-xs text-neutral-500" : "mb-2 text-xs text-neutral-400"}>
              {t(mode === "light" ? "previewLight" : "previewDark")}
            </p>
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt={t("previewAlt", { name: companyName })} className="h-16 w-full object-contain" />
            ) : (
              <CompanyMark name={companyName} logoUrl={null} expanded size="lg" />
            )}
          </div>
        ))}
      </div>

      {uploading && (
        <div className="space-y-1" role="status">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" aria-hidden />
              {t("uploading", { percent: progress })}
            </span>
            <button type="button" className="underline" onClick={() => abortRef.current?.abort()}>
              {t("cancelUpload")}
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={LOGO_TYPES.join(",")}
        className="sr-only"
        aria-label={t("choose")}
        onChange={(event) => choose(event.target.files?.[0])}
        disabled={busy || uploading}
      />

      {confirming ? (
        <div role="alert" className="space-y-2 rounded-md border border-border p-3">
          <p className="text-sm">{t("removeConfirm")}</p>
          <div className="flex gap-2">
            <Button type="button" variant="destructive" size="sm" onClick={remove}>{t("removeYes")}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>{t("keep")}</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={busy || uploading} onClick={() => inputRef.current?.click()}>
            <ImagePlus size={14} aria-hidden />
            {hasLogo ? t("change") : t("add")}
          </Button>
          {hasLogo && (
            <Button type="button" variant="ghost" size="sm" disabled={busy || uploading} onClick={() => setConfirming(true)}>
              {t("remove")}
            </Button>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t("rules")}</p>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
