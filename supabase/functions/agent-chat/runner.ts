import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { ResolvedDatasource } from "../_shared/datasource.ts";
import { DEFAULT_AGENT } from "./agent.ts";
import { generateContent } from "./gemini.ts";
import { buildToolDeclarations } from "./tools.ts";
import { appendMessage, loadContents, partsToContent, type AgentSession } from "./session.ts";

// The Runner: the ADK-style tool-calling loop. Calls Gemini with the full
// conversation + available tools; if it asks for a function call, executes
// it against the matching datasource's MCP/Roam client and feeds the result
// back; repeats until Gemini returns plain text or the iteration cap hits.
export async function runAgent(
  admin: SupabaseClient,
  session: AgentSession,
  datasources: ResolvedDatasource[],
): Promise<void> {
  const { declarations, dispatch } = await buildToolDeclarations(admin, datasources);
  const contents = await loadContents(admin, session);

  for (let i = 0; i < DEFAULT_AGENT.maxToolIterations; i++) {
    const result = await generateContent(
      DEFAULT_AGENT.model,
      contents,
      DEFAULT_AGENT.systemInstruction,
      declarations,
      DEFAULT_AGENT.generationConfig,
    );
    if (!result.content) {
      await appendMessage(admin, session, "model", "message", {
        text: "The model returned no response. Please try again.",
      });
      return;
    }

    const { text, functionCalls } = partsToContent(result.content.parts);

    if (functionCalls.length === 0) {
      await appendMessage(admin, session, "model", "message", { text: text ?? "" });
      return;
    }

    contents.push({ role: "model", parts: functionCalls.map((call) => ({ functionCall: call })) });

    for (const call of functionCalls) {
      await appendMessage(admin, session, "model", "tool_call", {
        name: call.name,
        args: call.args,
      });

      const entry = dispatch.get(call.name);
      let resultPayload: unknown;
      if (!entry) {
        resultPayload = { ok: false, error: `Unknown tool: ${call.name}` };
      } else {
        const ds = datasources.find((d) => d.id === entry.datasourceId);
        resultPayload = ds
          ? await ds.client.callTool(entry.toolName, call.args)
          : { ok: false, error: "Datasource not available" };
      }

      await appendMessage(admin, session, "function", "tool_result", {
        name: call.name,
        result: resultPayload,
      });
      contents.push({
        role: "function",
        parts: [{ functionResponse: { name: call.name, response: { result: resultPayload } } }],
      });
    }
  }

  await appendMessage(admin, session, "model", "message", {
    text: "I reached the tool-call limit for this turn — try rephrasing or asking a narrower question.",
  });
}
