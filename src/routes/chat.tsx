import { createFileRoute } from "@tanstack/react-router";
import { Send } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";

export const Route = createFileRoute("/chat")({
  component: Chat,
  head: () => ({ meta: [{ title: "Chat — Riftflip" }, { name: "description", content: "Live community chat for Riftflip players." }] }),
});

const messages = [
  { user: "system", text: "Welcome to Riftflip chat — be respectful and have fun!" },
];

function Chat() {
  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col">
      <SectionHeader title="Community Chat" badge={<span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--success)]" />} />
      <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        {messages.map((m, i) => (
          <div key={i} className="mb-3 last:mb-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">{m.user}</div>
            <div className="text-sm text-muted-foreground">{m.text}</div>
          </div>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => e.preventDefault()}>
        <input
          type="text"
          placeholder="Sign in to send a message..."
          disabled
          className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm placeholder:text-muted-foreground disabled:opacity-60"
        />
        <button disabled className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
