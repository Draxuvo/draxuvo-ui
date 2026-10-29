"use client";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { profileService } from "@/services/profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { AppearanceCard } from "@/components/appearance/appearance-card";

const schema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function MiPerfilPage() {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const tRoles = useTranslations("adminUsers.roles");
  const { user, fetchMe, role } = useAuthStore();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: profileService.get,
  });

  const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: profile
      ? {
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone ?? "",
          description: profile.description ?? "",
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: profileService.update,
    onSuccess: async () => {
      toast.success(t("saveSuccess"));
      qc.invalidateQueries({ queryKey: ["profile"] });
      await fetchMe();
      reset(undefined, { keepValues: true });
    },
  });

  const avatarUploadMutation = useMutation({
    mutationFn: profileService.uploadAvatar,
    onSuccess: async () => {
      toast.success(t("avatarUpdated"));
      qc.invalidateQueries({ queryKey: ["profile"] });
      await fetchMe();
    },
  });

  const avatarDeleteMutation = useMutation({
    mutationFn: profileService.deleteAvatar,
    onSuccess: async () => {
      toast.success(t("avatarDeleted"));
      qc.invalidateQueries({ queryKey: ["profile"] });
      await fetchMe();
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    avatarUploadMutation.mutate(file);
    e.target.value = "";
  }

  const initials = profile
    ? `${profile.first_name[0] ?? ""}${profile.last_name[0] ?? ""}`.toUpperCase()
    : user
    ? `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase()
    : "?";

  const roleLabel = role && role !== "super_admin" ? tRoles(role) : "";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("pageTitle")}</h1>
      </div>

      <div className="space-y-4">
        {/* Avatar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("avatarSection")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-5">
              <Avatar className="size-20">
                {profile?.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={initials} />
                )}
                <AvatarFallback className="text-xl font-semibold bg-muted text-muted-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={avatarUploadMutation.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera size={14} />
                  {avatarUploadMutation.isPending ? tCommon("saving") : t("changeAvatar")}
                </Button>
                {profile?.avatar_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={avatarDeleteMutation.isPending}
                    onClick={() => avatarDeleteMutation.mutate()}
                  >
                    <Trash2 size={14} />
                    {t("deleteAvatar")}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Editable info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("editSection")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <form
                onSubmit={handleSubmit((v) => updateMutation.mutate(v))}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">
                      {t("firstName")}
                    </Label>
                    <Input
                      placeholder={t("firstNamePlaceholder")}
                      {...register("first_name")}
                    />
                    {errors.first_name && (
                      <p className="text-xs text-destructive">{errors.first_name.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">
                      {t("lastName")}
                    </Label>
                    <Input
                      placeholder={t("lastNamePlaceholder")}
                      {...register("last_name")}
                    />
                    {errors.last_name && (
                      <p className="text-xs text-destructive">{errors.last_name.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">{t("phone")}</Label>
                  <Input placeholder={t("phonePlaceholder")} {...register("phone")} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-description" className="text-xs font-medium text-foreground">
                    {t("description")}
                  </Label>
                  <textarea
                    id="profile-description"
                    rows={3}
                    placeholder={t("descriptionPlaceholder")}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                    {...register("description")}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  {isDirty && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => reset()}
                      disabled={updateMutation.isPending}
                    >
                      {tCommon("cancel")}
                    </Button>
                  )}
                  <Button type="submit" disabled={updateMutation.isPending || !isDirty}>
                    {updateMutation.isPending ? tCommon("saving") : tCommon("save")}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Read-only account info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("accountSection")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[130px_1fr] gap-y-3 text-sm">
              <span className="text-muted-foreground font-medium">{t("email")}</span>
              <span className="text-foreground">{profile?.email ?? user?.email}</span>
              <span className="text-muted-foreground font-medium">{t("role")}</span>
              <span className="text-foreground capitalize">{roleLabel}</span>
              <span className="text-muted-foreground font-medium">{t("status")}</span>
              <span className="text-foreground">
                {(profile?.active ?? user?.active) ? t("active") : t("inactive")}
              </span>
            </div>
          </CardContent>
        </Card>

        <AppearanceCard />
      </div>
    </div>
  );
}
