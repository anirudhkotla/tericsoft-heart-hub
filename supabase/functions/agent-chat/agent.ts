// The "Agent" half of the ADK-style Agent/Tool/Session/Runner split: static
// configuration for how the model should behave, independent of any one
// conversation's session state or tool wiring.
export interface AgentConfig {
  name: string;
  model: string;
  systemInstruction: string;
  generationConfig?: Record<string, unknown>;
  maxToolIterations: number;
}

export const DEFAULT_AGENT: AgentConfig = {
  name: "tericsoft-hr-agent",
  model: "gemini-2.5-flash",
  systemInstruction:
    "You are the Tericsoft HR OS assistant. You can call tools on the user's connected " +
    "datasources (Airtable, Notion, Roam Research, or custom MCP servers) to look up real data " +
    "before answering. Prefer calling a tool over guessing when the question depends on external " +
    "data. Be concise and cite which datasource/table a fact came from when relevant.",
  generationConfig: { temperature: 0.4 },
  maxToolIterations: 8,
};
