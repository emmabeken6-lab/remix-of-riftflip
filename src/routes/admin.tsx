import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import {
  adminListUsers, adminAdjustBalance, adminSetBanned,
  adminListEvents, adminCreateEvent, adminEndEvent,
  adminListGiveaways, adminCreateGiveaway, adminDrawGiveaway,
  adminCreateWordCrumble, adminListWordCrumbles, adminAuditLog,
  adminLoginLogs, adminListAlts,
} from "@/functions/admin.functions";

export const Route = createFileRoute("/admin")({
  component: Admin,
  head: () => ({ meta: [{ title: "Admin — Riftflip" }] }),
});

function Admin() {
  const { user, admin, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && (!user || !admin)) nav({ to: "/" }); }, [user, admin, loading, nav]);
  if (loading || !user || !admin) return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Admin Panel</h1>
      <Tabs defaultValue="users">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="logins">Logins</TabsTrigger>
          <TabsTrigger value="alts">Alts</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="giveaways">Giveaways</TabsTrigger>
          <TabsTrigger value="words">Word Crumbles</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="logins"><LoginsTab /></TabsContent>
        <TabsContent value="alts"><AltsTab /></TabsContent>
        <TabsContent value="events"><EventsTab /></TabsContent>
        <TabsContent value="giveaways"><GiveawaysTab /></TabsContent>
        <TabsContent value="words"><WordCrumblesTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">{children}</div>;
}

function UsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data } = useQuery({ queryKey: ["admin-users", search], queryFn: () => adminListUsers({ data: { search } }) });
  async function adjust(userId: string) {
    const raw = prompt("Token delta (positive to grant, negative to deduct):");
    if (!raw) return;
    const delta = Number(raw);
    if (!Number.isFinite(delta) || delta === 0) return toast.error("Invalid number");
    const note = prompt("Reason / note (optional):") ?? undefined;
    try {
      await adminAdjustBalance({ data: { userId, delta, note } });
      toast.success("Balance updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  async function setBan(userId: string, banned: boolean) {
    if (!confirm(banned ? "Ban this user?" : "Unban this user?")) return;
    try {
      await adminSetBanned({ data: { userId, banned } });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <Card>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by username" className="mb-3 w-full rounded-full border border-border bg-background px-4 py-2 text-sm" />
      <ul className="divide-y divide-border">
        {(data?.users ?? []).map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-3">
            {u.avatar_url && <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full" />}
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-semibold">{u.display_name} <span className="text-muted-foreground">@{u.roblox_username}</span></div>
              <div className="text-xs text-muted-foreground">{Number(u.balance_tokens).toFixed(2)} tokens {u.banned && <span className="ml-1 rounded bg-destructive/20 px-1.5 py-0.5 text-destructive">banned</span>}</div>
            </div>
            <button onClick={() => adjust(u.id)} className="rounded-full border border-border px-3 py-1 text-xs">Adjust</button>
            <button onClick={() => setBan(u.id, !u.banned)} className="rounded-full border border-border px-3 py-1 text-xs">{u.banned ? "Unban" : "Ban"}</button>
          </li>
        ))}
        {(data?.users ?? []).length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No users.</li>}
      </ul>
    </Card>
  );
}

function EventsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-events"], queryFn: () => adminListEvents() });
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  async function create() {
    if (!title.trim()) return;
    try {
      await adminCreateEvent({ data: { title, description: desc || undefined, active: true } });
      setTitle(""); setDesc("");
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      toast.success("Event created");
    } catch (e) { toast.error((e as Error).message); }
  }
  async function end(id: string) {
    await adminEndEvent({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-events"] });
  }
  return (
    <Card>
      <div className="space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" className="w-full rounded-full border border-border bg-background px-4 py-2 text-sm" />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm" />
        <button onClick={create} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create active event</button>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {(data?.events ?? []).map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-3 text-sm">
            <div className="flex-1">
              <div className="font-semibold">{e.title} {e.active && <span className="ml-1 rounded bg-[color:var(--success)]/20 px-1.5 py-0.5 text-xs text-[color:var(--success)]">active</span>}</div>
              {e.description && <div className="text-xs text-muted-foreground">{e.description}</div>}
            </div>
            {e.active && <button onClick={() => end(e.id)} className="rounded-full border border-border px-3 py-1 text-xs">End</button>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GiveawaysTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-gws"], queryFn: () => adminListGiveaways() });
  const [title, setTitle] = useState("");
  const [prize, setPrize] = useState(100);
  const [mins, setMins] = useState(60);
  async function create() {
    try {
      await adminCreateGiveaway({ data: { title, prizeTokens: prize, durationMinutes: mins } });
      setTitle("");
      qc.invalidateQueries({ queryKey: ["admin-gws"] });
      toast.success("Giveaway live");
    } catch (e) { toast.error((e as Error).message); }
  }
  async function draw(id: string) {
    try {
      await adminDrawGiveaway({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin-gws"] });
      toast.success("Winner drawn");
    } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <Card>
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-full border border-border bg-background px-4 py-2 text-sm sm:col-span-3" />
        <input type="number" value={prize} onChange={(e) => setPrize(Number(e.target.value))} placeholder="Prize tokens" className="rounded-full border border-border bg-background px-4 py-2 text-sm" />
        <input type="number" value={mins} onChange={(e) => setMins(Number(e.target.value))} placeholder="Duration (min)" className="rounded-full border border-border bg-background px-4 py-2 text-sm" />
        <button onClick={create} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {(data?.giveaways ?? []).map((g: { id: string; title: string; prize_tokens: number; status: string; ends_at: string }) => (
          <li key={g.id} className="flex items-center gap-3 py-3 text-sm">
            <div className="flex-1">
              <div className="font-semibold">{g.title} — {Number(g.prize_tokens)} tokens <span className="ml-1 text-xs text-muted-foreground">({g.status})</span></div>
              <div className="text-xs text-muted-foreground">Ends {new Date(g.ends_at).toLocaleString()}</div>
            </div>
            {g.status === "active" && <button onClick={() => draw(g.id)} className="rounded-full border border-border px-3 py-1 text-xs">Draw winner</button>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function WordCrumblesTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-wc"], queryFn: () => adminListWordCrumbles() });
  const [answer, setAnswer] = useState("");
  const [prize, setPrize] = useState(50);
  async function create() {
    try {
      await adminCreateWordCrumble({ data: { answer: answer.trim(), prizeTokens: prize } });
      setAnswer("");
      qc.invalidateQueries({ queryKey: ["admin-wc"] });
      toast.success("Posted to chat");
    } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <Card>
      <p className="mb-2 text-xs text-muted-foreground">Word Crumbles post to chat as a locked-copy announcement. First correct answer in chat wins the prize.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={answer} onChange={(e) => setAnswer(e.target.value.replace(/[^A-Za-z]/g, ""))} placeholder="Answer (letters only)" className="rounded-full border border-border bg-background px-4 py-2 text-sm sm:col-span-2" />
        <input type="number" value={prize} onChange={(e) => setPrize(Number(e.target.value))} placeholder="Prize tokens" className="rounded-full border border-border bg-background px-4 py-2 text-sm" />
        <button onClick={create} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:col-span-3">Post Word Crumble to chat</button>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {(data?.rounds ?? []).map((r: { id: string; scrambled: string; answer: string; prize_tokens: number; status: string; winner?: { roblox_username: string } | null }) => (
          <li key={r.id} className="py-3 text-sm">
            <div className="font-semibold">{r.scrambled} → <span className="text-primary">{r.answer}</span></div>
            <div className="text-xs text-muted-foreground">{Number(r.prize_tokens)} tokens · {r.status}{r.winner ? ` · won by @${r.winner.roblox_username}` : ""}</div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AuditTab() {
  const { data } = useQuery({ queryKey: ["admin-audit"], queryFn: () => adminAuditLog() });
  return (
    <Card>
      <ul className="divide-y divide-border text-xs">
        {(data?.entries ?? []).map((e: { id: string; action: string; payload: unknown; created_at: string; admin?: { roblox_username: string } | null }) => (
          <li key={e.id} className="py-2">
            <div className="font-semibold">{e.action} <span className="text-muted-foreground">by @{e.admin?.roblox_username ?? "system"}</span></div>
            <div className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
            <pre className="mt-1 overflow-x-auto rounded bg-background p-2">{JSON.stringify(e.payload, null, 2)}</pre>
          </li>
        ))}
      </ul>
    </Card>
  );
}
