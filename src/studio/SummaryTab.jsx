import { useState } from "react";
import { C } from "../constants";
import { performGroup, performPivot, downloadCSV } from "../utils/dataUtils";
import { Btn, Section, DsSelector, DataTable } from "./UI";

export function SummaryTab({datasets,onResult}) {
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
