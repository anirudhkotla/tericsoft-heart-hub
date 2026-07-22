import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Cable, KeyRound, Loader2, LogIn, BookMarked } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { createDatasource } from "@/lib/datasources";
import { DATASOURCES_QUERY_KEY } from "@/lib/datasource-store";
import { startOAuthConnect, KNOWN_PROVIDERS } from "@/lib/mcp-oauth";
import { PageHeader } from "@/components/workspace/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/datasources/new")({
  head: () => ({ meta: [{ title: "Connect datasource — Tericsoft HR OS" }] }),
  component: NewDatasource,
});

function NewDatasource() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [signingIn, setSigningIn] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [connectingCustom, setConnectingCustom] = useState(false);

  const [roamName, setRoamName] = useState("");
  const [graphName, setGraphName] = useState("");
  const [roamToken, setRoamToken] = useState("");
  const [connectingRoam, setConnectingRoam] = useState(false);

  const signIn = async (providerId: string, dsName: string, url: string) => {
    setSigningIn(providerId);
    try {
      await startOAuthConnect(providerId, dsName, url);
      // Navigates away on success; nothing left to do here.
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in isn't available for this server");
      setSigningIn(null);
    }
  };

  const goToDatasource = async (id: string) => {
    await queryClient.invalidateQueries({ queryKey: DATASOURCES_QUERY_KEY });
    router.navigate({ to: "/datasources/$datasourceId", params: { datasourceId: id } });
  };

  const connectCustom = async () => {
    if (!name.trim() || !serverUrl.trim()) return;
    setConnectingCustom(true);
    try {
      const ds = await createDatasource(
        name.trim(),
        "mcp",
        "custom",
        { serverUrl: serverUrl.trim() },
        authToken.trim() ? { authToken: authToken.trim() } : undefined,
      );
      toast.success("Datasource connected");
      await goToDatasource(ds.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect");
    } finally {
      setConnectingCustom(false);
    }
  };

  const connectRoam = async () => {
    if (!roamName.trim() || !graphName.trim() || !roamToken.trim()) return;
    setConnectingRoam(true);
    try {
      const ds = await createDatasource(
        roamName.trim(),
        "rest",
        "roam",
        { graphName: graphName.trim() },
        { apiToken: roamToken.trim() },
      );
      toast.success("Roam graph connected");
      await goToDatasource(ds.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect");
    } finally {
      setConnectingRoam(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        onClick={() => router.navigate({ to: "/datasources" })}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Datasources
      </Button>
      <PageHeader
        eyebrow="Integration"
        title="Connect a datasource"
        description="Link an external source so the AI agent and dashboard builder can discover and query your data."
      />

      <Card className="rounded-2xl p-6 shadow-soft">
        <p className="mb-3 text-sm font-medium">Quick connect</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Sign in on the provider's own login page — no API key to copy/paste.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {KNOWN_PROVIDERS.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              className="h-11 justify-start rounded-xl"
              onClick={() => signIn(p.id, p.name, p.serverUrl)}
              disabled={signingIn !== null}
            >
              {signingIn === p.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Connect {p.name}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="mt-4 rounded-2xl p-6 shadow-soft">
        <p className="mb-1 text-sm font-medium">Roam Research</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Roam has no public OAuth login for third-party apps — connect with a graph API token
          instead (Roam graph → Settings → Graph → API Tokens).
        </p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="roam-name">Name</Label>
            <Input
              id="roam-name"
              value={roamName}
              onChange={(e) => setRoamName(e.target.value)}
              placeholder="e.g. HR Notes (Roam)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="roam-graph">Graph name</Label>
            <Input
              id="roam-graph"
              value={graphName}
              onChange={(e) => setGraphName(e.target.value)}
              placeholder="my-graph"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="roam-token" className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> API token
            </Label>
            <Input
              id="roam-token"
              type="password"
              value={roamToken}
              onChange={(e) => setRoamToken(e.target.value)}
              placeholder="roam-graph-token-..."
            />
          </div>
          <Button
            variant="outline"
            onClick={connectRoam}
            disabled={!roamName.trim() || !graphName.trim() || !roamToken.trim() || connectingRoam}
            className="rounded-xl"
          >
            {connectingRoam ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <BookMarked className="mr-1 h-4 w-4" />
            )}
            Connect Roam graph
          </Button>
        </div>
      </Card>

      <Card className="mt-4 rounded-2xl p-6 shadow-soft">
        <p className="mb-3 text-sm font-medium">Custom MCP server</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Internal CRM"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="url">MCP Server URL</Label>
            <Input
              id="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://mcp.example.com/mcp"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token" className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Auth Token (optional)
            </Label>
            <Input
              id="token"
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Bearer token or API key"
            />
          </div>
          <Button
            variant="outline"
            onClick={connectCustom}
            disabled={!name.trim() || !serverUrl.trim() || connectingCustom}
            className="rounded-xl"
          >
            {connectingCustom ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Cable className="mr-1 h-4 w-4" />
            )}
            Connect
          </Button>
          <p className="text-xs text-muted-foreground">
            You'll land on the datasource page next, where you can test the connection and browse
            its data.
          </p>
        </div>
      </Card>
    </div>
  );
}
