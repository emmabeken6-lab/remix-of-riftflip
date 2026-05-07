import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Coins, CircleDollarSign, Bomb } from "lucide-react";

export const Route = createFileRoute("/game/$gameId")({ component: Game });

const meta: Record<string, { name: string; desc: string; Icon: any; tint: string }> = {
  coinflip: { name: "Coinflip", desc: "Pick a side. Win 2x your wager.", Icon: Coins, tint: "from-amber-500/30 to-orange-600/30" },
  jackpot: { name: "Jackpot", desc: "All bets pool. Winner takes all.", Icon: CircleDollarSign, tint: "from-emerald-500/30 to-teal-600/30" },
  minefield: { name: "Minefield", desc: "Reveal tiles, avoid the mines.", Icon: Bomb, tint: "from-rose-500/30 to-red-600/30" },
};

function Game() {
  const { gameId } = useParams({ from: "/game/$gameId" });
  const data = meta[gameId] ?? { name: gameId, desc: "Coming soon.", Icon: Coins, tint: "from-muted to-muted" };
  const { Icon } = data;
  return (
    <div>
      <Link to="/games" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to games
      </Link>
      <section className={`relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]`}>
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 ${data.tint}`} />
        <div className="relative flex flex-col items-start gap-4">
          <div className="rounded-2xl bg-background/60 p-4 ring-1 ring-border backdrop-blur">
            <Icon className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold">{data.name}</h1>
          <p className="text-muted-foreground">{data.desc}</p>
          <button className="mt-2 rounded-full bg-[image:var(--gradient-primary)] px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
            Play now
          </button>
        </div>
      </section>
      <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Game arena coming soon — sign in to be notified.
      </div>
    </div>
  );
}
