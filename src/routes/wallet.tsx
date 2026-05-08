import { createFileRoute } from "@tanstack/react-router";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Loader2, X } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import { useAuth } from "@/hooks/useAuth";
import { RobloxLogin } from "@/components/RobloxLogin";
import { useQuery } from "@tanstack/react-query";
import { getWallet, createCryptoDeposit } from "@/functions/wallet.functions";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/wallet")({
  component: Wallet,
  head: () => ({ meta: [{ title: "Wallet — Riftflip" }, { name: "description", content: "View your Riftflip token balance and transaction history." }] }),
});

const REASON_LABEL: Record<string, string> = {
  admin_grant: "Admin grant",
  admin_deduct: "Admin adjustment",
  bet_placed: "Bet placed",
  bet_won: "Bet won",
  bet_refund: "Bet refunded",
  giveaway_win: "Giveaway prize",
  word_crumble_win: "Word crumble prize",
  deposit: "Deposit",
  withdraw: "Withdraw",
};

function Wallet() {
  const { user, loading } = useAuth();

  if (loading) return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <SectionHeader title="Sign in to access your wallet" />
        <RobloxLogin />
      </div>
    );
  }

  return <WalletInner />;
}

function WalletInner() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["wallet"], queryFn: () => getWallet() });
  const balance = data?.balance ?? user?.balance ?? 0;
  const txs = data?.transactions ?? [];

  return (
    <div>
      <SectionHeader title="Wallet" />
      <div className="rounded-2xl border border-border bg-[image:var(--gradient-banner)] p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <WalletIcon className="h-4 w-4" /> Balance
        </div>
        <div className="mt-2 text-4xl font-extrabold tracking-tight">
          {balance.toFixed(2)} <span className="text-base font-semibold text-muted-foreground">tokens</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button disabled className="inline-flex items-center gap-2 rounded-full bg-primary/60 px-5 py-2.5 text-sm font-semibold text-primary-foreground opacity-70">
            <ArrowDownToLine className="h-4 w-4" /> Deposit (coming soon)
          </button>
          <button disabled className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-5 py-2.5 text-sm font-semibold backdrop-blur opacity-70">
            <ArrowUpFromLine className="h-4 w-4" /> Withdraw (coming soon)
          </button>
        </div>
      </div>

      <SectionHeader title="Recent Transactions" />
      <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : txs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No transactions yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {txs.map((t) => {
              const delta = Number(t.delta);
              return (
                <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{REASON_LABEL[t.reason] ?? t.reason}</div>
                    <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                  <div className={`font-bold ${delta >= 0 ? "text-[color:var(--success)]" : "text-destructive"}`}>
                    {delta >= 0 ? "+" : ""}{delta.toFixed(2)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
