import {
  callTool,
  listTools,
  McpError,
  safeMessage,
  toolRequest,
  withMcp,
} from "../../../lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!process.env.MCD_MCP_TOKEN)
    return Response.json({
      status: "unavailable",
      error: safeMessage(new McpError("NO_TOKEN")),
    });
  try {
    const tools = await withMcp((client, options) =>
      listTools(client, options),
    );
    return Response.json(
      { status: "connected", tools },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { status: "unavailable", error: safeMessage(error) },
      { status: error instanceof McpError ? error.status : 503 },
    );
  }
}
export async function POST(request: Request) {
  const input = toolRequest.safeParse(await request.json().catch(() => null));
  if (!input.success)
    return Response.json(
      { error: "仅允许已列出的只读查询和价格计算，请传入工具名与参数对象。" },
      { status: 400 },
    );
  try {
    const data = await withMcp(async (client, options) =>
      callTool(
        client,
        options,
        await listTools(client, options),
        input.data.name,
        input.data.arguments,
      ),
    );
    const serialized = JSON.stringify({
      data,
      tool: input.data.name,
      checkedAt: new Date().toISOString(),
    });
    return new Response(
      process.env.MCD_MCP_TOKEN
        ? serialized.split(process.env.MCD_MCP_TOKEN).join("[REDACTED]")
        : serialized,
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return Response.json(
      { error: safeMessage(error) },
      { status: error instanceof McpError ? error.status : 503 },
    );
  }
}
