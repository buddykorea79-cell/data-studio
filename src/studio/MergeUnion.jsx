import { useState } from "react";
import { C } from "../constants";
import { Btn } from "./UI";
import { performJoin, performUnion, reheaderDataset } from "../utils/dataUtils";

// ── 데이터 시작 행 공통 지정 패널 ─────────────────────────────────────────────
// 제목·메타 행이 위에 있는 파일들의 실제 헤더(컬럼명) 행을 지정해 재파싱
export function StartRowPanel({ datasets, onUpdate }) {
  const adjustable = datasets.filter(d => d.rawGrid);
  const [open, setOpen] = useState(false);
  const [headerRow, setHeaderRow] = useState(() => adjustable[0]?.headerRow || 1);
  const [previewId, setPreviewId] = useState(() => adjustable[0]?.id || "");
  const [applied, setApplied] = useState("");

  if (!adjustable.length) return null;
  const previewDs = adjustable.find(d => d.id === previewId) || adjustable[0];
  const grid = previewDs.rawGrid || [];
  const previewRows = grid.slice(0, Math.min(grid.length, Math.max(8, headerRow + 2)));
  const maxCols = Math.min(8, Math.max(...previewRows.map(r => r.length), 1));

  const applyAll = () => {
    const n = Math.max(1, Math.min(headerRow, 50));
    adjustable.forEach(d => {
      if (d.headerRow !== n) onUpdate(reheaderDataset(d, n));
    });
    setApplied(`${adjustable.length}개 파일에 적용됨 — ${n}행을 컬럼명으로, ${n + 1}행부터 데이터로 읽습니다.`);
  };

  return (
    <div style={{ border:`0.5px solid ${C.bd}`, borderRadius:"var(--border-radius-lg)", overflow:"hidden", marginBottom:14 }}>
      <div onClick={() => setOpen(p => !p)} style={{ padding:"12px 16px", background:C.bgS,
        borderBottom: open ? `0.5px solid ${C.bd}` : "none",
        display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
        <span style={{ fontSize:11, padding:"2px 8px", borderRadius:4, background:C.warn, color:C.warnTx, fontWeight:500 }}>시작 행</span>
        <span style={{ fontSize:14, fontWeight:500, color:C.tx }}>데이터 시작 행 지정</span>
        <span style={{ fontSize:12, color:C.txS }}>— 제목·설명 행이 위에 있는 파일용 (모든 파일 공통 적용)</span>
        <span style={{ marginLeft:"auto", fontSize:12, color:C.txS }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding:16 }}>
          <div style={{ fontSize:12, color:C.txS, lineHeight:1.7, marginBottom:12 }}>
            엑셀 보고서처럼 위쪽에 제목이나 설명 행이 있는 파일은 컬럼명이 잘못 잡힙니다.<br/>
            아래 미리보기에서 <strong>실제 컬럼명이 있는 행을 클릭</strong>하면 그 행을 헤더로, 다음 행부터를 데이터로 다시 읽습니다.
          </div>

          {/* 미리볼 파일 선택 */}
          {adjustable.length > 1 && (
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
              {adjustable.map(d => (
                <span key={d.id} onClick={() => setPreviewId(d.id)} style={{
                  fontSize:11, padding:"4px 10px", borderRadius:14, cursor:"pointer",
                  background: previewDs.id === d.id ? C.info : C.bgS,
                  color: previewDs.id === d.id ? C.infoTx : C.txS,
                  border: `1px solid ${previewDs.id === d.id ? C.infoTx + "66" : C.bd}`,
                }}>
                  {d.name}{d.headerRow > 1 ? ` (${d.headerRow}행~)` : ""}
                </span>
              ))}
            </div>
          )}

          {/* 원본 미리보기 — 행 클릭으로 헤더 선택 */}
          <div style={{ border:`0.5px solid ${C.bd}`, borderRadius:"var(--border-radius-md)", overflow:"auto", marginBottom:12 }}>
            <table style={{ borderCollapse:"collapse", fontSize:12, width:"100%" }}>
              <tbody>
                {previewRows.map((row, ri) => {
                  const rowNum = ri + 1;
                  const isHeader = rowNum === headerRow;
                  const isData = rowNum > headerRow;
                  return (
                    <tr key={ri} onClick={() => setHeaderRow(rowNum)} style={{
                      cursor:"pointer",
                      background: isHeader ? C.info : isData ? C.bg : C.bgT,
                      opacity: rowNum < headerRow ? 0.45 : 1,
                    }}>
                      <td style={{ padding:"5px 10px", fontFamily:"var(--font-mono)", fontSize:11,
                        color: isHeader ? C.infoTx : C.txT, fontWeight: isHeader ? 700 : 400,
                        borderBottom:`0.5px solid ${C.bd}`, whiteSpace:"nowrap",
                        borderRight:`0.5px solid ${C.bd}`, position:"sticky", left:0,
                        background: isHeader ? C.info : isData ? C.bg : C.bgT }}>
                        {rowNum}행{isHeader ? " ✓ 헤더" : ""}
                      </td>
                      {Array.from({ length: maxCols }, (_, ci) => (
                        <td key={ci} style={{ padding:"5px 10px",
                          color: isHeader ? C.infoTx : C.tx,
                          fontWeight: isHeader ? 600 : 400,
                          borderBottom:`0.5px solid ${C.bd}`, whiteSpace:"nowrap",
                          maxWidth:140, overflow:"hidden", textOverflow:"ellipsis" }}>
                          {String(row[ci] ?? "")}
                        </td>
                      ))}
                      {row.length > maxCols && (
                        <td style={{ padding:"5px 10px", color:C.txT, fontSize:11, borderBottom:`0.5px solid ${C.bd}` }}>
                          +{row.length - maxCols}열
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <label style={{ fontSize:12, color:C.txS, display:"flex", alignItems:"center", gap:6 }}>
              헤더(컬럼명) 행:
              <input type="number" min={1} max={50} value={headerRow}
                onChange={e => setHeaderRow(Math.max(1, +e.target.value || 1))}
                style={{ width:64, fontSize:13, padding:"5px 8px", borderRadius:"var(--border-radius-md)",
                  border:`0.5px solid ${C.bdS}`, background:C.bg, color:C.tx, fontFamily:"var(--font-mono)" }}/>
            </label>
            <span style={{ fontSize:12, color:C.txS }}>
              → 데이터는 <strong style={{ color:C.tx }}>{headerRow + 1}행</strong>부터
            </span>
            <Btn variant="primary" small onClick={applyAll}>
              모든 파일({adjustable.length}개)에 공통 적용
            </Btn>
          </div>
          {applied && (
            <div style={{ marginTop:10, fontSize:12, color:C.successTx, background:C.success,
              padding:"7px 10px", borderRadius:"var(--border-radius-md)" }}>
              ✓ {applied}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MergePanel({ datasets, onResult }) {
  const [lIdx, setLIdx] = useState(0);
  const [rIdx, setRIdx] = useState(Math.min(1, datasets.length - 1));
  const [lKey, setLKey] = useState("");
  const [rKey, setRKey] = useState("");
  const [jType, setJType] = useState("inner");
  const [removeSrc, setRemoveSrc] = useState(false);

  const JOIN = [
    { id:"inner", label:"Inner", desc:"양쪽 모두" },
    { id:"left",  label:"Left",  desc:"왼쪽 기준" },
    { id:"right", label:"Right", desc:"오른쪽 기준" },
    { id:"outer", label:"Outer", desc:"전체 포함" },
  ];

  const handle = () => {
    if (!lKey || !rKey) return alert("조인 키를 선택해 주세요.");
    if (lIdx === rIdx) return alert("서로 다른 파일을 선택해 주세요.");
    onResult(
      performJoin(datasets[lIdx], datasets[rIdx], lKey, rKey, jType),
      removeSrc ? [datasets[lIdx].id, datasets[rIdx].id] : []
    );
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
        <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
          <Btn variant="primary" onClick={handle}>Merge 실행</Btn>
          <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.txS, cursor:"pointer" }}>
            <input type="checkbox" checked={removeSrc} onChange={e => setRemoveSrc(e.target.checked)}/>
            실행 후 원본 2개 파일 제거 (결과만 남기기)
          </label>
        </div>
      </div>
    </div>
  );
}

export function UnionPanel({ datasets, onResult }) {
  const [sel, setSel] = useState(() => new Set(datasets.map((_, i) => i)));
  const [mode, setMode] = useState("outer");
  const [removeSrc, setRemoveSrc] = useState(false);

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
        <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
          <Btn variant="success" disabled={sel.size < 2}
            onClick={() => {
              if (selDs.length < 2) return alert("2개 이상 선택");
              onResult(performUnion(selDs, mode), removeSrc ? selDs.map(d => d.id) : []);
            }}>
            Union 실행
          </Btn>
          <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.txS, cursor:"pointer" }}>
            <input type="checkbox" checked={removeSrc} onChange={e => setRemoveSrc(e.target.checked)}/>
            실행 후 원본 {selDs.length}개 파일 제거 (결과만 남기기)
          </label>
        </div>
      </div>
    </div>
  );
}
