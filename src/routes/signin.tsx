import { createFileRoute, useNavigate } from "@tanstack/react-router";
import logo from "@/assets/logo.png";
import { RobloxLogin } from "@/components/RobloxLogin";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

export const Route = createFileRoute("/signin")({
  component: SignIn,
  head: () => ({ meta: [{ title: "Sign In — Riftflip" }, { name: "description", content: "Sign in to Riftflip with your Roblox account using bio verification." }] }),
});

function SignIn() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (user) navigate({ to: "/wallet" }); }, [user, navigate]);

  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
      <div className="mb-5 text-center">
        <img src={logo} alt="Riftflip" className="mx-auto mb-3 h-14 w-14 rounded-full ring-1 ring-border" />
        <h1 className="text-2xl font-extrabold">Sign in to <span className="text-primary">RIFT</span>FLIP</h1>
        <p className="mt-1 text-xs text-muted-foreground">Verify ownership of your Roblox account by pasting a one-time code in your bio.</p>
      </div>
      <RobloxLogin />
    </div>
  );
}
