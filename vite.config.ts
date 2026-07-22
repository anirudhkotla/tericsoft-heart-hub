import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";

function mcpProxy(): Plugin {
  return {
    name: "mcp-proxy",
    configureServer(server) {
      server.middlewares.use("/api/mcp", async (req, res, next) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const { url, headers: reqHeaders, method, params } = JSON.parse(body);
            if (!url || !method) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "url and method required" }));
              return;
            }

            const outboundHeaders: Record<string, string> = {
              "Content-Type": "application/json",
              Accept: "application/json, text/event-stream",
              ...reqHeaders,
            };

            const apiRes = await fetch(url, {
              method: "POST",
              headers: outboundHeaders,
              body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
            });

            const sid = apiRes.headers.get("Mcp-Session-Id");
            if (sid) res.setHeader("X-Mcp-Session-Id", sid);

            const ct = apiRes.headers.get("content-type") ?? "";
            let data: unknown;

            if (ct.includes("text/event-stream")) {
              const text = await apiRes.text();
              // SSE format: event: message\ndata: {...}\n\n
              const jsonLines: string[] = [];
              for (const line of text.split("\n")) {
                if (line.startsWith("data: ")) {
                  jsonLines.push(line.slice(6));
                }
              }
              const joined = jsonLines.join("");
              try {
                data = JSON.parse(joined);
              } catch {
                // maybe it's a single JSON blob not in SSE framing
                data = JSON.parse(text);
              }
            } else {
              data = await apiRes.json();
            }

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Proxy error";
            res.statusCode = 502;
            res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: msg } }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: "/tericsoft-heart-hub/",
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart({
      spa: { enabled: true },
    }),
    viteReact(),
    tailwindcss(),
    mcpProxy(),
  ],
});
