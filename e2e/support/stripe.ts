import { createHmac } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";

// Eventos que HandleWebhookService procesa; cualquier otro se registra y se ignora.
export type StripeEventType =
  | "checkout.session.completed"
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.paid"
  | "invoice.payment_failed";

export const FAKE_CHECKOUT_URL = "https://checkout.stripe.test/c/pay/cs_test_e2e";
export const FAKE_PORTAL_URL = "https://billing.stripe.test/p/session/test_e2e";

const apiUrl = () => process.env.E2E_API_URL ?? "http://localhost:3000";

/** Resuelve las llamadas de la UI a checkout y portal sin tocar Stripe (forma real: { checkout_url } / { portal_url }). */
export async function mockStripeRedirects(
  page: Page,
  urls: { checkout?: string; portal?: string } = {},
): Promise<void> {
  const checkout = urls.checkout ?? FAKE_CHECKOUT_URL;
  const portal = urls.portal ?? FAKE_PORTAL_URL;
  const json = (body: object) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
  await page.route("**/api/v1/subscription/checkout", (route) =>
    route.request().method() === "POST"
      ? route.fulfill(json({ checkout_url: checkout }))
      : route.fallback(),
  );
  await page.route("**/api/v1/subscription/portal", (route) =>
    route.request().method() === "POST"
      ? route.fulfill(json({ portal_url: portal }))
      : route.fallback(),
  );
  // Los destinos falsos no existen: se responde una página vacía para no salir a la red.
  await page.route(/https:\/\/(checkout|billing)\.stripe\.test\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>stripe</body></html>" }),
  );
}

/** Cabecera Stripe-Signature: t=<ts>,v1=HMAC-SHA256("<ts>.<payload>") como pide Stripe::Webhook.construct_event. */
export function signWebhook(
  payload: string,
  secret = process.env.STRIPE_WEBHOOK_SECRET ?? "",
  timestamp = Math.floor(Date.now() / 1000),
): string {
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET no está definido");
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

export function buildEvent(
  type: StripeEventType,
  object: Record<string, unknown>,
  id = `evt_e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
) {
  return { id, object: "event", type, data: { object } };
}

/** Envía un evento firmado a POST /api/v1/stripe/webhooks. Un `id` repetido prueba la idempotencia. */
export async function sendWebhook(
  request: APIRequestContext,
  type: StripeEventType,
  object: Record<string, unknown>,
  opts: { id?: string; secret?: string; timestamp?: number } = {},
) {
  const payload = JSON.stringify(buildEvent(type, object, opts.id));
  return request.post(`${apiUrl()}/api/v1/stripe/webhooks`, {
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": signWebhook(payload, opts.secret, opts.timestamp),
    },
    data: payload,
  });
}
