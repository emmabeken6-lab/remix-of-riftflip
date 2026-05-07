import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMe, signOut as signOutFn } from "@/functions/auth.functions";

export type Me = {
  id: string;
  robloxId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  balance: number;
};

type AuthContextValue = {
  user: Me | null;
  admin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await getMe();
      setUser(res.user);
      setAdmin(res.admin);
    } catch (e) {
      console.error(e);
      setUser(null);
      setAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const signOut = useCallback(async () => {
    await signOutFn();
    setUser(null);
    setAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, admin, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
