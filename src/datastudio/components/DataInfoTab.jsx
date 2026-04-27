import { useState } from "react";
import { C } from "../../constants";
import { makeDataset, buildColMeta } from "../../utils/dataUtils";
import { StatCard, Btn, Section, DsSelector, DataTable } from "./UI";
import { TypeBadge } from "./UI";

export function DataInfoTab({datasets,onUpdate}) {
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
