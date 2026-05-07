import { useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { lookupRobloxUser, requestVerification, verifyAndSignIn } from "@/functions/auth.functions";
import { useAuth } from "@/hooks/useAuth";

type Profile = {
  robloxId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export function RobloxLogin({ onSuccess }: { onSuccess?: () => void }) {
  const { refresh } = useAuth();
  const [step, setStep] = useState<"username" | "confirm" | "verify">("username");
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLookup() {
    const u = username.trim();
    if (u.length < 3) { toast.error("Enter a Roblox username (3+ chars)."); return; }
    setBusy(true);
    try {
      const r = await lookupRobloxUser({ data: { username: u } });
      if (!r.found) {
        toast.error("That Roblox username doesn't exist.");
      } else {
        setProfile({ robloxId: r.robloxId, username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl });
        setStep("confirm");
      }
    } catch (err) {
      console.error("lookup failed", err);
      toast.error((err as Error).message || "Lookup failed. Try again.");
    } finally { setBusy(false); }
  }

  async function handleStartVerify() {
    if (!profile) return;
    setBusy(true);
    try {
      const r = await requestVerification({ data: { robloxId: profile.robloxId } });
      setCode(r.code);
      setStep("verify");
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  async function handleVerify() {
    if (!profile) return;
    setBusy(true);
    try {
      await verifyAndSignIn({ data: { robloxId: profile.robloxId } });
      toast.success("Signed in!");
      await refresh();
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  if (step === "username") {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="rbx-username">Roblox username</label>
        <input
          id="rbx-username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleLookup(); } }}
          placeholder="e.g. Builderman"
          className="w-full rounded-full border border-border bg-card px-4 py-2.5 text-sm"
          minLength={3}
          maxLength={20}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => void handleLookup()}
          disabled={busy || !username.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in with Roblox
        </button>
      </div>
    );
  }

  if (step === "confirm" && profile) {
    return (
      <div className="space-y-4 text-center">
        {profile.avatarUrl && (
          <img src={profile.avatarUrl} alt={profile.username} className="mx-auto h-20 w-20 rounded-full ring-1 ring-border" />
        )}
        <div>
          <div className="text-lg font-bold">{profile.displayName}</div>
          <div className="text-xs text-muted-foreground">@{profile.username}</div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setStep("username"); setProfile(null); }} className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium">Not me</button>
          <button type="button" onClick={() => void handleStartVerify()} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} This is me
          </button>
        </div>
      </div>
    );
  }

  if (step === "verify" && profile && code) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Paste this code anywhere in your Roblox profile <strong>About</strong> section, save it, then click Verify.
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <code className="flex-1 break-all text-center text-lg font-bold tracking-wider text-primary">{code}</code>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied"); }}
            className="rounded-md border border-border p-2 hover:bg-muted"
            aria-label="Copy code"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Open your Roblox profile in a new tab.</li>
          <li>Edit your About section, paste the code, save.</li>
          <li>Come back here and click Verify. You can remove the code after.</li>
        </ol>
        <button
          type="button"
          onClick={() => void handleVerify()}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify & sign in
        </button>
        <a
          href={`https://www.roblox.com/users/${profile.robloxId}/profile`}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-xs text-muted-foreground underline hover:text-foreground"
        >
          Open my Roblox profile →
        </a>
      </div>
    );
  }

  return null;
}
