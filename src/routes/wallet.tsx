import { createFileRoute } from "@tanstack/react-router";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Loader2, X, Copy, Check } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import { useAuth } from "@/hooks/useAuth";
import { RobloxLogin } from "@/components/RobloxLogin";
import { useQuery } from "@tanstack/react-query";
import {
  getWallet, createCryptoDeposit, getDepositStatus, listDepositCurrencies, TOKEN_USD_PRICE,
} from "@/functions/wallet.functions";
import { useEffect, useMemo, useState } from "react";
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
  daily_reward: "Daily reward",
  wager_reward: "Wager bonus",
  token_drop: "Token drop",
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
        <div className="text-xs text-muted-foreground">≈ ${(balance * TOKEN_USD_PRICE).toFixed(2)} USD</div>
        <div className="mt-5 flex flex-wrap gap-2">
          <DepositButton />
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

function DepositButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
        <ArrowDownToLine className="h-4 w-4" /> Deposit Crypto
      </button>
      {open && <DepositModal onClose={() => setOpen(false)} />}
    </>
  );
}

type DepositPayment = Awaited<ReturnType<typeof createCryptoDeposit>>;

function DepositModal({ onClose }: { onClose: () => void }) {
  const [usd, setUsd] = useState(10);
  const [currency, setCurrency] = useState("usdttrc20");
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState<DepositPayment | null>(null);

  const { data: cur } = useQuery({ queryKey: ["dep-cur"], queryFn: () => listDepositCurrencies() });
  const tokens = useMemo(() => Math.floor(usd / TOKEN_USD_PRICE), [usd]);

  async function go() {
    setBusy(true);
    try {
      const r = await createCryptoDeposit({ data: { usd, payCurrency: currency } });
      setPay(r);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="font-bold">{pay ? "Send your crypto" : "Deposit Crypto"}</div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {!pay ? (
          <>
            <label className="text-xs text-muted-foreground">Amount (USD)</label>
            <input type="number" min={1} value={usd} onChange={(e) => setUsd(Math.max(1, Number(e.target.value) || 0))}
              className="mt-1 w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm" />
            <div className="mt-1 text-xs text-muted-foreground">
              You will receive <span className="font-bold text-foreground">{tokens.toLocaleString()}</span> tokens
              <span className="ml-1">(1 token = ${TOKEN_USD_PRICE.toFixed(2)})</span>
            </div>

            <label className="mt-3 block text-xs text-muted-foreground">Pay with</label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {(cur?.currencies ?? []).map((c) => (
                <button key={c.code} type="button" onClick={() => setCurrency(c.code)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${currency === c.code ? "border-primary bg-primary/15 text-primary" : "border-border bg-background hover:bg-muted"}`}>
                  {c.name}
                </button>
              ))}
            </div>

            <button onClick={go} disabled={busy}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Generate deposit address
            </button>
          </>
        ) : (
          <DepositPaymentView pay={pay} onDone={onClose} />
        )}
      </div>
    </div>
  );
}

function DepositPaymentView({ pay, onDone }: { pay: DepositPayment; onDone: () => void }) {
  const [copied, setCopied] = useState<"addr" | "amt" | null>(null);
  const { data, refetch } = useQuery({
    queryKey: ["dep-status", pay.paymentId],
    queryFn: () => getDepositStatus({ data: { paymentId: pay.paymentId } }),
    refetchInterval: 6000,
  });
  const status = data?.status ?? pay.status;
  const credited = (data?.tokensCredited ?? 0) > 0;

  useEffect(() => {
    if (credited) toast.success(`Deposit confirmed! ${data?.tokensCredited ?? 0} tokens credited.`);
  }, [credited, data?.tokensCredited]);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=ffffff&data=${encodeURIComponent(pay.payAddress)}`;

  function copy(value: string, what: "addr" | "amt") {
    navigator.clipboard.writeText(value);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-background p-3 text-center">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Send exactly</div>
        <button onClick={() => copy(String(pay.payAmount), "amt")} className="mt-0.5 inline-flex items-center gap-1.5 text-lg font-extrabold">
          {pay.payAmount} <span className="text-xs uppercase">{pay.payCurrency}</span>
          {copied === "amt" ? <Check className="h-3.5 w-3.5 text-[color:var(--success)]" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        <div className="text-[10px] text-muted-foreground">≈ ${pay.usd} → {pay.tokens.toLocaleString()} tokens</div>
      </div>

      <div className="flex justify-center">
        <img src={qrUrl} alt="QR" className="h-40 w-40 rounded-lg bg-white p-2" />
      </div>

      <div className="rounded-xl border border-border bg-background p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Deposit address</div>
        <div className="mt-1 flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all text-xs">{pay.payAddress}</code>
          <button onClick={() => copy(pay.payAddress, "addr")} className="rounded-md border border-border p-1.5 hover:bg-muted">
            {copied === "addr" ? <Check className="h-3.5 w-3.5 text-[color:var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Status</span>
          <span className={`font-bold ${credited ? "text-[color:var(--success)]" : "text-foreground"}`}>
            {credited ? "Confirmed ✓" : status}
          </span>
        </div>
        {!credited && (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Waiting for blockchain confirmation…
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={() => refetch()} className="flex-1 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
          Refresh
        </button>
        <button onClick={onDone} className="flex-1 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
          Done
        </button>
      </div>
    </div>
  );
}
