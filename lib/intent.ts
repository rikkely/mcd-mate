import type { Input } from "./contracts";

// 使用确定性线索解析，不把无法识别的表达冒充为模型理解。
export function parseIntent(text: string): Partial<Input> {
  const result: Partial<Input> = {};
  const budget = text.match(/(?:预算\s*)?(\d+(?:\.\d{1,2})?)\s*(?:元|块)/);
  if (budget) result.budget = Number(budget[1]);
  for (const scene of ["早餐", "午餐", "下午茶", "夜宵"] as const)
    if (text.includes(scene)) result.scene = scene;
  if (/省钱|划算|便宜/.test(text)) result.mood = "想省钱";
  else if (/尝鲜|新鲜/.test(text)) result.mood = "想尝鲜";
  else if (/累|疲惫/.test(text)) result.mood = "今天有点累";
  else if (/满足|饱/.test(text)) result.mood = "想吃得满足";
  const preferences = (["鸡肉", "汉堡", "饮品", "薯条"] as const).filter((p) =>
    text.includes(p),
  );
  if (preferences.length) result.preferences = preferences;
  return result;
}
