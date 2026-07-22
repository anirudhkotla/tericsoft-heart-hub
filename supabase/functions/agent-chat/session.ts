import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { GeminiContent, GeminiPart } from "./gemini.ts";

export interface AgentSession {
  id: string;
  user_id: string;
  title: string;
  enabled_datasource_ids: string[];
  cache_cleared_at: string;
}

export async function getOrCreateSession(
  admin: SupabaseClient,
  userId: string,
  sessionId: string | undefined,
  enabledDatasourceIds: string[],
): Promise<AgentSession> {
  if (sessionId) {
    const { data, error } = await admin
      .from("agent_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as AgentSession;
  }
  const { data, error } = await admin
    .from("agent_sessions")
    .insert({ user_id: userId, enabled_datasource_ids: enabledDatasourceIds })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AgentSession;
}

export async function loadContents(
  admin: SupabaseClient,
  session: AgentSession,
): Promise<GeminiContent[]> {
  const { data, error } = await admin
    .from("agent_messages")
    .select("role, step_type, content, created_at")
    .eq("session_id", session.id)
    .gt("created_at", session.cache_cleared_at)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const contents: GeminiContent[] = [];
  for (const row of data ?? []) {
    if (row.step_type === "message") {
      contents.push({
        role: row.role as GeminiContent["role"],
        parts: [{ text: (row.content as { text: string }).text }],
      });
    } else if (row.step_type === "tool_call") {
      const c = row.content as { name: string; args: Record<string, unknown> };
      contents.push({ role: "model", parts: [{ functionCall: { name: c.name, args: c.args } }] });
    } else if (row.step_type === "tool_result") {
      const c = row.content as { name: string; result: unknown };
      contents.push({
        role: "function",
        parts: [{ functionResponse: { name: c.name, response: { result: c.result } } }],
      });
    }
  }
  return contents;
}

export async function appendMessage(
  admin: SupabaseClient,
  session: AgentSession,
  role: "user" | "model" | "function",
  stepType: "message" | "tool_call" | "tool_result",
  content: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("agent_messages").insert({
    session_id: session.id,
    user_id: session.user_id,
    role,
    step_type: stepType,
    content,
  });
  if (error) throw new Error(error.message);
}

export function partsToContent(parts: GeminiPart[]): {
  text?: string;
  functionCalls: { name: string; args: Record<string, unknown> }[];
} {
  let text = "";
  const functionCalls: { name: string; args: Record<string, unknown> }[] = [];
  for (const part of parts) {
    if ("text" in part) text += part.text;
    if ("functionCall" in part) functionCalls.push(part.functionCall);
  }
  return { text: text || undefined, functionCalls };
}
