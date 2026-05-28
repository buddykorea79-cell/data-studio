import { useState, useRef, useMemo } from "react";
import { C, ALL_TYPES } from "../constants";
import { buildColMeta } from "../utils/dataUtils";
import { TypeBadge, Btn, Section, DataTable, DsSelector } from "./UI";

export function PreprocessTab({datasets,onUpdate}) {
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
