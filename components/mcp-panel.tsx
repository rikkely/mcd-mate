"use client";

import { useState } from "react";

type Tool = { name: string; description?: string; inputSchema: unknown };
export function McpPanel({
  onStatus,
}: {
  onStatus: (status: "connected" | "unavailable") => void;
}) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [name, setName] = useState("");
  const [args, setArgs] = useState("{}");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const discover = async () => {
    setBusy(true);
    setOutput("");
    try {
      const response = await fetch("/api/mcp");
      const data = await response.json();
      if (data.status !== "connected") throw new Error(data.error);
      setTools(data.tools);
      setName(data.tools[0]?.name || "");
      onStatus("connected");
      setOutput(
        data.tools.length
          ? "连接成功。下方展示本次 tools/list 返回的原始参数定义。"
          : "连接成功，但所需工具当前不可用。",
      );
    } catch (e) {
      onStatus("unavailable");
      setTools([]);
      setOutput(e instanceof Error ? e.message : "连接失败");
    } finally {
      setBusy(false);
    }
  };
  const call = async () => {
    setBusy(true);
    try {
      const argumentsValue = JSON.parse(args);
      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, arguments: argumentsValue }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 503 || response.status === 429)
          onStatus("unavailable");
        throw new Error(data.error);
      }
      onStatus("connected");
      setOutput(JSON.stringify(data, null, 2));
    } catch (e) {
      setOutput(e instanceof Error ? e.message : "调用失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="mcp-panel">
      <summary>连接与接口核对 · 开发者入口</summary>
      <p className="hint">
        先发现官方参数，再填写查询。仅开放门店、菜单、详情和计价，Token
        由服务端读取。
      </p>
      <button className="retry" disabled={busy} onClick={discover}>
        {busy ? "查询中…" : "检测连接 / 刷新工具"}
      </button>
      {tools.length > 0 && (
        <>
          <label htmlFor="tool">工具</label>
          <select
            id="tool"
            value={name}
            onChange={(e) => setName(e.target.value)}
          >
            {tools.map((tool) => (
              <option key={tool.name}>{tool.name}</option>
            ))}
          </select>
          <pre>
            {JSON.stringify(
              tools.find((t) => t.name === name)?.inputSchema,
              null,
              2,
            )}
          </pre>
          <label htmlFor="toolArgs">按上方 schema 填写 JSON 参数</label>
          <textarea
            id="toolArgs"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
          />
          <button className="retry" disabled={busy} onClick={call}>
            执行只读查询 / 计价
          </button>
        </>
      )}
      <pre aria-live="polite">{output}</pre>
    </details>
  );
}
