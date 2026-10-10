import { Food, Input, Recommendation, Route, persona } from "./contracts";

// 模拟餐品使用虚构名称和固定金额，避免被误认成官方实时菜单。
export const demoFoods: Food[] = [
  {
    id: "demo-1",
    name: "金黄鸡肉堡 · 模拟",
    cents: 1200,
    tags: ["鸡肉", "汉堡"],
    scenes: ["午餐", "夜宵"],
  },
  {
    id: "demo-2",
    name: "小份快乐薯条 · 模拟",
    cents: 500,
    tags: ["薯条"],
    scenes: ["午餐", "下午茶", "夜宵"],
  },
  {
    id: "demo-3",
    name: "清爽气泡饮 · 模拟",
    cents: 300,
    tags: ["饮品"],
    scenes: ["早餐", "午餐", "下午茶", "夜宵"],
  },
  {
    id: "demo-4",
    name: "芝士双层堡 · 模拟",
    cents: 1500,
    tags: ["汉堡"],
    scenes: ["午餐", "夜宵"],
  },
  {
    id: "demo-5",
    name: "晨光鸡蛋堡 · 模拟",
    cents: 800,
    tags: ["汉堡"],
    scenes: ["早餐"],
  },
  {
    id: "demo-6",
    name: "温暖咖啡 · 模拟",
    cents: 600,
    tags: ["饮品"],
    scenes: ["早餐", "下午茶"],
  },
  {
    id: "demo-7",
    name: "轻巧鸡肉卷 · 模拟",
    cents: 900,
    tags: ["鸡肉"],
    scenes: ["午餐", "下午茶", "夜宵"],
  },
  {
    id: "demo-8",
    name: "香脆鸡块 · 模拟",
    cents: 700,
    tags: ["鸡肉"],
    scenes: ["午餐", "下午茶", "夜宵"],
  },
];
export function combinations(foods: Food[], input: Input): Food[][] {
  const limit = Math.round(input.budget * 100);
  const pool = foods
    .filter(
      (f) =>
        (!f.scenes.length || f.scenes.includes(input.scene)) &&
        f.cents <= limit,
    )
    .slice(0, 40);
  const result: Food[][] = [];
  // 每种餐品最多一份、组合最多三件，防止预算挑战变成无意义的重复购买。
  for (let a = 0; a < pool.length; a++) {
    result.push([pool[a]]);
    for (let b = a + 1; b < pool.length; b++) {
      if (pool[a].cents + pool[b].cents <= limit)
        result.push([pool[a], pool[b]]);
      for (let c = b + 1; c < pool.length; c++)
        if (pool[a].cents + pool[b].cents + pool[c].cents <= limit)
          result.push([pool[a], pool[b], pool[c]]);
    }
  }
  return result;
}
export function recommend(foods: Food[], input: Input): Route[] {
  const candidates = combinations(foods, input);
  const sum = (list: Food[]) => list.reduce((total, f) => total + f.cents, 0);
  const preference = (list: Food[]) =>
    list.filter((f) =>
      f.tags.some((t) =>
        input.preferences.includes(t as Input["preferences"][number]),
      ),
    ).length;
  const score = (list: Food[]) =>
    preference(list) * 100 +
    (list.some((f) => f.tags.includes("汉堡")) ? 40 : 0) +
    new Set(list.flatMap((f) => f.tags)).size * 10 +
    (input.mood === "想省钱" ? -sum(list) / 100 : list.length * 5);
  const used = new Set<string>();
  const key = (list: Food[]) =>
    list
      .map((f) => f.id)
      .sort()
      .join("|");
  return [
    {
      name: "预算挑战",
      reason: "在已知候选中尽量用好预算，每种餐品只选一份。",
      sort: (a: Food[], b: Food[]) => sum(b) - sum(a) || score(b) - score(a),
    },
    {
      name: "稳妥之选",
      reason: `${input.scene}时刻，照顾「${input.mood}」和你主动选择的偏好。`,
      sort: (a: Food[], b: Food[]) => score(b) - score(a),
    },
    {
      name: "新鲜尝试",
      reason: "换一种组合，探索不同的搭配。",
      sort: (a: Food[], b: Food[]) =>
        new Set(b.flatMap((f) => f.tags)).size -
          new Set(a.flatMap((f) => f.tags)).size ||
        preference(a) - preference(b),
    },
  ]
    .flatMap((def) => {
      const choice = [...candidates]
        .sort(def.sort)
        .find((list) => !used.has(key(list)));
      if (!choice) return [];
      used.add(key(choice));
      return [
        {
          name: def.name,
          reason: def.reason,
          foods: choice,
          cents: sum(choice),
          priceVerified: false,
        },
      ];
    })
    .sort(
      (a, b) =>
        ["稳妥之选", "新鲜尝试", "预算挑战"].indexOf(a.name) -
        ["稳妥之选", "新鲜尝试", "预算挑战"].indexOf(b.name),
    );
}
export function demoRecommendation(input: Input): Recommendation {
  return {
    source: "demo",
    title: persona(input).title,
    routes: recommend(demoFoods, input),
    checkedAt: new Date().toISOString(),
    note: "模拟餐品与模拟金额，仅供体验；并非官方菜单、优惠或实时价格。",
  };
}
