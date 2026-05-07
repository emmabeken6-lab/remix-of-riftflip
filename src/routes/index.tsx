import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Trophy, Coins, Bomb, CircleDollarSign, Gift, Wallet, Radio } from "lucide-react";
import banner from "@/assets/banner.png";
import SectionHeader from "@/components/SectionHeader";
import Typewriter from "@/components/Typewriter";

export const Route = createFileRoute("/")({ component: Home });

const games = [
  { to: "/game/coinflip", label: "Coinflip", icon: Coins, gradient: "from-amber-500/30 to-orange-600/30" },
  { to: "/game/jackpot", label: "Jackpot", icon: CircleDollarSign, gradient: "from-emerald-500/30 to-teal-600/30" },
  { to: "/game/minefield", label: "Minefield", icon: Bomb, gradient: "from-rose-500/30 to-red-600/30" },
] as const;

function Home() {
  return (
    <div>
      {/* Hero banner */}
      <section className="relative overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-card)]">
        <img src={banner} alt="Riftflip casino banner" className="h-44 w-full object-cover sm:h-64" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/40 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center gap-3 p-5 sm:p-8">
          <h1 className="min-h-[2.5rem] text-2xl font-extrabold uppercase leading-tight sm:min-h-[3rem] sm:text-4xl">
            <Typewriter phrases={["Zero House Edge", "Free Giveaways", "Instant Payouts", "Daily Rewards"]} />
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">The Best Roblox MM2 Casino</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to="/games" className="rounded-full bg-[image:var(--gradient-primary)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110">
              Play Games
            </Link>
            <Link to="/rewards" className="rounded-full border border-border bg-card/80 px-5 py-2.5 text-sm font-semibold backdrop-blur hover:bg-card">
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* Current Event */}
      <SectionHeader title="Current Event" linkTo="/rewards" linkLabel="View all winners" />
      <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="text-base font-semibold">No Active Event</div>
        <div className="mt-1 text-sm text-muted-foreground">Check back soon for the next giveaway!</div>
        <Link to="/rewards" className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-muted">
          <Trophy className="h-4 w-4" />
          View Previous Winners
        </Link>
      </div>

      {/* Live Wins */}
      <SectionHeader
        title="Live Wins"
        linkTo="/games"
        badge={<span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--success)]" />}
      />
      <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Radio className="h-4 w-4 text-[color:var(--success)]" />
            Live Wins
          </div>
          <span className="text-xs text-muted-foreground">Real-time</span>
        </div>
        <div className="px-4 py-10 text-center">
          <div className="text-sm font-medium text-muted-foreground">No wins recorded yet</div>
          <div className="mt-1 text-xs text-muted-foreground/80">Be the first to win!</div>
        </div>
      </div>

      {/* Games */}
      <SectionHeader title="Games" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {games.map(({ to, label, icon: Icon, gradient }) => (
          <Link
            key={to}
            to={to}
            className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-primary/50`}
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 ${gradient}`} />
            <div className="relative flex flex-col items-start gap-3">
              <div className="rounded-xl bg-background/60 p-2.5 ring-1 ring-border backdrop-blur">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div className="text-base font-bold">{label}</div>
              <div className="text-xs text-muted-foreground">Tap to play</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/rewards" className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] hover:border-primary/50">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/15 p-2 text-primary"><Gift className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-bold">Rewards</div>
              <div className="text-xs text-muted-foreground">Claim bonuses</div>
            </div>
          </div>
        </Link>
        <Link to="/wallet" className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] hover:border-primary/50">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/15 p-2 text-primary"><Wallet className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-bold">Wallet</div>
              <div className="text-xs text-muted-foreground">Deposit & withdraw</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
