import { handleOptions, json } from "../_shared/cors.ts";
import { callerClient, serviceRoleClient, loadDatasourceForCaller } from "../_shared/datasource.ts";
import { getOrCreateSession, appendMessage } from "./session.ts";
import { runAgent } from "./runner.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const caller = callerClient(req);
    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) return json(req, { error: "Not authenticated" }, 401);

    const { sessionId, message, enabledDatasourceIds } = await req.json();
    if (!message || typeof message !== "string") {
      return json(req, { error: "message is required" }, 400);
    }
    const dsIds: string[] = Array.isArray(enabledDatasourceIds) ? enabledDatasourceIds : [];

    const admin = serviceRoleClient();
    const session = await getOrCreateSession(admin, user.id, sessionId, dsIds);

    if (dsIds.length && JSON.stringify(dsIds) !== JSON.stringify(session.enabled_datasource_ids)) {
      await admin
        .from("agent_sessions")
        .update({ enabled_datasource_ids: dsIds })
        .eq("id", session.id);
      session.enabled_datasource_ids = dsIds;
    }
    if (session.title === "New chat") {
      await admin
        .from("agent_sessions")
        .update({ title: message.slice(0, 60) })
        .eq("id", session.id);
    }

    await appendMessage(admin, session, "user", "message", { text: message });

    const datasources = await Promise.all(
      session.enabled_datasource_ids.map((id) =>
        loadDatasourceForCaller(req, id).catch(() => null),
      ),
    );
    const resolved = datasources.filter((d): d is NonNullable<typeof d> => d !== null);

    await runAgent(admin, session, resolved);

    return json(req, { sessionId: session.id });
  } catch (e) {
    return json(req, { error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
