import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireUser } from "./auth.server";

export const getWallet = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const { data: txs } = await supabaseAdmin
    .from("transactions")
    .select("id, delta, reason, created_at, meta")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);
  return {
    balance: Number(user.balance_tokens),
    transactions: txs ?? [],
  };
});

export const submitWordCrumbleAnswer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const obj = d as { roundId?: string; answer?: string };
    if (!obj?.roundId || typeof obj.answer !== "string") throw new Error("Invalid input");
    return { roundId: String(obj.roundId), answer: String(obj.answer).trim() };
  })
  .handler(async ({ data }) => {
    const user = await requireUser();
    const { data: round } = await supabaseAdmin
      .from("word_crumbles")
      .select("*")
      .eq("id", data.roundId)
      .maybeSingle();
    if (!round || round.status !== "active") throw new Error("Round not active");
    if (round.answer.toLowerCase() !== data.answer.toLowerCase()) {
      return { correct: false };
    }
    // Atomically mark the round as won (only one winner)
    const { data: claimed } = await supabaseAdmin
      .from("word_crumbles")
      .update({ status: "won", winner_id: user.id, resolved_at: new Date().toISOString() })
      .eq("id", round.id)
      .eq("status", "active")
      .select("id, prize_tokens")
      .maybeSingle();
    if (!claimed) return { correct: false, alreadyWon: true };

    await supabaseAdmin.rpc("apply_transaction", {
      _user_id: user.id,
      _delta: claimed.prize_tokens,
      _reason: "word_crumble_win",
      _ref_id: claimed.id,
      _meta: { answer: round.answer },
    });

    await supabaseAdmin.from("chat_messages").insert({
      kind: "system",
      body: `${user.display_name} solved the word crumble "${round.answer}" and won ${claimed.prize_tokens} tokens!`,
    });

    return { correct: true, prize: Number(claimed.prize_tokens) };
  });
