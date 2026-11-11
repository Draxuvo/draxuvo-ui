// src/components/inventory/product-photo.tsx
// Foto del producto para el menú QR (spec 061): solo dueño y administrador, con el módulo de restaurante. La foto
// viaja aparte del formulario: en un producto existente cada acción se guarda al momento sin tocar los demás campos
// (FR-008); en uno nuevo se queda pendiente y el formulario la sube después de crear el producto.
"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError, isCancel } from "axios";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { inventoryService } from "@/services/inventory";
import type { Product, ProductPhoto as ProductPhotoData, ProductPhotoStyle } from "@/types";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export interface PendingPhoto {
  file: File;
  style: ProductPhotoStyle;
}

/** Motivo por el que el navegador rechaza un archivo antes de subirlo; la API vuelve a validar por el contenido. */
export function photoProblem(file: File): "invalidType" | "tooLarge" | null {
  if (!PHOTO_TYPES.includes(file.type)) return "invalidType";
  if (file.size > PHOTO_MAX_BYTES) return "tooLarge";
  return null;
}

type Props =
  | { productId: number; productName: string; photo: ProductPhotoData | null | undefined; pending?: never; onPendingChange?: never }
  | { productId?: undefined; productName: string; photo?: never; onPendingChange: (pending: PendingPhoto | null) => void };

export function ProductPhoto(props: Props) {
  const t = useTranslations("inventory.photo");
  const qc = useQueryClient();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);

  const existing = props.productId !== undefined;
  const saved = existing ? props.photo ?? null : null;
  // Producto nuevo: la foto elegida vive aquí (la hoja se desmonta al cerrarse) y el formulario la recibe por aviso.
  const [ownPending, setOwnPending] = useState<PendingPhoto | null>(null);
  const pending = existing ? null : ownPending;
  function setPending(next: PendingPhoto | null) {
    setOwnPending(next);
    if (!existing) props.onPendingChange(next);
  }
  const [chosenStyle, setChosenStyle] = useState<ProductPhotoStyle>(saved?.style ?? pending?.style ?? "card");
  // Mientras se guarda un cambio de estilo, se muestra el elegido (si falla, vuelve al guardado).
  const style: ProductPhotoStyle = busy ? chosenStyle : saved?.style ?? pending?.style ?? chosenStyle;

  // Vista previa local del archivo pendiente (producto nuevo) o en subida.
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);
  useEffect(() => () => abortRef.current?.abort(), []);

  function remember(product: Product) {
    qc.setQueryData(["products", product.id], product);
  }

  function failure(err: unknown) {
    if (isCancel(err)) return;
    const code = isAxiosError(err) ? err.response?.data?.error?.details?.code : undefined;
    setError(code === "photo_invalid_type" ? t("invalidType") : code === "photo_too_large" ? t("tooLarge") : t("error"));
  }

  async function choose(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError(null);
    const problem = photoProblem(file);
    if (problem) return setError(t(problem));

    setLocalUrl(URL.createObjectURL(file));
    if (!existing) return setPending({ file, style });

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    try {
      remember(await inventoryService.uploadPhoto(props.productId, file, style, { onProgress: setProgress, signal: controller.signal }));
      toast.success(t("saved"));
    } catch (err) {
      setLocalUrl(null);
      failure(err);
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  }

  async function changeStyle(next: ProductPhotoStyle) {
    setChosenStyle(next);
    setError(null);
    if (!existing) {
      if (pending) setPending({ ...pending, style: next });
      return;
    }
    if (!saved || saved.style === next) return;
    setBusy(true);
    try {
      remember(await inventoryService.updatePhotoStyle(props.productId, next));
      toast.success(t("styleSaved"));
    } catch (err) {
      setChosenStyle(saved.style);
      failure(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setConfirming(false);
    setError(null);
    setLocalUrl(null);
    if (!existing) return setPending(null);
    setBusy(true);
    try {
      remember(await inventoryService.removePhoto(props.productId));
      setChosenStyle("card");
      toast.success(t("removed"));
    } catch (err) {
      failure(err);
    } finally {
      setBusy(false);
    }
  }

  const uploading = progress !== null;
  const serverUrl = saved?.ready ? (style === "thumbnail" ? saved.thumbnail_url : saved.url) : null;
  const previewUrl = uploading || !existing || !serverUrl ? localUrl ?? serverUrl : serverUrl;
  const hasPhoto = !!saved || !!pending;
  const preparing = !!saved && !saved.ready && !uploading;

  return (
    <div className="space-y-2">
      <div>
        <Label htmlFor={inputId} className="text-xs font-medium text-foreground">{t("title")}</Label>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>

      {(previewUrl || preparing) && (
        <div
          className={cn(
            "relative overflow-hidden rounded-md border border-border bg-muted",
            style === "thumbnail" ? "size-24" : "aspect-[4/3] w-full",
          )}
        >
          {previewUrl && (
            // Vista previa con el mismo recorte al centro que hace la API (object-fit: cover).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={t("previewAlt", { name: props.productName })} className="size-full object-cover" />
          )}
          {preparing && !previewUrl && (
            <p role="status" className="flex size-full items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" aria-hidden />
              {t("preparing")}
            </p>
          )}
        </div>
      )}

      {hasPhoto && (
        <fieldset className="space-y-1" disabled={busy || uploading}>
          <legend className="text-xs text-muted-foreground">{t("styleLabel")}</legend>
          <div className="flex gap-4">
            {(["card", "thumbnail"] as const).map((option) => (
              <label key={option} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name={`${inputId}-style`}
                  value={option}
                  checked={style === option}
                  onChange={() => changeStyle(option)}
                />
                {t(option === "card" ? "styleCard" : "styleThumbnail")}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("cropHint")}</p>
        </fieldset>
      )}

      {uploading && (
        <div className="space-y-1" role="status">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("uploading", { percent: progress })}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
              {t("cancelUpload")}
            </Button>
          </div>
        </div>
      )}

      {preparing && previewUrl && (
        <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" aria-hidden />
          {t("preparing")}
        </p>
      )}

      {!existing && pending && <p className="text-xs text-muted-foreground">{t("pendingHint")}</p>}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        className="sr-only"
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
            {hasPhoto ? t("change") : t("add")}
          </Button>
          {hasPhoto && (
            <Button type="button" variant="ghost" size="sm" disabled={busy || uploading} onClick={() => setConfirming(true)}>
              {t("remove")}
            </Button>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
