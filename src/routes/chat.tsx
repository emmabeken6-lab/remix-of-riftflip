import { createFileRoute, Link } from "@tanstack/react-router";
import { Send } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listMessages, sendMessage } from "@/server/chat.functions";
import { submitWordCrumbleAnswer } from "@/server/wallet.functions";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/chat")({
  component: Chat,
  head: () => ({ meta: [{ title: "Chat — Riftflip" }, { name: "description", content: "Live community chat for Riftflip players." }] }),
});

function Chat() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["chat"], queryFn: () => listMessages(), refetchInterval: 15000 });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const channel = supabase
      .channel("chat-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["chat"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [data]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !user) return;
    setBusy(true);
    const body = text.trim();
    setText("");
    try {
      // If body looks like a single word, also try to claim the word crumble
      const activeWC = (data?.messages ?? [])
        .slice()
        .reverse()
        .find((m) => m.kind === "word_crumble");
      if (activeWC && /^[a-zA-Z]+$/.test(body)) {
        // Find latest active round - we don't have id here, send to chat regardless
        // Try server-side answer check via the round id stored in chat meta? We need round id.
        // Simpler: just send as a message; admin tools resolve. To enable claiming, fetch active round.
      }
      await sendMessage({ data: { body } });
      qc.invalidateQueries({ queryKey: ["chat"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  const messages = data?.messages ?? [];

  return (
    <div className="fixed inset-x-0 top-[57px] bottom-[60px] z-20 flex flex-col bg-background">
      <div className="border-b border-border px-4 py-3">
        <SectionHeader title="Community Chat" badge={<span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--success)]" />} />
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground">No messages yet. Be the first!</div>
        )}
        {messages.map((m) => {
          const u = (m as { users?: { roblox_username: string; display_name: string; avatar_url: string | null } }).users;
          const isSystem = m.kind === "system";
          const isWC = m.kind === "word_crumble";
          if (isWC) {
            return (
              <WordCrumbleMessage key={m.id} body={m.body} />
            );
          }
          return (
            <div key={m.id} className="mb-3 last:mb-0">
              <div className={`text-xs font-semibold uppercase tracking-wide ${isSystem ? "text-[color:var(--warning)]" : "text-primary"}`}>
                {isSystem ? "system" : (u?.display_name ?? "user")}
              </div>
              <div className="text-sm text-foreground/90">{m.body}</div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border bg-background px-4 py-3">
        {user ? (
          <form className="flex gap-2" onSubmit={handleSend}>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              maxLength={500}
              className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm placeholder:text-muted-foreground"
            />
            <button disabled={busy || !text.trim()} className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              <Send className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <Link to="/signin" className="block rounded-full border border-border bg-card px-4 py-2.5 text-center text-sm font-semibold hover:bg-muted">
            Sign in to chat
          </Link>
        )}
      </div>
    </div>
  );
}

function WordCrumbleMessage({ body }: { body: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  // Fetch active round id
  const { data: round } = useQuery({
    queryKey: ["wc-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("word_crumbles")
        .select("id, scrambled, prize_tokens, status")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 5000,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!round || !user) return;
    setBusy(true);
    try {
      const r = await submitWordCrumbleAnswer({ data: { roundId: round.id, answer } });
      if (r.correct) {
        toast.success(`Correct! You won ${r.prize} tokens.`);
        qc.invalidateQueries({ queryKey: ["wallet"] });
        qc.invalidateQueries({ queryKey: ["wc-active"] });
      } else if (r.alreadyWon) {
        toast.info("Someone already solved it!");
      } else {
        toast.error("Not the answer.");
      }
      setAnswer("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="mb-3 rounded-xl border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-[color:var(--warning)]">📣 Word Crumble</div>
      <div className="mt-1 text-sm font-semibold">{body}</div>
      {round && round.status === "active" && user && (
        <form onSubmit={submit} className="mt-2 flex gap-2">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer"
            className="flex-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm"
          />
          <button disabled={busy || !answer.trim()} className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60">Submit</button>
        </form>
      )}
      {round && round.status !== "active" && (
        <div className="mt-2 text-xs text-muted-foreground">Round ended.</div>
      )}
      {!user && (
        <Link to="/signin" className="mt-2 block text-xs text-primary underline">Sign in to play</Link>
      )}
    </div>
  );
}
