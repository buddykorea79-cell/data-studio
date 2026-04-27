import { useState, useRef, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { BarChart, Bar, LineChart, Line, ScatterChart, Scatter, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// ── Color tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:"var(--color-background-primary)", bgS:"var(--color-background-secondary)",
  bgT:"var(--color-background-tertiary)", tx:"var(--color-text-primary)",
  txS:"var(--color-text-secondary)", txT:"var(--color-text-tertiary)",
  bd:"var(--color-border-tertiary)", bdS:"var(--color-border-secondary)",
  info:"var(--color-background-info)", infoTx:"var(--color-text-info)",
  success:"var(--color-background-success)", successTx:"var(--color-text-success)",
  warn:"var(--color-background-warning)", warnTx:"var(--color-text-warning)",
  danger:"var(--color-background-danger)", dangerTx:"var(--color-text-danger)",
};
const TYPE_CLR = {
  number:{bg:"#E6F1FB",tx:"#0C447C"}, category:{bg:"#EEEDFE",tx:"#3C3489"},
  text:{bg:"#F1EFE8",tx:"#444441"}, date:{bg:"#EAF3DE",tx:"#27500A"}, empty:{bg:"#FAEEDA",tx:"#633806"},
};
const ALL_TYPES = ["number","category","text","date","empty"];
const PALETTE = ["#378ADD","#1D9E75","#D85A30","#7F77DD","#BA7517","#D4537E","#639922","#185FA5","#0F6E56","#993C1D"];

// ── Core helpers ──────────────────────────────────────────────────────────────
function prepareFeatures(ds, featureCols, targetCol) {
  const rows = ds.rows.filter(r =>
    featureCols.every(c => r[c] !== null && r[c] !== undefined && r[c] !== "") &&
    (targetCol ? r[targetCol] !== null && r[targetCol] !== undefined && r[targetCol] !== "" : true)
  );
  const catFcols = featureCols.filter(c => { const t = ds.colMeta.find(m => m.name === c)?.type; return t === "category" || t === "text"; });
  const numFcols = featureCols.filter(c => !catFcols.includes(c));
  const { maps, encode } = oneHot(rows, catFcols);
  const normStats = {};
  numFcols.forEach(c => { const vals = rows.map(r => parseFloat(r[c])).filter(v => !isNaN(v)); normStats[c] = normalize(vals); });
  const X = rows.map(r => {
    const numPart = numFcols.map(c => { const v = parseFloat(r[c]); const s = normStats[c]; return isNaN(v) ? 0 : (v - s.min) / (s.range || 1); });
    const ohPart = catFcols.length ? Object.values(encode(r)) : [];
    return [...numPart, ...ohPart];
  });
  const allFeatNames = [...numFcols, ...catFcols.flatMap(c => maps[c].map(v => `${c}_${v}`))];
  const y = targetCol ? rows.map(r => r[targetCol]) : null;
  return { X, y, allFeatNames, normStats, rows };
}
function trainTestSplit(X, y, testRatio = 0.2) {
  const n = X.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
  const splitAt = Math.floor(n * (1 - testRatio));
  const trIdx = idx.slice(0, splitAt), teIdx = idx.slice(splitAt);
  return { XTr: trIdx.map(i => X[i]), yTr: trIdx.map(i => y[i]), XTe: teIdx.map(i => X[i]), yTe: teIdx.map(i => y[i]), trIdx, teIdx };
}
function detectType(vals) {
  const nn = vals.filter(v => v !== null && v !== undefined && v !== "");
  if (!nn.length) return "empty";
  if (nn.filter(v => !isNaN(Number(v)) && v !== "").length / nn.length > 0.85) return "number";
  if (nn.filter(v => /^\d{4}[-/]\d{2}[-/]\d{2}|^\d{2}[-/]\d{2}[-/]\d{4}/.test(String(v))).length / nn.length > 0.7) return "date";
  if (new Set(nn.map(String)).size <= Math.min(20, nn.length * 0.3)) return "category";
  return "text";
}
function computeStats(vals, type) {
  const nn = vals.filter(v => v !== null && v !== undefined && v !== "");
  const base = { count: vals.length, nullCount: vals.length - nn.length, unique: new Set(nn.map(String)).size };
  if (type === "number") {
    const nums = nn.map(Number).filter(n => !isNaN(n));
    if (!nums.length) return base;
    const sorted = [...nums].sort((a,b)=>a-b), sum = nums.reduce((a,b)=>a+b,0), mean = sum/nums.length;
    return { ...base, min:sorted[0], max:sorted[sorted.length-1], mean:+mean.toFixed(4), median:sorted[Math.floor(sorted.length/2)], std:+Math.sqrt(nums.reduce((a,b)=>a+(b-mean)**2,0)/nums.length).toFixed(4), sum:+sum.toFixed(4) };
  }
  if (type === "category") {
    const freq = {}; nn.forEach(v=>{freq[String(v)]=(freq[String(v)]||0)+1;});
    return { ...base, topValues: Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5) };
  }
  return base;
}
function buildColMeta(rows, columns) {
  return columns.map(col => { const vals = rows.map(r=>r[col]); const type = detectType(vals); return { name:col, type, stats:computeStats(vals,type) }; });
}
function makeDataset(id, name, rows, extra={}) {
  const columns = Object.keys(rows[0]||{});
  return { id, name, rows, columns, colMeta:buildColMeta(rows,columns), rowCount:rows.length, ...extra };
}
function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); const ext = file.name.split(".").pop().toLowerCase();
    reader.onload = e => {
      try {
        let rows = [];
        if (ext === "csv") {
          const text = typeof e.target.result==="string"?e.target.result:new TextDecoder().decode(e.target.result);
          const lines = text.split(/\r?\n/).filter(l=>l.trim());
          const headers = lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,""));
          rows = lines.slice(1).map(line => { const vals=line.split(",").map(v=>v.trim().replace(/^"|"$/g,"")); const row={}; headers.forEach((h,i)=>{row[h]=vals[i]??""}); return row; });
        } else {
          const wb = XLSX.read(e.target.result,{type:"array"});
          const arr = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:"",header:1});
          const headers = arr[0].map(String);
          rows = arr.slice(1).map(row => { const obj={}; headers.forEach((h,i)=>{obj[h]=row[i]??""}); return obj; });
        }
        resolve(makeDataset(crypto.randomUUID(), file.name, rows));
      } catch(err) { reject(err); }
    };
    if (ext==="csv") reader.readAsText(file); else reader.readAsArrayBuffer(file);
  });
}
function downloadCSV(ds) {
  const header = ds.columns.join(",");
  const body = ds.rows.map(r=>ds.columns.map(c=>`"${String(r[c]??"").replace(/"/g,'""')}"`).join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([header+"\n"+body],{type:"text/csv"}));
  a.download = `${ds.name.replace(/\.[^.]+$/,"")}_export.csv`; a.click();
}

// ── Join / Union ──────────────────────────────────────────────────────────────
function performJoin(L, R, lKey, rKey, jType) {
  const rMap = {}; R.rows.forEach(row=>{const k=String(row[rKey]??""); if(!rMap[k])rMap[k]=[]; rMap[k].push(row);});
  const rOnly = R.columns.filter(c=>c!==rKey); const rows=[]; const matched=new Set();
  L.rows.forEach(lRow => {
    const k=String(lRow[lKey]??""); const ms=rMap[k]||[];
    if (ms.length) { ms.forEach(rRow=>{ matched.add(k); const m={...lRow}; rOnly.forEach(c=>{const tc=L.columns.includes(c)?`${R.name.replace(/\.[^.]+$/,"")}.${c}`:c; m[tc]=rRow[c];}); rows.push(m); }); }
    else if (jType==="left"||jType==="outer") { const m={...lRow}; rOnly.forEach(c=>{const tc=L.columns.includes(c)?`${R.name.replace(/\.[^.]+$/,"")}.${c}`:c; m[tc]=null;}); rows.push(m); }
  });
  if (jType==="right"||jType==="outer") {
    R.rows.forEach(rRow=>{const k=String(rRow[rKey]??""); if(!matched.has(k)){const m={}; L.columns.forEach(c=>{m[c]=null;}); rOnly.forEach(c=>{const tc=L.columns.includes(c)?`${R.name.replace(/\.[^.]+$/,"")}.${c}`:c; m[tc]=rRow[c];}); m[lKey]=rRow[rKey]; rows.push(m);}});
  }
  return makeDataset(crypto.randomUUID(), `merge_${L.name.replace(/\.[^.]+$/,"")}_${R.name.replace(/\.[^.]+$/,"")}`, rows, {isMerged:true});
}
function performUnion(datasets, mode) {
  const allCols = mode==="strict" ? datasets[0].columns.filter(c=>datasets.every(d=>d.columns.includes(c))) : [...new Set(datasets.flatMap(d=>d.columns))];
  const rows = datasets.flatMap(d=>d.rows.map(row=>{const r={_source:d.name}; allCols.forEach(c=>{r[c]=row[c]??null;}); return r;}));
  return makeDataset(crypto.randomUUID(), `union_${datasets.length}files`, rows, {isMerged:true});
}

// ── Pivot / Group helpers ─────────────────────────────────────────────────────
function performGroup(ds, groupCols, valCol, aggFn) {
  const map = {};
  ds.rows.forEach(row => {
    const key = groupCols.map(c=>String(row[c]??"")).join("|||");
    if (!map[key]) { map[key] = { _key:key, _vals:[] }; groupCols.forEach(c=>{map[key][c]=row[c];}); }
    const v = parseFloat(row[valCol]); if (!isNaN(v)) map[key]._vals.push(v);
  });
  const rows = Object.values(map).map(g => {
    const v=g._vals; let agg=0;
    if (aggFn==="sum") agg=v.reduce((a,b)=>a+b,0);
    else if (aggFn==="mean") agg=v.length?+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(4):0;
    else if (aggFn==="count") agg=v.length;
    else if (aggFn==="min") agg=v.length?Math.min(...v):0;
    else if (aggFn==="max") agg=v.length?Math.max(...v):0;
    const r={}; groupCols.forEach(c=>{r[c]=g[c];}); r[`${aggFn}(${valCol})`]=agg; return r;
  });
  return makeDataset(crypto.randomUUID(), `group_${ds.name.replace(/\.[^.]+$/,"")}`, rows, {isMerged:true});
}
function performPivot(ds, rowCol, colCol, valCol, aggFn) {
  const colVals = [...new Set(ds.rows.map(r=>String(r[colCol]??"")).filter(Boolean))].sort();
  const map = {};
  ds.rows.forEach(row => {
    const rk=String(row[rowCol]??""), ck=String(row[colCol]??""), v=parseFloat(row[valCol]);
    if (!map[rk]) { map[rk]={}; map[rk][rowCol]=rk; colVals.forEach(c=>{map[rk][c]=[];}); }
    if (!isNaN(v) && map[rk][ck]!==undefined) map[rk][ck].push(v);
  });
  const agg = (arr) => {
    if (!arr.length) return null;
    if (aggFn==="sum") return +arr.reduce((a,b)=>a+b,0).toFixed(4);
    if (aggFn==="mean") return +(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(4);
    if (aggFn==="count") return arr.length;
    if (aggFn==="min") return Math.min(...arr);
    if (aggFn==="max") return Math.max(...arr);
    return arr.length;
  };
  const rows = Object.values(map).map(r=>{const nr={}; nr[rowCol]=r[rowCol]; colVals.forEach(c=>{nr[c]=agg(r[c]);}); return nr;});
  return makeDataset(crypto.randomUUID(), `pivot_${ds.name.replace(/\.[^.]+$/,"")}`, rows, {isMerged:true});
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function TypeBadge({type}) {
  const clr=TYPE_CLR[type]||TYPE_CLR.text;
  return <span style={{fontSize:11,fontWeight:500,padding:"2px 7px",borderRadius:4,background:clr.bg,color:clr.tx,fontFamily:"var(--font-mono)"}}>{type}</span>;
}
function StatCard({label,value}) {
  return <div style={{background:C.bgS,borderRadius:"var(--border-radius-md)",padding:"10px 14px",minWidth:80}}><div style={{fontSize:11,color:C.txS,marginBottom:4}}>{label}</div><div style={{fontSize:15,fontWeight:500,color:C.tx,fontFamily:"var(--font-mono)"}}>{value}</div></div>;
}
function Btn({onClick,children,variant="default",disabled=false,small=false,full=false}) {
  const S={default:{bg:"transparent",color:C.txS,border:`0.5px solid ${C.bdS}`},primary:{bg:"#185FA5",color:"#fff",border:"none"},success:{bg:"#0F6E56",color:"#fff",border:"none"},danger:{bg:"transparent",color:"#A32D2D",border:"0.5px solid #F09595"},warn:{bg:"#BA7517",color:"#fff",border:"none"}};
  const s=S[variant]||S.default;
  return <button onClick={onClick} disabled={disabled} style={{fontSize:small?11:13,padding:small?"3px 8px":"7px 16px",cursor:disabled?"not-allowed":"pointer",borderRadius:"var(--border-radius-md)",background:s.bg,color:s.color,border:s.border,fontWeight:500,opacity:disabled?0.45:1,whiteSpace:"nowrap",width:full?"100%":"auto"}}>{children}</button>;
}
function Section({title,desc,children,defaultOpen=true}) {
  const [open,setOpen]=useState(defaultOpen);
  return <div style={{border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-lg)",overflow:"hidden",marginBottom:12}}><div onClick={()=>setOpen(p=>!p)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",cursor:"pointer",background:C.bgS,borderBottom:open?`0.5px solid ${C.bd}`:"none"}}><div><div style={{fontSize:13,fontWeight:500,color:C.tx}}>{title}</div>{desc&&<div style={{fontSize:11,color:C.txS,marginTop:2}}>{desc}</div>}</div><span style={{fontSize:12,color:C.txT}}>{open?"▲":"▼"}</span></div>{open&&<div style={{padding:14}}>{children}</div>}</div>;
}
function DataTable({rows,columns,maxH}) {
  const [page,setPage]=useState(0); const PG=10; const total=Math.ceil(rows.length/PG);
  return <div><div style={{overflowX:"auto",overflowY:maxH?"auto":"visible",maxHeight:maxH,borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bd}`}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{background:C.bgS}}><th style={{padding:"8px 10px",textAlign:"left",color:C.txS,fontWeight:500,fontSize:12,borderBottom:`0.5px solid ${C.bd}`,whiteSpace:"nowrap"}}>#</th>{columns.map(col=><th key={col} style={{padding:"8px 10px",textAlign:"left",color:C.txS,fontWeight:500,fontSize:12,borderBottom:`0.5px solid ${C.bd}`,whiteSpace:"nowrap"}}>{col}</th>)}</tr></thead><tbody>{rows.slice(page*PG,(page+1)*PG).map((row,i)=><tr key={i} style={{borderBottom:`0.5px solid ${C.bd}`,background:i%2===0?C.bg:C.bgS}}><td style={{padding:"6px 10px",color:C.txT,fontSize:12,fontFamily:"var(--font-mono)"}}>{page*PG+i+1}</td>{columns.map(col=>{const v=row[col];const isN=v===null||v===undefined;return <td key={col} style={{padding:"6px 10px",color:isN?C.txT:C.tx,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:isN?"italic":"normal"}}>{isN?"null":String(v)}</td>;})}</tr>)}</tbody></table></div>{total>1&&<div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,justifyContent:"flex-end"}}><span style={{fontSize:12,color:C.txS}}>{page+1}/{total} ({rows.length.toLocaleString()}행)</span><Btn small onClick={()=>setPage(Math.max(0,page-1))} disabled={page===0}>이전</Btn><Btn small onClick={()=>setPage(Math.min(total-1,page+1))} disabled={page===total-1}>다음</Btn></div>}</div>;
}
function DsSelector({datasets,value,onChange,label}) {
  return <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><span style={{fontSize:13,color:C.txS,whiteSpace:"nowrap",minWidth:60}}>{label||"데이터셋"}</span><select value={value} onChange={e=>onChange(e.target.value)} style={{flex:1,fontSize:13,padding:"7px 10px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}>{datasets.map(d=><option key={d.id} value={d.id}>{d.name} ({d.rowCount.toLocaleString()}행 × {d.columns.length}열)</option>)}</select></div>;
}

// ── FileCard ──────────────────────────────────────────────────────────────────
function FileCard({dataset,onRemove,isMergeResult}) {
  const [tab,setTab]=useState("preview"); const [expCol,setExpCol]=useState(null);
  const TABS=[{id:"preview",label:"미리보기"},{id:"schema",label:"스키마"},{id:"summary",label:"요약"}];
  return <div style={{background:C.bg,border:`0.5px solid ${isMergeResult?"#185FA5":C.bd}`,borderRadius:"var(--border-radius-lg)",overflow:"hidden",marginBottom:14}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:`0.5px solid ${C.bd}`,background:isMergeResult?"#E6F1FB":C.bgS}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {isMergeResult&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:"#185FA5",color:"#fff",fontWeight:500}}>결과</span>}
        <span style={{fontSize:14,fontWeight:500,color:C.tx}}>{dataset.name}</span>
        <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:C.info,color:C.infoTx}}>{dataset.rowCount.toLocaleString()}행 × {dataset.columns.length}열</span>
      </div>
      <div style={{display:"flex",gap:6}}><Btn small onClick={()=>downloadCSV(dataset)}>CSV</Btn><Btn small onClick={onRemove}>제거</Btn></div>
    </div>
    <div style={{display:"flex",borderBottom:`0.5px solid ${C.bd}`,padding:"0 16px"}}>{TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{fontSize:13,padding:"8px 12px",cursor:"pointer",background:"transparent",border:"none",borderBottom:tab===t.id?`2px solid ${C.infoTx}`:"2px solid transparent",color:tab===t.id?C.infoTx:C.txS,fontWeight:tab===t.id?500:400,marginBottom:-0.5}}>{t.label}</button>)}</div>
    <div style={{padding:16}}>
      {tab==="preview"&&<DataTable rows={dataset.rows} columns={dataset.columns}/>}
      {tab==="schema"&&<div style={{display:"flex",flexDirection:"column",gap:6}}>{dataset.colMeta.map(col=><div key={col.name} style={{border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-md)",overflow:"hidden"}}><div onClick={()=>setExpCol(expCol===col.name?null:col.name)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",cursor:"pointer",background:expCol===col.name?C.bgS:C.bg}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:13,fontWeight:500,color:C.tx,fontFamily:"var(--font-mono)"}}>{col.name}</span><TypeBadge type={col.type}/></div><span style={{fontSize:12,color:C.txS}}>결측 {col.stats.nullCount} · 고유 {col.stats.unique} {expCol===col.name?"▲":"▼"}</span></div>{expCol===col.name&&<div style={{padding:"10px 12px",borderTop:`0.5px solid ${C.bd}`}}><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{[["행수",col.stats.count],["고유",col.stats.unique],["결측",col.stats.nullCount],...(col.type==="number"?[["최솟값",col.stats.min],["최댓값",col.stats.max],["평균",col.stats.mean],["중앙값",col.stats.median]]:[]),(col.type==="category"&&col.stats.topValues?[["상위값",col.stats.topValues.map(([v,c])=>`${v}(${c})`).join(", ")]]:[])[0]??[]].filter(x=>x.length).map(([l,v])=><StatCard key={l} label={l} value={v}/>)}</div></div>}</div>)}</div>}
      {tab==="summary"&&<div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:16}}>{[["총 행 수",dataset.rowCount.toLocaleString()],["총 열 수",dataset.columns.length],["숫자형",dataset.colMeta.filter(c=>c.type==="number").length],["범주형",dataset.colMeta.filter(c=>c.type==="category").length],["텍스트",dataset.colMeta.filter(c=>c.type==="text").length]].map(([l,v])=><StatCard key={l} label={l} value={v}/>)}</div><div style={{border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-md)",overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{background:C.bgS}}>{["컬럼","평균","중앙값","최솟값","최댓값","표준편차","합계"].map(h=><th key={h} style={{padding:"7px 10px",textAlign:h==="컬럼"?"left":"right",color:C.txS,fontWeight:500,borderBottom:`0.5px solid ${C.bd}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{dataset.colMeta.filter(c=>c.type==="number").map((col,i)=><tr key={col.name} style={{borderBottom:`0.5px solid ${C.bd}`,background:i%2===0?C.bg:C.bgS}}><td style={{padding:"6px 10px",fontWeight:500,color:C.tx,fontFamily:"var(--font-mono)",fontSize:12}}>{col.name}</td>{[col.stats.mean,col.stats.median,col.stats.min,col.stats.max,col.stats.std,col.stats.sum].map((v,j)=><td key={j} style={{padding:"6px 10px",textAlign:"right",color:C.tx,fontFamily:"var(--font-mono)"}}>{v!==undefined?Number(v).toLocaleString():"—"}</td>)}</tr>)}{!dataset.colMeta.filter(c=>c.type==="number").length&&<tr><td colSpan={7} style={{padding:16,textAlign:"center",color:C.txS}}>숫자형 컬럼 없음</td></tr>}</tbody></table></div></div>}
    </div>
  </div>;
}

// ── Merge Panel ───────────────────────────────────────────────────────────────
function MergePanel({datasets,onResult}) {
  const [lIdx,setLIdx]=useState(0); const [rIdx,setRIdx]=useState(Math.min(1,datasets.length-1));
  const [lKey,setLKey]=useState(""); const [rKey,setRKey]=useState(""); const [jType,setJType]=useState("inner");
  const JOIN=[{id:"inner",label:"Inner",desc:"양쪽 모두"},{id:"left",label:"Left",desc:"왼쪽 기준"},{id:"right",label:"Right",desc:"오른쪽 기준"},{id:"outer",label:"Outer",desc:"전체 포함"}];
  const handle=()=>{
    if(!lKey||!rKey)return alert("조인 키를 선택해 주세요.");
    if(lIdx===rIdx)return alert("서로 다른 파일을 선택해 주세요.");
    onResult(performJoin(datasets[lIdx],datasets[rIdx],lKey,rKey,jType));
  };
  return <div style={{border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-lg)",overflow:"hidden",marginBottom:14}}>
    <div style={{padding:"12px 16px",background:C.bgS,borderBottom:`0.5px solid ${C.bd}`,display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:"#EEEDFE",color:"#3C3489",fontWeight:500}}>Merge</span>
      <span style={{fontSize:14,fontWeight:500,color:C.tx}}>2개 파일 조인</span>
    </div>
    <div style={{padding:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        {[{label:"왼쪽 (Left)",idx:lIdx,setIdx:setLIdx,key:lKey,setKey:setLKey},{label:"오른쪽 (Right)",idx:rIdx,setIdx:setRIdx,key:rKey,setKey:setRKey}].map(({label,idx,setIdx,key,setKey})=><div key={label}><div style={{fontSize:12,color:C.txS,marginBottom:4,fontWeight:500}}>{label}</div><select value={idx} onChange={e=>{setIdx(+e.target.value);setKey("");}} style={{width:"100%",marginBottom:8,fontSize:13,padding:"6px 10px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}>{datasets.map((d,i)=><option key={i} value={i}>{d.name}</option>)}</select><select value={key} onChange={e=>setKey(e.target.value)} style={{width:"100%",fontSize:13,padding:"6px 10px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}><option value="">— 조인 키 선택 —</option>{datasets[idx]?.columns.map(c=><option key={c} value={c}>{c}</option>)}</select></div>)}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>{JOIN.map(j=><div key={j.id} onClick={()=>setJType(j.id)} style={{flex:1,padding:"8px 10px",borderRadius:"var(--border-radius-md)",border:`${jType===j.id?"2px solid #185FA5":`0.5px solid ${C.bd}`}`,cursor:"pointer",background:jType===j.id?"#E6F1FB":C.bg}}><div style={{fontSize:12,fontWeight:500,color:jType===j.id?"#185FA5":C.tx}}>{j.label}</div><div style={{fontSize:11,color:C.txS}}>{j.desc}</div></div>)}</div>
      <Btn variant="primary" onClick={handle}>Merge 실행</Btn>
    </div>
  </div>;
}

// ── Union Panel ───────────────────────────────────────────────────────────────
function UnionPanel({datasets,onResult}) {
  const [sel,setSel]=useState(()=>new Set(datasets.map((_,i)=>i))); const [mode,setMode]=useState("outer");
  const toggle=i=>setSel(p=>{const s=new Set(p);s.has(i)?s.delete(i):s.add(i);return s;});
  const selDs=datasets.filter((_,i)=>sel.has(i));
  return <div style={{border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-lg)",overflow:"hidden",marginBottom:14}}>
    <div style={{padding:"12px 16px",background:C.bgS,borderBottom:`0.5px solid ${C.bd}`,display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:"#E1F5EE",color:"#085041",fontWeight:500}}>Union</span>
      <span style={{fontSize:14,fontWeight:500,color:C.tx}}>파일 결합 (수직)</span>
    </div>
    <div style={{padding:16}}>
      <div style={{fontSize:12,color:C.txS,marginBottom:8,fontWeight:500}}>결합할 파일 선택</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>{datasets.map((d,i)=><div key={i} onClick={()=>toggle(i)} style={{padding:"6px 12px",borderRadius:"var(--border-radius-md)",border:`${sel.has(i)?"2px solid #0F6E56":`0.5px solid ${C.bd}`}`,cursor:"pointer",background:sel.has(i)?"#E1F5EE":C.bg}}><span style={{fontSize:12,color:sel.has(i)?"#085041":C.tx,fontWeight:sel.has(i)?500:400}}>{d.name}</span><span style={{fontSize:11,color:C.txS,marginLeft:6}}>{d.rowCount}행</span></div>)}</div>
      {selDs.length>=2&&<div style={{fontSize:12,color:C.txS,marginBottom:12}}>공통 컬럼 {selDs[0].columns.filter(c=>selDs.every(d=>d.columns.includes(c))).length}개 · 전체 컬럼 {[...new Set(selDs.flatMap(d=>d.columns))].length}개 · 예상 {selDs.reduce((a,d)=>a+d.rowCount,0).toLocaleString()}행</div>}
      <div style={{display:"flex",gap:8,marginBottom:14}}>{[{id:"outer",label:"전체 포함",desc:"없으면 빈값"},{id:"strict",label:"공통만",desc:"공통 컬럼만"}].map(m=><div key={m.id} onClick={()=>setMode(m.id)} style={{flex:1,padding:"8px 10px",borderRadius:"var(--border-radius-md)",border:`${mode===m.id?"2px solid #0F6E56":`0.5px solid ${C.bd}`}`,cursor:"pointer",background:mode===m.id?"#E1F5EE":C.bg}}><div style={{fontSize:12,fontWeight:500,color:mode===m.id?"#085041":C.tx}}>{m.label}</div><div style={{fontSize:11,color:C.txS}}>{m.desc}</div></div>)}</div>
      <Btn variant="success" onClick={()=>{if(selDs.length<2)return alert("2개 이상 선택");onResult(performUnion(selDs,mode));}} disabled={sel.size<2}>Union 실행</Btn>
    </div>
  </div>;
}

// ── Data Info Tab (구 Overview) ───────────────────────────────────────────────
function DataInfoTab({datasets,onUpdate}) {
  const [selId,setSelId]=useState(()=>datasets[0]?.id??"");
  const ds=datasets.find(d=>d.id===selId);
  const [showTranspose,setShowTranspose]=useState(false);

  const handleTranspose=()=>{
    if(!ds)return;
    const newCols=["index",...ds.rows.map((_,i)=>`row_${i+1}`)];
    const newRows=ds.columns.map(col=>{const r={index:col}; ds.rows.forEach((_,i)=>{r[`row_${i+1}`]=ds.rows[i][col];}); return r;});
    const updated=makeDataset(crypto.randomUUID(),`${ds.name.replace(/\.[^.]+$/,"")}_transposed`,newRows,{isMerged:true});
    onUpdate(updated,"add");
  };

  if(!ds) return <div style={{padding:40,textAlign:"center",color:C.txT}}>파일을 업로드해 주세요.</div>;
  const totR=datasets.reduce((a,d)=>a+d.rowCount,0), totC=datasets.reduce((a,d)=>a+d.columns.length,0);
  return <div>
    <DsSelector datasets={datasets} value={selId} onChange={setSelId} label="파일 선택"/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:20}}>
      {[["총 파일 수",datasets.length],["총 행 수",totR.toLocaleString()],["총 열 수",totC],["숫자형",ds.colMeta.filter(c=>c.type==="number").length],["범주형",ds.colMeta.filter(c=>c.type==="category").length]].map(([l,v])=><StatCard key={l} label={l} value={v}/>)}
    </div>

    {/* 행렬 전치 */}
    <Section title="행렬 변환 (Transpose)" desc="행과 열을 바꿔 새 데이터셋으로 추가합니다">
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:showTranspose?12:0}}>
        <div style={{fontSize:13,color:C.txS}}>현재: <strong style={{color:C.tx}}>{ds.rowCount}행 × {ds.columns.length}열</strong> → 전치 후: <strong style={{color:C.tx}}>{ds.columns.length}행 × {ds.rowCount+1}열</strong></div>
        <Btn variant="warn" onClick={handleTranspose}>전치(Transpose) 실행 → 새 데이터셋 추가</Btn>
      </div>
    </Section>

    {/* 파일별 비교 */}
    <div style={{fontSize:13,color:C.txS,fontWeight:500,marginBottom:10}}>파일별 개요</div>
    <div style={{border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-md)",overflow:"hidden",marginBottom:20}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{background:C.bgS}}>{["파일명","행","열","숫자형","범주형","텍스트","날짜","결측합계"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:h==="파일명"?"left":"right",color:C.txS,fontWeight:500,fontSize:12,borderBottom:`0.5px solid ${C.bd}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{datasets.map((d,i)=>{const nt=d.colMeta.reduce((a,c)=>a+(c.stats.nullCount||0),0),np=d.rowCount>0?((nt/(d.rowCount*d.columns.length))*100).toFixed(1):0;return <tr key={d.id} style={{borderBottom:`0.5px solid ${C.bd}`,background:i%2===0?C.bg:C.bgS}}><td style={{padding:"8px 10px",color:C.tx,fontWeight:500,fontSize:13}}>{d.name}</td><td style={{padding:"8px 10px",textAlign:"right",fontFamily:"var(--font-mono)",fontSize:12}}>{d.rowCount.toLocaleString()}</td><td style={{padding:"8px 10px",textAlign:"right",fontFamily:"var(--font-mono)",fontSize:12}}>{d.columns.length}</td>{[["number","#E6F1FB","#0C447C"],["category","#EEEDFE","#3C3489"],["text","#F1EFE8","#444441"],["date","#EAF3DE","#27500A"]].map(([type,bg,clr])=><td key={type} style={{padding:"8px 10px",textAlign:"right"}}><span style={{fontSize:12,color:clr,background:bg,padding:"1px 7px",borderRadius:4,fontFamily:"var(--font-mono)"}}>{d.colMeta.filter(c=>c.type===type).length}</span></td>)}<td style={{padding:"8px 10px",textAlign:"right",fontSize:12,fontFamily:"var(--font-mono)",color:nt>0?"#A32D2D":C.txS}}>{nt.toLocaleString()} <span style={{fontSize:11,color:C.txT}}>({np}%)</span></td></tr>;})} </tbody>
      </table>
    </div>

    {/* 선택 파일 숫자형 통계 */}
    {ds.colMeta.filter(c=>c.type==="number").length>0&&<div><div style={{fontSize:13,fontWeight:500,color:C.txS,marginBottom:8}}><span style={{color:C.tx}}>{ds.name}</span> — 숫자형 통계</div><div style={{border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-md)",overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{background:C.bgS}}>{["컬럼","평균","중앙값","최솟값","최댓값","표준편차","결측"].map(h=><th key={h} style={{padding:"7px 10px",textAlign:h==="컬럼"?"left":"right",color:C.txS,fontWeight:500,borderBottom:`0.5px solid ${C.bd}`}}>{h}</th>)}</tr></thead><tbody>{ds.colMeta.filter(c=>c.type==="number").map((col,i)=><tr key={col.name} style={{borderBottom:`0.5px solid ${C.bd}`,background:i%2===0?C.bg:C.bgS}}><td style={{padding:"7px 10px",fontWeight:500,color:C.tx,fontFamily:"var(--font-mono)"}}>{col.name}</td>{[col.stats.mean,col.stats.median,col.stats.min,col.stats.max,col.stats.std].map((v,j)=><td key={j} style={{padding:"7px 10px",textAlign:"right",fontFamily:"var(--font-mono)",color:C.tx}}>{v!==undefined?Number(v).toLocaleString():"—"}</td>)}<td style={{padding:"7px 10px",textAlign:"right",fontFamily:"var(--font-mono)",color:col.stats.nullCount>0?"#A32D2D":C.txS}}>{col.stats.nullCount}</td></tr>)}</tbody></table></div></div>}
  </div>;
}

// ── Summary Tab (Group / Pivot) ───────────────────────────────────────────────
function SummaryTab({datasets,onResult}) {
  const [selId,setSelId]=useState(()=>datasets[0]?.id??"");
  const [mode,setMode]=useState("group");
  const [groupCols,setGroupCols]=useState([]);
  const [valCol,setValCol]=useState(""); const [aggFn,setAggFn]=useState("sum");
  const [rowCol,setRowCol]=useState(""); const [colCol,setColCol]=useState(""); const [pvValCol,setPvValCol]=useState("");
  const [result,setResult]=useState(null);
  const ds=datasets.find(d=>d.id===selId);
  const toggleGroup=c=>setGroupCols(p=>p.includes(c)?p.filter(x=>x!==c):[...p,c]);
  const AGG=[{id:"sum",label:"합계"},{id:"mean",label:"평균"},{id:"count",label:"건수"},{id:"min",label:"최솟값"},{id:"max",label:"최댓값"}];

  const run=()=>{
    if(!ds)return;
    if(mode==="group"){
      if(!groupCols.length||!valCol)return alert("그룹 컬럼과 집계 컬럼을 선택해 주세요.");
      setResult(performGroup(ds,groupCols,valCol,aggFn));
    } else {
      if(!rowCol||!colCol||!pvValCol)return alert("행/열/값 컬럼을 모두 선택해 주세요.");
      setResult(performPivot(ds,rowCol,colCol,pvValCol,aggFn));
    }
  };

  return <div>
    <DsSelector datasets={datasets} value={selId} onChange={v=>{setSelId(v);setResult(null);setGroupCols([]);setValCol("");}} label="데이터셋"/>
    {/* mode toggle */}
    <div style={{display:"flex",gap:8,marginBottom:16}}>
      {[{id:"group",label:"Group By",desc:"컬럼별 집계"},{id:"pivot",label:"Pivot",desc:"행열 교차 집계"}].map(m=><div key={m.id} onClick={()=>{setMode(m.id);setResult(null);}} style={{flex:1,padding:"10px 14px",borderRadius:"var(--border-radius-md)",border:`${mode===m.id?"2px solid #185FA5":`0.5px solid ${C.bd}`}`,cursor:"pointer",background:mode===m.id?"#E6F1FB":C.bg}}><div style={{fontSize:13,fontWeight:500,color:mode===m.id?"#185FA5":C.tx}}>{m.label}</div><div style={{fontSize:11,color:C.txS}}>{m.desc}</div></div>)}
    </div>

    {ds&&mode==="group"&&<Section title="Group By 설정">
      <div style={{marginBottom:10}}><div style={{fontSize:12,color:C.txS,marginBottom:6,fontWeight:500}}>그룹 기준 컬럼 (복수 선택 가능)</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{ds.columns.map(c=><span key={c} onClick={()=>toggleGroup(c)} style={{fontSize:12,padding:"4px 10px",borderRadius:10,cursor:"pointer",background:groupCols.includes(c)?"#E6F1FB":C.bg,color:groupCols.includes(c)?C.infoTx:C.txS,border:`0.5px solid ${groupCols.includes(c)?C.infoTx:C.bd}`,fontFamily:"var(--font-mono)",fontWeight:groupCols.includes(c)?500:400}}>{c}</span>)}</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div><div style={{fontSize:12,color:C.txS,marginBottom:4}}>집계할 컬럼 (숫자형)</div><select value={valCol} onChange={e=>setValCol(e.target.value)} style={{width:"100%",fontSize:13,padding:"6px 10px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}><option value="">— 선택 —</option>{ds.colMeta.filter(c=>c.type==="number").map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></div>
        <div><div style={{fontSize:12,color:C.txS,marginBottom:4}}>집계 함수</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{AGG.map(a=><span key={a.id} onClick={()=>setAggFn(a.id)} style={{fontSize:11,padding:"4px 10px",borderRadius:10,cursor:"pointer",background:aggFn===a.id?C.info:C.bg,color:aggFn===a.id?C.infoTx:C.txS,border:`0.5px solid ${aggFn===a.id?C.infoTx:C.bd}`,fontWeight:aggFn===a.id?500:400}}>{a.label}</span>)}</div></div>
      </div>
      <Btn variant="primary" onClick={run}>Group By 실행</Btn>
    </Section>}

    {ds&&mode==="pivot"&&<Section title="Pivot 설정">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
        {[{label:"행 컬럼 (Row)",val:rowCol,set:setRowCol},{label:"열 컬럼 (Column)",val:colCol,set:setColCol},{label:"값 컬럼 (Value)",val:pvValCol,set:setPvValCol}].map(({label,val,set})=><div key={label}><div style={{fontSize:12,color:C.txS,marginBottom:4}}>{label}</div><select value={val} onChange={e=>set(e.target.value)} style={{width:"100%",fontSize:13,padding:"6px 10px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}><option value="">— 선택 —</option>{ds.columns.map(c=><option key={c} value={c}>{c}</option>)}</select></div>)}
      </div>
      <div style={{marginBottom:12}}><div style={{fontSize:12,color:C.txS,marginBottom:4}}>집계 함수</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{AGG.map(a=><span key={a.id} onClick={()=>setAggFn(a.id)} style={{fontSize:11,padding:"4px 10px",borderRadius:10,cursor:"pointer",background:aggFn===a.id?C.info:C.bg,color:aggFn===a.id?C.infoTx:C.txS,border:`0.5px solid ${aggFn===a.id?C.infoTx:C.bd}`,fontWeight:aggFn===a.id?500:400}}>{a.label}</span>)}</div></div>
      <Btn variant="primary" onClick={run}>Pivot 실행</Btn>
    </Section>}

    {result&&<div style={{marginTop:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:500,color:C.tx}}>{result.name} — {result.rowCount.toLocaleString()}행 × {result.columns.length}열</span>
        <div style={{display:"flex",gap:8}}><Btn small onClick={()=>downloadCSV(result)}>CSV 다운로드</Btn><Btn small variant="success" onClick={()=>{onResult(result);setResult(null);}}>데이터셋으로 추가</Btn></div>
      </div>
      <DataTable rows={result.rows} columns={result.columns} maxH={360}/>
    </div>}
  </div>;
}

// ── Preprocess Tab ────────────────────────────────────────────────────────────
function PreprocessTab({datasets,onUpdate}) {
  const [selId,setSelId]=useState(()=>datasets[0]?.id??"");
  const [colOvr,setColOvr]=useState({}); const [skipRows,setSkipRows]=useState(0);
  const [fillSt,setFillSt]=useState({}); const [fillCus,setFillCus]=useState({});
  const [strOps,setStrOps]=useState({}); const [dedupCols,setDedupCols]=useState([]);
  const [dropCols,setDropCols]=useState([]); const [log,setLog]=useState([]);
  const [applyAll_,setApplyAll_]=useState(false);

  const ds=datasets.find(d=>d.id===selId);
  const prevId=useRef(selId);
  if(prevId.current!==selId){prevId.current=selId;setColOvr({});setSkipRows(0);setFillSt({});setFillCus({});setStrOps({});setDedupCols([]);setDropCols([]);}

  if(!ds)return <div style={{padding:40,textAlign:"center",color:C.txT}}>파일을 업로드해 주세요.</div>;

  const ovr=(col,key,val)=>setColOvr(p=>({...p,[col]:{...(p[col]||{}),[key]:val}}));
  const toggleDedup=c=>setDedupCols(p=>p.includes(c)?p.filter(x=>x!==c):[...p,c]);
  const toggleDrop=c=>setDropCols(p=>p.includes(c)?p.filter(x=>x!==c):[...p,c]);
  const toggleStr=(col,op)=>setStrOps(p=>{const cur=p[col]||[];return{...p,[col]:cur.includes(op)?cur.filter(o=>o!==op):[...cur,op]};});
  const preview=useMemo(()=>ds.rows.slice(skipRows),[ds.rows,skipRows]);

  // 개별 적용 함수
  const applySkip=(targets)=>{
    targets.forEach(d=>{
      if(skipRows===0)return;
      const rows=d.rows.slice(skipRows);
      const cols=Object.keys(rows[0]||{});
      onUpdate({...d,rows,columns:cols,colMeta:buildColMeta(rows,cols),rowCount:rows.length});
    });
    addLog([`시작 행 ${skipRows}개 스킵 (${targets.map(d=>d.name).join(",")})`]);
  };
  const applyTypeRename=(targets)=>{
    targets.forEach(d=>{
      let rows=[...d.rows];
      const renames={};
      Object.entries(colOvr).forEach(([col,ov])=>{if(ov.rename&&ov.rename!==col)renames[col]=ov.rename;});
      if(Object.keys(renames).length){rows=rows.map(r=>{const nr={};Object.entries(r).forEach(([k,v])=>{nr[renames[k]||k]=v;});return nr;});}
      const cols=Object.keys(rows[0]||{});
      const meta=buildColMeta(rows,cols).map(col=>{const origCol=Object.keys(renames).find(k=>renames[k]===col.name)||col.name;const ov=colOvr[origCol];if(ov?.type)return{...col,type:ov.type};return col;});
      onUpdate({...d,rows,columns:cols,colMeta:meta,rowCount:rows.length});
    });
    addLog(["타입/이름 변경 적용"]);
  };
  const applyNullReplace=(targets)=>{
    targets.forEach(d=>{
      let rows=[...d.rows];
      Object.entries(colOvr).forEach(([col,ov])=>{
        if(ov.nullValues?.length){const ns=new Set(ov.nullValues.map(v=>v.trim()).filter(Boolean));rows=rows.map(r=>({...r,[col]:ns.has(String(r[col]??""))?null:r[col]}));}
      });
      const cols=Object.keys(rows[0]||{});
      onUpdate({...d,rows,columns:cols,colMeta:buildColMeta(rows,cols),rowCount:rows.length});
    });
    addLog(["null 치환 적용"]);
  };
  const applyFill=(targets)=>{
    targets.forEach(d=>{
      let rows=[...d.rows];
      Object.entries(fillSt).forEach(([col,st])=>{
        if(st==="none")return;
        const vals=rows.map(r=>r[col]).filter(v=>v!==null&&v!==undefined&&v!=="");
        let fv=null;
        if(st==="mean"){const nums=vals.map(Number).filter(n=>!isNaN(n));fv=nums.length?+(nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(4):null;}
        else if(st==="median"){const nums=[...vals.map(Number).filter(n=>!isNaN(n))].sort((a,b)=>a-b);fv=nums.length?nums[Math.floor(nums.length/2)]:null;}
        else if(st==="mode"){const freq={};vals.forEach(v=>{freq[v]=(freq[v]||0)+1;});fv=Object.entries(freq).sort((a,b)=>b[1]-a[1])[0]?.[0]??null;}
        else if(st==="custom"){fv=fillCus[col]??"";}
        if(fv!==null)rows=rows.map(r=>({...r,[col]:(r[col]===null||r[col]===undefined||r[col]==="")?fv:r[col]}));
      });
      const cols=Object.keys(rows[0]||{});
      onUpdate({...d,rows,columns:cols,colMeta:buildColMeta(rows,cols),rowCount:rows.length});
    });
    addLog(["결측값 채우기 적용"]);
  };
  const applyStrOps=(targets)=>{
    targets.forEach(d=>{
      let rows=[...d.rows];
      Object.entries(strOps).forEach(([col,ops])=>{ops.forEach(op=>{rows=rows.map(r=>{let v=String(r[col]??"");if(op==="trim")v=v.trim();if(op==="lower")v=v.toLowerCase();if(op==="upper")v=v.toUpperCase();return{...r,[col]:v};});});});
      const cols=Object.keys(rows[0]||{});
      onUpdate({...d,rows,columns:cols,colMeta:buildColMeta(rows,cols),rowCount:rows.length});
    });
    addLog(["문자열 정제 적용"]);
  };
  const applyDedup=(targets)=>{
    if(!dedupCols.length)return;
    targets.forEach(d=>{
      const seen=new Set(); const before=d.rows.length;
      const rows=d.rows.filter(r=>{const k=dedupCols.map(c=>String(r[c]??"")).join("||");if(seen.has(k))return false;seen.add(k);return true;});
      const cols=Object.keys(rows[0]||{});
      onUpdate({...d,rows,columns:cols,colMeta:buildColMeta(rows,cols),rowCount:rows.length});
      addLog([`중복 제거: ${before-rows.length}행 삭제`]);
    });
  };
  const applyDrop=(targets)=>{
    if(!dropCols.length)return;
    targets.forEach(d=>{
      const cols=d.columns.filter(c=>!dropCols.includes(c));
      const rows=d.rows.map(r=>{const nr={};cols.forEach(c=>{nr[c]=r[c];});return nr;});
      onUpdate({...d,rows,columns:cols,colMeta:buildColMeta(rows,cols),rowCount:rows.length});
    });
    addLog([`컬럼 삭제: ${dropCols.join(",")}`]);
  };
  const addLog=ops=>setLog(p=>[...p,...ops.map(o=>({ts:new Date().toLocaleTimeString(),msg:o}))]);
  const getTargets=()=>applyAll_?datasets:[ds];
  const FILL_OPT=[{id:"none",label:"그대로"},{id:"mean",label:"평균"},{id:"median",label:"중앙"},{id:"mode",label:"최빈"},{id:"custom",label:"직접입력"}];

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <DsSelector datasets={datasets} value={selId} onChange={setSelId} label="대상 파일"/>
      <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:C.txS,cursor:"pointer"}}>
        <input type="checkbox" checked={applyAll_} onChange={e=>setApplyAll_(e.target.checked)}/>
        전체 파일 공통 적용
      </label>
    </div>

    {/* ① 시작 행 지정 */}
    <Section title="① 시작 행 지정" desc="상단 불필요한 행을 스킵합니다">
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <span style={{fontSize:13,color:C.txS}}>스킵할 행 수</span>
        <input type="number" min={0} max={Math.max(0,ds.rowCount-1)} value={skipRows} onChange={e=>setSkipRows(Math.max(0,+e.target.value))} style={{width:72,fontSize:13,padding:"5px 10px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}/>
        <span style={{fontSize:12,color:C.txS}}>적용 후 {Math.max(0,ds.rowCount-skipRows).toLocaleString()}행</span>
        <Btn variant="primary" onClick={()=>applySkip(getTargets())} small>{applyAll_?"전체 파일 적용":"이 파일 적용"}</Btn>
      </div>
      {skipRows>0&&<div style={{marginTop:10,fontSize:12,color:C.txS}}>미리보기 (5행): <DataTable rows={preview.slice(0,5)} columns={ds.columns}/></div>}
    </Section>

    {/* ② 컬럼 제거 */}
    <Section title="② 컬럼 제거" desc="삭제할 컬럼을 선택합니다">
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>{ds.columns.map(c=><span key={c} onClick={()=>toggleDrop(c)} style={{fontSize:12,padding:"4px 10px",borderRadius:10,cursor:"pointer",background:dropCols.includes(c)?"#FCEBEB":C.bg,color:dropCols.includes(c)?"#A32D2D":C.txS,border:`0.5px solid ${dropCols.includes(c)?"#F09595":C.bd}`,fontFamily:"var(--font-mono)",fontWeight:dropCols.includes(c)?500:400}}>{c}{dropCols.includes(c)?" ✕":""}</span>)}</div>
      {dropCols.length>0&&<div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:12,color:"#A32D2D"}}>{dropCols.length}개 컬럼 삭제 예정</span><Btn variant="danger" onClick={()=>applyDrop(getTargets())} small>{applyAll_?"전체 파일 적용":"이 파일 적용"}</Btn></div>}
    </Section>

    {/* ③ 타입/이름 변경 */}
    <Section title="③ 컬럼 타입 변경 및 이름 변경">
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>{ds.colMeta.filter(c=>!dropCols.includes(c.name)).map(col=>{const ov=colOvr[col.name]||{};return <div key={col.name} style={{display:"grid",gridTemplateColumns:"1fr 130px 1fr",gap:8,alignItems:"center",padding:"8px 10px",background:C.bgS,borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bd}`}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:12,fontWeight:500,color:C.tx,fontFamily:"var(--font-mono)"}}>{col.name}</span><TypeBadge type={ov.type||col.type}/></div><select value={ov.type||col.type} onChange={e=>ovr(col.name,"type",e.target.value)} style={{fontSize:12,padding:"4px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}>{ALL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select><input placeholder={`이름 변경 (현재: ${col.name})`} value={ov.rename??""} onChange={e=>ovr(col.name,"rename",e.target.value)} style={{fontSize:12,padding:"4px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}/></div>;})}
      </div>
      <Btn variant="primary" onClick={()=>applyTypeRename(getTargets())} small>{applyAll_?"전체 파일 적용":"이 파일 적용"}</Btn>
    </Section>

    {/* ④ null 치환 */}
    <Section title="④ 특정 값 → null 치환" desc="쉼표로 여러 값 입력">
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>{ds.colMeta.filter(c=>!dropCols.includes(c.name)).map(col=>{const ov=colOvr[col.name]||{};return <div key={col.name} style={{display:"grid",gridTemplateColumns:"160px 1fr",gap:10,alignItems:"center",padding:"7px 10px",background:C.bgS,borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bd}`}}><span style={{fontSize:12,fontWeight:500,color:C.tx,fontFamily:"var(--font-mono)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{col.name}</span><input placeholder="예: N/A, -, 없음" value={ov._nullInput??""} onChange={e=>{ovr(col.name,"_nullInput",e.target.value);ovr(col.name,"nullValues",e.target.value.split(",").map(v=>v.trim()).filter(Boolean));}} style={{fontSize:12,padding:"4px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}/></div>;})}
      </div>
      <Btn variant="primary" onClick={()=>applyNullReplace(getTargets())} small>{applyAll_?"전체 파일 적용":"이 파일 적용"}</Btn>
    </Section>

    {/* ⑤ 결측값 처리 */}
    <Section title="⑤ 결측값 처리">
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>{ds.colMeta.filter(c=>!dropCols.includes(c.name)).map(col=>{const st=fillSt[col.name]||"none";return <div key={col.name} style={{padding:"8px 10px",background:C.bgS,borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bd}`}}><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontSize:12,fontWeight:500,color:C.tx,fontFamily:"var(--font-mono)",minWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{col.name}</span><span style={{fontSize:11,color:col.stats.nullCount>0?"#A32D2D":C.txT,background:col.stats.nullCount>0?"#FCEBEB":C.bgT,padding:"2px 6px",borderRadius:4}}>결측 {col.stats.nullCount}개</span><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{FILL_OPT.filter(o=>col.type==="number"||!["mean","median"].includes(o.id)).map(o=><span key={o.id} onClick={()=>setFillSt(p=>({...p,[col.name]:o.id}))} style={{fontSize:11,padding:"3px 8px",borderRadius:10,cursor:"pointer",background:st===o.id?C.info:C.bg,color:st===o.id?C.infoTx:C.txS,border:`0.5px solid ${st===o.id?C.infoTx:C.bd}`,fontWeight:st===o.id?500:400}}>{o.label}</span>)}</div></div>{st==="custom"&&<input placeholder="채울 값" value={fillCus[col.name]||""} onChange={e=>setFillCus(p=>({...p,[col.name]:e.target.value}))} style={{marginTop:6,width:"100%",fontSize:12,padding:"4px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx,boxSizing:"border-box"}}/>}</div>;})}
      </div>
      <Btn variant="primary" onClick={()=>applyFill(getTargets())} small>{applyAll_?"전체 파일 적용":"이 파일 적용"}</Btn>
    </Section>

    {/* ⑥ 문자열 정제 */}
    <Section title="⑥ 문자열 정제">
      {ds.colMeta.filter(c=>["text","category"].includes(c.type)&&!dropCols.includes(c.name)).length===0?<div style={{fontSize:13,color:C.txT}}>텍스트/범주형 컬럼이 없습니다.</div>:<><div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>{ds.colMeta.filter(c=>["text","category"].includes(c.type)&&!dropCols.includes(c.name)).map(col=>{const ops=strOps[col.name]||[];return <div key={col.name} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:C.bgS,borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bd}`}}><span style={{fontSize:12,fontWeight:500,color:C.tx,fontFamily:"var(--font-mono)",minWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{col.name}</span>{[{id:"trim",label:"공백제거"},{id:"lower",label:"소문자"},{id:"upper",label:"대문자"}].map(op=><span key={op.id} onClick={()=>toggleStr(col.name,op.id)} style={{fontSize:11,padding:"3px 8px",borderRadius:10,cursor:"pointer",background:ops.includes(op.id)?C.success:C.bg,color:ops.includes(op.id)?C.successTx:C.txS,border:`0.5px solid ${ops.includes(op.id)?C.successTx:C.bd}`,fontWeight:ops.includes(op.id)?500:400}}>{op.label}</span>)}</div>;})}
      </div><Btn variant="primary" onClick={()=>applyStrOps(getTargets())} small>{applyAll_?"전체 파일 적용":"이 파일 적용"}</Btn></>}
    </Section>

    {/* ⑦ 중복 제거 */}
    <Section title="⑦ 중복 행 제거" desc="선택 컬럼 기준으로 중복 제거">
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>{ds.columns.filter(c=>!dropCols.includes(c)).map(c=><span key={c} onClick={()=>toggleDedup(c)} style={{fontSize:12,padding:"4px 10px",borderRadius:10,cursor:"pointer",background:dedupCols.includes(c)?"#E1F5EE":C.bg,color:dedupCols.includes(c)?"#085041":C.txS,border:`0.5px solid ${dedupCols.includes(c)?"#0F6E56":C.bd}`,fontFamily:"var(--font-mono)",fontWeight:dedupCols.includes(c)?500:400}}>{c}</span>)}</div>
      <Btn variant="success" onClick={()=>applyDedup(getTargets())} disabled={!dedupCols.length} small>{applyAll_?"전체 파일 적용":"이 파일 적용"}</Btn>
    </Section>

    {/* 로그 */}
    {log.length>0&&<div style={{marginTop:12,background:C.bgS,borderRadius:"var(--border-radius-md)",padding:"10px 14px",border:`0.5px solid ${C.bd}`}}><div style={{fontSize:12,fontWeight:500,color:C.txS,marginBottom:6}}>적용 로그</div>{log.slice().reverse().map((e,i)=><div key={i} style={{fontSize:12,color:C.tx,display:"flex",gap:10,marginBottom:3}}><span style={{color:C.txT,fontFamily:"var(--font-mono)",whiteSpace:"nowrap"}}>{e.ts}</span><span>{e.msg}</span></div>)}</div>}
  </div>;
}

// ── Viz Tab ───────────────────────────────────────────────────────────────────
function getNumCols(ds){return ds.colMeta.filter(c=>c.type==="number");}
function getCatCols(ds){return ds.colMeta.filter(c=>c.type==="category");}
function NoData(){return <div style={{padding:32,textAlign:"center",color:C.txT,fontSize:13}}>데이터 없음</div>;}
function ChartCard({title,subtitle,children}){return <div style={{border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-lg)",overflow:"hidden",marginBottom:14}}><div style={{padding:"10px 14px",background:C.bgS,borderBottom:`0.5px solid ${C.bd}`}}><div style={{fontSize:13,fontWeight:500,color:C.tx}}>{title}</div>{subtitle&&<div style={{fontSize:11,color:C.txS,marginTop:2}}>{subtitle}</div>}</div><div style={{padding:"14px 14px 10px"}}>{children}</div></div>;}
function HistChart({ds,col}){
  const vals=ds.rows.map(r=>parseFloat(r[col])).filter(v=>!isNaN(v));
  if(!vals.length)return <NoData/>;
  const mn=Math.min(...vals),mx=Math.max(...vals),w=(mx-mn)/20||1;
  const counts=Array.from({length:20},(_,i)=>({x:+(mn+i*w).toFixed(2),count:0}));
  vals.forEach(v=>{counts[Math.min(Math.floor((v-mn)/w),19)].count++;});
  return <ResponsiveContainer width="100%" height={220}><BarChart data={counts} margin={{top:4,right:8,left:0,bottom:20}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd}/><XAxis dataKey="x" tick={{fontSize:10,fill:C.txS}} label={{value:col,position:"insideBottom",offset:-14,fontSize:10,fill:C.txS}}/><YAxis tick={{fontSize:10,fill:C.txS}}/><Tooltip formatter={v=>[v,"빈도"]} contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Bar dataKey="count" fill="#378ADD" radius={[2,2,0,0]}/></BarChart></ResponsiveContainer>;
}
function BarFreq({ds,col,topN=12}){
  const freq={};ds.rows.forEach(r=>{const v=String(r[col]??"");freq[v]=(freq[v]||0)+1;});
  const data=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,topN).map(([name,value])=>({name,value}));
  if(!data.length)return <NoData/>;
  return <ResponsiveContainer width="100%" height={Math.max(180,data.length*26)}><BarChart data={data} layout="vertical" margin={{top:4,right:36,left:8,bottom:4}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false}/><XAxis type="number" tick={{fontSize:10,fill:C.txS}}/><YAxis type="category" dataKey="name" tick={{fontSize:10,fill:C.txS}} width={90}/><Tooltip contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Bar dataKey="value" name="빈도" radius={[0,3,3,0]}>{data.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Bar></BarChart></ResponsiveContainer>;
}
function PieFreq({ds,col}){
  const freq={};ds.rows.forEach(r=>{const v=String(r[col]??"");freq[v]=(freq[v]||0)+1;});
  const sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]);
  const top=sorted.slice(0,8);const other=sorted.slice(8).reduce((a,[,c])=>a+c,0);
  const data=[...top.map(([n,v])=>({name:n,value:v})),...(other>0?[{name:"기타",value:other}]:[])];
  if(!data.length)return <NoData/>;
  const R=Math.PI/180;
  const lbl=({cx,cy,midAngle,innerRadius,outerRadius,percent})=>{if(percent<0.04)return null;const r=innerRadius+(outerRadius-innerRadius)*0.55;return <text x={cx+r*Math.cos(-midAngle*R)} y={cy+r*Math.sin(-midAngle*R)} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11}>{`${(percent*100).toFixed(0)}%`}</text>;};
  return <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data} cx="50%" cy="50%" outerRadius={100} dataKey="value" labelLine={false} label={lbl}>{data.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Pie><Tooltip formatter={(v,n)=>[v.toLocaleString(),n]} contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Legend iconSize={10} wrapperStyle={{fontSize:11}}/></PieChart></ResponsiveContainer>;
}
function ScatterPlot({ds,xCol,yCol}){
  const data=ds.rows.map(r=>({x:parseFloat(r[xCol]),y:parseFloat(r[yCol])})).filter(p=>!isNaN(p.x)&&!isNaN(p.y)).slice(0,1000);
  if(!data.length)return <NoData/>;
  const n=data.length,sx=data.reduce((a,p)=>a+p.x,0)/n,sy=data.reduce((a,p)=>a+p.y,0)/n;
  const num=data.reduce((a,p)=>a+(p.x-sx)*(p.y-sy),0),den=Math.sqrt(data.reduce((a,p)=>a+(p.x-sx)**2,0)*data.reduce((a,p)=>a+(p.y-sy)**2,0));
  const r=den?+(num/den).toFixed(3):0;
  return <div><div style={{fontSize:11,color:C.txS,marginBottom:6}}>상관계수(r): <strong style={{color:Math.abs(r)>0.7?"#1D9E75":Math.abs(r)>0.4?"#BA7517":C.tx}}>{r}</strong> · {data.length>=1000?"최대 1,000개 표시":`${data.length}개`}</div><ResponsiveContainer width="100%" height={260}><ScatterChart margin={{top:4,right:8,left:0,bottom:20}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd}/><XAxis type="number" dataKey="x" name={xCol} tick={{fontSize:10,fill:C.txS}} label={{value:xCol,position:"insideBottom",offset:-14,fontSize:10,fill:C.txS}}/><YAxis type="number" dataKey="y" name={yCol} tick={{fontSize:10,fill:C.txS}}/><Tooltip content={({payload})=>payload?.length?<div style={{background:C.bg,border:`0.5px solid ${C.bd}`,borderRadius:6,padding:"5px 8px",fontSize:11}}><div>{xCol}: {payload[0]?.payload?.x}</div><div>{yCol}: {payload[0]?.payload?.y}</div></div>:null}/><Scatter data={data} fill="#378ADD" fillOpacity={0.5} r={3}/></ScatterChart></ResponsiveContainer></div>;
}
function LineChart_({ds,xCol,yCol}){
  const data=ds.rows.map(r=>({x:String(r[xCol]??""),y:parseFloat(r[yCol])})).filter(p=>p.x&&!isNaN(p.y)).sort((a,b)=>a.x.localeCompare(b.x)).slice(0,500);
  if(!data.length)return <NoData/>;
  return <ResponsiveContainer width="100%" height={260}><LineChart data={data} margin={{top:4,right:8,left:0,bottom:24}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd}/><XAxis dataKey="x" tick={{fontSize:10,fill:C.txS}} interval="preserveStartEnd" label={{value:xCol,position:"insideBottom",offset:-16,fontSize:10,fill:C.txS}}/><YAxis tick={{fontSize:10,fill:C.txS}}/><Tooltip contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Line type="monotone" dataKey="y" name={yCol} stroke="#185FA5" dot={false} strokeWidth={2}/></LineChart></ResponsiveContainer>;
}
function GroupedBar({ds,catCol,numCol,topN=12}){
  const agg={};ds.rows.forEach(r=>{const k=String(r[catCol]??"");const v=parseFloat(r[numCol]);if(!isNaN(v)){if(!agg[k])agg[k]={sum:0,count:0};agg[k].sum+=v;agg[k].count++;}});
  const data=Object.entries(agg).map(([name,{sum,count}])=>({name,avg:+(sum/count).toFixed(3)})).sort((a,b)=>b.avg-a.avg).slice(0,topN);
  if(!data.length)return <NoData/>;
  return <ResponsiveContainer width="100%" height={Math.max(180,data.length*26)}><BarChart data={data} layout="vertical" margin={{top:4,right:40,left:8,bottom:4}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false}/><XAxis type="number" tick={{fontSize:10,fill:C.txS}}/><YAxis type="category" dataKey="name" tick={{fontSize:10,fill:C.txS}} width={90}/><Tooltip contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Bar dataKey="avg" name={`${numCol} 평균`} radius={[0,3,3,0]}>{data.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Bar></BarChart></ResponsiveContainer>;
}
function CorrHeatmap({ds}){
  const numCols=getNumCols(ds).map(c=>c.name).slice(0,10);
  if(numCols.length<2)return <div style={{padding:24,textAlign:"center",color:C.txT,fontSize:13}}>숫자형 컬럼 2개 이상 필요</div>;
  const vals={};numCols.forEach(c=>{vals[c]=ds.rows.map(r=>parseFloat(r[c])).filter(v=>!isNaN(v));});
  const mean=arr=>arr.reduce((a,b)=>a+b,0)/arr.length;
  const corr=(a,b)=>{const ma=mean(a),mb=mean(b),num=a.reduce((s,v,i)=>s+(v-ma)*(b[i]-mb),0),den=Math.sqrt(a.reduce((s,v)=>s+(v-ma)**2,0)*b.reduce((s,v)=>s+(v-mb)**2,0));return den?+(num/den).toFixed(2):0;};
  const matrix=numCols.map(c1=>numCols.map(c2=>{const ml=Math.min(vals[c1].length,vals[c2].length);return corr(vals[c1].slice(0,ml),vals[c2].slice(0,ml));}));
  const cs=Math.min(60,Math.floor(540/numCols.length));
  const clr=v=>v>=0?`rgba(24,95,165,${0.1+Math.abs(v)*0.85})`:`rgba(216,90,48,${0.1+Math.abs(v)*0.85})`;
  return <div style={{overflowX:"auto"}}><div style={{display:"inline-block"}}><div style={{display:"flex",marginLeft:cs+4}}>{numCols.map(c=><div key={c} style={{width:cs,fontSize:9,color:C.txS,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",transform:"rotate(-30deg)",transformOrigin:"bottom left",marginBottom:4,height:38}}>{c}</div>)}</div>{matrix.map((row,i)=><div key={i} style={{display:"flex",alignItems:"center",marginBottom:2}}><div style={{width:cs,fontSize:9,color:C.txS,textAlign:"right",paddingRight:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flexShrink:0}}>{numCols[i]}</div>{row.map((v,j)=><div key={j} title={`${numCols[i]}×${numCols[j]}: ${v}`} style={{width:cs,height:cs,background:clr(v),display:"flex",alignItems:"center",justifyContent:"center",fontSize:cs>44?10:8,fontWeight:500,color:Math.abs(v)>0.5?"#fff":C.tx,borderRadius:2,margin:1,cursor:"default",flexShrink:0}}>{v}</div>)}</div>)}</div></div>;
}
function MissingChart({ds}){
  const data=ds.colMeta.filter(c=>c.stats.nullCount>0).map(c=>({name:c.name,pct:+((c.stats.nullCount/ds.rowCount)*100).toFixed(1),missing:c.stats.nullCount})).sort((a,b)=>b.pct-a.pct);
  if(!data.length)return <div style={{padding:24,textAlign:"center",color:C.successTx,fontSize:13}}>결측값 없음</div>;
  return <ResponsiveContainer width="100%" height={Math.max(160,data.length*28)}><BarChart data={data} layout="vertical" margin={{top:4,right:40,left:8,bottom:4}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false}/><XAxis type="number" tickFormatter={v=>`${v}%`} tick={{fontSize:10,fill:C.txS}} domain={[0,100]}/><YAxis type="category" dataKey="name" tick={{fontSize:10,fill:C.txS}} width={100}/><Tooltip formatter={(v,n,p)=>[`${p.payload?.missing?.toLocaleString()}개 (${p.payload?.pct}%)`,""]} contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Bar dataKey="pct" radius={[0,3,3,0]}>{data.map((d,i)=><Cell key={i} fill={d.pct>30?"#E24B4A":d.pct>10?"#EF9F27":"#F09595"}/>)}</Bar></BarChart></ResponsiveContainer>;
}
// ── Custom chart components ───────────────────────────────────────────────────
function aggData(rows, col, numCol, mode) {
  const freq = {};
  rows.forEach(r => {
    const k = String(r[col] ?? "");
    if (!freq[k]) freq[k] = { vals: [], count: 0 };
    freq[k].count++;
    const v = numCol ? parseFloat(r[numCol]) : NaN;
    if (!isNaN(v)) freq[k].vals.push(v);
  });
  return Object.entries(freq).map(([name, { vals, count }]) => {
    let value = count;
    if (mode === "sum") value = vals.reduce((a, b) => a + b, 0);
    else if (mode === "mean") value = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3) : 0;
    else if (mode === "max") value = vals.length ? Math.max(...vals) : 0;
    else if (mode === "min") value = vals.length ? Math.min(...vals) : 0;
    return { name, value: +value.toFixed ? +value.toFixed(3) : value };
  }).sort((a, b) => b.value - a.value).slice(0, 15);
}

const CL = ["label", { position: "insideRight", offset: -4, fontSize: 10, fill: "#fff" }];

function CustomBarChart({ ds, col, mode, barStyle, showLabel }) {
  const data = aggData(ds.rows, col, mode !== "count" ? null : null, mode);
  if (!data.length) return <NoData />;
  if (barStyle === "stacked" || barStyle === "group") {
    const top5 = data.slice(0, 5);
    // stacked/group by top categories: each row is a "group" col value, bars = top5 categories
    const allCats = [...new Set(ds.rows.map(r => String(r[col] ?? "")))].slice(0, 6);
    const pivotData = allCats.map(cat => {
      const obj = { name: cat };
      allCats.forEach(c2 => { obj[c2] = ds.rows.filter(r => String(r[col] ?? "") === c2).length; });
      return { name: cat, value: ds.rows.filter(r => String(r[col] ?? "") === cat).length };
    });
    return (
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: showLabel ? 60 : 36, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={90} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
          <Bar dataKey="value" name={mode} radius={[0, 3, 3, 0]} label={showLabel ? { position: "right", fontSize: 10, fill: C.txS } : false}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: showLabel ? 60 : 36, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={90} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Bar dataKey="value" name={mode} radius={[0, 3, 3, 0]} label={showLabel ? { position: "right", fontSize: 10, fill: C.txS } : false}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CustomGroupedBar({ ds, catCol, numCol, mode, showLabel }) {
  const data = aggData(ds.rows, catCol, numCol, mode || "mean");
  if (!data.length) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: showLabel ? 60 : 40, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={90} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} formatter={v => [v, mode]} />
        <Bar dataKey="value" name={mode} radius={[0, 3, 3, 0]} label={showLabel ? { position: "right", fontSize: 10, fill: C.txS } : false}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CustomPieChart({ ds, col, donut }) {
  const freq = {};
  ds.rows.forEach(r => { const v = String(r[col] ?? ""); freq[v] = (freq[v] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 8);
  const other = sorted.slice(8).reduce((a, [, c]) => a + c, 0);
  const data = [...top.map(([n, v]) => ({ name: n, value: v })), ...(other > 0 ? [{ name: "기타", value: other }] : [])];
  if (!data.length) return <NoData />;
  const R = Math.PI / 180;
  const lbl = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
    if (percent < 0.04) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    return <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11}>{`${(percent * 100).toFixed(0)}%`}</text>;
  };
  return (
    <ResponsiveContainer width="100%" height={270}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={110} innerRadius={donut ? 50 : 0} dataKey="value" labelLine={false} label={lbl}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip formatter={(v, n) => [v.toLocaleString(), n]} contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function CustomHistChart({ ds, col, hueCol }) {
  const allVals = ds.rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
  if (!allVals.length) return <NoData />;
  const mn = Math.min(...allVals), mx = Math.max(...allVals), w = (mx - mn) / 20 || 1;
  if (!hueCol) {
    const counts = Array.from({ length: 20 }, (_, i) => ({ x: +(mn + i * w).toFixed(2), count: 0 }));
    allVals.forEach(v => { counts[Math.min(Math.floor((v - mn) / w), 19)].count++; });
    return (
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={counts} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
          <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.txS }} label={{ value: col, position: "insideBottom", offset: -14, fontSize: 10, fill: C.txS }} />
          <YAxis tick={{ fontSize: 10, fill: C.txS }} />
          <Tooltip formatter={v => [v, "빈도"]} contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
          <Bar dataKey="count" fill="#378ADD" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  // Hue mode: multiple lines
  const hueVals = [...new Set(ds.rows.map(r => String(r[hueCol] ?? "")))].slice(0, 6);
  const binData = Array.from({ length: 20 }, (_, i) => {
    const obj = { x: +(mn + i * w).toFixed(2) };
    hueVals.forEach(hv => { obj[hv] = 0; });
    return obj;
  });
  ds.rows.forEach(r => {
    const v = parseFloat(r[col]); if (isNaN(v)) return;
    const hv = String(r[hueCol] ?? ""); if (!hueVals.includes(hv)) return;
    binData[Math.min(Math.floor((v - mn) / w), 19)][hv]++;
  });
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={binData} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
        <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.txS }} label={{ value: col, position: "insideBottom", offset: -14, fontSize: 10, fill: C.txS }} />
        <YAxis tick={{ fontSize: 10, fill: C.txS }} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {hueVals.map((hv, i) => <Bar key={hv} dataKey={hv} stackId="a" fill={PALETTE[i % PALETTE.length]} radius={i === hueVals.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

function CustomScatterChart({ ds, xCol, yCol, hueCol }) {
  const hueVals = hueCol ? [...new Set(ds.rows.map(r => String(r[hueCol] ?? "")))].slice(0, 8) : ["all"];
  const getRows = hv => ds.rows.filter(r => !hueCol || String(r[hueCol] ?? "") === hv).map(r => ({ x: parseFloat(r[xCol]), y: parseFloat(r[yCol]) })).filter(p => !isNaN(p.x) && !isNaN(p.y)).slice(0, 400);
  const n = ds.rows.length;
  const sx = ds.rows.map(r => parseFloat(r[xCol])).filter(v => !isNaN(v));
  const sy = ds.rows.map(r => parseFloat(r[yCol])).filter(v => !isNaN(v));
  const mxv = sx.reduce((a, b) => a + b, 0) / sx.length, myv = sy.reduce((a, b) => a + b, 0) / sy.length;
  const num = sx.reduce((s, v, i) => s + (v - mxv) * ((sy[i] || 0) - myv), 0);
  const den = Math.sqrt(sx.reduce((s, v) => s + (v - mxv) ** 2, 0) * sy.reduce((s, v) => s + (v - myv) ** 2, 0));
  const r = den ? +(num / den).toFixed(3) : 0;
  return (
    <div>
      <div style={{ fontSize: 11, color: C.txS, marginBottom: 6 }}>상관계수 r = <strong style={{ color: Math.abs(r) > 0.7 ? "#1D9E75" : Math.abs(r) > 0.4 ? "#BA7517" : C.tx }}>{r}</strong></div>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
          <XAxis type="number" dataKey="x" name={xCol} tick={{ fontSize: 10, fill: C.txS }} label={{ value: xCol, position: "insideBottom", offset: -14, fontSize: 10, fill: C.txS }} />
          <YAxis type="number" dataKey="y" name={yCol} tick={{ fontSize: 10, fill: C.txS }} />
          <Tooltip content={({ payload }) => payload?.length ? <div style={{ background: C.bg, border: `0.5px solid ${C.bd}`, borderRadius: 6, padding: "5px 8px", fontSize: 11 }}>{hueCol && <div>{hueCol}: {payload[0]?.payload?.hue}</div>}<div>{xCol}: {payload[0]?.payload?.x}</div><div>{yCol}: {payload[0]?.payload?.y}</div></div> : null} />
          {hueVals.map((hv, i) => <Scatter key={hv} name={hv === "all" ? `${xCol} × ${yCol}` : hv} data={getRows(hv).map(p => ({ ...p, hue: hv }))} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.55} r={3} />)}
          {hueCol && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomLineChart({ ds, xCol, yCol, hueCol }) {
  if (!hueCol) {
    const data = ds.rows.map(r => ({ x: String(r[xCol] ?? ""), y: parseFloat(r[yCol]) })).filter(p => p.x && !isNaN(p.y)).sort((a, b) => a.x.localeCompare(b.x)).slice(0, 500);
    if (!data.length) return <NoData />;
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
          <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.txS }} interval="preserveStartEnd" label={{ value: xCol, position: "insideBottom", offset: -16, fontSize: 10, fill: C.txS }} />
          <YAxis tick={{ fontSize: 10, fill: C.txS }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
          <Line type="monotone" dataKey="y" name={yCol} stroke="#185FA5" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  const hueVals = [...new Set(ds.rows.map(r => String(r[hueCol] ?? "")))].slice(0, 6);
  const xVals = [...new Set(ds.rows.map(r => String(r[xCol] ?? "")))].sort().slice(0, 100);
  const data = xVals.map(x => {
    const obj = { x };
    hueVals.forEach(hv => {
      const rows = ds.rows.filter(r => String(r[xCol] ?? "") === x && String(r[hueCol] ?? "") === hv);
      const vals = rows.map(r => parseFloat(r[yCol])).filter(v => !isNaN(v));
      obj[hv] = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3) : null;
    });
    return obj;
  });
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
        <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.txS }} interval="preserveStartEnd" label={{ value: xCol, position: "insideBottom", offset: -16, fontSize: 10, fill: C.txS }} />
        <YAxis tick={{ fontSize: 10, fill: C.txS }} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {hueVals.map((hv, i) => <Line key={hv} type="monotone" dataKey={hv} stroke={PALETTE[i % PALETTE.length]} dot={false} strokeWidth={2} connectNulls />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

function CustomBoxPlot({ ds, col, groupCol }) {
  const calcBox = vals => {
    if (!vals.length) return null;
    const s = [...vals].sort((a, b) => a - b);
    const q1 = s[Math.floor(s.length * 0.25)];
    const median = s[Math.floor(s.length * 0.5)];
    const q3 = s[Math.floor(s.length * 0.75)];
    const iqr = q3 - q1;
    const lo = Math.max(s[0], q1 - 1.5 * iqr);
    const hi = Math.min(s[s.length - 1], q3 + 1.5 * iqr);
    return { lo, q1, median, q3, hi, min: s[0], max: s[s.length - 1] };
  };
  const groups = groupCol
    ? [...new Set(ds.rows.map(r => String(r[groupCol] ?? "")))].slice(0, 12)
    : ["전체"];
  const data = groups.map(g => {
    const vals = ds.rows.filter(r => !groupCol || String(r[groupCol] ?? "") === g).map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    const box = calcBox(vals);
    if (!box) return null;
    return { name: g, lo: +box.lo.toFixed(3), q1: +(box.q1 - box.lo).toFixed(3), med: +(box.median - box.q1).toFixed(3), q3: +(box.q3 - box.median).toFixed(3), hi: +(box.hi - box.q3).toFixed(3), _q1: box.q1, _med: box.median, _q3: box.q3, _lo: box.lo, _hi: box.hi };
  }).filter(Boolean);
  if (!data.length) return <NoData />;
  return (
    <div>
      <div style={{ fontSize: 11, color: C.txS, marginBottom: 6 }}>박스: Q1~Q3 범위 · 선: 중앙값 · 수염: 1.5×IQR</div>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 50, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={80} />
          <Tooltip content={({ payload, label }) => payload?.length ? <div style={{ background: C.bg, border: `0.5px solid ${C.bd}`, borderRadius: 6, padding: "7px 10px", fontSize: 11 }}><div style={{ fontWeight: 500, marginBottom: 4 }}>{label}</div><div>최솟값: {payload[0]?.payload?._lo}</div><div>Q1: {payload[0]?.payload?._q1}</div><div>중앙값: {payload[0]?.payload?._med}</div><div>Q3: {payload[0]?.payload?._q3}</div><div>최댓값: {payload[0]?.payload?._hi}</div></div> : null} />
          <Bar dataKey="lo" stackId="box" fill="transparent" />
          <Bar dataKey="q1" stackId="box" fill="#B5D4F4" name="Q1-Q3" />
          <Bar dataKey="med" stackId="box" fill="#185FA5" name="중앙값" />
          <Bar dataKey="q3" stackId="box" fill="#B5D4F4" />
          <Bar dataKey="hi" stackId="box" fill="transparent" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}


function VizTab({allDs}) {
  const [selId,setSelId]=useState(()=>allDs[0]?.id??"");
  const [sec,setSec]=useState("auto");
  const [ct,setCt]=useState("bar"); const [xCol,setXCol]=useState(""); const [yCol,setYCol]=useState("");
  const [xCol2,setXCol2]=useState(""); const [yCol2,setYCol2]=useState("");
  const [catCol,setCatCol]=useState(""); const [numCol,setNumCol]=useState("");
  const [hueCol,setHueCol]=useState(""); const [barMode,setBarMode]=useState("count");
  const [barStyle,setBarStyle]=useState("normal"); const [donut,setDonut]=useState(false);
  const [showLabel,setShowLabel]=useState(false);
  const ds=allDs.find(d=>d.id===selId);
  const pId=useRef(selId); if(pId.current!==selId){pId.current=selId;setXCol("");setYCol("");setXCol2("");setYCol2("");setCatCol("");setNumCol("");}
  if(!ds)return <div style={{padding:48,textAlign:"center",color:C.txT}}>파일을 업로드해 주세요.</div>;
  const numCols=getNumCols(ds),catCols=getCatCols(ds);
  const SECS=[{id:"auto",label:"자동"},{id:"dist",label:"분포"},{id:"cat",label:"범주형"},{id:"corr",label:"상관관계"},{id:"missing",label:"결측값"},{id:"custom",label:"커스텀"}];
  const CTYPES=[{id:"bar",label:"막대",desc:"범주×빈도"},{id:"pie",label:"파이",desc:"비율"},{id:"hist",label:"히스토그램",desc:"숫자분포"},{id:"scatter",label:"산점도",desc:"숫자×숫자"},{id:"line",label:"라인",desc:"추세"},{id:"grouped",label:"그룹막대",desc:"범주별평균"}];
  return <div>
    <DsSelector datasets={allDs} value={selId} onChange={setSelId} label="데이터셋"/>
    <div style={{display:"flex",gap:2,marginBottom:18,borderBottom:`0.5px solid ${C.bd}`,overflowX:"auto"}}>{SECS.map(s=><button key={s.id} onClick={()=>setSec(s.id)} style={{fontSize:12,padding:"8px 13px",cursor:"pointer",background:"transparent",border:"none",borderBottom:sec===s.id?`2px solid ${C.infoTx}`:"2px solid transparent",color:sec===s.id?C.infoTx:C.txS,fontWeight:sec===s.id?500:400,whiteSpace:"nowrap",marginBottom:-0.5}}>{s.label}</button>)}</div>

    {sec==="auto"&&<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:16}}>{[["전체 행",ds.rowCount.toLocaleString()],["숫자형",numCols.length],["범주형",catCols.length],["날짜형",ds.colMeta.filter(c=>c.type==="date").length]].map(([l,v])=><div key={l} style={{background:C.bgS,borderRadius:"var(--border-radius-md)",padding:"10px 12px"}}><div style={{fontSize:11,color:C.txS,marginBottom:2}}>{l}</div><div style={{fontSize:18,fontWeight:500,color:C.tx,fontFamily:"var(--font-mono)"}}>{v}</div></div>)}</div>
      {numCols.length>0&&<ChartCard title="숫자형 분포" subtitle={numCols.slice(0,4).map(c=>c.name).join(" · ")}><div style={{display:"grid",gridTemplateColumns:numCols.length>1?"1fr 1fr":"1fr",gap:14}}>{numCols.slice(0,4).map(col=><div key={col.name}><div style={{fontSize:11,color:C.txS,marginBottom:3,fontFamily:"var(--font-mono)"}}>{col.name}</div><HistChart ds={ds} col={col.name}/></div>)}</div></ChartCard>}
      {catCols.length>0&&<ChartCard title="범주형 분포" subtitle={catCols.slice(0,2).map(c=>c.name).join(" · ")}><div style={{display:"grid",gridTemplateColumns:catCols.length>1?"1fr 1fr":"1fr",gap:16}}>{catCols.slice(0,2).map(col=><div key={col.name}><div style={{fontSize:11,color:C.txS,marginBottom:3,fontFamily:"var(--font-mono)"}}>{col.name}</div><BarFreq ds={ds} col={col.name} topN={7}/></div>)}</div></ChartCard>}
      {numCols.length>=2&&<ChartCard title="상관관계 히트맵"><CorrHeatmap ds={ds}/></ChartCard>}
      {ds.colMeta.some(c=>c.stats.nullCount>0)&&<ChartCard title="결측값 현황"><MissingChart ds={ds}/></ChartCard>}
      {catCols.length>0&&numCols.length>0&&<ChartCard title={`${catCols[0].name} 별 ${numCols[0].name} 평균`}><GroupedBar ds={ds} catCol={catCols[0].name} numCol={numCols[0].name}/></ChartCard>}
    </div>}

    {sec==="dist"&&<div>{numCols.length===0?<div style={{padding:40,textAlign:"center",color:C.txT}}>숫자형 컬럼 없음</div>:numCols.map(col=><ChartCard key={col.name} title={`분포: ${col.name}`} subtitle={`평균 ${col.stats.mean} · 중앙 ${col.stats.median} · 표준편차 ${col.stats.std}`}><HistChart ds={ds} col={col.name}/></ChartCard>)}</div>}

    {sec==="cat"&&<div>{catCols.length===0?<div style={{padding:40,textAlign:"center",color:C.txT}}>범주형 컬럼 없음</div>:catCols.map(col=><ChartCard key={col.name} title={`범주: ${col.name}`} subtitle={`고유값 ${col.stats.unique}개`}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}><div><div style={{fontSize:11,color:C.txS,marginBottom:4}}>막대</div><BarFreq ds={ds} col={col.name}/></div><div><div style={{fontSize:11,color:C.txS,marginBottom:4}}>파이</div><PieFreq ds={ds} col={col.name}/></div></div></ChartCard>)}</div>}

    {sec==="corr"&&<div><ChartCard title="상관관계 히트맵" subtitle="피어슨 상관계수 (-1~1)"><CorrHeatmap ds={ds}/></ChartCard>{numCols.length>=2&&<ChartCard title="산점도"><div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}><div style={{flex:1,minWidth:130}}><div style={{fontSize:12,color:C.txS,marginBottom:4}}>X축</div><select value={xCol2} onChange={e=>setXCol2(e.target.value)} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}><option value="">— 선택 —</option>{numCols.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></div><div style={{flex:1,minWidth:130}}><div style={{fontSize:12,color:C.txS,marginBottom:4}}>Y축</div><select value={yCol2} onChange={e=>setYCol2(e.target.value)} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}><option value="">— 선택 —</option>{numCols.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></div></div>{xCol2&&yCol2&&xCol2!==yCol2?<ScatterPlot ds={ds} xCol={xCol2} yCol={yCol2}/>:<div style={{padding:24,textAlign:"center",color:C.txT,fontSize:13}}>서로 다른 두 컬럼을 선택해 주세요.</div>}</ChartCard>}</div>}

    {sec==="missing"&&<ChartCard title="결측값 현황"><MissingChart ds={ds}/></ChartCard>}

{sec==="custom"&&<div>
      <div style={{border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-lg)",overflow:"hidden",marginBottom:14}}>
        <div style={{padding:"11px 14px",background:C.bgS,borderBottom:`0.5px solid ${C.bd}`}}><span style={{fontSize:13,fontWeight:500,color:C.tx}}>차트 유형 & 컬럼 선택</span></div>
        <div style={{padding:14}}>
          {/* 차트 유형 */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:14}}>
            {[{id:"bar",label:"막대",desc:"누적/그룹 선택가능"},{id:"pie",label:"파이/도넛",desc:"비율"},{id:"hist",label:"히스토그램",desc:"분포+Hue"},{id:"scatter",label:"산점도",desc:"숫자×숫자+Hue"},{id:"line",label:"라인",desc:"추세+Hue"},{id:"grouped",label:"그룹막대",desc:"범주별집계"},{id:"box",label:"박스플롯",desc:"분포+이상치"}].map(t=><div key={t.id} onClick={()=>{setCt(t.id);setXCol("");setYCol("");setCatCol("");setNumCol("");setHueCol("");setBarMode("count");setBarStyle("normal");setDonut(false);}} style={{padding:"8px 10px",borderRadius:"var(--border-radius-md)",border:`${ct===t.id?"2px solid #185FA5":`0.5px solid ${C.bd}`}`,cursor:"pointer",background:ct===t.id?"#E6F1FB":C.bg}}><div style={{fontSize:12,fontWeight:500,color:ct===t.id?"#185FA5":C.tx}}>{t.label}</div><div style={{fontSize:10,color:C.txS}}>{t.desc}</div></div>)}
          </div>

          {/* 컬럼 선택 */}
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
            {(ct==="bar"||ct==="pie")&&<div style={{flex:1,minWidth:130}}><div style={{fontSize:12,color:C.txS,marginBottom:4}}>범주 컬럼</div><select value={catCol} onChange={e=>setCatCol(e.target.value)} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}><option value="">— 선택 —</option>{[...catCols,...numCols].map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></div>}
            {ct==="hist"&&<div style={{flex:1,minWidth:130}}><div style={{fontSize:12,color:C.txS,marginBottom:4}}>숫자 컬럼</div><select value={xCol} onChange={e=>setXCol(e.target.value)} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}><option value="">— 선택 —</option>{numCols.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></div>}
            {(ct==="scatter"||ct==="line"||ct==="box")&&<><div style={{flex:1,minWidth:120}}><div style={{fontSize:12,color:C.txS,marginBottom:4}}>{ct==="box"?"숫자 컬럼":"X축"}</div><select value={xCol} onChange={e=>setXCol(e.target.value)} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}><option value="">— 선택 —</option>{(ct==="line"?ds.columns.map(c=>({name:c})):numCols).map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></div>{ct!=="box"&&<div style={{flex:1,minWidth:120}}><div style={{fontSize:12,color:C.txS,marginBottom:4}}>Y축</div><select value={yCol} onChange={e=>setYCol(e.target.value)} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}><option value="">— 선택 —</option>{numCols.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></div>}</>}
            {ct==="grouped"&&<><div style={{flex:1,minWidth:120}}><div style={{fontSize:12,color:C.txS,marginBottom:4}}>범주</div><select value={catCol} onChange={e=>setCatCol(e.target.value)} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}><option value="">— 선택 —</option>{catCols.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></div><div style={{flex:1,minWidth:120}}><div style={{fontSize:12,color:C.txS,marginBottom:4}}>숫자</div><select value={numCol} onChange={e=>setNumCol(e.target.value)} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}><option value="">— 선택 —</option>{numCols.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></div></>}
            {/* Hue 컬럼 (hist/scatter/line) */}
            {(ct==="hist"||ct==="scatter"||ct==="line")&&<div style={{flex:1,minWidth:120}}><div style={{fontSize:12,color:C.txS,marginBottom:4}}>Hue (색상 구분)</div><select value={hueCol} onChange={e=>setHueCol(e.target.value)} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}><option value="">— 없음 —</option>{[...catCols,...numCols.slice(0,3)].map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></div>}
            {/* Box: 그룹 컬럼 */}
            {ct==="box"&&<div style={{flex:1,minWidth:120}}><div style={{fontSize:12,color:C.txS,marginBottom:4}}>그룹 컬럼 (선택)</div><select value={catCol} onChange={e=>setCatCol(e.target.value)} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}><option value="">— 전체 —</option>{catCols.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></div>}
          </div>

          {/* 옵션 행 */}
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            {/* 막대: 스타일 */}
            {ct==="bar"&&<><div style={{fontSize:12,color:C.txS}}>스타일</div>{[{id:"normal",label:"기본"},{id:"stacked",label:"누적막대"},{id:"group",label:"그룹막대"}].map(s=><span key={s.id} onClick={()=>setBarStyle(s.id)} style={{fontSize:11,padding:"3px 9px",borderRadius:10,cursor:"pointer",background:barStyle===s.id?C.info:C.bg,color:barStyle===s.id?C.infoTx:C.txS,border:`0.5px solid ${barStyle===s.id?C.infoTx:C.bd}`}}>{s.label}</span>)}</>}
            {/* 파이: 도넛 */}
            {ct==="pie"&&<><div style={{fontSize:12,color:C.txS}}>모양</div><span onClick={()=>setDonut(false)} style={{fontSize:11,padding:"3px 9px",borderRadius:10,cursor:"pointer",background:!donut?C.info:C.bg,color:!donut?C.infoTx:C.txS,border:`0.5px solid ${!donut?C.infoTx:C.bd}`}}>파이</span><span onClick={()=>setDonut(true)} style={{fontSize:11,padding:"3px 9px",borderRadius:10,cursor:"pointer",background:donut?C.info:C.bg,color:donut?C.infoTx:C.txS,border:`0.5px solid ${donut?C.infoTx:C.bd}`}}>도넛</span></>}
            {(ct==="bar"||ct==="grouped")&&<><div style={{fontSize:12,color:C.txS,marginLeft:8}}>집계</div>{[{id:"count",label:"건수"},{id:"sum",label:"합계"},{id:"mean",label:"평균"},{id:"max",label:"최댓값"},{id:"min",label:"최솟값"}].map(m=><span key={m.id} onClick={()=>setBarMode(m.id)} style={{fontSize:11,padding:"3px 9px",borderRadius:10,cursor:"pointer",background:barMode===m.id?C.info:C.bg,color:barMode===m.id?C.infoTx:C.txS,border:`0.5px solid ${barMode===m.id?C.infoTx:C.bd}`}}>{m.label}</span>)}</>}
            {/* 값 레이블 표시 */}
            {(ct==="bar"||ct==="grouped")&&<><div style={{fontSize:12,color:C.txS,marginLeft:8}}>값표시</div><span onClick={()=>setShowLabel(p=>!p)} style={{fontSize:11,padding:"3px 9px",borderRadius:10,cursor:"pointer",background:showLabel?C.info:C.bg,color:showLabel?C.infoTx:C.txS,border:`0.5px solid ${showLabel?C.infoTx:C.bd}`}}>{showLabel?"켜짐":"꺼짐"}</span></>}
          </div>
        </div>
      </div>

      <ChartCard title="" subtitle="">
        {ct==="bar"&&catCol?<CustomBarChart ds={ds} col={catCol} mode={barMode} barStyle={barStyle} showLabel={showLabel}/>:null}
        {ct==="pie"&&catCol?<CustomPieChart ds={ds} col={catCol} donut={donut}/>:null}
        {ct==="hist"&&xCol?<CustomHistChart ds={ds} col={xCol} hueCol={hueCol}/>:null}
        {ct==="scatter"&&xCol&&yCol&&xCol!==yCol?<CustomScatterChart ds={ds} xCol={xCol} yCol={yCol} hueCol={hueCol}/>:null}
        {ct==="line"&&xCol&&yCol?<CustomLineChart ds={ds} xCol={xCol} yCol={yCol} hueCol={hueCol}/>:null}
        {ct==="grouped"&&catCol&&numCol?<CustomGroupedBar ds={ds} catCol={catCol} numCol={numCol} mode={barMode} showLabel={showLabel}/>:null}
        {ct==="box"&&xCol?<CustomBoxPlot ds={ds} col={xCol} groupCol={catCol||""}/>:null}
        {!((ct==="bar"&&catCol)||(ct==="pie"&&catCol)||(ct==="hist"&&xCol)||(ct==="scatter"&&xCol&&yCol&&xCol!==yCol)||(ct==="line"&&xCol&&yCol)||(ct==="grouped"&&catCol&&numCol)||(ct==="box"&&xCol))&&<div style={{padding:32,textAlign:"center",color:C.txT,fontSize:13}}>위에서 컬럼을 선택해 주세요.</div>}
      </ChartCard>
    </div>}
  </div>;
}
