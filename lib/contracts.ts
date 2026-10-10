import { z } from "zod";

export const storeSchema = z
  .object({
    storeCode: z.string().min(1).max(80),
    storeName: z.string().min(1).max(160),
    beType: z.union([z.literal(1), z.literal(5)]),
    beCode: z.string().min(1).max(80).optional(),
  })
  .refine(
    (store) => store.beType !== 5 || Boolean(store.beCode),
    "得来速需要门店返回的业务编码",
  );
export type Store = z.infer<typeof storeSchema>;

export const inputSchema = z.object({
  mode: z.enum(["demo", "live"]),
  budget: z.coerce
    .number()
    .finite()
    .min(1)
    .max(500)
    .refine(
      (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001,
      "最多两位小数",
    ),
  scene: z.enum(["早餐", "午餐", "下午茶", "夜宵"]),
  mood: z.enum(["想吃得满足", "想省钱", "想尝鲜", "今天有点累"]),
  preferences: z.array(z.enum(["鸡肉", "汉堡", "饮品", "薯条"])).max(4),
  store: storeSchema.optional(),
});
export type Input = z.infer<typeof inputSchema>;
export type Food = {
  id: string | number;
  name: string;
  cents: number;
  tags: string[];
  scenes: string[];
};
export type Route = {
  name: string;
  reason: string;
  foods: Food[];
  cents: number;
  priceVerified: boolean;
};
export type Recommendation = {
  source: "demo" | "live";
  title: string;
  routes: Route[];
  note: string;
  checkedAt: string;
  tool?: string;
  storeName?: string;
};
export function persona(input: Input) {
  if (input.preferences.includes("薯条"))
    return { title: "薯条守护者", copy: "平凡的一天，也值得一点金黄的快乐。" };
  if (input.mood === "想省钱")
    return { title: "预算掌控大师", copy: "快乐有预算，生活有主张。" };
  if (input.scene === "夜宵")
    return {
      title: "深夜能量补给员",
      copy: "今天辛苦了，给自己一点温柔补给。",
    };
  if (input.mood === "想尝鲜")
    return { title: "麦门探索家", copy: "小小的尝试，也是今天的新发现。" };
  return { title: "快乐补给官", copy: "把日子过好，从认真吃一顿开始。" };
}
