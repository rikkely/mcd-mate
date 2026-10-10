import { z } from "zod";
import type { Food, Input, Recommendation, Store } from "./contracts";
import { persona } from "./contracts";
import { callTool, listTools, McpError } from "./mcp";
import { money } from "./mapping";
import { recommend } from "./recommend";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

const menuSchema = z.object({
  data: z.object({
    categories: z.array(
      z.object({
        meals: z.array(
          z.object({
            code: z.string().min(1),
            tags: z.array(z.string()).optional(),
          }),
        ),
      }),
    ),
    meals: z.record(
      z.object({
        name: z.string().min(1),
        currentPrice: z.string().optional(),
      }),
    ),
  }),
});
const detailSchema = z.object({
  data: z.object({
    code: z.string(),
    name: z.string().min(1),
    rounds: z.array(z.unknown()).nullish(),
    supportModify: z.boolean().optional(),
    modification: z
      .object({
        items: z.array(
          z.object({
            values: z.array(
              z.object({
                code: z.string(),
                selectedQuantity: z.number().int().nonnegative(),
                selectedKey: z.string().nullish(),
                unselectedKey: z.string().nullish(),
              }),
            ),
          }),
        ),
      })
      .nullish(),
  }),
});
const quoteSchema = z.object({
  data: z.object({
    price: z.number().int().nonnegative(),
    productList: z.array(
      z.object({
        productCode: z.string(),
        quantity: z.number().int().positive(),
        subtotal: z.number().int().nonnegative(),
      }),
    ),
  }),
});
export function storeContext(store: Store): Record<string, unknown> {
  return {
    storeCode: store.storeCode,
    orderType: 1,
    beType: store.beType,
    ...(store.beType === 5 ? { beCode: store.beCode } : {}),
  };
}
export function menuCandidates(value: unknown) {
  const parsed = menuSchema.safeParse(value);
  if (!parsed.success) throw new McpError("INVALID_CATALOG", 422);
  const codes = new Set(
    parsed.data.data.categories.flatMap((category) =>
      category.meals.map((meal) => meal.code),
    ),
  );
  return Object.entries(parsed.data.data.meals).flatMap(([code, meal]) => codes.has(code) ? [{ code, name: meal.name }] : []);
}
export function foodTags(name: string): string[] {
  // 仅用于推荐意图匹配，不声称营养或配料结论。
  return [
    ...(/鸡/.test(name) ? ["鸡肉"] : []),
    ...(/汉堡|堡|巨无霸|麦香鸡/.test(name) ? ["汉堡"] : []),
    ...(/饮|可乐|雪碧|咖啡|牛奶|茶|汁|纯悦|美式|奶铁/.test(name) ? ["饮品"] : []),
    ...(/薯条/.test(name) ? ["薯条"] : []),
  ];
}
export function defaultItem(value: unknown) {
  const parsed = detailSchema.safeParse(value);
  if (!parsed.success) throw new McpError("INVALID_CATALOG", 422);
  const detail = parsed.data.data;
  // 本次默认适配只推荐无套餐轮次的单品，复杂套餐需由用户确认选配。
  if (detail.rounds?.length) return null;
  const values =
    detail.modification?.items.flatMap((item) =>
      item.values.flatMap((value) => {
        const key =
          value.selectedQuantity > 0 ? value.selectedKey : value.unselectedKey;
        if (value.selectedQuantity > 0 && !key)
          throw new McpError("INVALID_CATALOG", 422);
        return key
          ? [{ code: value.code, key, quantity: value.selectedQuantity }]
          : [];
      }),
    ) || [];
  return {
    productCode: detail.code,
    quantity: 1,
    ...(values.length ? { modification: { values } } : {}),
  };
}
export function verifiedQuote(value: unknown, codes: string[]) {
  const parsed = quoteSchema.safeParse(value);
  if (!parsed.success) throw new McpError("INVALID_PRICE", 422);
  const products = parsed.data.data.productList;
  if (
    products.length !== codes.length ||
    codes.some(
      (code) =>
        products.filter((p) => p.productCode === code && p.quantity === 1)
          .length !== 1,
    )
  )
    throw new McpError("INVALID_PRICE", 422);
  return money(parsed.data.data.price, "cent");
}
export async function officialRecommendation(
  client: Client,
  options: { timeout: number; signal: AbortSignal },
  tools: Awaited<ReturnType<typeof listTools>>,
  input: Input,
): Promise<Recommendation> {
  if (!input.store) throw new McpError("STORE_REQUIRED", 422);
  const context = storeContext(input.store);
  const candidates = menuCandidates(
    await callTool(client, options, tools, "query-meals", context),
  );
  const simple = candidates.filter(c => !/套餐|双人|多人|单人餐|随心配|开心乐园|件套/.test(c.name));
  const preferred = simple.filter(c => foodTags(c.name).some(tag => input.preferences.includes(tag as Input["preferences"][number])));
  const other = simple.filter(c => !preferred.includes(c));
  const prioritized = [...preferred.slice(0, 4), ...other, ...preferred.slice(4)];
  const foods: Food[] = [];
  const items = new Map<string, Record<string, unknown>>();
  // 菜单 currentPrice 是字符串且公开定义未明确单位，先用实际单品计价求金额，不猜单位。
  for (const candidate of prioritized.slice(0, 12)) {
    const detail = await callTool(client, options, tools, "query-meal-detail", {
      ...context,
      code: candidate.code,
    });
    const item = defaultItem(detail);
    if (!item) continue;
    if (item.productCode !== candidate.code)
      throw new McpError("INVALID_CATALOG", 422);
    const quote = await callTool(client, options, tools, "calculate-price", {
      ...context,
      items: [item],
    });
    const cents = verifiedQuote(quote, [candidate.code]);
    const tags = foodTags(candidate.name);
    foods.push({
      id: candidate.code,
      name: candidate.name,
      cents,
      tags,
      scenes: [],
    });
    items.set(candidate.code, item);
    if (foods.length >= 8) break;
  }
  const routes = recommend(foods, input);
  const verified = [];
  for (const route of routes) {
    const codes = route.foods.map((food) => String(food.id));
    const quote = await callTool(client, options, tools, "calculate-price", {
      ...context,
      items: codes.map((code) => items.get(code)),
    });
    const cents = verifiedQuote(quote, codes);
    if (cents <= Math.round(input.budget * 100))
      verified.push({ ...route, cents, priceVerified: true });
  }
  return {
    source: "live",
    title: persona(input).title,
    routes: verified,
    checkedAt: new Date().toISOString(),
    storeName: input.store.storeName,
    tool: "query-meals → query-meal-detail → calculate-price",
    note: `${input.store.storeName} · ${input.store.beType === 1 ? "到店自取" : "得来速"}；仅推荐已核验的当前可售单品，默认特制选项来自详情。最多比较 8 个单品，预算挑战不保证全菜单最优，未来时段需重新查询。`,
  };
}
