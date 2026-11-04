// src/components/scan/camera-dialog.tsx
// Lector de códigos con la cámara (spec 056): diálogo con video que se queda abierto entre lecturas. Pide el permiso
// al abrirse, filtra rebotes, lee el código más cercano al centro y avisa cada lectura aceptada. Las imágenes se
// procesan en el dispositivo: solo el texto leído sale por `onScan` (FR-018).
"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Flashlight, FlashlightOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createDetector, type Detector } from "@/lib/scan/detector";
import { createDebounce, normalizeCode, pickCentral } from "@/lib/scan/lib";

type Status = "starting" | "ready" | "denied" | "unavailable" | "insecure" | "failed";

const TICK_MS = 100;

interface CameraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama con cada lectura aceptada, de una en una. */
  onScan: (code: string) => Promise<void> | void;
  /** Para pruebas: detector ya armado en lugar del nativo o el polyfill. */
  detector?: Detector;
}

export function CameraDialog({ open, onOpenChange, onScan, detector }: CameraDialogProps) {
  const t = useTranslations("scan");
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const [status, setStatus] = useState<Status>("starting");
  const [announce, setAnnounce] = useState("");
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stream: MediaStream | null = null;
    const debounce = createDebounce();
    let busy = false;

    async function start() {
      setStatus("starting");
      setAnnounce("");
      setHasTorch(false);
      setTorchOn(false);
      if (typeof window !== "undefined" && window.isSecureContext === false) return setStatus("insecure");
      if (!navigator.mediaDevices?.getUserMedia) return setStatus("unavailable");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (error) {
        if (cancelled) return;
        const name = (error as { name?: string })?.name;
        return setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" ? "unavailable" : "failed");
      }
      if (cancelled) return stopStream();
      const track = stream.getVideoTracks?.()[0] ?? null;
      trackRef.current = track;
      setHasTorch(Boolean((track?.getCapabilities?.() as { torch?: boolean } | undefined)?.torch));
      const video = videoRef.current;
      if (!video) return stopStream();
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // El navegador puede rechazar play() si la pestaña se oculta; el ciclo de abajo espera al video.
      }
      let activeDetector: Detector;
      try {
        activeDetector = detector ?? (await createDetector());
      } catch {
        if (!cancelled) setStatus("failed");
        return stopStream();
      }
      if (cancelled) return stopStream();
      setStatus("ready");
      timer = setInterval(async () => {
        if (busy || cancelled || !video.videoWidth) return;
        busy = true;
        try {
          const best = pickCentral(await activeDetector.detect(video), video.videoWidth, video.videoHeight);
          if (!best || cancelled) return;
          const code = normalizeCode(best.value);
          if (!code) return void setAnnounce(t("invalid"));
          if (!debounce.accept(code)) return;
          navigator.vibrate?.(60);
          setAnnounce(t("read", { code }));
          try {
            await onScanRef.current(code);
          } catch {
            // El aviso del error ya lo dio quien procesa el código.
          }
        } catch {
          // Un cuadro que no se pudo leer no detiene la cámara.
        } finally {
          busy = false;
        }
      }, TICK_MS);
    }

    function stopStream() {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      trackRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    void start();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stopStream();
    };
  }, [open, detector, t]);

  async function toggleTorch() {
    const next = !torchOn;
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setHasTorch(false);
    }
  }

  const problem = status === "denied" || status === "unavailable" || status === "insecure" || status === "failed" ? status : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {problem ? (
          <p role="alert" className="rounded-md border border-border bg-muted p-4 text-sm">
            {t(problem)}
          </p>
        ) : (
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} muted playsInline aria-hidden className="size-full object-cover" />
            <div aria-label={t("frame")} className="pointer-events-none absolute inset-x-[10%] inset-y-[30%] rounded-md border-2 border-white/80" />
            {status === "starting" && <p className="absolute inset-0 flex items-center justify-center text-sm text-white">{t("starting")}</p>}
          </div>
        )}

        <p aria-live="polite" className="min-h-5 text-center text-sm text-muted-foreground">
          {announce}
        </p>

        <div className="flex justify-between gap-2">
          {hasTorch ? (
            <Button type="button" variant="outline" onClick={toggleTorch} className="h-11">
              {torchOn ? <FlashlightOff size={16} aria-hidden /> : <Flashlight size={16} aria-hidden />}
              {torchOn ? t("torchOff") : t("torchOn")}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" onClick={() => onOpenChange(false)} className="h-11">
            <X size={16} aria-hidden />
            {t("close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
