import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "draxuvo-ui",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-16",
    compatibilityFlags: ["nodejs_compat"],
    // Dominio personalizado: Cloudflare crea el DNS y el certificado al desplegar.
    domains: ["app.draxuvo.com"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
    },
  }),
});
