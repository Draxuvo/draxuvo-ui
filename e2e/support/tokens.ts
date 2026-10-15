import { createHmac } from "node:crypto";

export interface PasswordLinkUser {
  id: number | string;
  email: string;
  fullName: string;
}

const HOUR = 60 * 60;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function secret(): string {
  const key = process.env.SECRET_KEY_BASE;
  if (!key) throw new Error("SECRET_KEY_BASE no está definido: no se puede firmar el token");
  return key;
}

/** Firma un JWT HS256 con SECRET_KEY_BASE, igual que JwtHelper de la API. */
export function signToken(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret()).update(`${header}.${body}`).digest();
  return `${header}.${body}.${base64url(signature)}`;
}

/** Token de enlace de contraseña (alta de empleado o recuperación). */
export function passwordToken(
  user: PasswordLinkUser,
  options: { expiresInSeconds?: number } = {},
): string {
  const exp = Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 72 * HOUR);
  return signToken({ user_id: user.id, email: user.email, full_name: user.fullName, exp });
}

/** Token ya vencido, para probar el rechazo del enlace. */
export function expiredPasswordToken(user: PasswordLinkUser): string {
  return passwordToken(user, { expiresInSeconds: -HOUR });
}

/** Ruta de la UI para fijar la contraseña de un empleado nuevo. */
export function setPasswordPath(user: PasswordLinkUser): string {
  return `/set-password?token=${encodeURIComponent(passwordToken(user))}`;
}

/** Ruta de la UI para restablecer la contraseña. */
export function resetPasswordPath(user: PasswordLinkUser): string {
  return `/password?message=${encodeURIComponent(passwordToken(user, { expiresInSeconds: 24 * HOUR }))}`;
}
