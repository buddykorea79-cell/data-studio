import { useState } from "react";
import { C } from "../../constants";
import { downloadCSV } from "../../utils/dataUtils";
import { TypeBadge, StatCard, Btn, DataTable } from "./UI";

export function FileCard({dataset,onRemove,isMergeResult}){
  const [tab,setTab]=useState("preview");const [expCol,setExpCol]=useState(null);
  const TABS=[{id:"preview",label:"미리보기"},{id:"schema",label:"스키마"},{id:"summary",label:"요약"}];
  return<div style={{background:C.bg,border:`0.5px solid ${isMergeResult?"#185FA5":C.bd}`,borderRadius:"var(--border-radius-lg)",overflow:"hidden",marginBottom:14}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:`0.5px solid ${C.bd}`,background:isMergeResult?"#E6F1FB":C.bgS}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>{isMergeResult&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:"#185FA5",color:"#fff",fontWeight:500}}>결과</span>}<span style={{fontSize:14,fontWeight:500,color:C.tx}}>{dataset.name}</span><span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:C.info,color:C.infoTx}}>{dataset.rowCount.toLocaleString()}행 × {dataset.columns.length}열</span></div>
      <div style={{display:"flex",gap:6}}><Btn small onClick={()=>downloadCSV(dataset)}>CSV</Btn><Btn small onClick={onRemove}>제거</Btn></div>
    </div>
    <div style={{display:"flex",borderBottom:`0.5px solid ${C.bd}`,padding:"0 16px"}}>{TABS.map(t=><button type="button" key={t.id} onClick={()=>setTab(t.id)} style={{fontSize:13,padding:"8px 12px",cursor:"pointer",background:"transparent",border:"none",borderBottom:tab===t.id?`2px solid ${C.infoTx}`:"2px solid transparent",color:tab===t.id?C.infoTx:C.txS,fontWeight:tab===t.id?500:400,marginBottom:-0.5}}>{t.label}</button>)}</div>
    <div style={{padding:16}}>
      {tab==="preview"&&<DataTable rows={dataset.rows} columns={dataset.columns}/>}
      {tab==="schema"&&<div style={{display:"flex",flexDirection:"column",gap:6}}>{dataset.colMeta.map(col=><div key={col.name} style={{border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-md)",overflow:"hidden"}}><div onClick={()=>setExpCol(expCol===col.name?null:col.name)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",cursor:"pointer",background:expCol===col.name?C.bgS:C.bg}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:13,fontWeight:500,color:C.tx,fontFamily:"var(--font-mono)"}}>{col.name}</span><TypeBadge type={col.type}/></div><span style={{fontSize:12,color:C.txS}}>결측 {col.stats.nullCount} · 고유 {col.stats.unique} {expCol===col.name?"▲":"▼"}</span></div>{expCol===col.name&&<div style={{padding:"10px 12px",borderTop:`0.5px solid ${C.bd}`}}><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{[["행수",col.stats.count],["고유",col.stats.unique],["결측",col.stats.nullCount],...(col.type==="number"?[["min",col.stats.min],["max",col.stats.max],["평균",col.stats.mean],["중앙",col.stats.median]]:[])].filter(x=>x[1]!==undefined).map(([l,v])=><StatCard key={l} label={l} value={v}/>)}</div></div>}</div>)}</div>}
      {tab==="summary"&&<div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:16}}>{[["행",dataset.rowCount.toLocaleString()],["열",dataset.columns.length],["숫자형",dataset.colMeta.filter(c=>c.type==="number").length],["범주형",dataset.colMeta.filter(c=>c.type==="category").length]].map(([l,v])=><StatCard key={l} label={l} value={v}/>)}</div>
        <div style={{border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-md)",overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{background:C.bgS}}>{["컬럼","평균","중앙","min","max","std","결측"].map(h=><th key={h} style={{padding:"7px 10px",textAlign:h==="컬럼"?"left":"right",color:C.txS,fontWeight:500,borderBottom:`0.5px solid ${C.bd}`}}>{h}</th>)}</tr></thead><tbody>{dataset.colMeta.filter(c=>c.type==="number").map((col,i)=><tr key={col.name} style={{borderBottom:`0.5px solid ${C.bd}`,background:i%2===0?C.bg:C.bgS}}><td style={{padding:"7px 10px",fontWeight:500,color:C.tx,fontFamily:"var(--font-mono)"}}>{col.name}</td>{[col.stats.mean,col.stats.median,col.stats.min,col.stats.max,col.stats.std].map((v,j)=><td key={j} style={{padding:"7px 10px",textAlign:"right",fontFamily:"var(--font-mono)",color:C.tx}}>{v!==undefined?Number(v).toLocaleString():"—"}</td>)}<td style={{padding:"7px 10px",textAlign:"right",fontFamily:"var(--font-mono)",color:col.stats.nullCount>0?"#A32D2D":C.txS}}>{col.stats.nullCount}</td></tr>)}</tbody></table></div>
      </div>}
    </div>
  </div>;
}

// ── Main App ──────────────────────────────────────────────────────────────────
