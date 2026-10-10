import { inputSchema } from "../../../lib/contracts";
import { liveRecommendation } from "../../../lib/live";
import { McpError, safeMessage } from "../../../lib/mcp";
import { demoRecommendation } from "../../../lib/recommend";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success)
    return Response.json(
      { error: "预算应为 1–500 元，请选择有效的场景和心情。" },
      { status: 400 },
    );
  try {
    return Response.json(
      input.data.mode === "demo"
        ? demoRecommendation(input.data)
        : await liveRecommendation(input.data),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error: safeMessage(error),
        connection:
          error instanceof McpError &&
          [
            "MAPPING_REQUIRED",
            "STORE_REQUIRED",
            "INVALID_MAPPING",
            "INVALID_CATALOG",
            "INVALID_PRICE",
            "PRICE_REQUIRED",
            "TOOL_MISSING",
            "INVALID_ARGUMENTS",
            "TOOL_FAILED",
          ].includes(error.code)
            ? "connected"
            : "unavailable",
      },
      { status: error instanceof McpError ? error.status : 503 },
    );
  }
}
