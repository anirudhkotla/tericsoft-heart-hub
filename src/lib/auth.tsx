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
// a login form. The dev account's password NEVER lives in client code —
// Vite bakes every VITE_-prefixed var straight into the public bundle, so a
// client-side credential here would leak to anyone opening devtools on the
// deployed site. The `dev-session` edge function does the actual sign-in
// server-side (password is a Supabase function secret) and hands back only
// a session token pair.
let devSessionPromise: Promise<Session | null> | null = null;

async function fetchDevSession(): Promise<Session | null> {
  const { data, error } = await supabase.functions.invoke("dev-session");
  if (error || !data?.access_token || !data?.refresh_token) return null;
  const { data: setData } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  return setData.session;
}

export function ensureDevSession(): Promise<Session | null> {
  if (!devSessionPromise) {
    devSessionPromise = supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) return data.session;
      return fetchDevSession();
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
