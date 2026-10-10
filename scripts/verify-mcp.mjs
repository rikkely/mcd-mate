import nextEnv from "@next/env";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

nextEnv.loadEnvConfig(process.cwd());
const token = process.env.MCD_MCP_TOKEN;
if (!token) {
  console.log("未配置本地 MCD_MCP_TOKEN。");
  process.exit(1);
}
const timeout = Number(process.env.MCD_MCP_TIMEOUT_MS || 15000);
const client = new Client({ name: "mcd-mate-verification", version: "0.1.0" });
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeout);
const transport = new StreamableHTTPClientTransport(
  new URL("https://mcp.mcd.cn"),
  {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
    fetch: (url, init) =>
      fetch(url, {
        ...init,
        signal: AbortSignal.any([
          controller.signal,
          ...(init?.signal ? [init.signal] : []),
        ]),
      }),
    reconnectionOptions: {
      maxRetries: 0,
      initialReconnectionDelay: 1000,
      maxReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1,
    },
  },
);
try {
  await client.connect(transport, { timeout, signal: controller.signal });
  const tools = [];
  let cursor;
  let pages = 0;
  do {
    if (++pages > 10) throw new Error("工具分页超出上限");
    const result = await client.listTools(
      { cursor },
      { timeout, signal: controller.signal },
    );
    tools.push(...result.tools);
    cursor = result.nextCursor;
  } while (cursor);
  // 仅输出公开工具定义，禁止输出认证头、账户地址或原始异常。
  const relevant = tools.filter((tool) =>
    [
      "query-nearby-stores",
      "query-meals",
      "query-meal-detail",
      "calculate-price",
    ].includes(tool.name),
  );
  console.log(
    JSON.stringify(
      {
        connected: true,
        timeout,
        tools: relevant.map((tool) => ({
          name: tool.name,
          required: tool.inputSchema.required || [],
          parameters: Object.keys(tool.inputSchema.properties || {}),
        })),
      },
      null,
      2,
    ),
  );
  if (process.argv.includes("--probe")) {
    const result = await client.callTool(
      { name: "list-nutrition-foods", arguments: {} },
      undefined,
      { timeout, signal: controller.signal },
    );
    let content = result.structuredContent;
    if (!content) {
      try {
        content = JSON.parse(
          result.content.find((c) => c.type === "text")?.text || "{}",
        );
      } catch {
        content = {};
      }
    }
    console.log(
      JSON.stringify({
        tool: "list-nutrition-foods",
        success: !result.isError && content.code === 200,
        responseFields: Object.keys(content),
        dataType: typeof content.data,
      }),
    );
    if (result.isError || content.success === false || content.code !== 200) process.exitCode = 1;
  }
} catch (error) {
  console.log(
    JSON.stringify({
      connected: false,
      timeout,
      error: controller.signal.aborted ? "TIMEOUT" : "MCP_CONNECTION_FAILED",
      code: typeof error?.code === "number" ? error.code : undefined,
    }),
  );
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  await client.close().catch(() => {});
}
