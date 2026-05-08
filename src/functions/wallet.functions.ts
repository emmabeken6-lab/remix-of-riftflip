import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireUser } from "@/server/auth.server";
import { newServerSeed, hmacFloat, fairShuffle } from "@/server/fair.server";

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
      .from("word_crumbles").select("*").eq("id", data.roundId).maybeSingle();
    if (!round || round.status !== "active") throw new Error("Round not active");
    if (round.answer.toLowerCase() !== data.answer.toLowerCase()) return { correct: false };
    const { data: claimed } = await supabaseAdmin
      .from("word_crumbles")
      .update({ status: "won", winner_id: user.id, resolved_at: new Date().toISOString() })
      .eq("id", round.id).eq("status", "active")
      .select("id, prize_tokens").maybeSingle();
    if (!claimed) return { correct: false, alreadyWon: true };
    await supabaseAdmin.rpc("apply_transaction", {
      _user_id: user.id, _delta: claimed.prize_tokens,
      _reason: "word_crumble_win", _ref_id: claimed.id, _meta: { answer: round.answer },
    });
    return { correct: true, prize: Number(claimed.prize_tokens) };
  });

// ───────── COINFLIP (PvP) ─────────
// Lobby model: creator opens with a side + wager, second player joins with opposite side and equal wager,
// then the server flips a provably-fair coin and pays the winner 2x.

export const listCoinflipLobbies = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("games")
    .select("id, wager, creator_id, creator_side, server_seed_hash, created_at, status, joiner_id, result")
    .eq("game_type", "coinflip")
    .in("status", ["open", "resolved"])
    .order("created_at", { ascending: false })
    .limit(20);
  const ids = Array.from(new Set((data ?? []).flatMap((g) => [g.creator_id, g.joiner_id].filter(Boolean) as string[])));
  const { data: users } = ids.length
    ? await supabaseAdmin.from("users").select("id, display_name, avatar_url").in("id", ids)
    : { data: [] as { id: string; display_name: string; avatar_url: string | null }[] };
  const byId = new Map((users ?? []).map((u) => [u.id, u]));
  return (data ?? []).map((g) => ({
    id: g.id,
    wager: Number(g.wager),
    status: g.status,
    creatorSide: g.creator_side as "heads" | "tails" | null,
    creator: byId.get(g.creator_id) ?? null,
    joiner: g.joiner_id ? byId.get(g.joiner_id) ?? null : null,
    serverSeedHash: g.server_seed_hash,
    createdAt: g.created_at,
    result: g.result as { result?: string; winner_id?: string } | null,
  }));
});

export const createCoinflip = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      side: z.enum(["heads", "tails"]),
      wager: z.number().positive().max(100000),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (Number(user.balance_tokens) < data.wager) throw new Error("Not enough tokens");

    const { seed: serverSeed, hash: serverSeedHash } = newServerSeed();
    const { data: game, error: gErr } = await supabaseAdmin
      .from("games")
      .insert({
        game_type: "coinflip", wager: data.wager, creator_id: user.id, status: "open",
        creator_side: data.side,
        server_seed: serverSeed, server_seed_hash: serverSeedHash,
      })
      .select("id").single();
    if (gErr || !game) throw new Error("Could not create lobby");

    const { error: debitErr } = await supabaseAdmin.rpc("apply_transaction", {
      _user_id: user.id, _delta: -data.wager, _reason: "bet_placed",
      _ref_id: game.id, _meta: { game: "coinflip", side: data.side, role: "creator", server_seed_hash: serverSeedHash },
    });
    if (debitErr) {
      await supabaseAdmin.from("games").update({ status: "cancelled" }).eq("id", game.id);
      throw new Error(debitErr.message.includes("INSUFFICIENT_FUNDS") ? "Not enough tokens" : debitErr.message);
    }
    await supabaseAdmin.from("game_bets").insert({
      game_id: game.id, user_id: user.id, amount: data.wager, side: data.side,
    });
    return { gameId: game.id, serverSeedHash };
  });

export const joinCoinflip = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const { data: game } = await supabaseAdmin
      .from("games").select("*").eq("id", data.gameId).maybeSingle();
    if (!game || game.game_type !== "coinflip" || game.status !== "open") throw new Error("Lobby unavailable");
    if (game.creator_id === user.id) throw new Error("You created this lobby");
    if (Number(user.balance_tokens) < Number(game.wager)) throw new Error("Not enough tokens");

    const joinerSide = game.creator_side === "heads" ? "tails" : "heads";

    // Atomic claim: only succeed if still open
    const { data: claimed } = await supabaseAdmin
      .from("games")
      .update({ status: "resolved", joiner_id: user.id, joiner_side: joinerSide })
      .eq("id", game.id).eq("status", "open")
      .select("*").maybeSingle();
    if (!claimed) throw new Error("Lobby was already taken");

    const { error: debitErr } = await supabaseAdmin.rpc("apply_transaction", {
      _user_id: user.id, _delta: -Number(game.wager), _reason: "bet_placed",
      _ref_id: game.id, _meta: { game: "coinflip", side: joinerSide, role: "joiner" },
    });
    if (debitErr) {
      await supabaseAdmin.from("games").update({ status: "open", joiner_id: null, joiner_side: null }).eq("id", (game as { id: string }).id);
      throw new Error("Not enough tokens");
    }
    await supabaseAdmin.from("game_bets").insert({
      game_id: game.id, user_id: user.id, amount: Number(game.wager), side: joinerSide,
    });

    // Flip
    const clientSeed = `${game.creator_id}:${user.id}`;
    const nonce = Date.now();
    const r = hmacFloat(game.server_seed!, clientSeed, nonce);
    const result = r < 0.5 ? "heads" : "tails";
    const winnerId = result === game.creator_side! ? game.creator_id : user.id;
    const payout = Number(game.wager) * 2;

    await supabaseAdmin.rpc("apply_transaction", {
      _user_id: winnerId, _delta: payout, _reason: "bet_won",
      _ref_id: game.id, _meta: { game: "coinflip", result },
    });
    await supabaseAdmin.from("games").update({
      status: "resolved",
      client_seed: clientSeed, nonce,
      result: { result, winner_id: winnerId, payout, server_seed: game.server_seed, client_seed: clientSeed, nonce } as never,
      resolved_at: new Date().toISOString(),
    }).eq("id", game.id);

    return {
      gameId: game.id, result, winnerId, payout,
      serverSeed: game.server_seed!, serverSeedHash: game.server_seed_hash!,
      clientSeed, nonce,
      creatorSide: game.creator_side, joinerSide,
    };
  });

export const cancelCoinflip = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const { data: g } = await supabaseAdmin.from("games").select("*").eq("id", data.gameId).maybeSingle();
    if (!g || g.creator_id !== user.id || g.status !== "open") throw new Error("Cannot cancel");
    const { data: claimed } = await supabaseAdmin.from("games")
      .update({ status: "cancelled" }).eq("id", g.id).eq("status", "open")
      .select("id").maybeSingle();
    if (!claimed) throw new Error("Cannot cancel");
    await supabaseAdmin.rpc("apply_transaction", {
      _user_id: user.id, _delta: Number(g.wager), _reason: "bet_refund",
      _ref_id: g.id, _meta: { game: "coinflip", note: "lobby_cancelled" },
    });
    return { ok: true };
  });

export const getCoinflipGame = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: g } = await supabaseAdmin.from("games").select("*").eq("id", data.gameId).maybeSingle();
    if (!g) throw new Error("Not found");
    return {
      id: g.id, status: g.status, wager: Number(g.wager),
      creatorId: g.creator_id, joinerId: g.joiner_id,
      creatorSide: g.creator_side, joinerSide: g.joiner_side,
      serverSeedHash: g.server_seed_hash,
      result: g.result as { result?: string; winner_id?: string; payout?: number; server_seed?: string; client_seed?: string; nonce?: number } | null,
    };
  });

// ───────── JACKPOT ─────────
async function getOrCreateOpenJackpot() {
  const { data: open } = await supabaseAdmin
    .from("jackpot_rounds").select("*").eq("status", "open")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (open) {
    if (open.ends_at && new Date(open.ends_at) <= new Date()) {
      await resolveJackpotRound(open.id);
    } else {
      return open;
    }
  }
  const { seed, hash } = newServerSeed();
  // ends_at stays null until at least 2 players joined
  const { data: created } = await supabaseAdmin
    .from("jackpot_rounds")
    .insert({ status: "open", server_seed: seed, server_seed_hash: hash })
    .select("*").single();
  return created!;
}

export const getJackpot = createServerFn({ method: "GET" }).handler(async () => {
  const round = await getOrCreateOpenJackpot();
  const { data: entries } = await supabaseAdmin
    .from("jackpot_entries")
    .select("id, amount, created_at, user:users(id, display_name, roblox_username, avatar_url)")
    .eq("round_id", round.id).order("created_at", { ascending: true });
  return {
    round: {
      id: round.id,
      endsAt: round.ends_at,
      total: Number(round.total_tokens),
      serverSeedHash: round.server_seed_hash,
    },
    entries: (entries ?? []).map((e) => ({
      id: e.id, amount: Number(e.amount), createdAt: e.created_at,
      user: e.user as { id: string; display_name: string; roblox_username: string; avatar_url: string | null } | null,
    })),
  };
});

export const enterJackpot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ amount: z.number().positive().max(100000) }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (Number(user.balance_tokens) < data.amount) throw new Error("Not enough tokens");
    const round = await getOrCreateOpenJackpot();
    if (round.ends_at && new Date(round.ends_at) < new Date()) throw new Error("Round closed");

    const { error: debitErr } = await supabaseAdmin.rpc("apply_transaction", {
      _user_id: user.id, _delta: -data.amount, _reason: "bet_placed",
      _ref_id: round.id, _meta: { game: "jackpot" },
    });
    if (debitErr) throw new Error(debitErr.message.includes("INSUFFICIENT_FUNDS") ? "Not enough tokens" : debitErr.message);

    await supabaseAdmin.from("jackpot_entries").insert({ round_id: round.id, user_id: user.id, amount: data.amount });

    // Count distinct players. Start 30s countdown when 2nd unique player joins.
    const { data: allEntries } = await supabaseAdmin
      .from("jackpot_entries").select("user_id, amount").eq("round_id", round.id);
    const uniquePlayers = new Set((allEntries ?? []).map((e) => e.user_id));
    const newTotal = (allEntries ?? []).reduce((s, e) => s + Number(e.amount), 0);
    const updates: { total_tokens: number; ends_at?: string } = { total_tokens: newTotal };
    if (!round.ends_at && uniquePlayers.size >= 2) {
      updates.ends_at = new Date(Date.now() + 30_000).toISOString();
    }
    await supabaseAdmin.from("jackpot_rounds").update(updates).eq("id", round.id);
    return { success: true };
  });

export const resolveJackpot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ roundId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => resolveJackpotRound(data.roundId));

async function resolveJackpotRound(roundId: string) {
  const { data: round } = await supabaseAdmin.from("jackpot_rounds").select("*").eq("id", roundId).maybeSingle();
  if (!round || round.status !== "open") return { resolved: false };
  if (!round.ends_at || new Date(round.ends_at) > new Date()) return { resolved: false, reason: "not_ended" };
  const { data: entries } = await supabaseAdmin
    .from("jackpot_entries").select("user_id, amount").eq("round_id", round.id);
  if (!entries || entries.length < 2) {
    // Refund the sole entrant if any (need at least 2 players)
    if (entries && entries.length === 1) {
      await supabaseAdmin.rpc("apply_transaction", {
        _user_id: entries[0].user_id, _delta: Number(entries[0].amount), _reason: "bet_refund",
        _ref_id: round.id, _meta: { game: "jackpot", note: "not_enough_players" },
      });
    }
    await supabaseAdmin.from("jackpot_rounds").update({ status: "ended", resolved_at: new Date().toISOString() }).eq("id", round.id);
    return { resolved: true, winner: null };
  }
  const total = entries.reduce((s, e) => s + Number(e.amount), 0);
  const r = hmacFloat(round.server_seed, round.id, 0);
  const ticket = r * total;
  let acc = 0;
  let winnerId = entries[0].user_id;
  for (const e of entries) {
    acc += Number(e.amount);
    if (ticket <= acc) { winnerId = e.user_id; break; }
  }
  await supabaseAdmin.rpc("apply_transaction", {
    _user_id: winnerId, _delta: total, _reason: "bet_won",
    _ref_id: round.id, _meta: { game: "jackpot", server_seed: round.server_seed, ticket },
  });
  await supabaseAdmin.from("jackpot_rounds").update({
    status: "ended", winner_id: winnerId, winning_ticket: ticket, resolved_at: new Date().toISOString(),
  }).eq("id", round.id);
  return { resolved: true, winner: winnerId, total, ticket, serverSeed: round.server_seed };
}

// ───────── MINES ─────────
const GRID = 25;
function minesMultiplier(minesCount: number, picks: number) {
  // Standard provably-fair mines payout (house edge 1%)
  const safe = GRID - minesCount;
  if (picks > safe) return 0;
  let mult = 1;
  for (let i = 0; i < picks; i++) {
    mult *= (GRID - i) / (safe - i);
  }
  return Math.max(1, mult * 0.99);
}

export const startMines = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      wager: z.number().positive().max(100000),
      minesCount: z.number().int().min(1).max(24),
      clientSeed: z.string().trim().min(1).max(64).optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (Number(user.balance_tokens) < data.wager) throw new Error("Not enough tokens");

    // Cancel any active game first
    await supabaseAdmin.from("mines_games").update({ status: "cancelled" })
      .eq("user_id", user.id).eq("status", "active");

    const { seed, hash } = newServerSeed();
    const clientSeed = data.clientSeed || `${user.id}:${Date.now()}`;
    const all = Array.from({ length: GRID }, (_, i) => i);
    const shuffled = fairShuffle(all, seed, clientSeed, 0);
    const minePositions = shuffled.slice(0, data.minesCount).sort((a, b) => a - b);

    const { data: row, error } = await supabaseAdmin
      .from("mines_games")
      .insert({
        user_id: user.id, wager: data.wager, mines_count: data.minesCount,
        mine_positions: minePositions, server_seed: seed, server_seed_hash: hash,
        client_seed: clientSeed,
      }).select("*").single();
    if (error || !row) throw new Error("Could not start mines");

    const { error: debitErr } = await supabaseAdmin.rpc("apply_transaction", {
      _user_id: user.id, _delta: -data.wager, _reason: "bet_placed",
      _ref_id: row.id, _meta: { game: "mines", server_seed_hash: hash, mines: data.minesCount },
    });
    if (debitErr) {
      await supabaseAdmin.from("mines_games").update({ status: "cancelled" }).eq("id", row.id);
      throw new Error("Not enough tokens");
    }

    const { data: refreshed } = await supabaseAdmin.from("users").select("balance_tokens").eq("id", user.id).single();
    return {
      gameId: row.id, serverSeedHash: hash, clientSeed, minesCount: data.minesCount,
      revealed: [] as number[], wager: data.wager,
      balance: Number(refreshed?.balance_tokens ?? 0),
    };
  });

export const revealMines = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ gameId: z.string().uuid(), index: z.number().int().min(0).max(GRID - 1) }).parse(d)
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const { data: g } = await supabaseAdmin.from("mines_games").select("*").eq("id", data.gameId).maybeSingle();
    if (!g || g.user_id !== user.id) throw new Error("Game not found");
    if (g.status !== "active") throw new Error("Game over");
    const revealed: number[] = g.revealed ?? [];
    if (revealed.includes(data.index)) throw new Error("Already revealed");
    const isMine = (g.mine_positions as number[]).includes(data.index);

    if (isMine) {
      await supabaseAdmin.from("mines_games").update({
        status: "busted", revealed: [...revealed, data.index], resolved_at: new Date().toISOString(),
        payout: 0,
      }).eq("id", g.id);
      return {
        busted: true, index: data.index, mines: g.mine_positions as number[],
        serverSeed: g.server_seed, serverSeedHash: g.server_seed_hash,
      };
    }
    const next = [...revealed, data.index];
    await supabaseAdmin.from("mines_games").update({ revealed: next }).eq("id", g.id);
    const mult = minesMultiplier(g.mines_count, next.length);
    return { busted: false, index: data.index, revealed: next, multiplier: mult, potential: Number(g.wager) * mult };
  });

export const cashoutMines = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const { data: g } = await supabaseAdmin.from("mines_games").select("*").eq("id", data.gameId).maybeSingle();
    if (!g || g.user_id !== user.id) throw new Error("Game not found");
    if (g.status !== "active") throw new Error("Game over");
    const revealed: number[] = g.revealed ?? [];
    if (revealed.length === 0) throw new Error("Reveal at least one tile");
    const mult = minesMultiplier(g.mines_count, revealed.length);
    const payout = Math.floor(Number(g.wager) * mult * 100) / 100;
    await supabaseAdmin.rpc("apply_transaction", {
      _user_id: user.id, _delta: payout, _reason: "bet_won",
      _ref_id: g.id, _meta: { game: "mines", multiplier: mult },
    });
    await supabaseAdmin.from("mines_games").update({
      status: "cashed", payout, resolved_at: new Date().toISOString(),
    }).eq("id", g.id);
    const { data: refreshed } = await supabaseAdmin.from("users").select("balance_tokens").eq("id", user.id).single();
    return {
      payout, multiplier: mult, mines: g.mine_positions as number[],
      serverSeed: g.server_seed, serverSeedHash: g.server_seed_hash,
      balance: Number(refreshed?.balance_tokens ?? 0),
    };
  });

export const getActiveMines = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const { data: g } = await supabaseAdmin
    .from("mines_games").select("*").eq("user_id", user.id).eq("status", "active")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!g) return { active: null };
  return {
    active: {
      gameId: g.id,
      wager: Number(g.wager),
      minesCount: g.mines_count,
      revealed: g.revealed as number[],
      serverSeedHash: g.server_seed_hash,
      clientSeed: g.client_seed,
    },
  };
});

// ───────── LIVE WINS / REWARDS / GIVEAWAYS / DEPOSITS ─────────
export const getLiveWins = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("transactions")
    .select("id, delta, reason, meta, created_at, user_id")
    .eq("reason", "bet_won")
    .order("created_at", { ascending: false })
    .limit(20);
  const ids = Array.from(new Set((data ?? []).map((t) => t.user_id)));
  const { data: users } = ids.length
    ? await supabaseAdmin.from("users").select("id, display_name, avatar_url").in("id", ids)
    : { data: [] as { id: string; display_name: string; avatar_url: string | null }[] };
  const byId = new Map((users ?? []).map((u) => [u.id, u]));
  return {
    wins: (data ?? []).map((t) => {
      const meta = (t.meta ?? {}) as { game?: string; multiplier?: number };
      return {
        id: t.id, amount: Number(t.delta), createdAt: t.created_at,
        game: meta.game ?? "game",
        user: byId.get(t.user_id) ?? null,
      };
    }),
  };
});

// Daily reward: 2 tokens/day, 7-day streak; missing a day resets.
export const getDailyRewardStatus = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const { data: claims } = await supabaseAdmin
    .from("daily_claims")
    .select("claimed_on, streak_day, amount")
    .eq("user_id", user.id)
    .order("claimed_on", { ascending: false })
    .limit(7);
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const claimedToday = (claims ?? []).some((c) => c.claimed_on === today);
  const last = claims?.[0];
  let nextStreak = 1;
  if (last) {
    if (last.claimed_on === today) nextStreak = last.streak_day;
    else if (last.claimed_on === yest) nextStreak = (last.streak_day % 7) + 1;
  }
  return { claimedToday, nextStreak, amount: 2, recent: claims ?? [] };
});

export const claimDailyReward = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireUser();
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const { data: existing } = await supabaseAdmin
    .from("daily_claims").select("id").eq("user_id", user.id).eq("claimed_on", today).maybeSingle();
  if (existing) throw new Error("Already claimed today");
  const { data: last } = await supabaseAdmin
    .from("daily_claims").select("claimed_on, streak_day").eq("user_id", user.id)
    .order("claimed_on", { ascending: false }).limit(1).maybeSingle();
  let day = 1;
  if (last && last.claimed_on === yest) day = (last.streak_day % 7) + 1;
  const amount = 2;
  const { error: insErr } = await supabaseAdmin.from("daily_claims")
    .insert({ user_id: user.id, claimed_on: today, streak_day: day, amount });
  if (insErr) throw new Error(insErr.message);
  await supabaseAdmin.rpc("apply_transaction", {
    _user_id: user.id, _delta: amount, _reason: "daily_reward",
    _meta: { day, date: today },
  });
  return { day, amount };
});

// Wager rewards: 500 tokens for every 50,000 wagered (cumulative).
const WAGER_STEP = 50000;
const WAGER_BONUS = 500;

export const getWagerProgress = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const { data: bets } = await supabaseAdmin
    .from("transactions").select("delta").eq("user_id", user.id).eq("reason", "bet_placed");
  const wagered = (bets ?? []).reduce((s, t) => s + Math.abs(Number(t.delta)), 0);
  const milestonesEarned = Math.floor(wagered / WAGER_STEP);
  const { data: claimed } = await supabaseAdmin
    .from("wager_rewards").select("milestone, amount").eq("user_id", user.id);
  const claimedSet = new Set((claimed ?? []).map((r) => Number(r.milestone)));
  const unclaimed: number[] = [];
  for (let i = 1; i <= milestonesEarned; i++) {
    const m = i * WAGER_STEP;
    if (!claimedSet.has(m)) unclaimed.push(m);
  }
  return {
    wagered, step: WAGER_STEP, bonus: WAGER_BONUS,
    nextAt: (milestonesEarned + 1) * WAGER_STEP,
    unclaimed, totalClaimed: (claimed ?? []).reduce((s, r) => s + Number(r.amount), 0),
  };
});

export const claimWagerReward = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireUser();
  const { data: bets } = await supabaseAdmin
    .from("transactions").select("delta").eq("user_id", user.id).eq("reason", "bet_placed");
  const wagered = (bets ?? []).reduce((s, t) => s + Math.abs(Number(t.delta)), 0);
  const milestonesEarned = Math.floor(wagered / WAGER_STEP);
  const { data: claimed } = await supabaseAdmin
    .from("wager_rewards").select("milestone").eq("user_id", user.id);
  const claimedSet = new Set((claimed ?? []).map((r) => Number(r.milestone)));
  let granted = 0;
  for (let i = 1; i <= milestonesEarned; i++) {
    const m = i * WAGER_STEP;
    if (claimedSet.has(m)) continue;
    const { error: e1 } = await supabaseAdmin.from("wager_rewards")
      .insert({ user_id: user.id, milestone: m, amount: WAGER_BONUS });
    if (e1) continue;
    await supabaseAdmin.rpc("apply_transaction", {
      _user_id: user.id, _delta: WAGER_BONUS, _reason: "wager_reward",
      _meta: { milestone: m },
    });
    granted += WAGER_BONUS;
  }
  if (granted === 0) throw new Error("Nothing to claim yet");
  return { granted };
});

// Giveaways
export const listGiveaways = createServerFn({ method: "GET" }).handler(async () => {
  const { data: gws } = await supabaseAdmin
    .from("giveaways")
    .select("id, title, prize_tokens, ends_at, status, winner_id, created_at")
    .order("created_at", { ascending: false }).limit(20);
  const ids = (gws ?? []).map((g) => g.id);
  const { data: entries } = ids.length
    ? await supabaseAdmin.from("giveaway_entries").select("giveaway_id, user_id").in("giveaway_id", ids)
    : { data: [] as { giveaway_id: string; user_id: string }[] };
  const counts: Record<string, number> = {};
  for (const e of entries ?? []) counts[e.giveaway_id] = (counts[e.giveaway_id] ?? 0) + 1;
  return { giveaways: (gws ?? []).map((g) => ({ ...g, entries: counts[g.id] ?? 0 })) };
});

export const enterGiveaway = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ giveawayId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const { data: gw } = await supabaseAdmin
      .from("giveaways").select("status, ends_at").eq("id", data.giveawayId).maybeSingle();
    if (!gw || gw.status !== "active") throw new Error("Giveaway not active");
    if (new Date(gw.ends_at) < new Date()) throw new Error("Giveaway ended");
    const { data: existing } = await supabaseAdmin
      .from("giveaway_entries").select("id")
      .eq("giveaway_id", data.giveawayId).eq("user_id", user.id).maybeSingle();
    if (existing) throw new Error("Already entered");
    const { error } = await supabaseAdmin.from("giveaway_entries")
      .insert({ giveaway_id: data.giveawayId, user_id: user.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// NOWPayments crypto deposit
const TOKENS_PER_USD = 100;
export const createCryptoDeposit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    usd: z.number().positive().min(1).max(10000),
    payCurrency: z.string().trim().min(2).max(10).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) throw new Error("Deposits not configured");
    const orderId = `rf_${user.id}_${Date.now()}`;
    const body = {
      price_amount: data.usd,
      price_currency: "usd",
      pay_currency: data.payCurrency,
      order_id: orderId,
      order_description: `Riftflip ${data.usd * TOKENS_PER_USD} tokens`,
      ipn_callback_url: `${process.env.SUPABASE_URL?.replace(/\/+$/,"") ?? ""}/api/public/nowpayments-ipn`,
    };
    const res = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`NOWPayments error: ${t.slice(0, 160)}`);
    }
    const inv = await res.json() as { id: string; invoice_url: string };
    await supabaseAdmin.from("crypto_deposits").insert({
      user_id: user.id, payment_id: String(inv.id), price_amount: data.usd,
      pay_currency: data.payCurrency ?? null, status: "waiting", invoice_url: inv.invoice_url,
      tokens_credited: 0,
    });
    return { invoiceUrl: inv.invoice_url, paymentId: inv.id };
  });
