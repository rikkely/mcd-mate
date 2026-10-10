"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { Recommendation } from "../lib/contracts";

export function ShareCard({
  result,
  copy,
}: {
  result: Recommendation;
  copy: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const route = result.routes[0];
  const image = async () => {
    if (!cardRef.current) throw new Error("分享卡尚未准备好");
    return toPng(cardRef.current, {
      pixelRatio: 2,
      backgroundColor: "#fff9ed",
      skipFonts: true,
    });
  };
  const download = async () => {
    setBusy(true);
    try {
      const link = document.createElement("a");
      link.download = "mcd-mate-result.png";
      link.href = await image();
      link.click();
      setNotice("分享卡已生成，保留了数据来源标记。");
    } catch {
      setNotice("图片导出失败，请重试或复制分享文案。");
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    setBusy(true);
    const text = `McD Mate｜${result.title}\n${route?.foods.map((f) => f.name).join(" + ") || "暂无符合预算的组合"}\n${route ? `¥${(route.cents / 100).toFixed(2)} · ${route.priceVerified ? "MCP 已计价" : "模拟金额"}` : ""}\n${copy}\n${result.note}\n趣味测试，非麦当劳官方产品。`;
    try {
      if (navigator.share) {
        const blob = await (await fetch(await image())).blob();
        const file = new File([blob], "mcd-mate.png", { type: "image/png" });
        await navigator.share(
          navigator.canShare?.({ files: [file] })
            ? { files: [file], title: "麦门寻宝局", text }
            : { title: "麦门寻宝局", text },
        );
      } else {
        await navigator.clipboard.writeText(text);
        setNotice("分享文案已复制。");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setNotice("系统分享不可用，可下载图片后手动分享。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="share-section">
      <div>
        <span className="eyebrow">TAKE YOUR TREASURE</span>
        <h2>把今天的小快乐带走</h2>
        <p className="lede">这张卡，属于今天的你。</p>
        <div className="actions">
          <button className="retry" onClick={download} disabled={busy}>
            下载图片 ↓
          </button>
          <button className="retry" onClick={share} disabled={busy}>
            分享 / 复制文案 ↗
          </button>
        </div>
        <p role="status" className="hint">
          {notice}
        </p>
      </div>
      <div ref={cardRef} className="mobile-card">
        <div className="card-top">
          McD Mate · 麦门寻宝局
          <span>{result.source === "demo" ? "模拟数据" : "官方 MCP 查询"}</span>
        </div>
        <div className="card-orbit">✦</div>
        <p className="eyebrow">你的麦门人格卡 · 趣味测试</p>
        <h3>{result.title}</h3>
        <p>{copy}</p>
        {route && (
          <div className="card-meal">
            <strong>{route.name}</strong>
            {route.foods.map((f) => (
              <p key={f.id}>{f.name}</p>
            ))}
            <strong className="price">¥{(route.cents / 100).toFixed(2)}</strong>
            <span>
              {route.priceVerified
                ? "calculate-price 已核验总价"
                : "模拟金额 · 非官方价格"}
            </span>
            <p>{route.reason}</p>
          </div>
        )}
        <p className="card-disclaimer">{result.note}</p>
        <small>
          独立开发作品 · 非麦当劳官方产品
          <br />
          称号仅供娱乐，非官方人格评估
        </small>
      </div>
    </section>
  );
}
