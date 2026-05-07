import { createHash, randomBytes } from "crypto";
import { getCookie, setCookie, deleteCookie, getRequestHeader, getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const SESSION_COOKIE = "riftflip_session";
export const ADMIN_USERNAMES = ["ElADMI1938"];

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken() {
  return randomBytes(32).toString("hex");
}

export function getClientIp(): string | null {
  const xff = getRequestHeader("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = getRequestHeader("x-real-ip");
  if (real) return real;
  try {
    const req = getRequest();
    // @ts-expect-error cf
    return req?.cf?.connectingIP ?? null;
  } catch { return null; }
}

export function getUserAgent(): string | null {
  return getRequestHeader("user-agent") ?? null;
}

export async function createSession(userId: string) {
  const token = newSessionToken();
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await supabaseAdmin.from("sessions").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expires.toISOString(),
    ip: getClientIp(),
    user_agent: getUserAgent(),
  });
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return token;
}

export async function getCurrentUser() {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const { data: session } = await supabaseAdmin
    .from("sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", session.user_id)
    .maybeSingle();
  if (!user || user.banned) return null;
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function isAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) throw new Error("FORBIDDEN");
  return user;
}

export async function destroySession() {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    await supabaseAdmin.from("sessions").delete().eq("token_hash", hashToken(token));
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

export async function logLogin(opts: {
  userId?: string | null;
  username: string;
  success: boolean;
  reason?: string;
}) {
  await supabaseAdmin.from("login_logs").insert({
    user_id: opts.userId ?? null,
    roblox_username: opts.username,
    ip: getClientIp(),
    user_agent: getUserAgent(),
    success: opts.success,
    reason: opts.reason ?? null,
  });
}
