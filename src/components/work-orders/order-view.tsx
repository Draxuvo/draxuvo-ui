"use client";
// Detalle de una orden, compartido por el jefe (/ordenes/[id]) y el empleado (/mis-ordenes/[id]).
// Solo pinta las acciones que la API manda en `allowed_actions`; no repite reglas de rol ni de estado.
import { useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, Camera, MapPin, Phone, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddNote, useCancelOrder, useDeletePhoto, useDeleteWorkOrder, useFinishOrder, useReopenOrder, useStartOrder,
  useUploadPhoto, useVoidCharge, useWorkOrder,
} from "@/hooks/use-work-orders";
import { useAppRouter } from "@/hooks/use-router";
import { useAuthStore } from "@/store/auth";
import type { WorkOrder, WorkOrderAction } from "@/types";
import { ChargeDialog } from "./charge-dialog";
import { OrderHistory } from "./order-history";
import { OrderItems } from "./order-items";
import { OrderSteps } from "./order-steps";
import { PriorityBadge } from "./priority-badge";
import { ProgressBar } from "./progress-bar";
import { StatusBadge } from "./status-badge";

type OrderViewProps = {
  id: number;
  /** Lista a la que regresa: "/ordenes" o "/mis-ordenes". */
  backHref: string;
  /** Abre el formulario de edición (solo se muestra si la API trae `edit`). */
  onEdit?: (order: WorkOrder) => void;
};

type ReasonAction = "cancel" | "void_charge";

export function OrderView({ id, backHref, onEdit }: OrderViewProps) {
  const t = useTranslations("workOrders");
  const locale = useLocale();
  const dateLocale = locale === "en" ? enUS : es;
  const { data: order, isLoading, error, refetch } = useWorkOrder(id);
  const orderMode = useAuthStore((s) => s.user?.companies?.find((c) => c.id === s.selectedCompanyId)?.order_mode ?? "service");

  const start = useStartOrder(id);
  const finish = useFinishOrder(id);
  const reopen = useReopenOrder(id);
  const cancel = useCancelOrder(id);
  const voidCharge = useVoidCharge(id);
  const remove = useDeleteWorkOrder();
  const router = useAppRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [chargeOpen, setChargeOpen] = useState(false);
  const [finishWarning, setFinishWarning] = useState(false);
  const [reasonFor, setReasonFor] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState("");

  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  const backLink = (
    <Link href={`/${locale}${backHref}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground foco-etiqueta">
      <ArrowLeft size={16} aria-hidden="true" />
      {t("backToList")}
    </Link>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (status === 404 || (!order && !error)) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        {backLink}
        <h1 className="font-heading text-2xl font-semibold">{t("notFoundTitle")}</h1>
        <p className="text-muted-foreground">{t("notFoundDesc")}</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        {backLink}
        <p role="alert">{t("loadError")}</p>
        <Button variant="outline" className="h-11" onClick={() => refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const can = (action: WorkOrderAction) => order.allowed_actions?.includes(action) ?? false;
  const showSteps = orderMode === "service" || order.steps_count > 0;
  const showPhotos = orderMode === "service" || (order.photos?.length ?? 0) > 0;
  const pending = order.steps_count - order.steps_done;

  function fail(err: unknown) {
    const code = (err as { response?: { data?: { error?: { details?: { reason?: string } } } } }).response?.data?.error?.details?.reason;
    toast.error(code === "no_items" ? t("errors.no_items") : t("errors.invalid_transition"));
  }

  function onFinish() {
    if (pending > 0 && !finishWarning) {
      setFinishWarning(true);
      return;
    }
    setFinishWarning(false);
    finish.mutate(undefined, { onSuccess: () => toast.success(t("finished")), onError: fail });
  }

  function confirmReason() {
    if (!reasonFor) return;
    const text = reason.trim();
    if (!text) return;
    const mutation = reasonFor === "cancel" ? cancel : voidCharge;
    mutation.mutate(
      { reason: text },
      {
        onSuccess: () => {
          toast.success(reasonFor === "cancel" ? t("cancelledSuccess") : t("voidedSuccess"));
          setReasonFor(null);
          setReason("");
        },
        onError: fail,
      },
    );
  }

  // La acción principal es una sola: la siguiente del flujo.
  let primary: { label: string; run: () => void; pending: boolean } | null = null;
  if (can("start")) primary = { label: t("actions.start"), run: () => start.mutate(undefined, { onSuccess: () => toast.success(t("started")), onError: fail }), pending: start.isPending };
  else if (can("finish")) primary = { label: t("actions.finish"), run: onFinish, pending: finish.isPending };
  else if (can("charge")) primary = { label: t("actions.charge"), run: () => setChargeOpen(true), pending: false };

  const secondary = (
    <>
      {can("start") && can("finish") && (
        <Button variant="outline" className="h-11" onClick={onFinish} disabled={finish.isPending}>
          {t("actions.finish")}
        </Button>
      )}
      {can("reopen") && (
        <Button variant="outline" className="h-11" onClick={() => reopen.mutate(undefined, { onError: fail })} disabled={reopen.isPending}>
          {t("actions.reopen")}
        </Button>
      )}
      {can("edit") && onEdit && (
        <Button variant="outline" className="h-11" onClick={() => onEdit(order)}>
          {t("actions.edit")}
        </Button>
      )}
      {can("cancel") && (
        <Button variant="outline" className="h-11 text-destructive" onClick={() => setReasonFor("cancel")}>
          {t("actions.cancel")}
        </Button>
      )}
      {can("void_charge") && (
        <Button variant="outline" className="h-11 text-destructive" onClick={() => setReasonFor("void_charge")}>
          {t("actions.voidCharge")}
        </Button>
      )}
      {can("delete") && (
        <Button variant="outline" className="h-11 text-destructive" onClick={() => setDeleteOpen(true)}>
          {t("actions.delete")}
        </Button>
      )}
      {order.ticket && order.status === "paid" && (
        <Button variant="outline" className="h-11" onClick={() => setChargeOpen(true)}>
          {t("actions.viewTicket")}
        </Button>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-5xl pb-28 lg:pb-0">
      {backLink}

      <header className="mt-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold sm:text-3xl">{order.title}</h1>
          <StatusBadge status={order.status} />
          {orderMode === "service" && <PriorityBadge priority={order.priority} />}
        </div>
        <ul className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {order.customer_name && (
            <li className="flex items-center gap-1">
              <User size={14} aria-hidden="true" />
              {order.customer_name}
            </li>
          )}
          {order.customer_phone && (
            <li>
              <a href={`tel:${order.customer_phone}`} className="flex min-h-6 items-center gap-1 hover:text-foreground">
                <Phone size={14} aria-hidden="true" />
                {order.customer_phone}
              </a>
            </li>
          )}
          {order.customer_address && (
            <li className="flex items-center gap-1">
              <MapPin size={14} aria-hidden="true" />
              {order.customer_address}
            </li>
          )}
          <li>
            {t("assignedTo")}: {order.employee?.name ?? t("unassigned")}
          </li>
          {order.due_date && orderMode === "service" && (
            <li>
              {t("dueDate")}: {format(new Date(order.due_date), "d MMM, HH:mm", { locale: dateLocale })}
            </li>
          )}
        </ul>
        {showSteps && order.steps_count > 0 && <ProgressBar steps_done={order.steps_done} steps_count={order.steps_count} />}
        {order.status === "cancelled" && order.cancel_reason && (
          <p className="rounded-etiqueta bg-estado-cancelada p-3 text-sm text-estado-cancelada-foreground">
            {t("actions.cancelledNote", { reason: order.cancel_reason })}
          </p>
        )}
      </header>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          {showSteps && <OrderSteps order={order} />}
          <OrderItems order={order} />
          {showPhotos && <PhotosSection order={order} canAdd={can("add_photo")} />}
          <NotesSection order={order} canAdd={can("add_note")} />
          <OrderHistory order={order} />
        </div>

        <aside className="hidden space-y-3 lg:block" aria-label={t("primaryAction")}>
          <div className="sticky top-20 space-y-3">
            {primary && (
              <Button className="h-12 w-full text-base" onClick={primary.run} disabled={primary.pending}>
                {primary.label}
              </Button>
            )}
            {order.charge_blocked_reason === "no_items" && <p className="text-sm text-muted-foreground">{t("errors.no_items")}</p>}
            <div className="flex flex-col gap-2 [&>button]:w-full">{secondary}</div>
          </div>
        </aside>
      </div>

      {/* Celular: la acción principal queda fija abajo y las demás en una fila. */}
      <div role="region" aria-label={t("aria.bottomBar")} className="fixed inset-x-0 bottom-0 z-30 space-y-2 border-t border-border bg-card p-3 lg:hidden">
        {order.charge_blocked_reason === "no_items" && <p className="text-sm text-muted-foreground">{t("errors.no_items")}</p>}
        {primary && (
          <Button className="h-12 w-full text-base" onClick={primary.run} disabled={primary.pending}>
            {primary.label}
          </Button>
        )}
        <div className="flex flex-wrap gap-2">{secondary}</div>
      </div>

      <ChargeDialog order={order} open={chargeOpen} onOpenChange={setChargeOpen} />

      <Dialog open={finishWarning} onOpenChange={setFinishWarning}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("actions.finish")}</DialogTitle>
            <DialogDescription>{t("actions.pendingStepsWarning", { count: pending })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setFinishWarning(false)}>
              {t("actions.dismiss")}
            </Button>
            <Button className="h-11" onClick={onFinish}>
              {t("actions.finishAnyway")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("actions.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("actions.deleteConfirm", { title: order.title })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setDeleteOpen(false)}>
              {t("actions.dismiss")}
            </Button>
            <Button
              variant="destructive"
              className="h-11"
              disabled={remove.isPending}
              onClick={() => remove.mutate(order.id, { onSuccess: () => { toast.success(t("deleteSuccess")); router.replace(backHref); }, onError: fail })}
            >
              {remove.isPending ? t("actions.deleting") : t("actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reasonFor !== null} onOpenChange={(open) => !open && setReasonFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{reasonFor === "cancel" ? t("actions.cancelTitle") : t("actions.voidTitle")}</DialogTitle>
            <DialogDescription>{reasonFor === "cancel" ? t("actions.cancelDesc") : t("actions.voidDesc")}</DialogDescription>
          </DialogHeader>
          <label htmlFor="order-reason" className="text-sm font-medium">
            {t("actions.reasonLabel")}
          </label>
          <Input id="order-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("actions.reasonPlaceholder")} className="h-11" autoFocus />
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setReasonFor(null)}>
              {reasonFor === "cancel" ? t("actions.cancelKeep") : t("actions.dismiss")}
            </Button>
            <Button variant="destructive" className="h-11" disabled={!reason.trim() || cancel.isPending || voidCharge.isPending} onClick={confirmReason}>
              {reasonFor === "cancel" ? t("actions.cancelConfirm") : t("actions.voidConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PhotosSection({ order, canAdd }: { order: WorkOrder; canAdd: boolean }) {
  const t = useTranslations("workOrders");
  const upload = useUploadPhoto(order.id);
  const remove = useDeletePhoto(order.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [failedFile, setFailedFile] = useState<File | null>(null);
  const photos = order.photos ?? [];

  function send(file: File) {
    upload.mutate(
      { file },
      {
        onSuccess: () => {
          setFailedFile(null);
          toast.success(t("photos.uploadSuccess"));
        },
        onError: () => setFailedFile(file),
      },
    );
  }

  return (
    <section aria-labelledby="order-photos-title" className="space-y-3">
      <h2 id="order-photos-title" className="font-heading text-lg font-semibold">
        {t("photos.title")}
      </h2>
      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("photos.empty")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.id} className="relative overflow-hidden rounded-etiqueta border border-border bg-card">
              <a href={photo.url} target="_blank" rel="noreferrer" aria-label={t("photos.view")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- foto subida por el usuario */}
                <img src={photo.url} alt={photo.description ?? t("photos.title")} className="aspect-square w-full object-cover" />
              </a>
              <p className="px-2 py-1 text-xs text-muted-foreground">{t("photos.uploadedBy", { name: photo.uploaded_by.name })}</p>
              {canAdd && (
                <button
                  type="button"
                  onClick={() => remove.mutate(photo.id)}
                  aria-label={t("photos.delete")}
                  className="absolute top-1 right-1 grid size-9 place-items-center rounded-full bg-card/90 text-destructive foco-etiqueta"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canAdd && (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) send(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" className="h-11 gap-2" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
            <Camera size={16} aria-hidden="true" />
            {upload.isPending ? t("photos.uploading") : t("photos.add")}
          </Button>
          {failedFile && (
            <p role="alert" className="flex items-center gap-3 text-sm text-destructive">
              {t("photos.uploadError")}
              <Button size="sm" variant="outline" className="h-9" onClick={() => send(failedFile)}>
                {t("photos.retry")}
              </Button>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function NotesSection({ order, canAdd }: { order: WorkOrder; canAdd: boolean }) {
  const t = useTranslations("workOrders");
  const add = useAddNote(order.id);
  const [text, setText] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    add.mutate(value, { onSuccess: () => setText("") });
  }

  if (!canAdd) return null;
  return (
    <section aria-labelledby="order-notes-title" className="space-y-2">
      <h2 id="order-notes-title" className="font-heading text-lg font-semibold">
        {t("notesSection.title")}
      </h2>
      <form onSubmit={submit} className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("notesSection.placeholder")} aria-label={t("notesSection.add")} className="h-11" />
        <Button type="submit" variant="outline" className="h-11" disabled={add.isPending || !text.trim()}>
          {t("notesSection.submit")}
        </Button>
      </form>
    </section>
  );
}
