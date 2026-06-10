import { useRef } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { C, PALETTE } from "../constants";

// ── 차트 PNG 다운로드 — 컨테이너 내부 첫 SVG를 2배 해상도 PNG로 저장 ──────────
export function downloadChartPNG(container, filename = "chart") {
  const svg = container?.querySelector("svg");
  if (!svg) { alert("다운로드할 차트를 찾을 수 없습니다."); return; }
  const rect = svg.getBoundingClientRect();
  const w = Math.max(rect.width, 320), h = Math.max(rect.height, 200);
  const clone = svg.cloneNode(true);
  clone.setAttribute("width", w);
  clone.setAttribute("height", h);
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w * 2; canvas.height = h * 2;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const a = document.createElement("a");
    a.download = `${String(filename).replace(/[\\/:*?"<>|]/g, "_")}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
}

// 차트 영역에 PNG 저장 버튼을 붙이는 래퍼 (ChartCard 미사용 차트용)
export function DownloadableChart({ filename = "chart", children }) {
  const ref = useRef(null);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => downloadChartPNG(ref.current, filename)}
        title="PNG로 저장"
        style={{ position: "absolute", top: 0, right: 0, zIndex: 2, fontSize: 10,
          padding: "2px 7px", borderRadius: 5, cursor: "pointer",
          background: C.bg, border: `0.5px solid ${C.bd}`, color: C.txS }}>
        ⬇ PNG
      </button>
      {children}
    </div>
  );
}

// 대용량 배열 안전 min/max (spread 대신 reduce 사용)
function safeMin(arr) { return arr.reduce((m, v) => v < m ? v : m, Infinity); }
function safeMax(arr) { return arr.reduce((m, v) => v > m ? v : m, -Infinity); }

export function getNumCols(ds) { return ds.colMeta.filter(c => c.type === "number"); }
export function getCatCols(ds) { return ds.colMeta.filter(c => c.type === "category"); }

export function NoData() {
  return <div style={{ padding: 32, textAlign: "center", color: C.txT, fontSize: 13 }}>데이터 없음</div>;
}

export function ChartCard({ title, subtitle, desc, children }) {
  const bodyRef = useRef(null);
  return (
    <div style={{ border: `0.5px solid ${C.bd}`, borderRadius: "var(--border-radius-lg)", overflow: "hidden", marginBottom: 14 }}>
      <div style={{ padding: "10px 14px", background: C.bgS, borderBottom: `0.5px solid ${C.bd}`,
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.tx }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: C.txS, marginTop: 2 }}>{subtitle}</div>}
          {desc && (
            <div style={{ fontSize: 11, color: C.infoTx, marginTop: 5, lineHeight: 1.5,
              padding: "5px 8px", background: C.info, borderRadius: 4 }}>
              💡 {desc}
            </div>
          )}
        </div>
        <button type="button" onClick={() => downloadChartPNG(bodyRef.current, title)}
          title="차트를 PNG 이미지로 저장"
          style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, cursor: "pointer",
            background: C.bg, border: `0.5px solid ${C.bd}`, color: C.txS,
            whiteSpace: "nowrap", flexShrink: 0 }}>
          ⬇ PNG
        </button>
      </div>
      <div ref={bodyRef} style={{ padding: "14px 14px 10px" }}>{children}</div>
    </div>
  );
}

export function HistChart({ ds, col }) {
  const vals = ds.rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
  if (!vals.length) return <NoData />;
  const mn = safeMin(vals), mx = safeMax(vals), w = (mx - mn) / 20 || 1;
  const counts = Array.from({ length: 20 }, (_, i) => ({ x: +(mn + i * w).toFixed(2), count: 0 }));
  vals.forEach(v => { counts[Math.min(Math.floor((v - mn) / w), 19)].count++; });
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={counts} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
        <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.txS }}
          label={{ value: col, position: "insideBottom", offset: -14, fontSize: 10, fill: C.txS }} />
        <YAxis tick={{ fontSize: 10, fill: C.txS }} />
        <Tooltip formatter={v => [v, "빈도"]} contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Bar dataKey="count" fill="#378ADD" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BarFreq({ ds, col, topN = 12, barDir = "h", palette }) {
  const colors = palette || PALETTE;
  const freq = {};
  ds.rows.forEach(r => { const v = String(r[col] ?? ""); freq[v] = (freq[v] || 0) + 1; });
  const data = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, topN)
    .map(([name, value]) => ({ name, value }));
  if (!data.length) return <NoData />;
  if (barDir !== "h") {
    const rotateX = data.length > 7;
    return (
      <ResponsiveContainer width="100%" height={Math.max(220, 30)}>
        <BarChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: rotateX ? 72 : 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
          <XAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: C.txS, ...(rotateX ? { angle: -40, textAnchor: "end" } : {}) }} height={rotateX ? 78 : 32} interval={0} />
          <YAxis type="number" tick={{ fontSize: 10, fill: C.txS }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
          <Bar dataKey="value" name="빈도" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={90} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Bar dataKey="value" name="빈도" radius={[0, 3, 3, 0]}>
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PieFreq({ ds, col }) {
  const freq = {};
  ds.rows.forEach(r => { const v = String(r[col] ?? ""); freq[v] = (freq[v] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 8);
  const other = sorted.slice(8).reduce((a, [, c]) => a + c, 0);
  const data = [...top.map(([n, v]) => ({ name: n, value: v })), ...(other > 0 ? [{ name: "기타", value: other }] : [])];
  if (!data.length) return <NoData />;
  const R = Math.PI / 180;
  const lbl = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.04) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    return (
      <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
        fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={100} dataKey="value" labelLine={false} label={lbl}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip formatter={(v, n) => [v.toLocaleString(), n]}
          contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CorrHeatmap({ ds }) {
  const numCols = getNumCols(ds).map(c => c.name).slice(0, 10);
  if (numCols.length < 2) {
    return <div style={{ padding: 24, textAlign: "center", color: C.txT, fontSize: 13 }}>숫자형 컬럼 2개 이상 필요</div>;
  }
  const vals = {};
  numCols.forEach(c => { vals[c] = ds.rows.map(r => parseFloat(r[c])).filter(v => !isNaN(v)); });
  const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const corr = (a, b) => {
    const ma = mean(a), mb = mean(b);
    const num = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0);
    const den = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0) * b.reduce((s, v) => s + (v - mb) ** 2, 0));
    return den ? +(num / den).toFixed(2) : 0;
  };
  const matrix = numCols.map(c1 => numCols.map(c2 => {
    const ml = Math.min(vals[c1].length, vals[c2].length);
    return corr(vals[c1].slice(0, ml), vals[c2].slice(0, ml));
  }));
  const cs = Math.min(60, Math.floor(540 / numCols.length));
  const clr = v => v >= 0
    ? `rgba(24,95,165,${0.1 + Math.abs(v) * 0.85})`
    : `rgba(216,90,48,${0.1 + Math.abs(v) * 0.85})`;
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "inline-block" }}>
        <div style={{ display: "flex", marginLeft: cs + 4 }}>
          {numCols.map(c => (
            <div key={c} style={{ width: cs, fontSize: 9, color: C.txS, textAlign: "center",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              transform: "rotate(-30deg)", transformOrigin: "bottom left", marginBottom: 4, height: 38 }}>
              {c}
            </div>
          ))}
        </div>
        {matrix.map((row, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: 2 }}>
            <div style={{ width: cs, fontSize: 9, color: C.txS, textAlign: "right", paddingRight: 4,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>
              {numCols[i]}
            </div>
            {row.map((v, j) => (
              <div key={j} title={`${numCols[i]}×${numCols[j]}: ${v}`}
                style={{ width: cs, height: cs, background: clr(v),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: cs > 44 ? 10 : 8, fontWeight: 500,
                  color: Math.abs(v) > 0.5 ? "#fff" : C.tx,
                  borderRadius: 2, margin: 1, cursor: "default", flexShrink: 0 }}>
                {v}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MissingChart({ ds }) {
  const data = ds.colMeta
    .filter(c => c.stats.nullCount > 0)
    .map(c => ({ name: c.name, pct: +((c.stats.nullCount / ds.rowCount) * 100).toFixed(1), missing: c.stats.nullCount }))
    .sort((a, b) => b.pct - a.pct);
  if (!data.length) {
    return <div style={{ padding: 24, textAlign: "center", color: "#1D9E75", fontSize: 13 }}>결측값 없음 ✓</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
        <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: C.txS }} domain={[0, 100]} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={100} />
        <Tooltip
          formatter={(v, n, p) => [`${p.payload?.missing?.toLocaleString()}개 (${p.payload?.pct}%)`, ""]}
          contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Bar dataKey="pct" radius={[0, 3, 3, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.pct > 30 ? "#E24B4A" : d.pct > 10 ? "#EF9F27" : "#F09595"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GroupedBar({ ds, catCol, numCol, topN = 12, barDir = "h", palette }) {
  const colors = palette || PALETTE;
  const agg = {};
  ds.rows.forEach(r => {
    const k = String(r[catCol] ?? "");
    const v = parseFloat(r[numCol]);
    if (!isNaN(v)) {
      if (!agg[k]) agg[k] = { sum: 0, count: 0 };
      agg[k].sum += v; agg[k].count++;
    }
  });
  const data = Object.entries(agg)
    .map(([name, { sum, count }]) => ({ name, avg: +(sum / count).toFixed(3) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, topN);
  if (!data.length) return <NoData />;
  if (barDir !== "h") {
    const rotateX = data.length > 7;
    return (
      <ResponsiveContainer width="100%" height={Math.max(220, 30)}>
        <BarChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: rotateX ? 72 : 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
          <XAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: C.txS, ...(rotateX ? { angle: -40, textAnchor: "end" } : {}) }} height={rotateX ? 78 : 32} interval={0} />
          <YAxis type="number" tick={{ fontSize: 10, fill: C.txS }} tickFormatter={v => v.toLocaleString()} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
          <Bar dataKey="avg" name={`${numCol} 평균`} radius={[3, 3, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={90} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Bar dataKey="avg" name={`${numCol} 평균`} radius={[0, 3, 3, 0]}>
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 범용 XY 차트 — [{name, value}] 데이터를 막대/선/파이로 ─────────────────────
export function XYChart({ data, type = "bar", barDir = "v", palette, valueName = "값" }) {
  const colors = palette || PALETTE;
  if (!data?.length) return <NoData />;

  if (type === "pie") {
    const top = data.slice(0, 10);
    const other = data.slice(10).reduce((a, d) => a + d.value, 0);
    const pd = [...top, ...(other > 0 ? [{ name: "기타", value: other }] : [])];
    const R = Math.PI / 180;
    const lbl = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
      if (percent < 0.04) return null;
      const r = innerRadius + (outerRadius - innerRadius) * 0.55;
      return (
        <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
          fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11}>
          {`${(percent * 100).toFixed(0)}%`}
        </text>
      );
    };
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={pd} cx="50%" cy="50%" outerRadius={100} dataKey="value" labelLine={false} label={lbl}>
            {pd.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [v.toLocaleString(), n]}
            contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    const rotateX = data.length > 7;
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: rotateX ? 60 : 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.txS, ...(rotateX ? { angle: -40, textAnchor: "end" } : {}) }}
            height={rotateX ? 66 : 28} interval={0} />
          <YAxis tick={{ fontSize: 10, fill: C.txS }} tickFormatter={v => v.toLocaleString()} />
          <Tooltip formatter={v => [v.toLocaleString(), valueName]}
            contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
          <Line type="monotone" dataKey="value" name={valueName} stroke={colors[0]} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // 막대 — 가로
  if (barDir === "h") {
    return (
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} tickFormatter={v => v.toLocaleString()} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={96} />
          <Tooltip formatter={v => [v.toLocaleString(), valueName]}
            contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
          <Bar dataKey="value" name={valueName} radius={[0, 3, 3, 0]}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // 막대 — 세로 (기본): 범주가 X축, 값이 Y축
  const rotateX = data.length > 7;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: rotateX ? 64 : 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
        <XAxis dataKey="name" type="category"
          tick={{ fontSize: 10, fill: C.txS, ...(rotateX ? { angle: -40, textAnchor: "end" } : {}) }}
          height={rotateX ? 70 : 28} interval={0} />
        <YAxis type="number" tick={{ fontSize: 10, fill: C.txS }} tickFormatter={v => v.toLocaleString()} />
        <Tooltip formatter={v => [v.toLocaleString(), valueName]}
          contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Bar dataKey="value" name={valueName} radius={[3, 3, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── AI 추천 차트 스펙 렌더링 ───────────────────────────────────────────────────
// spec: { type: "bar"|"line"|"pie"|"hist"|"scatter", x, y, agg, title, reason }
export function specValid(ds, spec) {
  if (!spec || !spec.type) return false;
  const has = c => ds.columns.includes(c);
  if (spec.type === "hist")    return has(spec.y) || has(spec.x);
  if (spec.type === "scatter") return has(spec.x) && has(spec.y);
  return has(spec.x);
}

export function SpecChart({ ds, spec, palette }) {
  const colors = palette || PALETTE;
  const has = c => ds.columns.includes(c);

  if (spec.type === "hist") {
    return <HistChart ds={ds} col={has(spec.y) ? spec.y : spec.x} />;
  }

  if (spec.type === "scatter") {
    const data = ds.rows
      .map(r => ({ x: parseFloat(r[spec.x]), y: parseFloat(r[spec.y]) }))
      .filter(p => !isNaN(p.x) && !isNaN(p.y)).slice(0, 1000);
    if (!data.length) return <NoData />;
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
          <XAxis type="number" dataKey="x" name={spec.x} tick={{ fontSize: 10, fill: C.txS }}
            label={{ value: spec.x, position: "insideBottom", offset: -14, fontSize: 10, fill: C.txS }} />
          <YAxis type="number" dataKey="y" name={spec.y} tick={{ fontSize: 10, fill: C.txS }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
          <Scatter data={data} fill={colors[1] || colors[0]} fillOpacity={0.5} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  // bar / line / pie — x 기준 집계
  const agg = spec.agg || (has(spec.y) ? "mean" : "count");
  const groups = {};
  ds.rows.forEach(r => {
    const k = String(r[spec.x] ?? "");
    if (!groups[k]) groups[k] = { sum: 0, cnt: 0, n: 0 };
    groups[k].n++;
    const v = has(spec.y) ? parseFloat(r[spec.y]) : NaN;
    if (!isNaN(v)) { groups[k].sum += v; groups[k].cnt++; }
  });
  let data = Object.entries(groups).map(([name, g]) => ({
    name,
    value: agg === "count" ? g.n
      : agg === "sum" ? +g.sum.toFixed(3)
      : g.cnt ? +(g.sum / g.cnt).toFixed(3) : 0,
  }));
  if (spec.type === "line") data.sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true }));
  else data.sort((a, b) => b.value - a.value);
  data = data.slice(0, spec.type === "pie" ? 10 : 15);
  const aggLabel = { count: "건수", sum: "합계", mean: "평균" }[agg] || agg;
  return (
    <XYChart data={data} type={spec.type} palette={colors}
      valueName={has(spec.y) ? `${spec.y} ${aggLabel}` : aggLabel} />
  );
}
