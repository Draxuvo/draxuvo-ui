// src/services/profile.ts
import { apiClient } from "@/lib/api";
import type { User } from "@/types";

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  theme?: string;
  color_mode?: string;
  phone?: string;
  description?: string;
}

export interface AvatarResponse {
  message: string;
  avatar_url: string;
}

export const profileService = {
  get: (): Promise<User> =>
    apiClient.get("/api/v1/profile").then((r) => r.data),

  update: (data: UpdateProfilePayload): Promise<User> =>
    apiClient.patch("/api/v1/profile", { profile: data }).then((r) => r.data),

  /** Guarda tema y modo; la tarjeta Apariencia avisa por su cuenta si falla (FR-009). */
  saveAppearance: (data: Pick<UpdateProfilePayload, "theme" | "color_mode">): Promise<User> =>
    apiClient.patch("/api/v1/profile", { profile: data }, { skipErrorToast: true }).then((r) => r.data),

  uploadAvatar: (file: File): Promise<AvatarResponse> => {
    const form = new FormData();
    form.append("avatar", file);
    return apiClient
      .post("/api/v1/profile/avatar", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  deleteAvatar: (): Promise<{ message: string }> =>
    apiClient.delete("/api/v1/profile/avatar").then((r) => r.data),
};
