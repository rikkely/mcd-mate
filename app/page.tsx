"use client";

import { useState } from "react";
import { ShareCard } from "../components/share-card";
import { McpPanel } from "../components/mcp-panel";
import { Input, Recommendation, Store, persona } from "../lib/contracts";
import { StorePicker } from "../components/store-picker";
import { parseIntent } from "../lib/intent";

const scenes = ["早餐", "午餐", "下午茶", "夜宵"] as const;
const moods = ["想吃得满足", "想省钱", "想尝鲜", "今天有点累"] as const;
const preferences = ["鸡肉", "汉堡", "饮品", "薯条"] as const;

export default function Home() {
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [connection, setConnection] = useState<
    "connected" | "unavailable" | "unknown"
  >("unknown");
  const [budget, setBudget] = useState("20");
  const [scene, setScene] = useState<Input["scene"]>("午餐");
  const [mood, setMood] = useState<Input["mood"]>("想吃得满足");
  const [selected, setSelected] = useState<Input["preferences"]>([]);
  const [prompt, setPrompt] = useState("");
  const [promptNote, setPromptNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Recommendation | null>(null);
  const [snapshot, setSnapshot] = useState<Input | null>(null);
  const [store, setStore] = useState<Store>();

  const applyPrompt = () => {
    const parsed = parseIntent(prompt);
    if (parsed.budget !== undefined) setBudget(String(parsed.budget));
    if (parsed.scene) setScene(parsed.scene);
    if (parsed.mood) setMood(parsed.mood);
    if (parsed.preferences) setSelected(parsed.preferences);
    setPromptNote(
      Object.keys(parsed).length
        ? "已提取可识别的线索，请在下方确认后开始寻宝。"
        : "暂未识别到明确线索，请在下方选择。支持「20 元、午餐、有点累、鸡肉」等表达。",
    );
  };
  const changeMode = (value: "demo" | "live") => {
    if (loading) return;
    setMode(value);
    setResult(null);
    setError("");
  };
  const submit = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    const input = {
      mode,
      budget: Number(budget),
      scene,
      mood,
      preferences: selected,
      ...(mode === "live" && store ? { store } : {}),
    };
    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        if (mode === "live" && data.connection) setConnection(data.connection);
        throw new Error(data.error || "推荐服务暂不可用");
      }
      setResult(data);
      setSnapshot(input);
      if (data.source === "live") setConnection("connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "推荐服务暂不可用");
    } finally {
      setLoading(false);
    }
  };
  const toggle = (value: Input["preferences"][number]) =>
    setSelected((old) =>
      old.includes(value) ? old.filter((x) => x !== value) : [...old, value],
    );
  const status =
    mode === "demo"
      ? "演示模式 · 模拟数据"
      : connection === "connected"
        ? "已连接官方 MCP"
        : connection === "unavailable"
          ? "MCP 暂不可用"
          : "官方 MCP · 尚未连接";

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="McD Mate 首页">
          <span className="brand-icon">✦</span>
          <span>
            McD Mate
            <br />
            <small>麦门宇宙</small>
          </span>
        </a>
        <div className="status" role="status">
          <span
            className={`dot ${mode === "live" && connection === "connected" ? "live" : ""}`}
          />
          {status}
        </div>
      </header>
      <section className="hero">
        <div>
          <span className="eyebrow">A LITTLE BUDGET. A LITTLE JOY.</span>
          <h1>
            今天，你想
            <br />
            <span className="accent">怎么玩转麦门？</span>
          </h1>
          <p className="lede">
            让预算遇见心情，给每一顿饭一点新鲜感。三条寻宝路线，找到今天刚刚好的快乐。
          </p>
          <div className="hero-tags">
            <span>✦ 心情搭配</span>
            <span>↗ 预算挑战</span>
            <span>▧ 快乐分享</span>
          </div>
        </div>
        <div className="board">
          <span className="sticker">TODAY’S MISSION</span>
          <div className="food-art" aria-hidden="true">
            <span className="food-burger">🍔</span>
            <span className="food-fries">🍟</span>
            <span className="food-spark">✦</span>
            <span className="orbit" />
          </div>
          <p>
            小预算，也有
            <br />
            大大的满足感。
          </p>
          <span className="board-footer">下一站 · 你的麦门宝藏</span>
        </div>
      </section>
      <section className="formcard" aria-label="寻宝条件">
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="form-heading">
            <div>
              <span className="eyebrow">01 / LEAVE YOUR CLUES</span>
              <h2>给我一点寻宝线索</h2>
            </div>
            <span className="tiny-sticker">今日预算 ¥{budget || "—"}</span>
          </div>
          <div className="mode">
            <button
              type="button"
              aria-pressed={mode === "demo"}
              className={mode === "demo" ? "modeActive" : ""}
              onClick={() => changeMode("demo")}
            >
              体验演示模式
            </button>
            <button
              type="button"
              aria-pressed={mode === "live"}
              className={mode === "live" ? "modeActive" : ""}
              onClick={() => changeMode("live")}
            >
              使用官方 MCP
            </button>
          </div>
          <label htmlFor="intent">用一句话说说今天的你</label>
          <div className="intent-input">
            <input
              id="intent"
              placeholder="20 元以内，今天有点累，午餐想吃鸡肉"
              value={prompt}
              maxLength={200}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button className="retry" type="button" onClick={applyPrompt}>
              提取线索 ↙
            </button>
          </div>
          <p className="hint" role="status">
            {promptNote || "支持常见预算、场景、心情关键词；下方选项由你确认。"}
          </p>
          <div className="fields">
            <div>
              <label htmlFor="budget">预算 / 元</label>
              <input
                id="budget"
                required
                type="number"
                min="1"
                max="500"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
              <div className="chips budget-chips">
                {[20, 30, 50].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`chip ${Number(budget) === n ? "active" : ""}`}
                    onClick={() => setBudget(String(n))}
                  >
                    ¥{n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label>用餐场景</label>
              <div className="chips">
                {scenes.map((x) => (
                  <button
                    type="button"
                    aria-pressed={scene === x}
                    className={`chip ${scene === x ? "active" : ""}`}
                    onClick={() => setScene(x)}
                    key={x}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label>今天的心情</label>
              <div className="chips">
                {moods.map((x) => (
                  <button
                    type="button"
                    aria-pressed={mood === x}
                    className={`chip ${mood === x ? "active" : ""}`}
                    onClick={() => setMood(x)}
                    key={x}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label>餐品偏好 / 可选</label>
              <div className="chips">
                {preferences.map((x) => (
                  <button
                    type="button"
                    aria-pressed={selected.includes(x)}
                    className={`chip ${selected.includes(x) ? "active" : ""}`}
                    onClick={() => toggle(x)}
                    key={x}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {mode === "live" && (
            <StorePicker
              selected={store}
              onSelect={setStore}
              onStatus={setConnection}
            />
          )}
          <button className="submit" type="submit" disabled={loading}>
            {loading ? "正在翻找麦门宝藏…" : "开始寻宝 →"}
          </button>
          <p className="hint">
            {mode === "demo"
              ? "当前使用独立模拟菜单和模拟金额，体验不需要 Token。"
              : "当前菜单与总价必须由 MCP 查询核验；如缺少配置，页面会说明原因。"}
          </p>
        </form>
        {mode === "live" && <McpPanel onStatus={setConnection} />}
      </section>
      {loading && (
        <section className="results" aria-live="polite">
          <div className="loading">
            <span className="spinner" />
            正在为你的心情寻找合适的组合…
          </div>
        </section>
      )}
      {error && (
        <section className="results" role="alert">
          <p className="error">{error}</p>
          <div className="actions">
            <button className="retry" onClick={() => void submit()}>
              重试
            </button>
            <button className="retry" onClick={() => changeMode("demo")}>
              切换演示模式
            </button>
          </div>
        </section>
      )}
      {result && snapshot && (
        <section className="results" aria-live="polite">
          <span className="eyebrow">02 / YOUR TREASURE ROUTES</span>
          <h2>你的快乐，分三路出发</h2>
          <p className={result.source === "live" ? "verified" : "demo"}>
            {result.note}
          </p>
          {!result.routes.length && (
            <div className="empty">
              <h3>这次预算内还没有找到合适组合</h3>
              <p>
                可以调整预算或场景再试一次。我们不会为了凑预算改写餐品价格。
              </p>
            </div>
          )}
          <div className="routegrid">
            {result.routes.map((route, index) => (
              <article className={`route route-${index}`} key={route.name}>
                <span className="route-number">0{index + 1}</span>
                <h3>{route.name}</h3>
                <p>{route.reason}</p>
                <ul>
                  {route.foods.map((food) => (
                    <li key={food.id}>{food.name}</li>
                  ))}
                </ul>
                <div className="price">
                  ¥{(route.cents / 100).toFixed(2)}
                  <small> / ¥{snapshot.budget.toFixed(2)}</small>
                </div>
                <progress
                  aria-label={`${route.name}预算利用率`}
                  max={snapshot.budget * 100}
                  value={route.cents}
                />
                <p className="hint">
                  预算利用{" "}
                  {Math.round((route.cents / (snapshot.budget * 100)) * 100)}% ·
                  剩余 ¥{(snapshot.budget - route.cents / 100).toFixed(2)}
                </p>
                <span className={route.priceVerified ? "verified" : "demo"}>
                  {route.priceVerified
                    ? "✓ calculate-price 已核验总价"
                    : "模拟金额 · 非官方价格"}
                </span>
              </article>
            ))}
          </div>
          <ShareCard result={result} copy={persona(snapshot).copy} />
        </section>
      )}
      <footer>
        McD Mate｜麦门宇宙 · 独立开发的开源参赛作品
        <br />
        非麦当劳官方产品 · 趣味称号仅供娱乐
      </footer>
    </main>
  );
}
