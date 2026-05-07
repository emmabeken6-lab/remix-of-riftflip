import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Coins, CircleDollarSign, Bomb, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  playCoinflip,
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

// ───────── COINFLIP ─────────
function CoinflipArena() {
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const [wager, setWager] = useState(10);
  const [side, setSide] = useState<"heads" | "tails">("heads");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ result: string; won: boolean; payout: number; fair: { serverSeed: string; serverSeedHash: string; clientSeed: string; nonce: number } } | null>(null);
  const balance = user?.balance ?? 0;

  async function flip() {
    if (wager <= 0) return toast.error("Wager must be > 0");
    if (wager > balance) return toast.error("Not enough tokens");
    setBusy(true); setLast(null);
    try {
      const r = await playCoinflip({ data: { side, wager } });
      setLast({ result: r.result, won: r.won, payout: r.payout, fair: r.fair });
      r.won ? toast.success(`${r.result.toUpperCase()} — won ${r.payout} tokens!`) : toast.error(`${r.result.toUpperCase()} — lost ${wager}`);
      await refresh();
      qc.invalidateQueries({ queryKey: ["wallet"] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center justify-between"><div className="text-sm font-semibold">Place your bet</div><BalanceLine /></div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["heads", "tails"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSide(s)}
            className={`rounded-xl border px-4 py-3 text-sm font-bold uppercase transition ${side === s ? "border-primary bg-primary/15 text-primary" : "border-border bg-background hover:bg-muted"}`}>{s}</button>
        ))}
      </div>
      <label className="block text-xs font-medium text-muted-foreground">Wager (tokens)</label>
      <input type="number" min={1} value={wager} onChange={(e) => setWager(Math.max(0, Number(e.target.value) || 0))}
        className="mt-1 w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm" />
      <div className="mt-2 flex flex-wrap gap-2">
        {[10, 50, 100, 500].map((v) => (
          <button key={v} type="button" onClick={() => setWager(v)} className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-muted">{v}</button>
        ))}
        <button type="button" onClick={() => setWager(Math.floor(balance))} className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-muted">Max</button>
      </div>
      <button type="button" onClick={() => void flip()} disabled={busy || wager <= 0}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Flip for {wager} tokens
      </button>
      {last && (
        <div className={`mt-4 rounded-xl border p-4 text-center ${last.won ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10" : "border-destructive/40 bg-destructive/10"}`}>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Result</div>
          <div className="mt-1 text-2xl font-extrabold">{last.result.toUpperCase()}</div>
          <div className="mt-1 text-sm font-semibold">{last.won ? `+${last.payout} tokens` : `-${wager} tokens`}</div>
          <FairBadge hash={last.fair.serverSeedHash} />
          <div className="mt-1 text-[10px] break-all text-muted-foreground">Revealed seed: {last.fair.serverSeed}</div>
        </div>
      )}
    </div>
  );
}

// ───────── JACKPOT ─────────
function JackpotArena() {
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { data } = useQuery({ queryKey: ["jackpot"], queryFn: () => getJackpot(), refetchInterval: 2000 });
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  const round = data?.round;
  const entries = data?.entries ?? [];
  const remaining = round ? Math.max(0, Math.floor((new Date(round.endsAt).getTime() - now) / 1000)) : 0;
  const total = round?.total ?? 0;

  useEffect(() => {
    if (round && remaining === 0) {
      void resolveJackpot({ data: { roundId: round.id } }).then(() => {
        qc.invalidateQueries({ queryKey: ["jackpot"] });
        void refresh();
      });
    }
  }, [remaining, round, qc, refresh]);

  async function enter() {
    if (!round) return;
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

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Pot</div>
          <div className="text-3xl font-extrabold">{total.toFixed(2)} <span className="text-sm font-semibold text-muted-foreground">tokens</span></div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Ends in</div>
          <div className="text-3xl font-extrabold tabular-nums">{remaining}s</div>
        </div>
      </div>
      <BalanceLine />

      <div className="mt-3 flex gap-2">
        <input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
          className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm" />
        <button type="button" onClick={() => void enter()} disabled={busy || remaining === 0}
          className="rounded-full bg-[image:var(--gradient-primary)] px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">Enter</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {[10, 50, 100, 500, 1000].map((v) => (
          <button key={v} type="button" onClick={() => setAmount(v)} className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-muted">{v}</button>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold text-muted-foreground">Players ({entries.length})</div>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {entries.length === 0 && <li className="py-4 text-center text-xs text-muted-foreground">No entries yet.</li>}
          {entries.map((e) => {
            const pct = total > 0 ? (e.amount / total) * 100 : 0;
            return (
              <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                {e.user?.avatar_url && <img src={e.user.avatar_url} alt="" className="h-7 w-7 rounded-full" />}
                <div className="flex-1 min-w-0 truncate">{e.user?.display_name ?? "—"}</div>
                <div className="font-bold">{e.amount}</div>
                <div className="w-12 text-right text-xs text-muted-foreground">{pct.toFixed(1)}%</div>
              </li>
            );
          })}
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
