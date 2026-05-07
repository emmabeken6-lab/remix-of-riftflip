import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Home, Gamepad2, MessageCircle, Gift, Wallet, Shield } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";

const baseTabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/games", label: "Games", icon: Gamepad2 },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/rewards", label: "Rewards", icon: Gift },
  { to: "/wallet", label: "Wallet", icon: Wallet },
] as const;

export default function Layout() {
  const { pathname } = useLocation();
  const { user, admin, signOut } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Riftflip" className="h-9 w-9 rounded-full ring-1 ring-border" />
            <span className="text-lg font-extrabold tracking-wide">
              <span className="text-primary">RIFT</span>FLIP
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {admin && (
              <Link to="/admin" className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-card">
                <Shield className="h-3.5 w-3.5" /> Admin
              </Link>
            )}
            {user ? (
              <>
                <Link
                  to="/wallet"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-bold hover:bg-card"
                  aria-label="Wallet"
                >
                  <Wallet className="h-3.5 w-3.5 text-primary" />
                  <span>{user.balance.toFixed(2)}</span>
                  <span className="text-[10px] font-medium text-muted-foreground">tokens</span>
                </Link>
                <div className="flex items-center gap-2">
                  <div className="hidden text-right text-xs sm:block">
                    <div className="font-semibold leading-tight">{user.displayName}</div>
                    <div className="text-muted-foreground leading-tight">@{user.username}</div>
                  </div>
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.username} className="h-8 w-8 rounded-full ring-1 ring-border" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted ring-1 ring-border" />
                  )}
                  <button
                    onClick={() => signOut()}
                    className="rounded-full border border-border px-2.5 py-1.5 text-[11px] font-medium hover:bg-card"
                  >Sign out</button>
                </div>
              </>
            ) : (
              <Link to="/signin" className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Sign in</Link>
            )}
          </div>
        </div>
        {admin && (
          <Link to="/admin" className="block sm:hidden border-t border-border bg-card/50 py-1.5 text-center text-xs font-semibold">
            <Shield className="mr-1 inline h-3.5 w-3.5" /> Open Admin Panel
          </Link>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <ul className="mx-auto grid max-w-5xl grid-cols-5">
          {baseTabs.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== "/" && pathname.startsWith(to));
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                  <span className={`h-0.5 w-6 rounded-full ${active ? "bg-primary" : "bg-transparent"}`} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
