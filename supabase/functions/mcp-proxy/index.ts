import { handleOptions, json } from "../_shared/cors.ts";
import { loadDatasourceForCaller, serviceRoleClient } from "../_shared/datasource.ts";
import { getCachedTools } from "../_shared/tool-cache.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { datasourceId, action, params } = await req.json();
    if (!datasourceId || !action) {
      return json(req, { error: "datasourceId and action are required" }, 400);
    }

    if (action === "clear_cache") {
      // Caller-ownership check still applies — reuse the resolver, discard the client.
      const ds = await loadDatasourceForCaller(req, datasourceId);
      const admin = serviceRoleClient();
      await admin.from("datasource_tool_cache").delete().eq("datasource_id", ds.id);
      return json(req, { ok: true });
    }

    const ds = await loadDatasourceForCaller(req, datasourceId);

    switch (action) {
      case "list_tools": {
        const admin = serviceRoleClient();
        const tools = await getCachedTools(admin, ds.id, ds.client);
        return json(req, { tools });
      }
      case "call_tool": {
        const result = await ds.client.callTool(params?.name, params?.arguments ?? {});
        return json(req, result);
      }
      case "list_resources": {
        if (!ds.client.listResources) return json(req, { resources: [] });
        const resources = await ds.client.listResources();
        return json(req, { resources });
      }
      case "read_resource": {
        if (!ds.client.readResource) return json(req, { contents: [] });
        const contents = await ds.client.readResource(params?.uri);
        return json(req, { contents });
      }
      case "discover_schema": {
        const schema = await ds.client.discoverSchema();
        return json(req, { schema });
      }
      default:
        return json(req, { error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json(req, { error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
