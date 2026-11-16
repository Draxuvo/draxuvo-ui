// src/services/company-logo.ts
// Logo propio de la empresa (spec 063, contracts/api.md). Sin `companyId` actúa sobre la empresa activa; el super admin
// pasa el id de la empresa que atiende (hoja de /empresas), como los módulos extra de la spec 053.
import { apiClient } from "@/lib/api";
import type { CompanyLogo } from "@/types";

const target = (companyId?: number) => (companyId ? { "X-Company-Id": String(companyId) } : {});

export const companyLogoService = {
  /** Sube o reemplaza el logo. Los errores los explica la tarjeta, no el aviso global. */
  upload: (
    file: File,
    { onProgress, signal, companyId }: { onProgress?: (percent: number) => void; signal?: AbortSignal; companyId?: number } = {},
  ): Promise<{ logo: CompanyLogo | null }> => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .put("/api/v1/company/logo", form, {
        headers: { "Content-Type": "multipart/form-data", ...target(companyId) },
        signal,
        skipErrorToast: true,
        onUploadProgress: (event) => {
          if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
        },
      })
      .then((r) => r.data);
  },

  remove: (companyId?: number): Promise<{ logo: null }> =>
    apiClient.delete("/api/v1/company/logo", { headers: target(companyId), skipErrorToast: true }).then((r) => r.data),
};
