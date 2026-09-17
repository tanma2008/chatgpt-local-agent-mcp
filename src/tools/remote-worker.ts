import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { McpRuntime } from "../mcp.js";

export type RemoteWorkerInfo = {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  statusUrl: string;
  mcpUrl: string;
};

export const ALLOWED_WORKERS: ReadonlyArray<RemoteWorkerInfo> = [
  {
    id: "dell5080",
    name: "Dell 5080 Worker",
    host: "100.91.251.126",
    port: 8795,
    protocol: "StreamableHTTP",
    statusUrl: "http://100.91.251.126:8795/health",
    mcpUrl: "http://100.91.251.126:8795/mcp",
  },
];

export const PHASE1_READONLY_TOOLS = new Set([
  "system_info",
  "cpu_info",
  "memory_info",
  "disk_info",
  "network_info",
  "gpu_info",
  "process_list",
  "service_status",
  "ollama_list",
  "ollama_status",
  "mcp_status",
  "mcp_health",
  "mcp_clients",
]);

export const BLOCKED_TOOLS = new Set([
  "execute_command",
  "powershell",
  "filesystem_write",
  "process_start",
  "process_stop",
  "service_restart",
  "ollama_run",
]);

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 500_000;

export function getWorker(workerId: string): RemoteWorkerInfo | undefined {
  return ALLOWED_WORKERS.find((w) => w.id.toLowerCase() === workerId.toLowerCase());
}

export function isToolAllowed(toolName: string): { allowed: boolean; reason?: string } {
  if (BLOCKED_TOOLS.has(toolName)) {
    return { allowed: false, reason: `Tool '${toolName}' is explicitly blocked in Phase 1 (Mutative/Privileged tool)` };
  }
  if (PHASE1_READONLY_TOOLS.has(toolName)) {
    return { allowed: true };
  }
  return { allowed: false, reason: `Tool '${toolName}' is not in Phase 1 read-only allowlist` };
}

export async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export function registerRemoteWorkerListTool(server: McpServer, _runtime: McpRuntime): void {
  server.tool(
    "remote_worker_list",
    "List all registered remote workers in the AI Commander network",
    {},
    async () => {
      const workers = ALLOWED_WORKERS.map((w) => ({
        id: w.id,
        name: w.name,
        host: w.host,
        port: w.port,
        protocol: w.protocol,
        mcpUrl: w.mcpUrl,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ workers }, null, 2) }],
      };
    }
  );
}

export function registerRemoteWorkerHealthTool(server: McpServer, _runtime: McpRuntime): void {
  server.tool(
    "remote_worker_health",
    "Check HTTP & MCP transport health of a remote worker in the network",
    {
      worker_id: z.string().describe("The ID of the remote worker (e.g. 'dell5080')"),
    },
    async ({ worker_id }) => {
      const worker = getWorker(worker_id);
      if (!worker) {
        return {
          isError: true,
          content: [{ type: "text", text: `Unknown worker_id '${worker_id}'. Allowed workers: ${ALLOWED_WORKERS.map((w) => w.id).join(", ")}` }],
        };
      }

      try {
        const res = await fetchWithTimeout(worker.statusUrl);
        if (!res.ok) {
          return {
            isError: true,
            content: [{ type: "text", text: `Worker '${worker.id}' status check failed with HTTP ${res.status}` }],
          };
        }
        const text = await res.text();
        let healthData: unknown;
        try {
          healthData = JSON.parse(text);
        } catch {
          healthData = text;
        }

        return {
          content: [{ type: "text", text: JSON.stringify({ worker: worker.id, reachable: true, health: healthData }, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Worker '${worker.id}' unreachable at ${worker.statusUrl}: ${error?.message || String(error)}` }],
        };
      }
    }
  );
}

export function registerRemoteWorkerToolsTool(server: McpServer, _runtime: McpRuntime): void {
  server.tool(
    "remote_worker_tools",
    "Retrieve the tool definitions published by a remote worker",
    {
      worker_id: z.string().describe("The ID of the remote worker (e.g. 'dell5080')"),
    },
    async ({ worker_id }) => {
      const worker = getWorker(worker_id);
      if (!worker) {
        return {
          isError: true,
          content: [{ type: "text", text: `Unknown worker_id '${worker_id}'. Allowed workers: ${ALLOWED_WORKERS.map((w) => w.id).join(", ")}` }],
        };
      }

      try {
        const res = await fetchWithTimeout(worker.mcpUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/list",
          }),
        });

        if (!res.ok) {
          return {
            isError: true,
            content: [{ type: "text", text: `Remote worker '${worker.id}' tools/list failed with HTTP ${res.status}` }],
          };
        }

        const rawText = await res.text();
        if (rawText.length > MAX_RESPONSE_BYTES) {
          return {
            isError: true,
            content: [{ type: "text", text: `Remote worker response exceeded maximum payload limit of ${MAX_RESPONSE_BYTES} bytes` }],
          };
        }

        let toolsList: any[] = [];
        for (const line of rawText.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.result?.tools) {
                toolsList = json.result.tools;
              }
            } catch {}
          }
        }

        const sanitizedTools = toolsList.map((t: any) => ({
          name: t.name,
          description: t.description,
          phase1Status: isToolAllowed(t.name).allowed ? "ALLOWED_READONLY" : "BLOCKED_PHASE1",
        }));

        return {
          content: [{ type: "text", text: JSON.stringify({ worker: worker.id, count: sanitizedTools.length, tools: sanitizedTools }, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to query tools from worker '${worker.id}': ${error?.message || String(error)}` }],
        };
      }
    }
  );
}

export function registerRemoteWorkerCallTool(server: McpServer, _runtime: McpRuntime): void {
  server.tool(
    "remote_worker_call",
    "Execute a read-only MCP tool on a remote worker node (Phase 1 allowed read-only tools only)",
    {
      worker_id: z.string().describe("The ID of the target worker (e.g. 'dell5080')"),
      tool_name: z.string().describe("The name of the read-only tool to execute on the worker"),
      arguments: z.record(z.string(), z.any()).optional().describe("Arguments to pass to the remote tool"),
    },
    async ({ worker_id, tool_name, arguments: toolArgs }) => {
      const worker = getWorker(worker_id);
      if (!worker) {
        return {
          isError: true,
          content: [{ type: "text", text: `Unknown worker_id '${worker_id}'. Allowed workers: ${ALLOWED_WORKERS.map((w) => w.id).join(", ")}` }],
        };
      }

      const policyCheck = isToolAllowed(tool_name);
      if (!policyCheck.allowed) {
        return {
          isError: true,
          content: [{ type: "text", text: `SECURITY REJECTION: ${policyCheck.reason}` }],
        };
      }

      try {
        const res = await fetchWithTimeout(worker.mcpUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "tools/call",
            params: {
              name: tool_name,
              arguments: toolArgs || {},
            },
          }),
        });

        if (!res.ok) {
          return {
            isError: true,
            content: [{ type: "text", text: `Remote worker '${worker.id}' returned HTTP ${res.status}` }],
          };
        }

        const rawText = await res.text();
        if (rawText.length > MAX_RESPONSE_BYTES) {
          return {
            isError: true,
            content: [{ type: "text", text: `Remote worker response exceeded size limit of ${MAX_RESPONSE_BYTES} bytes` }],
          };
        }

        let rpcResult: any = null;
        for (const line of rawText.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.result || json.error) {
                rpcResult = json;
              }
            } catch {}
          }
        }

        if (!rpcResult) {
          // Try parsing raw payload if not EventStream data line
          try {
            rpcResult = JSON.parse(rawText);
          } catch {}
        }

        if (!rpcResult) {
          return {
            isError: true,
            content: [{ type: "text", text: `Failed to parse valid JSON-RPC response from worker '${worker.id}'` }],
          };
        }

        if (rpcResult.error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Remote tool execution error [${rpcResult.error.code}]: ${rpcResult.error.message}` }],
          };
        }

        const resultObj = rpcResult.result;
        if (resultObj?.content) {
          return resultObj;
        }

        return {
          content: [{ type: "text", text: JSON.stringify(resultObj, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to call remote tool '${tool_name}' on '${worker.id}': ${error?.message || String(error)}` }],
        };
      }
    }
  );
}
