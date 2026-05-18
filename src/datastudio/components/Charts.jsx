import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { C, PALETTE } from "../../constants";

// 대용량 배열 안전 min/max (spread 대신 reduce 사용)
function safeMin(arr) { return arr.reduce((m, v) => v < m ? v : m, Infinity); }
function safeMax(arr) { return arr.reduce((m, v) => v > m ? v : m, -Infinity); }

export function getNumCols(ds) { return ds.colMeta.filter(c => c.type === "number"); }
export function getCatCols(ds) { return ds.colMeta.filter(c => c.type === "category"); }

export function NoData() {
  return <div style={{ padding: 32, textAlign: "center", color: C.txT, fontSize: 13 }}>데이터 없음</div>;
}

export function ChartCard({ title, subtitle, desc, children }) {
  return (
    <div style={{ border: `0.5px solid ${C.bd}`, borderRadius: "var(--border-radius-lg)", overflow: "hidden", marginBottom: 14 }}>
      <div style={{ padding: "10px 14px", background: C.bgS, borderBottom: `0.5px solid ${C.bd}` }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.tx }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: C.txS, marginTop: 2 }}>{subtitle}</div>}
        {desc && (
          <div style={{ fontSize: 11, color: C.infoTx, marginTop: 5, lineHeight: 1.5,
            padding: "5px 8px", background: C.info, borderRadius: 4 }}>
            💡 {desc}
          </div>
        )}
      </div>
      <div style={{ padding: "14px 14px 10px" }}>{children}</div>
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

export function BarFreq({ ds, col, topN = 12 }) {
  const freq = {};
  ds.rows.forEach(r => { const v = String(r[col] ?? ""); freq[v] = (freq[v] || 0) + 1; });
  const data = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, topN)
    .map(([name, value]) => ({ name, value }));
  if (!data.length) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={90} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Bar dataKey="value" name="빈도" radius={[0, 3, 3, 0]}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
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

export function GroupedBar({ ds, catCol, numCol, topN = 12 }) {
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
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={90} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Bar dataKey="avg" name={`${numCol} 평균`} radius={[0, 3, 3, 0]}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
