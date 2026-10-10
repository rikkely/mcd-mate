import { afterEach, describe, expect, it, vi } from "vitest";
import { inputSchema } from "../lib/contracts";

const fixture = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../lib/mcp", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/mcp")>();
  return {
    ...original,
    withMcp: async (run: (client: unknown, options: unknown) => unknown) =>
      run({}, {}),
    listTools: async () => [],
    callTool: fixture.call,
  };
});
import { liveRecommendation } from "../lib/live";
afterEach(() => {
  vi.unstubAllEnvs();
  fixture.call.mockReset();
});
const mapping = {
  queryArgs: { fixtureStore: "test" },
  catalogPath: [],
  idPath: ["code"],
  namePath: ["name"],
  pricePath: ["price"],
  priceUnit: "yuan",
  calculate: {
    baseArgs: { fixtureStore: "test" },
    productsPath: ["goods"],
    itemTemplate: {},
    idPath: ["code"],
    quantityPath: ["count"],
    totalPath: ["pay"],
    totalUnit: "yuan",
  },
};
const input = inputSchema.parse({
  mode: "live",
  budget: 20,
  scene: "午餐",
  mood: "想吃得满足",
  preferences: [],
});
describe("真实价格的验证边界（协议夹具，非线上数据）", () => {
  it("只使用菜单实际编码，过滤计价后超预算组合", async () => {
    vi.stubEnv("MCD_MCP_MAPPING", JSON.stringify(mapping));
    fixture.call.mockImplementation(
      async (_client, _options, _tools, name, args) => {
        if (name === "query-meals")
          return [
            { code: "fixture-a", name: "测试商品A", price: 8 },
            { code: "fixture-b", name: "测试商品B", price: 5 },
            { code: "fixture-c", name: "测试商品C", price: 3 },
          ];
        expect(args.fixtureStore).toBe("test");
        expect(
          args.goods.every(
            (g: { code: string; count: number }) =>
              g.code.startsWith("fixture-") && g.count === 1,
          ),
        ).toBe(true);
        return { pay: args.goods.length > 2 ? 25 : 12 };
      },
    );
    const result = await liveRecommendation(input);
    expect(result.routes.length).toBeGreaterThan(0);
    expect(
      result.routes.every((r) => r.cents === 1200 && r.priceVerified),
    ).toBe(true);
  });
  it("价格字段无效时不生成已验证结果", async () => {
    vi.stubEnv("MCD_MCP_MAPPING", JSON.stringify(mapping));
    fixture.call
      .mockResolvedValueOnce([{ code: "fixture", name: "测试", price: 3 }])
      .mockResolvedValue({ unknown: true });
    await expect(liveRecommendation(input)).rejects.toMatchObject({
      code: "INVALID_PRICE",
    });
  });
  it("无映射时要求明确门店，不猜测菜单参数", async () => {
    vi.stubEnv("MCD_MCP_MAPPING", "");
    await expect(liveRecommendation(input)).rejects.toMatchObject({
      code: "STORE_REQUIRED",
    });
    expect(fixture.call).not.toHaveBeenCalled();
  });
});
