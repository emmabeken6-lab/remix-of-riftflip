import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireUser } from "@/server/auth.server";

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

export const playCoinflip = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      side: z.enum(["heads", "tails"]),
      wager: z.number().positive().max(100000),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const user = await requireUser();

    // Create game + bet records
    const { data: game, error: gErr } = await supabaseAdmin
      .from("games")
      .insert({ game_type: "coinflip", wager: data.wager, creator_id: user.id, status: "open" })
      .select("id")
      .single();
    if (gErr || !game) throw new Error("Could not start game");

    // Debit wager
    const { error: debitErr } = await supabaseAdmin.rpc("apply_transaction", {
      _user_id: user.id,
      _delta: -data.wager,
      _reason: "bet_placed",
      _ref_id: game.id,
      _meta: { game: "coinflip", side: data.side },
    });
    if (debitErr) {
      await supabaseAdmin.from("games").update({ status: "cancelled" }).eq("id", game.id);
      throw new Error(debitErr.message.includes("INSUFFICIENT_FUNDS") ? "Not enough tokens" : debitErr.message);
    }

    await supabaseAdmin.from("game_bets").insert({
      game_id: game.id, user_id: user.id, amount: data.wager, side: data.side,
    });

    // Resolve
    const result = Math.random() < 0.5 ? "heads" : "tails";
    const won = result === data.side;
    const payout = won ? data.wager * 2 : 0;

    if (won) {
      await supabaseAdmin.rpc("apply_transaction", {
        _user_id: user.id,
        _delta: payout,
        _reason: "bet_won",
        _ref_id: game.id,
        _meta: { game: "coinflip", result },
      });
    }

    await supabaseAdmin.from("games").update({
      status: "resolved",
      result: { result, won, payout } as never,
      resolved_at: new Date().toISOString(),
    }).eq("id", game.id);

    const { data: refreshed } = await supabaseAdmin
      .from("users").select("balance_tokens").eq("id", user.id).single();

    return {
      result,
      won,
      payout,
      balance: Number(refreshed?.balance_tokens ?? 0),
    };
  });
