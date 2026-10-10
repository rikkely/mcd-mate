import { describe, expect, it } from "vitest";
import {
  defaultItem,
  menuCandidates,
  storeContext,
  verifiedQuote,
} from "../lib/official";
import { checkedContent } from "../lib/mcp";

describe("已核对的官方默认适配（测试数据）", () => {
  it("按分类编码映射菜单，不把字符串价格猜成元或分", () => {
    const candidates = menuCandidates({
      data: {
        categories: [{ meals: [{ code: "fixture-a" }, { code: "fixture-a" }] }],
        meals: {
          "fixture-a": { name: "测试单品", currentPrice: "12.50" },
          "not-sellable": { name: "未在分类出现" },
        },
      },
    });
    expect(candidates).toEqual([{ code: "fixture-a", name: "测试单品" }]);
  });
  it("到店自取不传 beCode，得来速使用对应业务编码", () => {
    expect(
      storeContext({
        storeCode: "fixture",
        storeName: "测试门店",
        beType: 1,
        beCode: "ignored",
      }),
    ).toEqual({ storeCode: "fixture", orderType: 1, beType: 1 });
    expect(
      storeContext({
        storeCode: "fixture",
        storeName: "测试门店",
        beType: 5,
        beCode: "drive",
      }).beCode,
    ).toBe("drive");
  });
  it("默认选中和未选中特制都按详情 key 传递", () => {
    const item = defaultItem({
      data: {
        code: "fixture-a",
        name: "测试单品",
        rounds: [],
        modification: {
          items: [
            {
              values: [
                {
                  code: "selected",
                  selectedQuantity: 1,
                  selectedKey: "yes",
                  unselectedKey: "no",
                },
                {
                  code: "unselected",
                  selectedQuantity: 0,
                  unselectedKey: "no",
                },
              ],
            },
          ],
        },
      },
    });
    expect(item?.modification?.values).toEqual([
      { code: "selected", key: "yes", quantity: 1 },
      { code: "unselected", key: "no", quantity: 0 },
    ]);
  });
  it("跳过需要套餐轮次的商品", () => {
    expect(
      defaultItem({
        data: { code: "fixture", name: "测试套餐", rounds: [{}] },
      }),
    ).toBeNull();
  });
  it("总价按整数分读取，同时核对商品编码与数量", () => {
    const result = {
      data: {
        price: 1350,
        productList: [
          { productCode: "fixture-a", quantity: 1, subtotal: 1000 },
          { productCode: "fixture-b", quantity: 1, subtotal: 300 },
        ],
      },
    };
    expect(verifiedQuote(result, ["fixture-a", "fixture-b"])).toBe(1350);
    expect(() => verifiedQuote(result, ["unknown", "fixture-b"])).toThrow();
    expect(() =>
      verifiedQuote({ data: { ...result.data, price: "13.50" } }, [
        "fixture-a",
        "fixture-b",
      ]),
    ).toThrow();
  });
  it("业务失败响应不能当作成功工具结果", () => {
    expect(() => checkedContent({ success: false, code: 500 })).toThrow();
    expect(() => checkedContent({ code: 401 })).toThrow();
    expect(
      checkedContent({ success: true, code: 200, data: [] }),
    ).toMatchObject({ code: 200 });
  });
});
