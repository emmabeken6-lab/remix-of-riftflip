import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpFromLine, Wallet as WalletIcon } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";

export const Route = createFileRoute("/wallet")({
  component: Wallet,
  head: () => ({ meta: [{ title: "Wallet — Riftflip" }, { name: "description", content: "Deposit and withdraw MM2 items on Riftflip." }] }),
});

function Wallet() {
  return (
    <div>
      <SectionHeader title="Wallet" />
      <div className="rounded-2xl border border-border bg-[image:var(--gradient-banner)] p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <WalletIcon className="h-4 w-4" /> Balance
        </div>
        <div className="mt-2 text-4xl font-extrabold tracking-tight">0.00 <span className="text-base font-semibold text-muted-foreground">VAL</span></div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
            <ArrowDownToLine className="h-4 w-4" /> Deposit
          </button>
          <button className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-5 py-2.5 text-sm font-semibold backdrop-blur hover:bg-card">
            <ArrowUpFromLine className="h-4 w-4" /> Withdraw
          </button>
        </div>
      </div>

      <SectionHeader title="Recent Transactions" />
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
        No transactions yet.
      </div>
    </div>
  );
}
