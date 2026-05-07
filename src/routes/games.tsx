import { createFileRoute, Link } from "@tanstack/react-router";
import { Coins, CircleDollarSign, Bomb } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";

export const Route = createFileRoute("/games")({
  component: Games,
  head: () => ({ meta: [{ title: "Games — Riftflip" }, { name: "description", content: "Browse all Riftflip games: Coinflip, Jackpot, Minefield." }] }),
});

const games = [
  { to: "/game/coinflip", label: "Coinflip", desc: "50/50 — provably fair, double or nothing", icon: Coins, gradient: "from-amber-500/30 to-orange-600/30" },
  { to: "/game/jackpot",  label: "Jackpot",  desc: "Pool your bets, weighted random winner", icon: CircleDollarSign, gradient: "from-emerald-500/30 to-teal-600/30" },
  { to: "/game/mines",    label: "Mines",    desc: "Reveal gems, avoid mines, cash out big", icon: Bomb, gradient: "from-rose-500/30 to-red-600/30" },
] as const;

function Games() {
  return (
    <div>
      <SectionHeader title="All Games" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {games.map(({ to, label, desc, icon: Icon, gradient }) => (
          <Link key={to} to={to} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] hover:border-primary/50">
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 ${gradient}`} />
            <div className="relative flex items-center gap-4">
              <div className="rounded-xl bg-background/60 p-3 ring-1 ring-border backdrop-blur">
                <Icon className="h-7 w-7 text-primary" />
              </div>
              <div>
                <div className="text-lg font-bold">{label}</div>
                <div className="text-sm text-muted-foreground">{desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
