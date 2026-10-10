import { z } from "zod";
import { Food } from "./contracts";

const path = z
  .array(
    z
      .string()
      .min(1)
      .refine(
        (key) => !["__proto__", "constructor", "prototype"].includes(key),
      ),
  )
  .max(12);
export const mappingSchema = z.object({
  queryArgs: z.record(z.unknown()),
  catalogPath: path,
  idPath: path.min(1),
  namePath: path.min(1),
  pricePath: path.min(1),
  priceUnit: z.enum(["yuan", "cent"]),
  calculate: z
    .object({
      baseArgs: z.record(z.unknown()),
      productsPath: path.min(1),
      itemTemplate: z.record(z.unknown()),
      idPath: path.min(1),
      quantityPath: path.min(1),
      totalPath: path.min(1),
      totalUnit: z.enum(["yuan", "cent"]),
    })
    .optional(),
});
export type Mapping = z.infer<typeof mappingSchema>;
export function readPath(value: unknown, keys: string[]): unknown {
  return keys.reduce<unknown>(
    (v, k) =>
      v && typeof v === "object" && Object.prototype.hasOwnProperty.call(v, k)
        ? (v as Record<string, unknown>)[k]
        : undefined,
    value,
  );
}
export function setPath(
  value: Record<string, unknown>,
  keys: string[],
  item: unknown,
) {
  let cursor = value;
  keys.forEach((key, i) => {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new Error("INVALID_MAPPING");
    if (i === keys.length - 1) cursor[key] = item;
    else {
      if (
        !cursor[key] ||
        typeof cursor[key] !== "object" ||
        Array.isArray(cursor[key])
      )
        cursor[key] = {};
      cursor = cursor[key] as Record<string, unknown>;
    }
  });
}
export function money(value: unknown, unit: "yuan" | "cent") {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error("INVALID_PRICE");
  const cents = unit === "yuan" ? Math.round(value * 100) : value;
  if (!Number.isSafeInteger(cents)) throw new Error("INVALID_PRICE");
  return cents;
}
export function catalogFrom(value: unknown, mapping: Mapping): Food[] {
  const list = readPath(value, mapping.catalogPath);
  if (!Array.isArray(list)) throw new Error("INVALID_CATALOG");
  const rows = list.slice(0, 200).map((row) => {
    const id = readPath(row, mapping.idPath),
      name = readPath(row, mapping.namePath);
    if (
      (typeof id !== "string" && typeof id !== "number") ||
      typeof name !== "string" ||
      !name.trim()
    )
      throw new Error("INVALID_CATALOG");
    return {
      id,
      name,
      cents: money(readPath(row, mapping.pricePath), mapping.priceUnit),
      tags: [],
      scenes: [],
    };
  });
  // 同一商品可能出现在多个菜单分类中，按原始编码去重避免重复计入组合。
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}
