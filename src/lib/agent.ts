import { supabase } from "@/integrations/supabase/client";
import { clearToolCache } from "@/lib/mcp-proxy-client";
import { functionErrorMessage } from "@/lib/edge-function-error";

export interface AgentSession {
  id: string;
  user_id: string;
  title: string;
  enabled_datasource_ids: string[];
  cache_cleared_at: string;
  created_at: string;
  updated_at: string;
}

export type MessageRole = "user" | "model" | "function";
export type StepType = "message" | "tool_call" | "tool_result";

export interface AgentMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  step_type: StepType;
  content: Record<string, unknown>;
  created_at: string;
}

export async function fetchSessions(): Promise<AgentSession[]> {
  const { data, error } = await supabase
    .from("agent_sessions")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as unknown as AgentSession[];
}

export async function fetchSession(id: string): Promise<AgentSession | null> {
  const { data, error } = await supabase
    .from("agent_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as AgentSession | null;
}

export async function fetchMessages(sessionId: string): Promise<AgentMessage[]> {
  const { data, error } = await supabase
    .from("agent_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data as unknown as AgentMessage[];
}

export async function createSession(): Promise<AgentSession> {
  const { data, error } = await supabase.from("agent_sessions").insert({}).select("*").single();
  if (error) throw new Error(error.message);
  return data as unknown as AgentSession;
}

export async function renameSession(id: string, title: string): Promise<void> {
  const { error } = await supabase.from("agent_sessions").update({ title }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from("agent_sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function sendMessage(
  sessionId: string | undefined,
  message: string,
  enabledDatasourceIds: string[],
): Promise<{ sessionId: string }> {
  const { data, error } = await supabase.functions.invoke("agent-chat", {
    body: { sessionId, message, enabledDatasourceIds },
  });
  if (error) throw new Error(await functionErrorMessage(error, "Failed to send message"));
  if (data?.error) throw new Error(data.error);
  return data as { sessionId: string };
}

// The "Clear KV cache" button: resets the conversation context the Runner
// will reconstruct (agent_sessions.cache_cleared_at) and drops the cached MCP
// tool schemas for this session's connected datasources, so the very next
// turn starts with a clean slate and fresh tool discovery.
export async function clearAgentCache(sessionId: string, datasourceIds: string[]): Promise<void> {
  const { error } = await supabase
    .from("agent_sessions")
    .update({ cache_cleared_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
  await Promise.all(datasourceIds.map((id) => clearToolCache(id).catch(() => {})));
}
