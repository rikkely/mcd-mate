import { describe, expect, it } from "vitest";
import { catalogFrom, mappingSchema, money, setPath } from "../lib/mapping";
import { inputSchema } from "../lib/contracts";
import { demoFoods, demoRecommendation, recommend } from "../lib/recommend";
import { parseIntent } from "../lib/intent";

describe("预算、映射与模拟数据", () => {
  it("不补造缺失的商品金额", () => {
    const mapping = mappingSchema.parse({
      queryArgs: {},
      catalogPath: [],
      idPath: ["code"],
      namePath: ["title"],
      pricePath: ["amount"],
      priceUnit: "yuan",
    });
    expect(() =>
      catalogFrom([{ code: "fixture", title: "fixture" }], mapping),
    ).toThrow();
    expect(
      catalogFrom(
        [{ code: "fixture", title: "fixture", amount: 7.25 }],
        mapping,
      )[0].cents,
    ).toBe(725);
  });
  it("拒绝字符串、负数和无穷价格", () => {
    for (const value of ["12", -1, Infinity, undefined])
      expect(() => money(value, "yuan")).toThrow();
  });
  it("路径写入不会污染对象原型", () => {
    expect(() => setPath({}, ["__proto__", "polluted"], true)).toThrow();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
  it("模拟价格固定，低预算产生空结果", () => {
    const input = inputSchema.parse({
      mode: "demo",
      budget: 1,
      scene: "午餐",
      mood: "想吃得满足",
      preferences: [],
    });
    expect(demoRecommendation(input).routes).toHaveLength(0);
    for (const budget of [10, 20, 30, 50]) {
      const routes = recommend(demoFoods, { ...input, budget });
      for (const route of routes) {
        expect(route.cents).toBe(route.foods.reduce((n, f) => n + f.cents, 0));
        expect(route.cents).toBeLessThanOrEqual(budget * 100);
        expect(route.priceVerified).toBe(false);
      }
    }
  });
  it("提取用户主动描述的线索", () => {
    expect(parseIntent("20 元以内，今天有点累，午餐喜欢鸡肉")).toEqual({
      budget: 20,
      scene: "午餐",
      mood: "今天有点累",
      preferences: ["鸡肉"],
    });
  });
  it("拒绝超两位小数预算", () => {
    expect(
      inputSchema.safeParse({
        mode: "demo",
        budget: 20.123,
        scene: "午餐",
        mood: "想吃得满足",
        preferences: [],
      }).success,
    ).toBe(false);
  });
});
