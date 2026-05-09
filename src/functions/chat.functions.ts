import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireUser } from "@/server/auth.server";

export const listMessages = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("chat_messages")
    .select("id, kind, body, meta, created_at, user_id, users(roblox_username, display_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(50);
  return { messages: (data ?? []).reverse() };
});

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ body: z.string().trim().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const { error } = await supabaseAdmin.from("chat_messages").insert({
      user_id: user.id,
      kind: "user",
      body: data.body,
    });
    if (error) throw new Error(error.message);

    // Award +1 XP per message (rate-limited: only if last message > 3s ago)
    const { data: last } = await supabaseAdmin
      .from("chat_messages")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(1, 1)
      .maybeSingle();
    const ok = !last || (Date.now() - new Date(last.created_at).getTime() > 3000);
    if (ok) {
      const { data: u } = await supabaseAdmin
        .from("users").select("xp, messages_count").eq("id", user.id).maybeSingle();
      if (u) {
        const newXp = Number(u.xp ?? 0) + 1;
        const newLevel = Math.floor(Math.sqrt(newXp / 50));
        await supabaseAdmin.from("users")
          .update({ xp: newXp, level: newLevel, messages_count: (u.messages_count ?? 0) + 1 })
          .eq("id", user.id);
      }
    }
    return { success: true };
  });
