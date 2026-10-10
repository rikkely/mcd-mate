import { Input, Recommendation, persona } from "./contracts";
import {
  catalogFrom,
  mappingSchema,
  money,
  readPath,
  setPath,
} from "./mapping";
import { callTool, listTools, McpError, withMcp } from "./mcp";
import { recommend } from "./recommend";
import { officialRecommendation } from "./official";

export async function liveRecommendation(
  input: Input,
): Promise<Recommendation> {
  return withMcp(async (client, options) => {
    const tools = await listTools(client, options);
    if (!process.env.MCD_MCP_MAPPING?.trim())
      return officialRecommendation(client, options, tools, input);
    let mapping;
    try {
      mapping = mappingSchema.parse(JSON.parse(process.env.MCD_MCP_MAPPING));
    } catch {
      throw new McpError("INVALID_MAPPING", 422);
    }
    let catalog;
    try {
      catalog = catalogFrom(
        await callTool(
          client,
          options,
          tools,
          "query-meals",
          mapping.queryArgs,
        ),
        mapping,
      );
    } catch (error) {
      if (error instanceof McpError) throw error;
      throw new McpError("INVALID_CATALOG", 422);
    }
    const routes = recommend(
      catalog.map((f) => ({
        ...f,
        tags: input.preferences.filter((p) => f.name.includes(p)),
      })),
      input,
    );
    if (!mapping.calculate && routes.length)
      throw new McpError("PRICE_REQUIRED", 422);
    const verified = [];
    // 商品编码来自本次菜单，门店和就餐参数来自按实际 schema 配置的上下文。
    for (const route of routes) {
      const cfg = mapping.calculate!;
      const args = structuredClone(cfg.baseArgs);
      const products = route.foods.map((food) => {
        const item = structuredClone(cfg.itemTemplate);
        setPath(item, cfg.idPath, food.id);
        setPath(item, cfg.quantityPath, 1);
        return item;
      });
      setPath(args, cfg.productsPath, products);
      const quote = await callTool(
        client,
        options,
        tools,
        "calculate-price",
        args,
      );
      let cents;
      try {
        cents = money(readPath(quote, cfg.totalPath), cfg.totalUnit);
      } catch {
        throw new McpError("INVALID_PRICE", 422);
      }
      if (cents <= Math.round(input.budget * 100))
        verified.push({ ...route, cents, priceVerified: true });
    }
    return {
      source: "live",
      title: persona(input).title,
      routes: verified,
      checkedAt: new Date().toISOString(),
      tool: "query-meals → calculate-price",
      note: verified.length
        ? "本次门店菜单与组合总价来自官方 MCP。预算挑战比较有限候选，不保证全菜单最优；其他时段库存需重新查询。"
        : "已查询官方菜单，但没有取得预算内的已核验组合。可调整预算或门店上下文后重试；不会用演示餐品补齐。",
    };
  });
}
