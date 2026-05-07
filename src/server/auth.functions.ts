import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ADMIN_USERNAMES,
  createSession,
  destroySession,
  getCurrentUser,
  isAdmin,
} from "./auth.server";
import { getAvatarUrl, getProfile, lookupUsername, newVerificationCode } from "./roblox.server";

export const lookupRobloxUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ username: z.string().trim().min(3).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const hit = await lookupUsername(data.username);
    if (!hit) return { found: false as const };
    const avatar = await getAvatarUrl(hit.id);
    return {
      found: true as const,
      robloxId: hit.id,
      username: hit.name,
      displayName: hit.displayName,
      avatarUrl: avatar,
    };
  });

export const requestVerification = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ robloxId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const profile = await getProfile(data.robloxId);
    if (!profile) throw new Error("Roblox user not found");
    const code = newVerificationCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await supabaseAdmin.from("verification_challenges").insert({
      roblox_id: profile.robloxId,
      roblox_username: profile.username,
      code,
      expires_at: expires.toISOString(),
    });
    return { code, expiresAt: expires.toISOString() };
  });

export const verifyAndSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ robloxId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const { data: challenge } = await supabaseAdmin
      .from("verification_challenges")
      .select("*")
      .eq("roblox_id", data.robloxId)
      .eq("consumed", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!challenge) throw new Error("No active verification code. Generate a new one.");

    const profile = await getProfile(data.robloxId);
    if (!profile) throw new Error("Roblox user not found");

    if (!profile.description.includes(challenge.code)) {
      throw new Error(`Code "${challenge.code}" not found in your Roblox bio. Save your bio and try again.`);
    }

    // Upsert user
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("roblox_id", profile.robloxId)
      .maybeSingle();

    let userId: string;
    if (existing) {
      if (existing.banned) throw new Error("This account is banned.");
      await supabaseAdmin
        .from("users")
        .update({
          roblox_username: profile.username,
          display_name: profile.displayName,
          avatar_url: profile.avatarUrl,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      userId = existing.id;
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("users")
        .insert({
          roblox_id: profile.robloxId,
          roblox_username: profile.username,
          display_name: profile.displayName,
          avatar_url: profile.avatarUrl,
        })
        .select("id")
        .single();
      if (error || !created) throw new Error("Failed to create account");
      userId = created.id;
    }

    // Auto-grant admin role for seeded usernames
    if (ADMIN_USERNAMES.some((n) => n.toLowerCase() === profile.username.toLowerCase())) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    }

    await supabaseAdmin.from("verification_challenges").update({ consumed: true }).eq("id", challenge.id);

    await createSession(userId);
    return { success: true, userId };
  });

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getCurrentUser();
  if (!user) return { user: null, admin: false };
  const admin = await isAdmin(user.id);
  return {
    user: {
      id: user.id,
      robloxId: user.roblox_id,
      username: user.roblox_username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      balance: Number(user.balance_tokens),
    },
    admin,
  };
});

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { success: true };
});
