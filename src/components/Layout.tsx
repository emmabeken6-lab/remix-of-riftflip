import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Home, Gamepad2, MessageCircle, Gift, LogIn } from "lucide-react";
import logo from "@/assets/logo.png";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/games", label: "Games", icon: Gamepad2 },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/rewards", label: "Rewards", icon: Gift },
  { to: "/signin", label: "Sign In", icon: LogIn },
] as const;

export default function Layout() {
  const { pathname } = useLocation();
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
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <ul className="mx-auto grid max-w-5xl grid-cols-5">
          {tabs.map(({ to, label, icon: Icon }) => {
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
