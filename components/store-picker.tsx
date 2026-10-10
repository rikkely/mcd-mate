"use client";

import { useState } from "react";
import type { Store } from "../lib/contracts";

type Candidate = {
  storeCode: string;
  storeName: string;
  address: string;
  beCode?: string;
  businessStatus?: boolean;
  reservationTimeOptions?: {
    date: string;
    reservationOptionText: string;
    today?: boolean;
  }[];
};
export function StorePicker({
  onSelect,
  onStatus,
  selected,
}: {
  onSelect: (store: Store | undefined) => void;
  onStatus: (status: "connected" | "unavailable") => void;
  selected?: Store;
}) {
  const [city, setCity] = useState("");
  const [keyword, setKeyword] = useState("");
  const [beType, setBeType] = useState<1 | 5>(1);
  const [searchType, setSearchType] = useState<1 | 2>(2);
  const [stores, setStores] = useState<Candidate[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reset = () => {
    setStores([]);
    onSelect(undefined);
    setError("");
  };
  const search = async () => {
    if (searchType === 2 && (!city.trim() || !keyword.trim())) {
      setError("请输入城市与附近地点。");
      return;
    }
    setBusy(true);
    reset();
    try {
      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "query-nearby-stores",
          arguments: {
            searchType,
            beType,
            ...(searchType === 2
              ? { city: city.trim(), keyword: keyword.trim() }
              : {}),
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 503) onStatus("unavailable");
        throw new Error(result.error);
      }
      onStatus("connected");
      if (!Array.isArray(result.data?.data))
        throw new Error("门店返回格式变化，暂时无法选择。");
      const valid = result.data.data.filter(
        (store: Candidate) =>
          typeof store.storeCode === "string" &&
          typeof store.storeName === "string" &&
          typeof store.address === "string",
      );
      setStores(valid);
      if (!valid.length)
        setError("暂未找到门店；请换一个附近地点，或改用位置搜索。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "门店查询失败，请重试。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="store-picker">
      <label>选择真实门店</label>
      <p className="hint">
        无需填写菜单映射。先按城市或收藏查询，选择门店，再开始寻宝。
      </p>
      <div className="fields">
        <div>
          <label htmlFor="pickup">取餐方式</label>
          <select
            id="pickup"
            value={beType}
            onChange={(e) => {
              reset();
              setBeType(Number(e.target.value) as 1 | 5);
            }}
          >
            <option value={1}>到店自取</option>
            <option value={5}>得来速</option>
          </select>
        </div>
        <div>
          <label htmlFor="store-search-type">查询方式</label>
          <select
            id="store-search-type"
            value={searchType}
            onChange={(e) => {
              reset();
              setSearchType(Number(e.target.value) as 1 | 2);
            }}
          >
            <option value={2}>按城市和附近地点</option>
            <option value={1}>我的收藏餐厅</option>
          </select>
        </div>
        {searchType === 2 && (
          <>
            <div>
              <label htmlFor="city">城市</label>
              <input
                id="city"
                value={city}
                placeholder="请输入城市"
                maxLength={60}
                onChange={(e) => {
                  reset();
                  setCity(e.target.value);
                }}
              />
            </div>
            <div>
              <label htmlFor="landmark">附近地点</label>
              <input
                id="landmark"
                value={keyword}
                placeholder="商圈、街道或地标"
                maxLength={100}
                onChange={(e) => {
                  reset();
                  setKeyword(e.target.value);
                }}
              />
            </div>
          </>
        )}
      </div>
      <button className="retry" type="button" disabled={busy} onClick={search}>
        {busy ? "正在查询真实门店…" : "查询门店"}
      </button>
      {error && (
        <p className="error" role="status">
          {error}
        </p>
      )}
      <div className="store-options">
        {stores.map((store) => (
          <div className="store-option" key={store.storeCode}>
            <button
              type="button"
              className={`chip ${selected?.storeCode === store.storeCode ? "active" : ""}`}
              disabled={
                store.businessStatus === false ||
                (beType === 5 && !store.beCode)
              }
              onClick={() =>
                onSelect({
                  storeCode: store.storeCode,
                  storeName: store.storeName,
                  beType,
                  ...(beType === 5 ? { beCode: store.beCode } : {}),
                })
              }
            >
              {store.storeName}
              {store.businessStatus === false ? " · 暂停营业" : ""}
            </button>
            <p className="hint">
              {store.address} · 编码 {store.storeCode}
              {beType === 5 ? ` · 业务编码 ${store.beCode || "暂缺"}` : ""}
            </p>
            {Boolean(store.reservationTimeOptions?.length) && (
              <details>
                <summary>门店预约时段</summary>
                {store.reservationTimeOptions!.map((option) => (
                  <p
                    className="hint"
                    key={`${option.date}-${option.reservationOptionText}`}
                  >
                    {option.date}
                    {option.today ? "（今天）" : ""}{" "}
                    {option.reservationOptionText}
                  </p>
                ))}
              </details>
            )}
          </div>
        ))}
      </div>
      {selected && (
        <p className="verified">
          已选择：{selected.storeName} ·{" "}
          {selected.beType === 1 ? "到店自取" : "得来速"}
        </p>
      )}
    </section>
  );
}
