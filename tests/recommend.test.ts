import { describe, expect, it } from "vitest";
import { inputSchema, persona } from "../lib/contracts";
import { demoFoods, recommend } from "../lib/recommend";

describe("麦门寻宝局推荐规则", () => {
  it("拒绝零预算并保留枚举约束", () => {
    expect(
      inputSchema.safeParse({
        mode: "demo",
        budget: 0,
        scene: "午餐",
        mood: "想吃得满足",
        preferences: [],
      }).success,
    ).toBe(false);
  });
  it("演示路线不超过预算且生成趣味称号", () => {
    const input = inputSchema.parse({
      mode: "demo",
      budget: 20,
      scene: "午餐",
      mood: "想省钱",
      preferences: ["薯条"],
    });
    const routes = recommend(demoFoods, input);
    expect(routes.length).toBe(3);
    expect(routes.every((route) => route.cents <= 2000)).toBe(true);
    expect(persona(input).title).toBe("薯条守护者");
  });
});
