import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "hr" | "team_lead" | "evaluator";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  hr: "HR",
  team_lead: "Team Lead",
  evaluator: "Evaluator",
};

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  job_title: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (...roles: AppRole[]) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// No login/signup UI in this app — every browser is signed in as one shared
// dev account automatically, so auth.uid() stays real (RLS on
// datasource_secrets/agent_sessions/etc. keeps working) without ever showing
// a login form. Credentials come only from env — never hardcode a real
// password as a source-controlled fallback.
const DEV_EMAIL = import.meta.env.VITE_DEV_EMAIL;
const DEV_PASSWORD = import.meta.env.VITE_DEV_PASSWORD;

let devSessionPromise: Promise<Session | null> | null = null;

async function signInOrSignUpDevAccount(): Promise<Session | null> {
  if (!DEV_EMAIL || !DEV_PASSWORD) {
    throw new Error(
      "Missing VITE_DEV_EMAIL / VITE_DEV_PASSWORD environment variable(s) for the shared dev account.",
    );
  }
  const signIn = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD });
  if (signIn.data.session) return signIn.data.session;

  const signUp = await supabase.auth.signUp({ email: DEV_EMAIL, password: DEV_PASSWORD });
  if (signUp.data.session) return signUp.data.session;

  // Project may require email confirmation on first signup — try signing in
  // once more in case it doesn't, otherwise give up until confirmed.
  const retry = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD });
  return retry.data.session ?? null;
}

export function ensureDevSession(): Promise<Session | null> {
  if (!devSessionPromise) {
    devSessionPromise = supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) return data.session;
      return signInOrSignUpDevAccount();
    });
  }
  return devSessionPromise;
}

async function loadProfileAndRoles(userId: string) {
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  return {
    profile: (profile as Profile | null) ?? null,
    roles: (roleRows ?? []).map((r) => r.role as AppRole),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const hydrate = async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession?.user) {
      setProfile(null);
      setRoles([]);
      return;
    }
    const { profile: nextProfile, roles: nextRoles } = await loadProfileAndRoles(
      nextSession.user.id,
    );
    setProfile(nextProfile);
    setRoles(nextRoles);
  };

  useEffect(() => {
    let mounted = true;

    ensureDevSession().then(async (devSession) => {
      if (!mounted) return;
      await hydrate(devSession);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      await hydrate(nextSession);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      roles,
      loading,
      hasRole: (...check: AppRole[]) => check.some((r) => roles.includes(r)),
      refresh: async () => {
        const { data } = await supabase.auth.getSession();
        await hydrate(data.session);
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setRoles([]);
      },
    }),
    [session, profile, roles, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function initials(name: string | null | undefined, fallback = "?") {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || fallback;
}
