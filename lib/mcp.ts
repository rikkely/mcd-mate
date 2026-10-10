import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { z } from "zod";

export const allowedTools = [
  "query-nearby-stores",
  "query-meals",
  "query-meal-detail",
  "calculate-price",
] as const;
export const toolRequest = z.object({
  name: z.enum(allowedTools),
  arguments: z.record(z.unknown()),
});
export class McpError extends Error {
  constructor(
    public code: string,
    public status = 503,
  ) {
    super(code);
  }
}
export function safeMessage(error: unknown) {
  const code = error instanceof McpError ? error.code : "UNAVAILABLE";
  const messages: Record<string, string> = {
    NO_TOKEN: "尚未配置服务端 Token。请配置 .env.local，或选择演示模式。",
    STORE_REQUIRED:
      "请先查询并选择真实门店及取餐方式，再生成推荐。无需填写 MCD_MCP_MAPPING。",
    INVALID_CONFIG: "服务端 MCP 配置无效。",
    TIMEOUT: "官方 MCP 响应超时，请稍后重试。",
    AUTH: "MCP 认证失败，请在本地检查 Token。",
    RATE_LIMIT: "MCP 请求过于频繁，请稍后重试。",
    TOOL_MISSING: "当前官方服务未提供所需工具。",
    INVALID_ARGUMENTS: "参数与官方 tools/list 返回的 schema 不符。",
    TOOL_FAILED: "官方工具未成功返回，请检查门店与餐品上下文。",
    MAPPING_REQUIRED:
      "已发现官方工具；请根据实际 schema 与返回字段配置菜单映射后再查询。",
    INVALID_MAPPING: "菜单映射配置无效。",
    INVALID_CATALOG: "返回字段与菜单映射不符，无法生成真实推荐。",
    INVALID_PRICE: "价格字段缺失或格式不符，无法核实预算。",
    PRICE_REQUIRED:
      "请配置 calculate-price 的实际参数与返回字段映射以验证组合。",
    UNAVAILABLE: "官方 MCP 暂不可用，请重试或主动切换演示模式。",
  };
  return messages[code] || messages.UNAVAILABLE;
}
export async function withMcp<T>(
  run: (
    client: Client,
    options: { timeout: number; signal: AbortSignal },
  ) => Promise<T>,
): Promise<T> {
  const token = process.env.MCD_MCP_TOKEN;
  if (!token) throw new McpError("NO_TOKEN");
  const parsed = z.coerce
    .number()
    .int()
    .min(100)
    .max(60000)
    .safeParse(process.env.MCD_MCP_TIMEOUT_MS || 15000);
  if (!parsed.success) throw new McpError("INVALID_CONFIG");
  // 固定官方域名，避免令牌因可配置 URL 被发送至其他服务。
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), parsed.data);
  const client = new Client({ name: "mcd-mate", version: "0.1.0" });
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
  const options = { timeout: parsed.data, signal: controller.signal };
  try {
    await scopedRequest(options, (requestOptions) =>
      client.connect(transport, requestOptions),
    );
    return await run(client, options);
  } catch (error) {
    if (error instanceof McpError) throw error;
    if (controller.signal.aborted) throw new McpError("TIMEOUT");
    const code = (error as { code?: number }).code;
    if (code === 401 || code === 403) throw new McpError("AUTH");
    if (code === 429) throw new McpError("RATE_LIMIT", 429);
    throw new McpError("UNAVAILABLE");
  } finally {
    clearTimeout(timer);
    controller.abort();
    await client.close().catch(() => {});
  }
}

async function scopedRequest<T>(
  options: { timeout: number; signal: AbortSignal },
  run: (options: { timeout: number; signal: AbortSignal }) => Promise<T>,
): Promise<T> {
  // SDK 不移除已完成请求的 abort 监听；每次请求使用独立信号，并清理整体超时的转发监听。
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal.reason);
  options.signal.addEventListener("abort", abort, { once: true });
  if (options.signal.aborted) abort();
  try {
    return await run({ ...options, signal: controller.signal });
  } finally {
    options.signal.removeEventListener("abort", abort);
  }
}
export async function listTools(
  client: Client,
  options: { timeout: number; signal: AbortSignal },
) {
  const tools = [];
  let cursor: string | undefined;
  for (let i = 0; i < 10; i++) {
    const result = await scopedRequest(options, (requestOptions) =>
      client.listTools({ cursor }, requestOptions),
    );
    tools.push(
      ...result.tools.filter((tool) =>
        allowedTools.includes(tool.name as (typeof allowedTools)[number]),
      ),
    );
    cursor = result.nextCursor;
    if (!cursor) return tools;
  }
  throw new McpError("UNAVAILABLE");
}
export async function callTool(
  client: Client,
  options: { timeout: number; signal: AbortSignal },
  tools: Awaited<ReturnType<typeof listTools>>,
  name: (typeof allowedTools)[number],
  args: Record<string, unknown>,
) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new McpError("TOOL_MISSING");
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  let valid: boolean;
  try {
    valid = Boolean(ajv.compile(tool.inputSchema)(args));
  } catch {
    throw new McpError("INVALID_ARGUMENTS", 400);
  }
  if (!valid) throw new McpError("INVALID_ARGUMENTS", 400);
  const result = await scopedRequest(options, (requestOptions) =>
    client.callTool({ name, arguments: args }, undefined, requestOptions),
  );
  if (result.isError) throw new McpError("TOOL_FAILED");
  if (result.structuredContent) return checkedContent(result.structuredContent);
  const texts = Array.isArray(result.content)
    ? result.content.filter((c) => c.type === "text").map((c) => c.text)
    : [];
  if (texts.length === 1) {
    // JSON 解析错误和业务失败分别处理，避免吞掉服务端失败标记。
    let parsed;
    try {
      parsed = JSON.parse(texts[0] as string);
    } catch {
      return texts[0];
    }
    return checkedContent(parsed);
  }
  return texts;
}

export function checkedContent(value: unknown) {
  if (value && typeof value === "object") {
    const result = value as Record<string, unknown>;
    if (
      result.success === false ||
      (typeof result.code === "number" &&
        result.code !== 200 &&
        result.code !== 0)
    )
      throw new McpError("TOOL_FAILED");
  }
  return value;
}
