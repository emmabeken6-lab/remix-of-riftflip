import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "./auth.server";

async function audit(adminId: string, action: string, payload: unknown) {
  await supabaseAdmin.from("admin_audit_log").insert({ admin_id: adminId, action, payload: payload as never });
}

export const adminListUsers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ search: z.string().trim().max(40).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    await requireAdmin();
    let q = supabaseAdmin
      .from("users")
      .select("id, roblox_id, roblox_username, display_name, avatar_url, balance_tokens, banned, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.search) q = q.ilike("roblox_username", `%${data.search}%`);
    const { data: users } = await q;
    return { users: users ?? [] };
  });

export const adminAdjustBalance = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      userId: z.string().uuid(),
      delta: z.number().refine((n) => n !== 0, "Delta cannot be zero"),
      note: z.string().trim().max(200).optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const reason = data.delta > 0 ? "admin_grant" : "admin_deduct";
    const { data: newBalance, error } = await supabaseAdmin.rpc("apply_transaction", {
      _user_id: data.userId,
      _delta: data.delta,
      _reason: reason,
      _meta: { admin_id: admin.id, note: data.note ?? null },
    });
    if (error) throw new Error(error.message);
    await audit(admin.id, "adjust_balance", { userId: data.userId, delta: data.delta, note: data.note });
    return { newBalance: Number(newBalance) };
  });

export const adminSetBanned = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), banned: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await supabaseAdmin.from("users").update({ banned: data.banned }).eq("id", data.userId);
    if (data.banned) {
      await supabaseAdmin.from("sessions").delete().eq("user_id", data.userId);
    }
    await audit(admin.id, "set_banned", data);
    return { success: true };
  });

// Events
export const adminListEvents = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data } = await supabaseAdmin.from("events").select("*").order("created_at", { ascending: false });
  return { events: data ?? [] };
});

export const adminCreateEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().trim().min(1).max(80),
      description: z.string().trim().max(400).optional(),
      active: z.boolean().default(true),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (data.active) {
      await supabaseAdmin.from("events").update({ active: false }).eq("active", true);
    }
    const { data: row, error } = await supabaseAdmin.from("events").insert(data).select().single();
    if (error) throw new Error(error.message);
    await audit(admin.id, "create_event", { id: row.id });
    return { event: row };
  });

export const adminEndEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await supabaseAdmin.from("events").update({ active: false, ends_at: new Date().toISOString() }).eq("id", data.id);
    await audit(admin.id, "end_event", data);
    return { success: true };
  });

// Giveaways
export const adminListGiveaways = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("giveaways")
    .select("*, winner:users!giveaways_winner_id_fkey(roblox_username), giveaway_entries(count)")
    .order("created_at", { ascending: false });
  return { giveaways: data ?? [] };
});

export const adminCreateGiveaway = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().trim().min(1).max(80),
      prizeTokens: z.number().positive(),
      durationMinutes: z.number().int().positive().max(60 * 24 * 30),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const endsAt = new Date(Date.now() + data.durationMinutes * 60 * 1000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("giveaways")
      .insert({ title: data.title, prize_tokens: data.prizeTokens, ends_at: endsAt })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("chat_messages").insert({
      kind: "system",
      body: `New giveaway: "${data.title}" — ${data.prizeTokens} tokens. Type /enter in chat... (admins draw winner).`,
    });
    await audit(admin.id, "create_giveaway", { id: row.id });
    return { giveaway: row };
  });

export const adminDrawGiveaway = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const { data: gw } = await supabaseAdmin.from("giveaways").select("*").eq("id", data.id).maybeSingle();
    if (!gw || gw.status !== "active") throw new Error("Giveaway not active");
    const { data: entries } = await supabaseAdmin.from("giveaway_entries").select("user_id").eq("giveaway_id", data.id);
    if (!entries || entries.length === 0) throw new Error("No entries");
    const winner = entries[Math.floor(Math.random() * entries.length)];
    await supabaseAdmin
      .from("giveaways")
      .update({ status: "ended", winner_id: winner.user_id })
      .eq("id", data.id);
    await supabaseAdmin.rpc("apply_transaction", {
      _user_id: winner.user_id,
      _delta: gw.prize_tokens,
      _reason: "giveaway_win",
      _ref_id: gw.id,
    });
    const { data: u } = await supabaseAdmin.from("users").select("display_name").eq("id", winner.user_id).single();
    await supabaseAdmin.from("chat_messages").insert({
      kind: "system",
      body: `${u?.display_name ?? "Someone"} won the "${gw.title}" giveaway (${gw.prize_tokens} tokens)!`,
    });
    await audit(admin.id, "draw_giveaway", { id: data.id, winner: winner.user_id });
    return { winnerId: winner.user_id };
  });

// Word crumbles
export const adminCreateWordCrumble = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      answer: z.string().trim().min(2).max(40).regex(/^[A-Za-z]+$/, "Letters only"),
      prizeTokens: z.number().positive(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const letters = data.answer.toUpperCase().split("");
    // Fisher-Yates
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    const scrambled = letters.join("");
    const { data: msg } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        kind: "word_crumble",
        body: `WORD CRUMBLE — unscramble: ${scrambled}  (prize: ${data.prizeTokens} tokens, type the answer in chat)`,
        meta: { scrambled, prize: data.prizeTokens },
      })
      .select("id")
      .single();
    const { data: row } = await supabaseAdmin
      .from("word_crumbles")
      .insert({
        scrambled,
        answer: data.answer.toUpperCase(),
        prize_tokens: data.prizeTokens,
        created_by: admin.id,
        chat_message_id: msg?.id ?? null,
      })
      .select()
      .single();
    await audit(admin.id, "create_word_crumble", { id: row?.id });
    return { round: row };
  });

export const adminListWordCrumbles = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("word_crumbles")
    .select("*, winner:users!word_crumbles_winner_id_fkey(roblox_username)")
    .order("created_at", { ascending: false })
    .limit(50);
  return { rounds: data ?? [] };
});

export const adminAuditLog = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("admin_audit_log")
    .select("*, admin:users(roblox_username)")
    .order("created_at", { ascending: false })
    .limit(100);
  return { entries: data ?? [] };
});
