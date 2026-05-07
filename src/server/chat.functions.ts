import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireUser } from "./auth.server";

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
    return { success: true };
  });
