import { useState } from "react";
import { C } from "../../constants";
import { Btn } from "./UI";
import { performJoin, performUnion } from "../../utils/dataUtils";

export function MergePanel({ datasets, onResult }) {
  const [lIdx, setLIdx] = useState(0);
  const [rIdx, setRIdx] = useState(Math.min(1, datasets.length - 1));
  const [lKey, setLKey] = useState("");
  const [rKey, setRKey] = useState("");
  const [jType, setJType] = useState("inner");

  const JOIN = [
    { id:"inner", label:"Inner", desc:"양쪽 모두" },
    { id:"left",  label:"Left",  desc:"왼쪽 기준" },
    { id:"right", label:"Right", desc:"오른쪽 기준" },
    { id:"outer", label:"Outer", desc:"전체 포함" },
  ];

  const handle = () => {
    if (!lKey || !rKey) return alert("조인 키를 선택해 주세요.");
    if (lIdx === rIdx) return alert("서로 다른 파일을 선택해 주세요.");
    onResult(performJoin(datasets[lIdx], datasets[rIdx], lKey, rKey, jType));
  };

  const sel = (idx, setIdx, key, setKey, label) => (
    <div key={label}>
      <div style={{ fontSize:12, color:C.txS, marginBottom:4, fontWeight:500 }}>{label}</div>
      <select value={idx} onChange={e => { setIdx(+e.target.value); setKey(""); }}
        style={{ width:"100%", marginBottom:8, fontSize:13, padding:"6px 10px",
          borderRadius:"var(--border-radius-md)", border:`0.5px solid ${C.bdS}`,
          background:C.bg, color:C.tx }}>
        {datasets.map((d, i) => <option key={i} value={i}>{d.name}</option>)}
      </select>
      <select value={key} onChange={e => setKey(e.target.value)}
        style={{ width:"100%", fontSize:13, padding:"6px 10px",
          borderRadius:"var(--border-radius-md)", border:`0.5px solid ${C.bdS}`,
          background:C.bg, color:C.tx }}>
        <option value="">— 조인 키 선택 —</option>
        {datasets[idx]?.columns.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );

  return (
    <div style={{ border:`0.5px solid ${C.bd}`, borderRadius:"var(--border-radius-lg)", overflow:"hidden", marginBottom:14 }}>
      <div style={{ padding:"12px 16px", background:C.bgS, borderBottom:`0.5px solid ${C.bd}`, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:11, padding:"2px 8px", borderRadius:4, background:"#EEEDFE", color:"#3C3489", fontWeight:500 }}>Merge</span>
        <span style={{ fontSize:14, fontWeight:500, color:C.tx }}>2개 파일 조인</span>
      </div>
      <div style={{ padding:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
          {sel(lIdx, setLIdx, lKey, setLKey, "왼쪽 (Left)")}
          {sel(rIdx, setRIdx, rKey, setRKey, "오른쪽 (Right)")}
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          {JOIN.map(j => (
            <div key={j.id} onClick={() => setJType(j.id)} style={{
              flex:1, padding:"8px 10px", borderRadius:"var(--border-radius-md)",
              border: jType===j.id ? "2px solid #185FA5" : `0.5px solid ${C.bd}`,
              cursor:"pointer", background: jType===j.id ? "#E6F1FB" : C.bg,
            }}>
              <div style={{ fontSize:12, fontWeight:500, color: jType===j.id ? "#185FA5" : C.tx }}>{j.label}</div>
              <div style={{ fontSize:11, color:C.txS }}>{j.desc}</div>
            </div>
          ))}
        </div>
        <Btn variant="primary" onClick={handle}>Merge 실행</Btn>
      </div>
    </div>
  );
}

export function UnionPanel({ datasets, onResult }) {
  const [sel, setSel] = useState(() => new Set(datasets.map((_, i) => i)));
  const [mode, setMode] = useState("outer");

  const toggle = i => setSel(p => {
    const s = new Set(p);
    s.has(i) ? s.delete(i) : s.add(i);
    return s;
  });
  const selDs = datasets.filter((_, i) => sel.has(i));
  const commonCols = selDs.length
    ? selDs[0].columns.filter(c => selDs.every(d => d.columns.includes(c)))
    : [];
  const allCols = [...new Set(selDs.flatMap(d => d.columns))];

  return (
    <div style={{ border:`0.5px solid ${C.bd}`, borderRadius:"var(--border-radius-lg)", overflow:"hidden", marginBottom:14 }}>
      <div style={{ padding:"12px 16px", background:C.bgS, borderBottom:`0.5px solid ${C.bd}`, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:11, padding:"2px 8px", borderRadius:4, background:"#E1F5EE", color:"#085041", fontWeight:500 }}>Union</span>
        <span style={{ fontSize:14, fontWeight:500, color:C.tx }}>파일 결합 (수직)</span>
      </div>
      <div style={{ padding:16 }}>
        <div style={{ fontSize:12, color:C.txS, marginBottom:8, fontWeight:500 }}>결합할 파일 선택</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:12 }}>
          {datasets.map((d, i) => (
            <div key={i} onClick={() => toggle(i)} style={{
              padding:"6px 12px", borderRadius:"var(--border-radius-md)",
              border: sel.has(i) ? "2px solid #0F6E56" : `0.5px solid ${C.bd}`,
              cursor:"pointer", background: sel.has(i) ? "#E1F5EE" : C.bg,
            }}>
              <span style={{ fontSize:12, color:sel.has(i)?"#085041":C.tx, fontWeight:sel.has(i)?500:400 }}>{d.name}</span>
              <span style={{ fontSize:11, color:C.txS, marginLeft:6 }}>{d.rowCount}행</span>
            </div>
          ))}
        </div>
        {selDs.length >= 2 && (
          <div style={{ fontSize:12, color:C.txS, marginBottom:12 }}>
            공통 컬럼 {commonCols.length}개 · 전체 컬럼 {allCols.length}개 · 예상 {selDs.reduce((a,d)=>a+d.rowCount,0).toLocaleString()}행
          </div>
        )}
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          {[{ id:"outer", label:"전체 포함", desc:"없으면 빈값" }, { id:"strict", label:"공통만", desc:"공통 컬럼만" }].map(m => (
            <div key={m.id} onClick={() => setMode(m.id)} style={{
              flex:1, padding:"8px 10px", borderRadius:"var(--border-radius-md)",
              border: mode===m.id ? "2px solid #0F6E56" : `0.5px solid ${C.bd}`,
              cursor:"pointer", background: mode===m.id ? "#E1F5EE" : C.bg,
            }}>
              <div style={{ fontSize:12, fontWeight:500, color:mode===m.id?"#085041":C.tx }}>{m.label}</div>
              <div style={{ fontSize:11, color:C.txS }}>{m.desc}</div>
            </div>
          ))}
        </div>
        <Btn variant="success" disabled={sel.size < 2}
          onClick={() => { if (selDs.length < 2) return alert("2개 이상 선택"); onResult(performUnion(selDs, mode)); }}>
          Union 실행
        </Btn>
      </div>
    </div>
  );
}
