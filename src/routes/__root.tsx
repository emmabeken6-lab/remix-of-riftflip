import { createRootRouteWithContext, HeadContent, Outlet, Scripts, useRouter, Link } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import appCss from "../styles.css?url";
import Layout from "@/components/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import SplashScreen from "@/components/SplashScreen";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Riftflip — The Best Roblox MM2 Casino" },
      { name: "description", content: "Riftflip: zero house edge Roblox MM2 casino. Play Coinflip, Jackpot and Minefield, win prizes and claim daily rewards." },
      { property: "og:title", content: "Riftflip — The Best Roblox MM2 Casino" },
      { name: "twitter:title", content: "Riftflip — The Best Roblox MM2 Casino" },
      { property: "og:description", content: "Riftflip: zero house edge Roblox MM2 casino. Play Coinflip, Jackpot and Minefield, win prizes and claim daily rewards." },
      { name: "twitter:description", content: "Riftflip: zero house edge Roblox MM2 casino. Play Coinflip, Jackpot and Minefield, win prizes and claim daily rewards." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/28c0b097-9f34-4883-b02e-d925395e35e2/id-preview-3a64c472--5ea78817-9452-415f-8aec-0810375d59bf.lovable.app-1778134385110.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/28c0b097-9f34-4883-b02e-d925395e35e2/id-preview-3a64c472--5ea78817-9452-415f-8aec-0810375d59bf.lovable.app-1778134385110.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SplashScreen />
        <Layout />
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function _Outlet() { return <Outlet />; }
void _Outlet;
