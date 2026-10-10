import { expect, test } from "@playwright/test";

test("完成模拟寻宝、保留来源并下载分享图片", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("怎么玩转麦门");
  await page.getByLabel("用一句话说说今天的你").fill("20 元以内，今天有点累，午餐想吃鸡肉");
  await page.getByRole("button", { name: "提取线索" }).click();
  await expect(page.getByLabel("预算 / 元")).toHaveValue("20");
  await expect(page.getByRole("button", { name: "今天有点累", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "开始寻宝" }).click();
  await expect(page.locator(".route")).toHaveCount(3);
  await expect(page.locator(".mobile-card")).toContainText("模拟数据");
  await expect(page.locator(".mobile-card")).toContainText("非官方价格");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载图片" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("mcd-mate-result.png");
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  const chunks = []; for await (const chunk of stream!) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(bytes.length).toBeGreaterThan(10000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("低预算显示空状态，无 Token 的真实模式不伪造成功", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("预算 / 元").fill("1");
  await page.getByRole("button", { name: "开始寻宝" }).click();
  await expect(page.getByRole("heading", { name: "这次预算内还没有找到合适组合" })).toBeVisible();
  await page.getByRole("button", { name: "使用官方 MCP" }).click();
  await page.getByRole("button", { name: "开始寻宝" }).click();
  await expect(page.locator("section[role='alert']")).toContainText("尚未配置服务端 Token");
  await expect(page.locator(".topbar")).toContainText("MCP 暂不可用");
  await expect(page.locator(".topbar")).not.toContainText("已连接官方 MCP");
  await page.getByRole("button", { name: "切换演示模式" }).click();
  await expect(page.locator(".topbar")).toContainText("演示模式");
});
