// Datasources are persisted in Supabase (owner-only RLS) instead of
// sessionStorage — they now survive reloads and sync wherever the same user
// signs in, and secrets never live in the browser (see mcp-proxy-client.ts).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteDatasource, fetchDatasources, type Datasource } from "@/lib/datasources";
import { evictMcpProxyClient } from "@/lib/mcp-proxy-client";

export const DATASOURCES_QUERY_KEY = ["datasources"] as const;

export function useDatasources() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: DATASOURCES_QUERY_KEY, queryFn: fetchDatasources });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: DATASOURCES_QUERY_KEY });

  const remove = async (id: string) => {
    evictMcpProxyClient(id);
    await deleteDatasource(id);
    await invalidate();
  };

  return {
    datasources: (query.data ?? []) as Datasource[],
    isLoading: query.isLoading,
    error: query.error,
    invalidate,
    remove,
  };
}
