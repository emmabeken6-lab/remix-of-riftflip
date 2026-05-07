import { createFileRoute } from "@tanstack/react-router";
import { Trophy, Gift, Sparkles } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";

export const Route = createFileRoute("/rewards")({
  component: Rewards,
  head: () => ({ meta: [{ title: "Rewards — Riftflip" }, { name: "description", content: "Claim daily bonuses, see past winners and learn how Riftflip works." }] }),
});

function Rewards() {
  return (
    <div>
      <SectionHeader title="Rewards" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Gift, title: "Daily Bonus", desc: "Claim a free reward every 24 hours." },
          { icon: Sparkles, title: "Rakeback", desc: "Earn back a % of every wager you make." },
          { icon: Trophy, title: "Leaderboard", desc: "Top wagerers split a weekly prize pool." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="mb-3 inline-flex rounded-xl bg-primary/15 p-2 text-primary"><Icon className="h-5 w-5" /></div>
            <div className="text-base font-bold">{title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
          </div>
        ))}
      </div>

      <SectionHeader title="Previous Winners" />
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <Trophy className="mx-auto mb-3 h-8 w-8 text-primary" />
        <div className="font-semibold">No winners yet</div>
        <div className="mt-1 text-sm text-muted-foreground">Be the first name on the board.</div>
      </div>

      <SectionHeader title="How it works" />
      <ol className="space-y-3">
        {[
          "Sign in with your Roblox account.",
          "Deposit MM2 items into your Riftflip wallet.",
          "Pick a game — Coinflip, Jackpot or Minefield.",
          "Win, claim rewards, withdraw anytime.",
        ].map((step, i) => (
          <li key={i} className="flex gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</div>
            <div className="text-sm">{step}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
