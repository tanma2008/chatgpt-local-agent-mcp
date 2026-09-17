import assert from "node:assert/strict";
import test from "node:test";
import { ALLOWED_WORKERS, isToolAllowed } from "../src/tools/remote-worker.js";
import { TOOL_DEFINITIONS } from "../src/tools/registry.js";

test("remote_worker_list contains registered Dell5080 worker", () => {
  assert.equal(ALLOWED_WORKERS.length, 1);
  assert.equal(ALLOWED_WORKERS[0].id, "dell5080");
  assert.equal(ALLOWED_WORKERS[0].host, "100.91.251.126");
  assert.equal(ALLOWED_WORKERS[0].port, 8795);
});

test("Phase 1 read-only allowlist permits specified read-only tools", () => {
  const allowedTools = [
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
  ];

  for (const tool of allowedTools) {
    const res = isToolAllowed(tool);
    assert.equal(res.allowed, true, `Expected tool '${tool}' to be allowed in Phase 1`);
  }
});

test("Phase 1 blocks mutative and privileged tools", () => {
  const blockedTools = [
    "execute_command",
    "powershell",
    "filesystem_write",
    "process_start",
    "process_stop",
    "service_restart",
    "ollama_run",
    "unknown_tool",
  ];

  for (const tool of blockedTools) {
    const res = isToolAllowed(tool);
    assert.equal(res.allowed, false, `Expected tool '${tool}' to be blocked in Phase 1`);
    assert.match(res.reason!, /Phase 1/);
  }
});

test("Tool registry contains 57 total tools (53 local + 4 remote worker dispatcher tools)", () => {
  assert.equal(TOOL_DEFINITIONS.length, 57);
  const toolNames = TOOL_DEFINITIONS.map((t) => t.name);
  assert.ok(toolNames.includes("remote_worker_list"));
  assert.ok(toolNames.includes("remote_worker_health"));
  assert.ok(toolNames.includes("remote_worker_tools"));
  assert.ok(toolNames.includes("remote_worker_call"));
});
