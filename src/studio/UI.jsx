import { useState } from "react";
import { C, TYPE_CLR } from "../constants";

export function TypeBadge({ type }) {
  const clr = TYPE_CLR[type] || TYPE_CLR.text;
  return (
    <span style={{ fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20,
      background:clr.bg, color:clr.tx, fontFamily:"var(--font-mono)",
      border:"1px solid "+clr.tx+"44" }}>
      {type}
    </span>
  );
}

export function StatCard({ label, value }) {
  return (
    <div style={{
      background:C.bgS, borderRadius:"var(--border-radius-md)",
      padding:"12px 16px", minWidth:80,
      border:"1px solid "+C.bdS,
      boxShadow:"var(--shadow-xs)",
    }}>
      <div style={{ fontSize:11, color:C.txS, marginBottom:5, fontWeight:500,
        textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:600, color:C.tx, fontFamily:"var(--font-mono)" }}>{value}</div>
    </div>
  );
}

export function Btn({ onClick, children, variant="default", disabled=false, small=false, full=false }) {
  const S = {
    default: { bg:C.bg,      color:C.tx,           border:"1px solid "+C.bdS },
    primary: { bg:"var(--color-brand)", color:"#fff", border:"none" },
    success: { bg:"#30A46C", color:"#fff",          border:"none" },
    danger:  { bg:"transparent", color:"#CC3D3D",   border:"1px solid #CC3D3D" },
    warn:    { bg:"#B07816", color:"#fff",          border:"none" },
  };
  const s = S[variant] || S.default;
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      fontSize: small ? 11 : 13,
      padding: small ? "4px 10px" : "8px 18px",
      cursor: disabled ? "not-allowed" : "pointer",
      borderRadius: "var(--border-radius-md)",
      background: s.bg, color: s.color, border: s.border,
      fontWeight: 500, opacity: disabled ? 0.45 : 1,
      whiteSpace: "nowrap", width: full ? "100%" : "auto",
      boxShadow: (!disabled && variant !== "default") ? "var(--shadow-sm)" : "none",
      transition:"all 0.15s",
      fontFamily: "var(--font-sans)",
    }}>
      {children}
    </button>
  );
}

export function Section({ title, desc, children, defaultOpen=true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      border: "1px solid " + C.bdS,
      borderRadius:"var(--border-radius-lg)",
      overflow:"hidden", marginBottom:14,
      boxShadow:"var(--shadow-sm)",
    }}>
      <div onClick={() => setOpen(p => !p)} style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"13px 16px", cursor:"pointer",
        background: open ? "linear-gradient(90deg,#E8F1E7 0%,#F2F7F1 100%)" : C.bgS,
        borderBottom: open ? "1px solid " + C.bdS : "none",
        transition:"background 0.15s",
      }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:C.tx, fontFamily:"var(--font-sans)" }}>{title}</div>
          {desc && <div style={{ fontSize:11, color:C.txS, marginTop:2 }}>{desc}</div>}
        </div>
        <span style={{
          fontSize:11, fontWeight:500,
          color: open ? C.infoTx : C.txS,
          background: open ? C.info : C.bgT,
          padding:"2px 8px", borderRadius:10,
          border: "1px solid " + (open ? C.infoTx+"55" : C.bd),
        }}>{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </div>
      {open && <div style={{ padding:16 }}>{children}</div>}
    </div>
  );
}

export function DataTable({ rows, columns, maxH }) {
  const [page, setPage] = useState(0);
  const PG = 10;
  const total = Math.ceil(rows.length / PG);
  return (
    <div>
      <div style={{ overflowX:"auto", overflowY:maxH?"auto":"visible", maxHeight:maxH,
        borderRadius:"var(--border-radius-md)", border:`1px solid ${C.bd}` }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:C.bgS }}>
              <th style={{ padding:"8px 10px", textAlign:"left", color:C.txS, fontWeight:600, fontSize:11,
                borderBottom:`1px solid ${C.bd}`, whiteSpace:"nowrap",
                textTransform:"uppercase", letterSpacing:"0.05em" }}>#</th>
              {columns.map(col => (
                <th key={col} style={{ padding:"8px 10px", textAlign:"left", color:C.txS, fontWeight:600,
                  fontSize:11, borderBottom:`1px solid ${C.bd}`, whiteSpace:"nowrap",
                  textTransform:"uppercase", letterSpacing:"0.05em" }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(page*PG, (page+1)*PG).map((row, i) => (
              <tr key={i} style={{ borderBottom:`1px solid ${C.bd}`,
                background: i%2===0 ? C.bg : C.bgS,
                transition:"background 0.1s" }}
                onMouseEnter={e => e.currentTarget.style.background="var(--color-background-info)"}
                onMouseLeave={e => e.currentTarget.style.background=i%2===0?C.bg:C.bgS}
              >
                <td style={{ padding:"6px 10px", color:C.txT, fontSize:12, fontFamily:"var(--font-mono)" }}>
                  {page*PG+i+1}
                </td>
                {columns.map(col => {
                  const v = row[col];
                  const isN = v === null || v === undefined;
                  return (
                    <td key={col} style={{ padding:"6px 10px", color:isN?C.txT:C.tx,
                      maxWidth:160, overflow:"hidden", textOverflow:"ellipsis",
                      whiteSpace:"nowrap", fontStyle:isN?"italic":"normal" }}>
                      {isN ? "null" : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 1 && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, justifyContent:"flex-end" }}>
          <span style={{ fontSize:12, color:C.txS }}>{page+1}/{total} ({rows.length.toLocaleString()}행)</span>
          <Btn small onClick={() => setPage(Math.max(0, page-1))} disabled={page===0}>이전</Btn>
          <Btn small onClick={() => setPage(Math.min(total-1, page+1))} disabled={page===total-1}>다음</Btn>
        </div>
      )}
    </div>
  );
}

export function DsSelector({ datasets, value, onChange, label }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
      <span style={{ fontSize:13, color:C.txS, whiteSpace:"nowrap", minWidth:60 }}>{label || "데이터셋"}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        flex:1, fontSize:13, padding:"7px 10px", borderRadius:"var(--border-radius-md)",
        border:`1px solid ${C.bdS}`, background:C.bg, color:C.tx,
        fontFamily:"var(--font-sans)",
      }}>
        {datasets.map(d => (
          <option key={d.id} value={d.id}>
            {d.name} ({d.rowCount.toLocaleString()}행 × {d.columns.length}열)
          </option>
        ))}
      </select>
    </div>
  );
}

export function MdBlock({ text }) {
  const lines = text.split("\n");
  const els = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^###\s/.test(l)) {
      els.push(<div key={i} style={{ fontSize:14, fontWeight:500, color:C.tx, margin:"16px 0 5px",
        fontFamily:"var(--font-sans)" }}>{l.replace(/^###\s/,"")}</div>);
    } else if (/^##\s/.test(l)) {
      els.push(<div key={i} style={{ fontSize:15, fontWeight:600, color:C.tx, margin:"20px 0 7px",
        paddingBottom:5, borderBottom:`1px solid ${C.bd}`, fontFamily:"var(--font-display)" }}>
        {l.replace(/^##\s/,"")}</div>);
    } else if (/^#\s/.test(l)) {
      els.push(<div key={i} style={{ fontSize:17, fontWeight:400, color:"var(--color-primary-700)",
        margin:"22px 0 8px", fontFamily:"var(--font-display)", letterSpacing:"-0.02em" }}>
        {l.replace(/^#\s/,"")}</div>);
    } else if (/^(\*|-)\s/.test(l)) {
      const c = l.replace(/^(\*|-)\s/,"").replace(/\*\*(.+?)\*\*/g,"⟦$1⟧");
      els.push(
        <div key={i} style={{ display:"flex", gap:8, margin:"3px 0", paddingLeft:8 }}>
          <span style={{ color:"var(--color-primary-400)", flexShrink:0 }}>•</span>
          <span style={{ fontSize:13, color:C.tx, lineHeight:1.65 }}>
            {c.split("⟦").map((p, j) => {
              if (p.includes("⟧")) {
                const [b, r] = p.split("⟧");
                return <span key={j}><strong style={{ fontWeight:600 }}>{b}</strong>{r}</span>;
              }
              return p;
            })}
          </span>
        </div>
      );
    } else if (/^\d+\.\s/.test(l)) {
      const n = l.match(/^(\d+)\./)[1];
      const c = l.replace(/^\d+\.\s/,"");
      els.push(
        <div key={i} style={{ display:"flex", gap:8, margin:"4px 0", paddingLeft:8 }}>
          <span style={{ color:C.infoTx, fontWeight:600, flexShrink:0, fontSize:12, minWidth:18 }}>{n}.</span>
          <span style={{ fontSize:13, color:C.tx, lineHeight:1.65 }}>
            {c.replace(/\*\*(.+?)\*\*/g,"§$1§").split("§").map((p, j) =>
              j % 2 === 1 ? <strong key={j} style={{ fontWeight:600 }}>{p}</strong> : p
            )}
          </span>
        </div>
      );
    } else if (l.trim() === "") {
      els.push(<div key={i} style={{ height:5 }} />);
    } else {
      const f = l.replace(/\*\*(.+?)\*\*/g,"§$1§");
      els.push(
        <p key={i} style={{ fontSize:13, color:C.tx, lineHeight:1.7, margin:"3px 0" }}>
          {f.split("§").map((p, j) =>
            j % 2 === 1 ? <strong key={j} style={{ fontWeight:600 }}>{p}</strong> : p
          )}
        </p>
      );
    }
    i++;
  }
  return <div>{els}</div>;
}
