import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { DATASOURCES_QUERY_KEY } from "@/lib/datasource-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CallbackSearch = { ds?: string; name?: string; error?: string };

export const Route = createFileRoute("/_authenticated/datasources/oauth-callback")({
  head: () => ({ meta: [{ title: "Connecting… — Tericsoft HR OS" }] }),
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    ds: typeof search.ds === "string" ? search.ds : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: OAuthCallback,
});

// The oauth-connect edge function does the entire token exchange
// server-to-server and redirects here with ?ds=&name= (success) or ?error=
// (failure) — the access token itself never touches the browser.
function OAuthCallback() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ds, name, error } = Route.useSearch();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    if (error || redirected) return;
    if (ds) {
      queryClient.invalidateQueries({ queryKey: DATASOURCES_QUERY_KEY });
      setRedirected(true);
      const t = setTimeout(() => router.navigate({ to: "/datasources" }), 900);
      return () => clearTimeout(t);
    }
  }, [ds, error, redirected, queryClient, router]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <Card className="w-full rounded-2xl p-8 shadow-soft">
        {error ? (
          <>
            <XCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-3 text-sm text-destructive">{error}</p>
            <Button
              className="mt-4 rounded-xl"
              onClick={() => router.navigate({ to: "/datasources/new" })}
            >
              Try again
            </Button>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto h-8 w-8 text-green-600" />
            <p className="mt-3 text-sm">Connected {name ? `to ${name}` : ""}. Redirecting…</p>
          </>
        )}
      </Card>
    </div>
  );
}
