import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Coins, CircleDollarSign, Bomb, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { playCoinflip } from "@/functions/wallet.functions";

export const Route = createFileRoute("/game/$gameId")({ component: Game });

const meta: Record<string, { name: string; desc: string; Icon: typeof Coins; tint: string }> = {
  coinflip: { name: "Coinflip", desc: "Pick a side. Win 2x your wager.", Icon: Coins, tint: "from-amber-500/30 to-orange-600/30" },
  jackpot: { name: "Jackpot", desc: "All bets pool. Winner takes all.", Icon: CircleDollarSign, tint: "from-emerald-500/30 to-teal-600/30" },
  minefield: { name: "Minefield", desc: "Reveal tiles, avoid the mines.", Icon: Bomb, tint: "from-rose-500/30 to-red-600/30" },
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
        ) : gameId === "coinflip" ? (
          <CoinflipArena />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {data.name} arena is coming soon.
          </div>
        )}
      </div>
    </div>
  );
}

function CoinflipArena() {
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const [wager, setWager] = useState(10);
  const [side, setSide] = useState<"heads" | "tails">("heads");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ result: string; won: boolean; payout: number } | null>(null);
  const balance = user?.balance ?? 0;

  async function flip() {
    if (wager <= 0) return toast.error("Wager must be > 0");
    if (wager > balance) return toast.error("Not enough tokens");
    setBusy(true);
    setLast(null);
    try {
      const r = await playCoinflip({ data: { side, wager } });
      setLast({ result: r.result, won: r.won, payout: r.payout });
      if (r.won) toast.success(`${r.result.toUpperCase()} — you won ${r.payout} tokens!`);
      else toast.error(`${r.result.toUpperCase()} — you lost ${wager} tokens`);
      await refresh();
      qc.invalidateQueries({ queryKey: ["wallet"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold">Place your bet</div>
        <div className="text-xs text-muted-foreground">Balance: <span className="font-bold text-foreground">{balance.toFixed(2)}</span> tokens</div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["heads", "tails"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={`rounded-xl border px-4 py-3 text-sm font-bold uppercase transition ${side === s ? "border-primary bg-primary/15 text-primary" : "border-border bg-background hover:bg-muted"}`}
          >{s}</button>
        ))}
      </div>

      <label className="block text-xs font-medium text-muted-foreground">Wager (tokens)</label>
      <input
        type="number"
        min={1}
        step={1}
        value={wager}
        onChange={(e) => setWager(Math.max(0, Number(e.target.value) || 0))}
        className="mt-1 w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {[10, 50, 100, 500].map((v) => (
          <button key={v} type="button" onClick={() => setWager(v)} className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-muted">
            {v}
          </button>
        ))}
        <button type="button" onClick={() => setWager(Math.floor(balance))} className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-muted">Max</button>
      </div>

      <button
        type="button"
        onClick={() => void flip()}
        disabled={busy || wager <= 0}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Flip for {wager} tokens
      </button>

      {last && (
        <div className={`mt-4 rounded-xl border p-4 text-center ${last.won ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10" : "border-destructive/40 bg-destructive/10"}`}>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Result</div>
          <div className="mt-1 text-2xl font-extrabold">{last.result.toUpperCase()}</div>
          <div className="mt-1 text-sm font-semibold">
            {last.won ? `+${last.payout} tokens` : `-${wager} tokens`}
          </div>
        </div>
      )}
    </div>
  );
}
