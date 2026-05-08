import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, Gift, Sparkles, Loader2, Check } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDailyRewardStatus, claimDailyReward, getWagerProgress, claimWagerReward, listGiveaways, enterGiveaway } from "@/functions/wallet.functions";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/rewards")({
  component: Rewards,
  head: () => ({ meta: [{ title: "Rewards — Riftflip" }, { name: "description", content: "Claim daily bonuses, see past winners and learn how Riftflip works." }] }),
});

function Rewards() {
  const { user } = useAuth();
  return (
    <div>
      <SectionHeader title="Rewards" />
      {user ? <DailyCard /> : <SignInPrompt />}
      {user && <WagerCard />}
      <SectionHeader title="Active Giveaways" />
      <GiveawayList />
      <SectionHeader title="How it works" />
      <ol className="space-y-3">
        {[
          "Sign in with your Roblox account.",
          "Deposit crypto via NOWPayments to load tokens.",
          "Pick a game — Coinflip, Jackpot or Mines.",
          "Claim daily rewards & wager milestones.",
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

function SignInPrompt() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
      <Gift className="mx-auto mb-2 h-8 w-8 text-primary" />
      <div className="text-sm">Sign in to claim daily rewards.</div>
      <Link to="/signin" className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Sign in</Link>
    </div>
  );
}

function DailyCard() {
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const { data, refetch } = useQuery({ queryKey: ["daily-reward"], queryFn: () => getDailyRewardStatus() });
  const [busy, setBusy] = useState(false);
  if (!data) return <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Loading…</div>;
  const days = Array.from({ length: 7 }, (_, i) => i + 1);
  const claimedToday = data.claimedToday;
  const next = data.nextStreak;

  async function claim() {
    setBusy(true);
    try {
      const r = await claimDailyReward();
      toast.success(`Claimed ${r.amount} tokens (Day ${r.day}/7)`);
      await refresh();
      qc.invalidateQueries({ queryKey: ["wallet"] });
      refetch();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center gap-2">
        <Gift className="h-5 w-5 text-primary" />
        <div className="font-bold">Daily Reward</div>
        <span className="ml-auto text-xs text-muted-foreground">2 tokens / day · 7 day streak</span>
      </div>
      <div className="mb-4 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const reached = claimedToday ? d <= next : d < next;
          const isNext = !claimedToday && d === next;
          return (
            <div key={d} className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-[10px] font-bold ${
              reached ? "border-[color:var(--success)]/50 bg-[color:var(--success)]/15 text-[color:var(--success)]"
              : isNext ? "border-primary bg-primary/15 text-primary"
              : "border-border bg-background text-muted-foreground"
            }`}>
              {reached ? <Check className="h-4 w-4" /> : <span>D{d}</span>}
              <span className="mt-0.5">+2</span>
            </div>
          );
        })}
      </div>
      <button onClick={claim} disabled={busy || claimedToday}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {claimedToday ? "Come back tomorrow" : `Claim Day ${next} reward (2 tokens)`}
      </button>
    </div>
  );
}

function WagerCard() {
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const { data, refetch } = useQuery({ queryKey: ["wager-reward"], queryFn: () => getWagerProgress() });
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const into = data.wagered % data.step;
  const pct = Math.min(100, (into / data.step) * 100);

  async function claim() {
    setBusy(true);
    try {
      const r = await claimWagerReward();
      toast.success(`Claimed ${r.granted} bonus tokens`);
      await refresh();
      qc.invalidateQueries({ queryKey: ["wallet"] });
      refetch();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <div className="font-bold">Wager Rewards</div>
        <span className="ml-auto text-xs text-muted-foreground">+{data.bonus} every {data.step.toLocaleString()} wagered</span>
      </div>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>{data.wagered.toLocaleString()} wagered</span>
        <span>Next at {data.nextAt.toLocaleString()}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-background">
        <div className="h-full bg-[image:var(--gradient-primary)] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <button onClick={claim} disabled={busy || data.unclaimed.length === 0}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {data.unclaimed.length === 0 ? "No bonus available yet" : `Claim ${data.unclaimed.length * data.bonus} tokens`}
      </button>
    </div>
  );
}

function GiveawayList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["giveaways"], queryFn: () => listGiveaways(), refetchInterval: 5000 });
  const active = (data?.giveaways ?? []).filter((g) => g.status === "active");
  const past = (data?.giveaways ?? []).filter((g) => g.status !== "active").slice(0, 5);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function join(id: string) {
    if (!user) { toast.error("Sign in to enter"); return; }
    setBusyId(id);
    try {
      await enterGiveaway({ data: { giveawayId: id } });
      toast.success("Entered giveaway — good luck!");
      qc.invalidateQueries({ queryKey: ["giveaways"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }

  return (
    <>
      {active.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">No active giveaways right now.</div>
      ) : (
        <div className="space-y-2">
          {active.map((g) => {
            const remainingMs = new Date(g.ends_at).getTime() - Date.now();
            const mins = Math.max(0, Math.floor(remainingMs / 60000));
            return (
              <div key={g.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                <div className="rounded-xl bg-primary/15 p-2 text-primary"><Gift className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{g.title}</div>
                  <div className="text-xs text-muted-foreground">Prize: {Number(g.prize_tokens)} tokens · {g.entries} entries · ends in {mins}m</div>
                </div>
                <button onClick={() => join(g.id)} disabled={busyId === g.id || !user}
                  className="rounded-full bg-[image:var(--gradient-primary)] px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
                  {busyId === g.id ? "…" : "Enter"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {past.length > 0 && (
        <>
          <SectionHeader title="Previous Winners" />
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            {past.map((g) => (
              <li key={g.id} className="flex items-center gap-2 px-4 py-3 text-sm">
                <Trophy className="h-4 w-4 text-primary" />
                <div className="flex-1 truncate">{g.title}</div>
                <div className="text-xs text-muted-foreground">{Number(g.prize_tokens)} tokens</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
