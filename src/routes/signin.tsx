import { createFileRoute } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/signin")({
  component: SignIn,
  head: () => ({ meta: [{ title: "Sign In — Riftflip" }, { name: "description", content: "Sign in to Riftflip with your Roblox account." }] }),
});

function SignIn() {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
      <img src={logo} alt="Riftflip" className="mx-auto mb-4 h-16 w-16 rounded-full ring-1 ring-border" />
      <h1 className="text-2xl font-extrabold">Welcome to <span className="text-primary">RIFT</span>FLIP</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in with your Roblox account to play, deposit and claim rewards.</p>
      <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
        <LogIn className="h-4 w-4" /> Sign in with Roblox
      </button>
      <p className="mt-4 text-xs text-muted-foreground">By signing in you agree to our Terms and Privacy Policy.</p>
    </div>
  );
}
