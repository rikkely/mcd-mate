import { afterEach, describe, expect, it, vi } from "vitest";
import { getEventListeners } from "node:events";
import { callTool, listTools, safeMessage, withMcp } from "../lib/mcp";

const tools = [
  {
    name: "query-meals",
    inputSchema: {
      type: "object",
      properties: { store: { type: "string" } },
      required: ["store"],
      additionalProperties: false,
    },
  },
];
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function mockServer(sse = false, toolError = false) {
  vi.stubEnv("MCD_MCP_TOKEN", "test-only-fake-token");
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    if (init?.method !== "POST") return new Response(null, { status: 405 });
    const message = JSON.parse(String(init.body));
    // SDK 从请求编号 0 开始，通知只能通过缺少 id 判断。
    if (message.id === undefined) return new Response(null, { status: 202 });
    const result =
      message.method === "initialize"
        ? {
            protocolVersion: "2025-03-26",
            capabilities: { tools: {} },
            serverInfo: { name: "test-fixture", version: "1" },
          }
        : message.method === "tools/list"
          ? { tools }
          : {
              isError: toolError,
              content: [{ type: "text", text: '{"fixture":true}' }],
            };
    const json = JSON.stringify({ jsonrpc: "2.0", id: message.id, result });
    return new Response(sse ? `event: message\ndata: ${json}\n\n` : json, {
      headers: {
        "Content-Type": sse ? "text/event-stream" : "application/json",
        "Mcp-Session-Id": "fixture-session",
      },
    });
  });
}
describe("SDK 协议和真实性边界", () => {
  it("连续调用后清理整体超时监听", async () => {
    vi.stubGlobal("fetch", mockServer());
    let workflowSignal: AbortSignal | undefined;
    await withMcp(async (client, options) => {
      workflowSignal = options.signal;
      const listed = await listTools(client, options);
      for (let i = 0; i < 15; i++) {
        await callTool(client, options, listed, "query-meals", {
          store: "fixture-store",
        });
        expect(getEventListeners(options.signal, "abort")).toHaveLength(0);
      }
    });
    expect(workflowSignal?.aborted).toBe(true);
  });
  it("无 Token 时不发送请求", async () => {
    vi.stubEnv("MCD_MCP_TOKEN", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(withMcp(async () => true)).rejects.toMatchObject({
      code: "NO_TOKEN",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "完成 JSON/SSE 会话并阻止缺失参数：%s",
    async (sse) => {
      const fetch = mockServer(sse);
      vi.stubGlobal("fetch", fetch);
      await withMcp(async (client, options) => {
        const listed = await listTools(client, options);
        await expect(
          callTool(client, options, listed, "query-meals", {}),
        ).rejects.toMatchObject({ code: "INVALID_ARGUMENTS" });
        expect(
          await callTool(client, options, listed, "query-meals", {
            store: "fixture-store",
          }),
        ).toEqual({ fixture: true });
      });
      const calls = fetch.mock.calls
        .map((c) => c[1]?.body && JSON.parse(String(c[1].body)))
        .filter(Boolean);
      expect(calls.filter((c) => c.method === "tools/call")).toHaveLength(1);
      expect(calls.some((c) => c.method === "notifications/initialized")).toBe(
        true,
      );
    },
  );
  it("工具级失败不当作真实结果", async () => {
    vi.stubGlobal("fetch", mockServer(false, true));
    await expect(
      withMcp(async (client, options) =>
        callTool(
          client,
          options,
          await listTools(client, options),
          "query-meals",
          { store: "fixture-store" },
        ),
      ),
    ).rejects.toMatchObject({ code: "TOOL_FAILED" });
  });
  it("不透传可能含 Token 的原始异常", () => {
    expect(safeMessage(new Error("secret-token-fake"))).not.toContain(
      "secret-token-fake",
    );
  });
  it("HTTP 401 被归为认证失败", async () => {
    vi.stubEnv("MCD_MCP_TOKEN", "test-only-fake-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    await expect(withMcp(async () => true)).rejects.toMatchObject({
      code: "AUTH",
    });
  });
  it("整体 deadline 能终止挂起的请求", async () => {
    vi.stubEnv("MCD_MCP_TOKEN", "test-only-fake-token");
    vi.stubEnv("MCD_MCP_TIMEOUT_MS", "100");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init.signal.addEventListener(
              "abort",
              () => reject(new DOMException("超时", "AbortError")),
              { once: true },
            ),
          ),
      ),
    );
    await expect(withMcp(async () => true)).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });
});
