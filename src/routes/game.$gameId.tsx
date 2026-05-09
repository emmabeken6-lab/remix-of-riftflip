import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Coins, CircleDollarSign, Bomb, Loader2, ShieldCheck, Plus, X, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCoinflipLobbies, createCoinflip, joinCoinflip, cancelCoinflip, getCoinflipGame,
  enterJackpot, getJackpot, resolveJackpot,
  startMines, revealMines, cashoutMines, getActiveMines,
} from "@/functions/wallet.functions";

export const Route = createFileRoute("/game/$gameId")({ component: Game });

const meta: Record<string, { name: string; desc: string; Icon: typeof Coins; tint: string }> = {
  coinflip: { name: "Coinflip", desc: "Pick a side. Win 2x your wager. Provably fair.", Icon: Coins, tint: "from-amber-500/30 to-orange-600/30" },
  jackpot:  { name: "Jackpot",  desc: "Pool your bets. Winner takes all. 90s rounds.",   Icon: CircleDollarSign, tint: "from-emerald-500/30 to-teal-600/30" },
  mines:    { name: "Mines",    desc: "Reveal tiles, avoid the mines, cash out anytime.", Icon: Bomb, tint: "from-rose-500/30 to-red-600/30" },
};

function Game() {
  const { gameId } = useParams({ from: "/game/$gameId" });
  const { user } = useAuth();
  const data = meta[gameId] ?? { name: gameId, desc: "Coming soon.", Icon: Coins, tint: "from-muted to-muted" };
  const { Icon } = data;

  return (
    <div>
      <Link to="/games" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to games
      </Link>
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-[var(--shadow-card)]">
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 ${data.tint}`} />
        <div className="relative flex flex-col items-start gap-4">
          <div className="rounded-2xl bg-background/60 p-4 ring-1 ring-border backdrop-blur">
            <Icon className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold">{data.name}</h1>
          <p className="text-muted-foreground">{data.desc}</p>
        </div>
      </section>

      <div className="mt-6">
        {!user ? (
          <Link to="/signin" className="inline-flex rounded-full border border-border bg-card px-6 py-2.5 text-sm font-semibold hover:bg-muted">
            Sign in to play
          </Link>
        ) : gameId === "coinflip" ? <CoinflipArena />
          : gameId === "jackpot"  ? <JackpotArena />
          : gameId === "mines"    ? <MinesArena />
          : (
            <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              {data.name} arena is coming soon.
            </div>
          )}
      </div>
    </div>
  );
}

function BalanceLine() {
  const { user } = useAuth();
  return <div className="text-xs text-muted-foreground">Balance: <span className="font-bold text-foreground">{(user?.balance ?? 0).toFixed(2)}</span> tokens</div>;
}

function FairBadge({ hash }: { hash: string }) {
  return (
    <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-background/60 p-2 text-[10px] text-muted-foreground">
      <ShieldCheck className="h-3 w-3 mt-0.5 text-[color:var(--success)]" />
      <div className="break-all"><span className="font-bold">Server seed hash:</span> {hash}</div>
    </div>
  );
}

// ───────── COINFLIP (PvP) ─────────
type Lobby = Awaited<ReturnType<typeof listCoinflipLobbies>>[number];

function CoinflipArena() {
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [active, setActive] = useState<{
    gameId: string;
    phase: "waiting" | "flipping" | "result";
    result?: "heads" | "tails";
    won?: boolean; payout?: number; wager: number;
    creatorSide: "heads" | "tails"; joinerSide?: "heads" | "tails";
    creator: { display_name: string; avatar_url: string | null } | null;
    joiner: { display_name: string; avatar_url: string | null } | null;
    serverSeed?: string; serverSeedHash: string;
  } | null>(null);

  const { data: lobbies } = useQuery({
    queryKey: ["coinflip-lobbies"], queryFn: () => listCoinflipLobbies(), refetchInterval: 1500,
  });

  function showFlip(payload: NonNullable<typeof active>) {
    setActive({ ...payload, phase: "flipping" });
    setTimeout(() => setActive((cur) => (cur && cur.gameId === payload.gameId ? { ...cur, phase: "result" } : cur)), 3500);
  }

  async function join(lobby: Lobby) {
    if (!user) return;
    if ((user.balance ?? 0) < lobby.wager) return toast.error("Not enough tokens");
    try {
      const r = await joinCoinflip({ data: { gameId: lobby.id } });
      const youWon = r.winnerId === user.id;
      showFlip({
        gameId: r.gameId, phase: "flipping",
        result: r.result as "heads" | "tails",
        won: youWon, payout: r.payout, wager: lobby.wager,
        creatorSide: r.creatorSide as "heads" | "tails",
        joinerSide: r.joinerSide as "heads" | "tails",
        creator: lobby.creator,
        joiner: { display_name: user.displayName, avatar_url: user.avatarUrl },
        serverSeed: r.serverSeed, serverSeedHash: r.serverSeedHash,
      });
      await refresh();
      qc.invalidateQueries({ queryKey: ["coinflip-lobbies"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function cancel(lobbyId: string) {
    try {
      await cancelCoinflip({ data: { gameId: lobbyId } });
      setActive((cur) => (cur && cur.gameId === lobbyId ? null : cur));
      await refresh();
      qc.invalidateQueries({ queryKey: ["coinflip-lobbies"] });
      toast.success("Lobby cancelled, wager refunded");
    } catch (e) { toast.error((e as Error).message); }
  }

  // Realtime detection: when MY open lobby gets joined and resolved, animate.
  const seenRef = useRef(new Set<string>());
  useEffect(() => {
    if (!user || !lobbies) return;
    // Find my own waiting lobby — show waiting state
    const myWaiting = lobbies.find((l) => l.status === "open" && l.creator?.display_name === user.displayName);
    if (myWaiting && (!active || active.gameId !== myWaiting.id)) {
      setActive({
        gameId: myWaiting.id, phase: "waiting", wager: myWaiting.wager,
        creatorSide: myWaiting.creatorSide as "heads" | "tails",
        creator: myWaiting.creator, joiner: null,
        serverSeedHash: myWaiting.serverSeedHash ?? "",
      });
    }
    // If my waiting lobby just got resolved, fetch + flip
    for (const l of lobbies) {
      if (l.status === "resolved" && l.creator?.display_name === user.displayName && !seenRef.current.has(l.id) && l.result?.result) {
        seenRef.current.add(l.id);
        void getCoinflipGame({ data: { gameId: l.id } }).then((g) => {
          if (!g.result) return;
          showFlip({
            gameId: g.id, phase: "flipping",
            result: g.result.result as "heads" | "tails",
            won: g.result.winner_id === user.id,
            payout: g.result.payout ?? 0,
            wager: g.wager,
            creatorSide: g.creatorSide as "heads" | "tails",
            joinerSide: g.joinerSide as "heads" | "tails",
            creator: l.creator, joiner: l.joiner,
            serverSeed: g.result.server_seed ?? "", serverSeedHash: g.serverSeedHash ?? "",
          });
          void refresh();
        });
      }
    }
    // If my waiting lobby disappeared (cancelled by me), clear
    if (active?.phase === "waiting" && !lobbies.some((l) => l.id === active.gameId && l.status === "open")) {
      setActive((cur) => (cur?.phase === "waiting" ? null : cur));
    }
  }, [lobbies, user, active, refresh]);

  return (
    <div className="space-y-4">
      {active && <CoinflipStage data={active} onClose={() => setActive(null)} onCancel={() => active.phase === "waiting" && void cancel(active.gameId)} />}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-semibold">Open lobbies</div>
          </div>
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1 rounded-full bg-[image:var(--gradient-primary)] px-4 py-2 text-xs font-bold text-primary-foreground shadow-[var(--shadow-glow)]">
            <Plus className="h-3.5 w-3.5" /> Create
          </button>
        </div>
        <BalanceLine />
        <ul className="mt-3 space-y-2">
          {(!lobbies || lobbies.filter((l) => l.status === "open").length === 0) && (
            <li className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No open lobbies. Be the first — create one!
            </li>
          )}
          {lobbies?.filter((l) => l.status === "open").map((l) => {
            const mine = l.creator?.display_name === user?.displayName;
            return (
              <li key={l.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3">
                {l.creator?.avatar_url && <img src={l.creator.avatar_url} alt="" className="h-9 w-9 rounded-full" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{l.creator?.display_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    Picked <span className="font-semibold uppercase">{l.creatorSide}</span> · {l.wager} tokens
                  </div>
                </div>
                {mine ? (
                  <button type="button" onClick={() => void cancel(l.id)}
                    className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">
                    <X className="inline h-3 w-3" /> Cancel
                  </button>
                ) : (
                  <button type="button" onClick={() => void join(l)}
                    className="rounded-full bg-[image:var(--gradient-primary)] px-4 py-1.5 text-xs font-bold text-primary-foreground">
                    Join {l.wager}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {showCreate && (
        <CreateCoinflipModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["coinflip-lobbies"] });
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateCoinflipModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [wager, setWager] = useState(10);
  const [side, setSide] = useState<"heads" | "tails">("heads");
  const [busy, setBusy] = useState(false);
  const balance = user?.balance ?? 0;

  async function create() {
    if (wager <= 0) return toast.error("Wager must be > 0");
    if (wager > balance) return toast.error("Not enough tokens");
    setBusy(true);
    try {
      await createCoinflip({ data: { side, wager } });
      toast.success("Lobby created — waiting for opponent");
      onCreated();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-bold">Create lobby</div>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(["heads", "tails"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSide(s)}
              className={`rounded-xl border px-4 py-3 text-sm font-bold uppercase ${side === s ? "border-primary bg-primary/15 text-primary" : "border-border bg-background"}`}>{s}</button>
          ))}
        </div>
        <label className="block text-xs font-medium text-muted-foreground">Wager (tokens)</label>
        <input type="number" min={1} value={wager} onChange={(e) => setWager(Math.max(0, Number(e.target.value) || 0))}
          className="mt-1 w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm" />
        <div className="mt-2 flex flex-wrap gap-2">
          {[10, 50, 100, 500].map((v) => (
            <button key={v} type="button" onClick={() => setWager(v)} className="rounded-full border border-border bg-background px-3 py-1 text-xs">{v}</button>
          ))}
          <button type="button" onClick={() => setWager(Math.floor(balance))} className="rounded-full border border-border bg-background px-3 py-1 text-xs">Max</button>
        </div>
        <button type="button" onClick={() => void create()} disabled={busy}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Open lobby for {wager} tokens
        </button>
      </div>
    </div>
  );
}

function CoinflipStage({
  data, onClose, onCancel,
}: {
  data: {
    gameId: string;
    phase: "waiting" | "flipping" | "result";
    result?: "heads" | "tails";
    won?: boolean; payout?: number; wager: number;
    creatorSide: "heads" | "tails"; joinerSide?: "heads" | "tails";
    creator: { display_name: string; avatar_url: string | null } | null;
    joiner: { display_name: string; avatar_url: string | null } | null;
    serverSeed?: string; serverSeedHash: string;
  };
  onClose: () => void;
  onCancel: () => void;
}) {
  // Final coin rotation — heads = 0, tails = 180. Add 10 spins.
  const target = data.result === "tails" ? 180 : 0;
  const spinning = data.phase === "flipping";
  const finalRotation = 10 * 360 + target;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-amber-500/10 to-orange-600/10 p-5">
      <button type="button" onClick={onClose} className="absolute right-2 top-2 rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button>

      <div className="grid grid-cols-3 items-center gap-2">
        <PlayerCard u={data.creator} side={data.creatorSide} />

        <div className="flex flex-col items-center">
          <div className="relative h-24 w-24 [perspective:800px]">
            <div
              className="absolute inset-0 [transform-style:preserve-3d]"
              style={{
                transition: spinning ? "transform 3.4s cubic-bezier(.18,.7,.2,1)" : "none",
                transform: `rotateY(${data.phase === "waiting" ? 0 : spinning ? finalRotation : target}deg)`,
              }}
            >
              {/* Heads face */}
              <div className="absolute inset-0 flex items-center justify-center rounded-full border-4 border-amber-200 bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-700 text-3xl font-extrabold text-amber-950 shadow-[0_0_30px_rgba(251,191,36,0.6)] [backface-visibility:hidden]">
                H
              </div>
              {/* Tails face */}
              <div
                className="absolute inset-0 flex items-center justify-center rounded-full border-4 border-slate-300 bg-gradient-to-br from-slate-200 via-slate-400 to-slate-700 text-3xl font-extrabold text-slate-900 shadow-[0_0_30px_rgba(148,163,184,0.5)] [backface-visibility:hidden]"
                style={{ transform: "rotateY(180deg)" }}
              >
                T
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Pot</div>
          <div className="text-lg font-extrabold">{data.wager * 2}</div>
        </div>

        {data.phase === "waiting" ? (
          <div className="flex flex-col items-center gap-1 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-border">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
            <div className="text-xs font-bold text-muted-foreground">Waiting…</div>
          </div>
        ) : (
          <PlayerCard u={data.joiner} side={data.joinerSide ?? (data.creatorSide === "heads" ? "tails" : "heads")} />
        )}
      </div>

      {data.phase === "waiting" && (
        <div className="mt-4 space-y-2">
          <div className="rounded-xl border border-dashed border-border bg-background/60 p-3 text-center text-sm">
            Waiting for an opponent to join your <span className="font-bold uppercase">{data.creatorSide}</span> bet of <span className="font-bold">{data.wager}</span>…
          </div>
          <button onClick={onCancel} className="w-full rounded-full border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive">
            Cancel & refund
          </button>
        </div>
      )}

      {data.phase === "flipping" && (
        <div className="mt-4 rounded-xl border border-border bg-background/60 p-3 text-center text-sm font-bold">
          Flipping…
        </div>
      )}

      {data.phase === "result" && data.result && (
        <div className={`mt-4 rounded-xl border p-3 text-center text-sm font-bold ${data.won ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
          {data.result.toUpperCase()} — {data.won ? `You won ${data.payout} tokens` : `You lost ${data.wager}`}
        </div>
      )}

      {data.serverSeedHash && <FairBadge hash={data.serverSeedHash} />}
      {data.phase === "result" && data.serverSeed && (
        <div className="mt-1 text-[10px] break-all text-muted-foreground">Revealed seed: {data.serverSeed}</div>
      )}
    </div>
  );
}

function PlayerCard({ u, side }: { u: { display_name: string; avatar_url: string | null } | null; side: "heads" | "tails" }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      {u?.avatar_url ? <img src={u.avatar_url} alt="" className="h-12 w-12 rounded-full ring-2 ring-border" /> : <div className="h-12 w-12 rounded-full bg-muted" />}
      <div className="max-w-[80px] truncate text-xs font-bold">{u?.display_name ?? "—"}</div>
      <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${side === "heads" ? "bg-amber-500/20 text-amber-400" : "bg-slate-500/20 text-slate-300"}`}>{side}</div>
    </div>
  );
}

// ───────── JACKPOT (Wheel) ─────────
const SLICE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b"];

function JackpotArena() {
  const qc = useQueryClient();
  const { user, refresh } = useAuth();
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { data } = useQuery({ queryKey: ["jackpot"], queryFn: () => getJackpot(), refetchInterval: 1500 });
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  const round = data?.round;
  const entries = data?.entries ?? [];
  const total = round?.total ?? 0;
  const uniquePlayers = new Set(entries.map((e) => e.user?.id)).size;
  const remaining = round?.endsAt ? Math.max(0, Math.floor((new Date(round.endsAt).getTime() - now) / 1000)) : null;

  // Aggregate per-player for wheel slices
  const slices = useMemo(() => {
    const byUser = new Map<string, { name: string; avatar: string | null; amount: number }>();
    for (const e of entries) {
      const id = e.user?.id ?? "?";
      const prev = byUser.get(id);
      byUser.set(id, {
        name: e.user?.display_name ?? "—",
        avatar: e.user?.avatar_url ?? null,
        amount: (prev?.amount ?? 0) + e.amount,
      });
    }
    return Array.from(byUser.entries()).map(([id, v], i) => ({ id, ...v, color: SLICE_COLORS[i % SLICE_COLORS.length] }));
  }, [entries]);

  // Spin animation: when round resolves, spin wheel to winner's slice
  const [spinDeg, setSpinDeg] = useState(0);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const lastRoundIdRef = useRef<string | null>(null);
  const spinningRef = useRef(false);

  useEffect(() => {
    if (round && remaining === 0 && !spinningRef.current && slices.length >= 2) {
      spinningRef.current = true;
      void resolveJackpot({ data: { roundId: round.id } }).then((res) => {
        const winnerId = (res as { winner?: string }).winner;
        const winnerSlice = slices.find((s) => s.id === winnerId);
        if (winnerSlice) {
          // compute mid-angle of winner's slice
          let acc2 = 0;
          let mid = 0;
          for (const s of slices) {
            const span = (s.amount / total) * 360;
            if (s.id === winnerId) { mid = acc2 + span / 2; break; }
            acc2 += span;
          }
          // pointer at top (0deg). rotate so mid lands at 0: target = -mid (mod 360)
          const target = (360 - (mid % 360)) % 360;
          setSpinDeg((d) => d + 360 * 8 + target - (d % 360));
          setTimeout(() => {
            setWinnerName(winnerSlice.name);
            spinningRef.current = false;
            qc.invalidateQueries({ queryKey: ["jackpot"] });
            void refresh();
          }, 5200);
        } else {
          spinningRef.current = false;
          qc.invalidateQueries({ queryKey: ["jackpot"] });
        }
      });
    }
  }, [remaining, round, qc, refresh, total, slices]);

  // Reset winner display on new round
  useEffect(() => {
    if (round && lastRoundIdRef.current !== round.id) {
      lastRoundIdRef.current = round.id;
      setWinnerName(null);
    }
  }, [round]);

  async function enter() {
    setBusy(true);
    try {
      await enterJackpot({ data: { amount } });
      await refresh();
      qc.invalidateQueries({ queryKey: ["jackpot"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      toast.success(`Entered ${amount} tokens`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  // Compute SVG slice paths
  const SIZE = 240, R = 110, CX = SIZE / 2, CY = SIZE / 2;
  let acc = 0;
  const arcs = slices.map((s) => {
    const start = total > 0 ? (s.amount / total) * 360 : 0;
    const a0 = acc; const a1 = acc + start; acc = a1;
    const startRad = (a0 - 90) * Math.PI / 180;
    const endRad = (a1 - 90) * Math.PI / 180;
    const x0 = CX + R * Math.cos(startRad), y0 = CY + R * Math.sin(startRad);
    const x1 = CX + R * Math.cos(endRad), y1 = CY + R * Math.sin(endRad);
    const large = start > 180 ? 1 : 0;
    const d = `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
    return { ...s, d, mid: (a0 + a1) / 2, pct: total > 0 ? (s.amount / total) * 100 : 0 };
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Pot</div>
          <div className="text-2xl font-extrabold">{total.toFixed(2)} <span className="text-xs font-semibold text-muted-foreground">tokens</span></div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Players</div>
          <div className="text-2xl font-extrabold">{uniquePlayers}</div>
        </div>
      </div>

      <div className="relative mx-auto my-2 h-[240px] w-[240px]">
        {/* Pointer */}
        <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2">
          <div className="h-0 w-0 border-x-[10px] border-t-[16px] border-x-transparent border-t-foreground" />
        </div>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE}
          className="drop-shadow-[0_0_30px_rgba(255,255,255,0.08)]"
          style={{
            transition: "transform 5s cubic-bezier(.15,.85,.2,1)",
            transform: `rotate(${spinDeg}deg)`,
          }}
        >
          {arcs.length === 0 ? (
            <circle cx={CX} cy={CY} r={R} fill="hsl(var(--muted))" />
          ) : arcs.length === 1 ? (
            <circle cx={CX} cy={CY} r={R} fill={arcs[0].color} />
          ) : arcs.map((a) => <path key={a.id} d={a.d} fill={a.color} stroke="hsl(var(--background))" strokeWidth="2" />)}
          <circle cx={CX} cy={CY} r={36} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
          <text x={CX} y={CY - 2} textAnchor="middle" className="fill-foreground" fontSize="11" fontWeight="700">POT</text>
          <text x={CX} y={CY + 12} textAnchor="middle" className="fill-foreground" fontSize="13" fontWeight="800">{total.toFixed(0)}</text>
        </svg>
      </div>

      <div className="mt-2 text-center">
        {uniquePlayers < 2 ? (
          <div className="text-sm text-muted-foreground">Waiting for {2 - uniquePlayers} more player{uniquePlayers === 1 ? "" : "s"} to start the spin…</div>
        ) : remaining !== null ? (
          <div className="text-sm">Spinning in <span className="font-extrabold tabular-nums">{remaining}s</span></div>
        ) : (
          <div className="text-sm text-muted-foreground">Round ready</div>
        )}
        {winnerName && <div className="mt-1 text-sm font-bold text-[color:var(--success)]">{winnerName} won {total.toFixed(0)} tokens!</div>}
      </div>

      <BalanceLine />

      <div className="mt-3 flex gap-2">
        <input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
          className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm" />
        <button type="button" onClick={() => void enter()} disabled={busy || !user}
          className="rounded-full bg-[image:var(--gradient-primary)] px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">Enter</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {[10, 50, 100, 500, 1000].map((v) => (
          <button key={v} type="button" onClick={() => setAmount(v)} className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-muted">{v}</button>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold text-muted-foreground">Players ({slices.length})</div>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {slices.length === 0 && <li className="py-4 text-center text-xs text-muted-foreground">No entries yet.</li>}
          {slices.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
              {s.avatar && <img src={s.avatar} alt="" className="h-7 w-7 rounded-full" />}
              <div className="flex-1 min-w-0 truncate">{s.name}</div>
              <div className="font-bold">{s.amount}</div>
              <div className="w-12 text-right text-xs text-muted-foreground">{(total > 0 ? (s.amount / total) * 100 : 0).toFixed(1)}%</div>
            </li>
          ))}
        </ul>
      </div>
      {round?.serverSeedHash && <FairBadge hash={round.serverSeedHash} />}
    </div>
  );
}

// ───────── MINES ─────────
type MinesState = {
  gameId: string;
  wager: number;
  minesCount: number;
  revealed: number[];
  serverSeedHash: string;
  busted?: boolean;
  mines?: number[];
  serverSeed?: string;
  multiplier?: number;
  potential?: number;
};

function MinesArena() {
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const [wager, setWager] = useState(10);
  const [mines, setMines] = useState(3);
  const [state, setState] = useState<MinesState | null>(null);
  const [busy, setBusy] = useState(false);
  const balance = user?.balance ?? 0;

  // Restore active game on mount
  useEffect(() => {
    void getActiveMines().then((r) => {
      if (r.active) {
        setState({
          gameId: r.active.gameId, wager: r.active.wager, minesCount: r.active.minesCount,
          revealed: r.active.revealed, serverSeedHash: r.active.serverSeedHash,
        });
        setWager(r.active.wager); setMines(r.active.minesCount);
      }
    });
  }, []);

  async function start() {
    if (wager <= 0 || wager > balance) return toast.error("Invalid wager");
    setBusy(true);
    try {
      const r = await startMines({ data: { wager, minesCount: mines } });
      setState({ gameId: r.gameId, wager: r.wager, minesCount: r.minesCount, revealed: [], serverSeedHash: r.serverSeedHash });
      await refresh();
      qc.invalidateQueries({ queryKey: ["wallet"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function reveal(i: number) {
    if (!state || state.busted) return;
    if (state.revealed.includes(i)) return;
    setBusy(true);
    try {
      const r = await revealMines({ data: { gameId: state.gameId, index: i } });
      if (r.busted) {
        setState({ ...state, busted: true, mines: r.mines, revealed: [...state.revealed, i], serverSeed: r.serverSeed });
        toast.error("Boom! You hit a mine.");
      } else {
        setState({ ...state, revealed: r.revealed, multiplier: r.multiplier, potential: r.potential });
      }
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function cashout() {
    if (!state) return;
    setBusy(true);
    try {
      const r = await cashoutMines({ data: { gameId: state.gameId } });
      toast.success(`Cashed out ${r.payout.toFixed(2)} tokens (${r.multiplier.toFixed(2)}x)`);
      setState({ ...state, busted: true, mines: r.mines, serverSeed: r.serverSeed, multiplier: r.multiplier, potential: r.payout });
      await refresh();
      qc.invalidateQueries({ queryKey: ["wallet"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  function newGame() { setState(null); }

  const cells = useMemo(() => Array.from({ length: 25 }, (_, i) => i), []);

  if (!state) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center justify-between"><div className="text-sm font-semibold">Set up your game</div><BalanceLine /></div>
        <label className="block text-xs font-medium text-muted-foreground">Wager (tokens)</label>
        <input type="number" min={1} value={wager} onChange={(e) => setWager(Math.max(1, Number(e.target.value) || 0))}
          className="mt-1 w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm" />
        <label className="mt-3 block text-xs font-medium text-muted-foreground">Mines: <span className="font-bold text-foreground">{mines}</span></label>
        <input type="range" min={1} max={24} value={mines} onChange={(e) => setMines(Number(e.target.value))} className="mt-1 w-full" />
        <button type="button" onClick={() => void start()} disabled={busy}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Start game ({wager} tokens, {mines} mines)
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-border p-2"><div className="text-muted-foreground">Wager</div><div className="font-bold">{state.wager}</div></div>
        <div className="rounded-xl border border-border p-2"><div className="text-muted-foreground">Mult</div><div className="font-bold">{(state.multiplier ?? 1).toFixed(2)}x</div></div>
        <div className="rounded-xl border border-border p-2"><div className="text-muted-foreground">Potential</div><div className="font-bold">{(state.potential ?? state.wager).toFixed(2)}</div></div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {cells.map((i) => {
          const revealed = state.revealed.includes(i);
          const isMine = state.mines?.includes(i);
          const showMine = state.busted && isMine;
          const showGem = state.busted ? revealed && !isMine : revealed;
          return (
            <button key={i} type="button" disabled={busy || state.busted || revealed}
              onClick={() => void reveal(i)}
              className={`aspect-square rounded-lg border text-xl font-bold transition ${
                showMine ? "border-destructive/60 bg-destructive/20 text-destructive"
                : showGem ? "border-[color:var(--success)]/60 bg-[color:var(--success)]/15 text-[color:var(--success)]"
                : "border-border bg-background hover:bg-muted"
              }`}>
              {showMine ? "💣" : showGem ? "💎" : ""}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        {!state.busted && state.revealed.length > 0 && (
          <button type="button" onClick={() => void cashout()} disabled={busy}
            className="flex-1 rounded-full bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
            Cash out {(state.potential ?? state.wager).toFixed(2)}
          </button>
        )}
        {state.busted && (
          <button type="button" onClick={newGame} className="flex-1 rounded-full border border-border bg-background px-5 py-3 text-sm font-bold hover:bg-muted">New game</button>
        )}
      </div>
      <FairBadge hash={state.serverSeedHash} />
      {state.serverSeed && <div className="mt-1 text-[10px] break-all text-muted-foreground">Revealed seed: {state.serverSeed}</div>}
    </div>
  );
}
