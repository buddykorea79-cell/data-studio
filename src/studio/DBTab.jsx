import { useState, useEffect, useRef } from "react";
import { C } from "../constants";
import { Btn, DsSelector, DataTable } from "./UI";
import { makeDataset, downloadCSV } from "../utils/dataUtils";
import { ChartCard, HistChart, CorrHeatmap, getNumCols, XYChart } from "./Charts";

const MODELS = [
  { id: "deepseek/deepseek-v4-flash",          label: "DeepSeek V4 Flash" },
  { id: "google/gemini-2.5-flash-lite",        label: "Gemini 2.5 Flash Lite" },
];

async function callOpenRouter(apiKey, model, systemPrompt, userMsg) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "Data Studio",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMsg },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function extractSQL(text) {
  const m = text.match(/```sql\n?([\s\S]+?)\n?```/i) || text.match(/```\n?([\s\S]+?)\n?```/i);
  if (m) return m[1].trim();
  const sm = text.match(/(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH)[\s\S]+?;/i);
  if (sm) return sm[0].trim();
  return text.trim();
}

function inpStyle(extra = {}) {
  return {
    fontSize: 13, padding: "7px 10px", borderRadius: "var(--border-radius-md)",
    border: `1px solid ${C.bdS}`, background: C.bg, color: C.tx,
    fontFamily: "var(--font-sans)", width: "100%", boxSizing: "border-box",
    ...extra,
  };
}

const DB_PALETTES = {
  "기본":   ["#4A7560","#185FA5","#D85A30","#BA7517","#7F77DD","#0F6E56","#378ADD","#EF9F27","#A32D2D","#1D9E75"],
  "Sage":   ["#2E4D3D","#4A7560","#7FAF97","#A8CCB8","#5B8A72","#9CC4AE","#3A6B53","#C6DDD4"],
  "블루":   ["#0C447C","#185FA5","#378ADD","#5FA0D4","#88BDE8","#2A7EC8","#63A8D8","#B0D5F4"],
  "따뜻한": ["#C23B22","#D85A30","#EF9F27","#BA7517","#E87040","#F5C26B","#C45C14","#F7D98C"],
};

// ── SQL 결과 시각화 — 데이터 성격 기반 추천 + 커스텀 ──────────────────────────
function SqlResultCharts({ ds }) {
  const numCols   = getNumCols(ds);
  // SQL 결과는 이미 집계된 작은 테이블인 경우가 많음 —
  // 숫자가 아닌 모든 컬럼(텍스트·범주·날짜)을 X축 후보로 취급
  const labelCols = ds.colMeta.filter(c => c.type !== "number");

  const recommendBar = labelCols.length > 0 && numCols.length > 0;
  const [chartType,   setChartType]   = useState(recommendBar ? "bar" : "hist");
  const [xCol,        setXCol]        = useState(labelCols[0]?.name || ds.columns[0] || "");
  const [yCol,        setYCol]        = useState(numCols[0]?.name || "");
  const [barDir,      setBarDir]      = useState("v");
  const [paletteName, setPaletteName] = useState("기본");
  const palette = DB_PALETTES[paletteName] || DB_PALETTES["기본"];

  if (!numCols.length) return null;

  // X축 기준으로 Y값 정리 — SQL이 이미 집계한 결과면 그대로, 중복 X는 평균
  const buildData = () => {
    const groups = {};
    ds.rows.forEach(r => {
      const k = String(r[xCol] ?? "");
      const v = parseFloat(r[yCol]);
      if (!groups[k]) groups[k] = { sum: 0, cnt: 0 };
      if (!isNaN(v)) { groups[k].sum += v; groups[k].cnt++; }
    });
    return Object.entries(groups)
      .map(([name, g]) => ({ name, value: g.cnt ? +(g.sum / g.cnt).toFixed(3) : 0 }))
      .slice(0, 30);
  };

  const CHART_TYPES = [
    { id: "bar",  label: "막대" },
    { id: "line", label: "선" },
    { id: "pie",  label: "파이" },
    { id: "hist", label: "히스토그램" },
  ];

  const selStyle = {
    fontSize: 12, padding: "4px 8px", borderRadius: 6,
    border: `1px solid ${C.bd}`, background: C.bg, color: C.tx, maxWidth: 140,
  };

  const needXY = chartType !== "hist";
  const canDraw = chartType === "hist" ? !!yCol : (!!xCol && !!yCol);
  const title = chartType === "hist"
    ? `${yCol} 분포`
    : `${xCol} 별 ${yCol}`;

  return (
    <div style={{ border:`1px solid ${C.bd}`, borderRadius:"var(--border-radius-lg)", overflow:"hidden", marginBottom:14 }}>
      <div style={{ padding:"10px 16px", background:"linear-gradient(90deg,#E8F1E7 0%,#F2F7F1 100%)",
        borderBottom:`1px solid ${C.bd}` }}>
        <div style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:400,
          color:"var(--color-primary-700)", letterSpacing:"-0.01em" }}>
          📊 결과 시각화
          {recommendBar && <span style={{ fontSize:11, color:C.txS, marginLeft:8 }}>
            추천: {labelCols[0]?.name}(X축) × {numCols[0]?.name}(Y축) 막대 그래프
          </span>}
        </div>
      </div>

      {/* 커스텀 컨트롤 */}
      <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.bd}`, background:C.bgS,
        display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
        {/* 차트 종류 */}
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          <span style={{ fontSize:11, color:C.txS }}>차트:</span>
          {CHART_TYPES.map(t => (
            <button key={t.id} type="button" onClick={() => setChartType(t.id)} style={{
              fontSize:11, padding:"3px 9px", borderRadius:6, cursor:"pointer",
              background: chartType===t.id ? C.infoTx : C.bg,
              color: chartType===t.id ? "#fff" : C.txS,
              border:`1px solid ${chartType===t.id ? C.infoTx : C.bd}`,
            }}>{t.label}</button>
          ))}
        </div>
        {/* X축 */}
        {needXY && (
          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            <span style={{ fontSize:11, color:C.txS }}>X축:</span>
            <select value={xCol} onChange={e => setXCol(e.target.value)} style={selStyle}>
              {ds.columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        {/* Y축 (숫자) */}
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          <span style={{ fontSize:11, color:C.txS }}>{needXY ? "Y축:" : "컬럼:"}</span>
          <select value={yCol} onChange={e => setYCol(e.target.value)} style={selStyle}>
            {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        {/* 막대 방향 */}
        {chartType === "bar" && (
          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            <span style={{ fontSize:11, color:C.txS }}>방향:</span>
            {[{v:"v",l:"세로"},{v:"h",l:"가로"}].map(({v,l}) => (
              <button key={v} type="button" onClick={() => setBarDir(v)} style={{
                fontSize:11, padding:"3px 8px", borderRadius:6, cursor:"pointer",
                background: barDir===v ? C.infoTx : C.bg,
                color: barDir===v ? "#fff" : C.txS,
                border:`1px solid ${barDir===v ? C.infoTx : C.bd}`,
              }}>{l}</button>
            ))}
          </div>
        )}
        {/* 색상 팔레트 */}
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          <span style={{ fontSize:11, color:C.txS }}>색상:</span>
          {Object.entries(DB_PALETTES).map(([name, colors]) => (
            <button key={name} type="button" onClick={() => setPaletteName(name)} title={name} style={{
              display:"flex", gap:2, padding:"3px 5px", borderRadius:6, cursor:"pointer",
              border:`1.5px solid ${paletteName===name ? C.infoTx : C.bd}`,
              background: paletteName===name ? C.info : C.bg,
            }}>
              {colors.slice(0,4).map((c,i) => <span key={i} style={{ width:8,height:8,borderRadius:2,background:c,display:"inline-block" }} />)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:"14px 14px 4px" }}>
        {canDraw && (
          <ChartCard title={title} subtitle={needXY ? `X축: ${xCol} / Y축: ${yCol}` : undefined}>
            {chartType === "hist"
              ? <HistChart ds={ds} col={yCol} />
              : <XYChart data={buildData()} type={chartType} barDir={barDir} palette={palette} valueName={yCol} />}
          </ChartCard>
        )}
        {numCols.length >= 2 && (
          <ChartCard title="상관관계 히트맵" subtitle="숫자형 컬럼 간 상관계수">
            <CorrHeatmap ds={ds} />
          </ChartCard>
        )}
      </div>
    </div>
  );
}

// ── Markdown-ish block renderer ───────────────────────────────────────────────
function MdBlock({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div style={{ fontSize:13, color:C.tx, lineHeight:1.75, fontFamily:"var(--font-sans)" }}>
      {lines.map((ln, i) => {
        if (/^###/.test(ln)) return <div key={i} style={{ fontWeight:700, fontSize:14, color:"var(--color-primary-700)", marginTop:10, marginBottom:2 }}>{ln.replace(/^###\s*/,"")}</div>;
        if (/^##/.test(ln))  return <div key={i} style={{ fontWeight:700, fontSize:15, color:"var(--color-primary-700)", marginTop:12, marginBottom:4 }}>{ln.replace(/^##\s*/,"")}</div>;
        if (/^#/.test(ln))   return <div key={i} style={{ fontWeight:700, fontSize:16, color:"var(--color-primary-800)", marginTop:14, marginBottom:6 }}>{ln.replace(/^#\s*/,"")}</div>;
        if (/^\s*[-*]\s/.test(ln)) return <div key={i} style={{ paddingLeft:16, marginBottom:2 }}>• {ln.replace(/^\s*[-*]\s*/,"")}</div>;
        if (!ln.trim()) return <div key={i} style={{ height:6 }} />;
        return <div key={i} style={{ marginBottom:2 }}>{ln}</div>;
      })}
    </div>
  );
}

export function DBTab({ allDs, onAddDataset }) {
  const [sqlReady, setSqlReady]       = useState(false);
  const [sqlError, setSqlError]       = useState("");
  const dbRef                          = useRef(null);

  const [tables,   setTables]         = useState([]);
  const [selDsId,  setSelDsId]        = useState(() => allDs[0]?.id ?? "");
  const [tblName,  setTblName]        = useState("");
  const [importing, setImporting]     = useState(false);
  const [importMsg, setImportMsg]     = useState("");

  const [apiKey,   setApiKey]         = useState(() => sessionStorage.getItem("openrouter_key") || "");
  const [showKey,  setShowKey]        = useState(false);
  const [model,    setModel]          = useState(MODELS[0].id);
  const [query,    setQuery]          = useState("");
  const [editSQL,  setEditSQL]        = useState("");
  const [results,  setResults]        = useState(null);
  const [resultDs, setResultDs]       = useState(null);
  const [history,  setHistory]        = useState([]);
  const [loading,  setLoading]        = useState(false);
  const [error,    setError]          = useState("");
  const [activeTab,setActiveTab]      = useState("import");

  const [aiLoading, setAiLoading]     = useState(false);
  const [aiResult,  setAiResult]      = useState("");
  const [aiError,   setAiError]       = useState("");

  // ── Init sql.js ─────────────────────────────────────────────────────────────
  useEffect(() => {
    import("sql.js").then(({ default: initSqlJs }) =>
      initSqlJs({ locateFile: () => "/sql-wasm.wasm" })
    ).then(SQL => {
      dbRef.current = new SQL.Database();
      setSqlReady(true);
    }).catch(e => setSqlError(`sql.js 로드 실패: ${e.message}`));
  }, []);

  const refreshTables = () => {
    const db = dbRef.current;
    if (!db) return;
    try {
      const r = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
      setTables(r[0]?.values?.map(v => v[0]) || []);
    } catch { setTables([]); }
  };

  // ── Import dataset ───────────────────────────────────────────────────────────
  // ds → SQLite 테이블 생성 (공통 헬퍼)
  const loadDsIntoTable = (ds, name) => {
    const db = dbRef.current;
    const cols = ds.columns.map(col => {
      const t = ds.colMeta.find(m => m.name === col)?.type;
      return `"${col.replace(/"/g, '""')}" ${t === "number" ? "REAL" : "TEXT"}`;
    }).join(", ");

    db.run(`DROP TABLE IF EXISTS "${name}"`);
    db.run(`CREATE TABLE "${name}" (${cols})`);

    const placeholders = ds.columns.map(() => "?").join(",");
    const stmt = db.prepare(`INSERT INTO "${name}" VALUES (${placeholders})`);
    for (const row of ds.rows) {
      stmt.run(ds.columns.map(col => {
        const v = row[col];
        if (v === null || v === undefined || v === "") return null;
        const t = ds.colMeta.find(m => m.name === col)?.type;
        return t === "number" ? (isNaN(parseFloat(v)) ? null : parseFloat(v)) : String(v);
      }));
    }
    stmt.free();
    refreshTables();
  };

  const importTable = () => {
    const db = dbRef.current;
    const ds = allDs.find(d => d.id === selDsId);
    if (!ds || !db) return;

    const raw  = tblName.trim() || ds.name.replace(/[^a-zA-Z0-9]/g, "_").replace(/^(\d)/, "_$1").substring(0, 40);
    const name = raw.replace(/_{2,}/g, "_").replace(/_+$/, "");
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return setError("테이블명은 영문자·숫자·_만 사용 가능합니다.");
    }

    setImporting(true); setError(""); setImportMsg("");
    try {
      loadDsIntoTable(ds, name);
      setImportMsg(`✅ "${name}" 테이블 생성 완료 (${ds.rowCount.toLocaleString()}행)`);
      setTblName("");
      setActiveTab("query");
    } catch (e) {
      setError(`가져오기 실패: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  // SQL 결과를 테이블로 저장 → 결과에 대해 다시 쿼리 가능
  const saveResultAsTable = () => {
    if (!resultDs) return;
    const ts = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).replace(/:/g, "");
    const name = `sql_result_${ts}`;
    setError("");
    try {
      loadDsIntoTable(resultDs, name);
      setImportMsg(`✅ "${name}" 테이블 생성 완료 — 이 테이블에 다시 쿼리할 수 있습니다 (${resultDs.rowCount.toLocaleString()}행)`);
    } catch (e) {
      setError(`테이블 저장 실패: ${e.message}`);
    }
  };

  // ── Build schema context ─────────────────────────────────────────────────────
  const buildSchemaCtx = () => {
    const db = dbRef.current;
    return tables.map(t => {
      const cols  = db.exec(`PRAGMA table_info("${t}")`);
      const defs  = (cols[0]?.values || []).map(r => `  ${r[1]} ${r[2]}`).join("\n");
      const rows  = db.exec(`SELECT * FROM "${t}" LIMIT 3`);
      const sample = (rows[0]?.values || []).map(r => "  " + r.map(v => String(v ?? "NULL")).join(" | ")).join("\n");
      const cnt   = db.exec(`SELECT COUNT(*) FROM "${t}"`);
      const total = cnt[0]?.values?.[0]?.[0] ?? "?";
      return `-- 테이블: ${t}  (${total}행)\nCREATE TABLE "${t}" (\n${defs}\n);\n-- 샘플:\n${sample}`;
    }).join("\n\n");
  };

  // ── Generate SQL ─────────────────────────────────────────────────────────────
  const generateSQL = async () => {
    if (!apiKey.trim()) return setError("OpenRouter API 키를 입력해 주세요.");
    if (!query.trim())  return setError("질문을 입력해 주세요.");
    if (!tables.length) return setError("먼저 '데이터 가져오기'에서 테이블을 생성하세요.");
    setLoading(true); setError("");
    try {
      const schema = buildSchemaCtx();
      const sys = `당신은 SQLite 전문가입니다. 사용자의 자연어 질문을 SQLite SQL 쿼리로만 변환하세요.
반드시 \`\`\`sql ... \`\`\` 코드블록으로만 답하세요. 설명은 쓰지 마세요.

${schema}`;
      const raw = await callOpenRouter(apiKey.trim(), model, sys, query);
      const sql = extractSQL(raw);
      setEditSQL(sql);
    } catch (e) {
      setError(`SQL 생성 실패: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Execute SQL ──────────────────────────────────────────────────────────────
  const execSQL = () => {
    const db  = dbRef.current;
    const sql = editSQL.trim();
    if (!db || !sql) return;
    setError(""); setAiResult(""); setAiError("");
    try {
      const res = db.exec(sql);
      if (!res.length) {
        const r = { columns: ["결과"], rows: [{ 결과: "쿼리 실행 완료 (반환 행 없음)" }] };
        setResults(r);
        setResultDs(makeDataset(crypto.randomUUID(), "sql_result", r.rows));
      } else {
        const { columns, values } = res[0];
        const rows = values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
        setResults({ columns, rows });
        setResultDs(makeDataset(crypto.randomUUID(), "sql_result", rows));
      }
      setHistory(p => [{ query, sql, ts: new Date().toLocaleTimeString() }, ...p].slice(0, 10));
      refreshTables();
    } catch (e) {
      setError(`실행 오류: ${e.message}`);
      setResults(null);
      setResultDs(null);
    }
  };

  // ── AI interpretation ────────────────────────────────────────────────────────
  const interpretResult = async () => {
    if (!apiKey.trim()) return setAiError("OpenRouter API 키를 입력해 주세요.");
    if (!resultDs)      return;
    setAiLoading(true); setAiResult(""); setAiError("");
    try {
      const schema = buildSchemaCtx();
      const colInfo = resultDs.colMeta.map(c => {
        const s = c.stats;
        const detail = c.type === "number"
          ? `min=${s.min}, max=${s.max}, mean=${s.mean}, std=${s.std}`
          : c.type === "category"
          ? `top: ${(s.topValues||[]).map(([v,n]) => `${v}(${n})`).join(", ")}`
          : `unique=${s.unique}`;
        return `- ${c.name} [${c.type}]: ${detail}, 결측=${s.nullCount}`;
      }).join("\n");

      const sampleRows = resultDs.rows.slice(0, 20)
        .map(r => resultDs.columns.map(c => String(r[c] ?? "")).join(" | "))
        .join("\n");

      const sys = `당신은 데이터 분석 전문가입니다. SQL 쿼리 결과 데이터를 분석하고 한국어로 핵심 인사이트를 제공하세요.
분석 내용: 주요 패턴, 이상값, 트렌드, 비즈니스 관점의 해석을 포함하세요.
원본 DB 스키마 컨텍스트:
${schema}`;

      const userMsg = `## SQL 쿼리
\`\`\`sql
${editSQL}
\`\`\`

## 결과 데이터 정보 (${resultDs.rowCount}행 × ${resultDs.columns.length}열)
${colInfo}

## 샘플 데이터 (최대 20행)
${resultDs.columns.join(" | ")}
${sampleRows}

위 SQL 결과를 분석하고 핵심 인사이트를 제공해 주세요.`;

      const answer = await callOpenRouter(apiKey.trim(), model, sys, userMsg);
      setAiResult(answer);
    } catch (e) {
      setAiError(`AI 분석 실패: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const dropTable = t => {
    try { dbRef.current.run(`DROP TABLE IF EXISTS "${t}"`); refreshTables(); }
    catch (e) { setError(`삭제 실패: ${e.message}`); }
  };

  const saveKey = k => { setApiKey(k); sessionStorage.setItem("openrouter_key", k); };

  // ── Loading / Error states ───────────────────────────────────────────────────
  if (sqlError) return (
    <div style={{ padding:32, textAlign:"center", color:C.dangerTx, fontSize:13 }}>⚠️ {sqlError}</div>
  );
  if (!sqlReady) return (
    <div style={{ padding:60, textAlign:"center", color:C.txS, fontSize:14 }}>
      <div style={{ fontSize:28, marginBottom:12 }}>🗄️</div>
      <div style={{ fontFamily:"var(--font-display)", fontSize:17, color:"var(--color-primary-700)", marginBottom:6 }}>
        SQLite 엔진 로딩 중…
      </div>
      <div style={{ fontSize:12 }}>sql.js (WebAssembly) 초기화 중입니다.</div>
    </div>
  );

  const ds = allDs.find(d => d.id === selDsId);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Sub-tab nav ── */}
      <div style={{ display:"flex", gap:0, marginBottom:16, borderBottom:`1px solid ${C.bd}` }}>
        {[
          { id:"import", label:"📥 데이터 가져오기" },
          { id:"query",  label:"💬 자연어 쿼리" },
          { id:"schema", label:"📋 스키마 보기" },
        ].map(t => (
          <button key={t.id} type="button" onClick={() => setActiveTab(t.id)} style={{
            fontSize:13, padding:"9px 14px", cursor:"pointer",
            background:"transparent", border:"none",
            borderBottom: activeTab===t.id ? `2px solid var(--color-primary-600)` : "2px solid transparent",
            color: activeTab===t.id ? "var(--color-primary-700)" : C.txS,
            fontWeight: activeTab===t.id ? 600 : 400,
            marginBottom:-1, transition:"all 0.15s",
            fontFamily:"var(--font-sans)",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Table chips ── */}
      {tables.length > 0 && (
        <div style={{ marginBottom:14, padding:"10px 14px", background:C.bgS,
          borderRadius:"var(--border-radius-md)", border:`1px solid ${C.bd}` }}>
          <div style={{ fontSize:11, fontWeight:600, color:C.txS, marginBottom:7,
            textTransform:"uppercase", letterSpacing:"0.06em" }}>
            🗄️ 생성된 테이블 ({tables.length})
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {tables.map(t => (
              <span key={t} style={{ display:"inline-flex", alignItems:"center", gap:4,
                fontSize:12, padding:"3px 10px", borderRadius:20,
                background:"var(--color-background-success)",
                color:"var(--color-text-success)", fontFamily:"var(--font-mono)",
                border:"1px solid var(--color-text-success)33" }}>
                {t}
                <button type="button" onClick={() => dropTable(t)} style={{
                  fontSize:10, background:"none", border:"none", cursor:"pointer",
                  color:C.txS, padding:"0 2px", lineHeight:1 }}>✕</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Error / Import success ── */}
      {error && (
        <div style={{ fontSize:12, color:C.dangerTx, background:C.danger, padding:"8px 12px",
          borderRadius:"var(--border-radius-md)", marginBottom:12,
          border:`1px solid ${C.dangerTx}44` }}>
          ⚠️ {error}
        </div>
      )}
      {importMsg && !error && (
        <div style={{ fontSize:12, color:C.successTx, background:C.success, padding:"8px 12px",
          borderRadius:"var(--border-radius-md)", marginBottom:12,
          border:`1px solid ${C.successTx}44` }}>
          {importMsg}
        </div>
      )}

      {/* ════════════════════ IMPORT TAB ════════════════════ */}
      {activeTab === "import" && (
        <div style={{ border:`1px solid ${C.bd}`, borderRadius:"var(--border-radius-lg)", overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", background:"linear-gradient(90deg,#E8F1E7 0%,#F2F7F1 100%)",
            borderBottom:`1px solid ${C.bd}` }}>
            <div style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:400,
              color:"var(--color-primary-700)", letterSpacing:"-0.01em" }}>
              📥 전처리 데이터 → SQLite 테이블
            </div>
            <div style={{ fontSize:11, color:C.txS, marginTop:3 }}>
              전처리가 완료된 데이터를 브라우저 내 SQLite DB에 저장합니다.
            </div>
          </div>
          <div style={{ padding:16 }}>
            <DsSelector datasets={allDs} value={selDsId} onChange={v => { setSelDsId(v); setTblName(""); setImportMsg(""); }} label="데이터셋" />
            {ds && (
              <div style={{ fontSize:12, color:C.txS, marginBottom:12, background:C.bgS,
                padding:"8px 12px", borderRadius:"var(--border-radius-md)", border:`1px solid ${C.bd}` }}>
                <span style={{ fontWeight:500 }}>{ds.rowCount.toLocaleString()}행</span> × <span style={{ fontWeight:500 }}>{ds.columns.length}열</span>
                {" · "}컬럼: <span style={{ fontFamily:"var(--font-mono)", fontSize:11 }}>
                  {ds.columns.slice(0,6).join(", ")}{ds.columns.length>6?` 외 ${ds.columns.length-6}개`:""}
                </span>
              </div>
            )}
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:14 }}>
              <span style={{ fontSize:12, color:C.txS, whiteSpace:"nowrap" }}>테이블명</span>
              <input type="text" value={tblName}
                onChange={e => setTblName(e.target.value.replace(/[^a-zA-Z0-9_]/g,"_"))}
                placeholder={ds ? ds.name.replace(/[^a-zA-Z0-9]/g,"_").substring(0,40) : "table_name"}
                style={{ ...inpStyle(), fontFamily:"var(--font-mono)" }} />
            </div>
            <Btn variant="primary" onClick={importTable} disabled={!ds || importing}>
              {importing ? "가져오는 중…" : "📥 DB에 가져오기"}
            </Btn>
          </div>
        </div>
      )}

      {/* ════════════════════ QUERY TAB ════════════════════ */}
      {activeTab === "query" && (
        <div>
          {/* API Key */}
          <div style={{ border:`1px solid ${C.bd}`, borderRadius:"var(--border-radius-lg)",
            overflow:"hidden", marginBottom:14 }}>
            <div style={{ padding:"11px 16px", background:C.bgS, borderBottom:`1px solid ${C.bd}`,
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:13, fontWeight:600, color:C.tx }}>🔑 OpenRouter API 키</span>
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer"
                style={{ fontSize:11, color:C.infoTx, padding:"2px 8px", borderRadius:4,
                  background:C.info, textDecoration:"none", border:`1px solid ${C.infoTx}44` }}>
                무료 키 발급 →
              </a>
            </div>
            <div style={{ padding:"12px 16px" }}>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                <input type={showKey?"text":"password"} value={apiKey}
                  onChange={e => saveKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  style={{ ...inpStyle(), fontFamily:"var(--font-mono)",
                    border:`1px solid ${apiKey ? C.successTx+"88" : C.bdS}` }} />
                <button type="button" onClick={() => setShowKey(p => !p)} style={{
                  fontSize:11, padding:"4px 10px", cursor:"pointer",
                  borderRadius:"var(--border-radius-md)", background:"transparent",
                  border:`1px solid ${C.bdS}`, color:C.txS, whiteSpace:"nowrap",
                  fontFamily:"var(--font-sans)" }}>
                  {showKey?"숨기기":"보기"}
                </button>
                {apiKey && <span style={{ fontSize:11, color:C.successTx, whiteSpace:"nowrap" }}>✓ 입력됨</span>}
              </div>
              <div style={{ fontSize:11, color:C.txS }}>
                무료 모델 지원 · 키는 브라우저 세션에만 저장됩니다.
              </div>
            </div>
          </div>

          {/* Query input */}
          <div style={{ border:`1px solid ${C.bd}`, borderRadius:"var(--border-radius-lg)",
            overflow:"hidden", marginBottom:14 }}>
            <div style={{ padding:"12px 16px", background:"linear-gradient(90deg,#E8F1E7 0%,#F2F7F1 100%)",
              borderBottom:`1px solid ${C.bd}` }}>
              <div style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:400,
                color:"var(--color-primary-700)", letterSpacing:"-0.01em" }}>
                💬 자연어로 데이터 질의
              </div>
              <div style={{ fontSize:11, color:C.txS, marginTop:3 }}>
                질문을 입력하면 AI가 SQL을 생성하고 실행합니다.
              </div>
            </div>
            <div style={{ padding:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                <span style={{ fontSize:12, color:C.txS, whiteSpace:"nowrap" }}>AI 모델</span>
                <select value={model} onChange={e => setModel(e.target.value)}
                  style={{ ...inpStyle(), width:"auto", flex:1 }}>
                  {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              <textarea rows={3} value={query} onChange={e => setQuery(e.target.value)}
                placeholder={"예: 카테고리별 평균 매출을 내림차순으로 보여줘\n예: 결측값이 있는 컬럼 목록\n예: 상위 10개 행만 보여줘"}
                style={{ ...inpStyle(), resize:"vertical", lineHeight:1.6, marginBottom:12 }} />
              {tables.length === 0 && (
                <div style={{ fontSize:12, color:C.warnTx, background:C.warn, padding:"7px 10px",
                  borderRadius:"var(--border-radius-md)", marginBottom:10,
                  border:`1px solid ${C.warnTx}44` }}>
                  ⚠️ 먼저 '데이터 가져오기' 탭에서 테이블을 생성해 주세요.
                </div>
              )}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <Btn variant="primary" onClick={generateSQL} disabled={loading || !apiKey || !tables.length}>
                  {loading ? "SQL 생성 중…" : "🤖 SQL 자동 생성"}
                </Btn>
                {editSQL && <Btn variant="success" onClick={execSQL}>▶ 쿼리 실행</Btn>}
              </div>
            </div>
          </div>

          {/* Generated SQL editor */}
          {editSQL && (
            <div style={{ border:`1px solid ${C.bd}`, borderRadius:"var(--border-radius-lg)",
              overflow:"hidden", marginBottom:14 }}>
              <div style={{ padding:"10px 16px", background:C.bgS, borderBottom:`1px solid ${C.bd}`,
                display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, fontWeight:600, color:C.tx }}>📝 생성된 SQL (수정 가능)</span>
                <Btn small variant="success" onClick={execSQL}>▶ 실행</Btn>
              </div>
              <div style={{ padding:12 }}>
                <textarea rows={5} value={editSQL} onChange={e => setEditSQL(e.target.value)}
                  style={{ ...inpStyle(), fontFamily:"var(--font-mono)", fontSize:12,
                    background:"var(--color-primary-900)", color:"var(--color-primary-300)",
                    lineHeight:1.7, resize:"vertical" }} />
              </div>
            </div>
          )}

          {/* Results table */}
          {results && (
            <div style={{ border:`1px solid ${C.bd}`, borderRadius:"var(--border-radius-lg)",
              overflow:"hidden", marginBottom:14 }}>
              <div style={{ padding:"10px 16px", background:"#E3F1E8", borderBottom:`1px solid ${C.bd}`,
                display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                <span style={{ fontSize:12, fontWeight:600, color:"var(--color-text-success)" }}>
                  ✅ 결과 — {results.rows.length.toLocaleString()}행 × {results.columns.length}열
                </span>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {resultDs && (
                    <Btn small onClick={saveResultAsTable}>
                      🗄️ 테이블로 저장 (재쿼리)
                    </Btn>
                  )}
                  {onAddDataset && resultDs && (
                    <Btn small variant="success" onClick={() => {
                      const name = `sql_${new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).replace(/:/g,"")}`;
                      onAddDataset({ ...resultDs, id: crypto.randomUUID(), name });
                    }}>
                      📥 새 데이터로 저장
                    </Btn>
                  )}
                  {resultDs && (
                    <Btn small onClick={() => downloadCSV(resultDs)}>
                      ⬇ CSV
                    </Btn>
                  )}
                  {apiKey && (
                    <Btn small variant="primary" onClick={interpretResult} disabled={aiLoading}>
                      {aiLoading ? "AI 분석 중…" : "🤖 AI 해석"}
                    </Btn>
                  )}
                </div>
              </div>
              <div style={{ padding:12 }}>
                <DataTable rows={results.rows} columns={results.columns} maxH={400} />
              </div>
            </div>
          )}

          {/* Auto-charts */}
          {resultDs && resultDs.rowCount > 0 && <SqlResultCharts key={resultDs.id} ds={resultDs} />}

          {/* AI interpretation */}
          {(aiResult || aiError || aiLoading) && (
            <div style={{ border:`1px solid ${C.bd}`, borderRadius:"var(--border-radius-lg)",
              overflow:"hidden", marginBottom:14 }}>
              <div style={{ padding:"10px 16px", background:"linear-gradient(90deg,#EAE8F5 0%,#F4F3FA 100%)",
                borderBottom:`1px solid ${C.bd}` }}>
                <span style={{ fontSize:13, fontWeight:600, color:"#4B3FA0" }}>🤖 AI 데이터 해석</span>
              </div>
              <div style={{ padding:16 }}>
                {aiLoading && (
                  <div style={{ fontSize:13, color:C.txS, textAlign:"center", padding:"24px 0" }}>
                    분석 중…
                  </div>
                )}
                {aiError && (
                  <div style={{ fontSize:12, color:C.dangerTx }}>⚠️ {aiError}</div>
                )}
                {aiResult && <MdBlock text={aiResult} />}
              </div>
            </div>
          )}

          {/* Query history */}
          {history.length > 0 && (
            <div style={{ border:`1px solid ${C.bd}`, borderRadius:"var(--border-radius-lg)", overflow:"hidden" }}>
              <div style={{ padding:"10px 16px", background:C.bgS, borderBottom:`1px solid ${C.bd}` }}>
                <span style={{ fontSize:12, fontWeight:600, color:C.txS }}>📋 쿼리 이력 (최근 10개)</span>
              </div>
              <div style={{ padding:8 }}>
                {history.map((h, i) => (
                  <div key={i} onClick={() => { setQuery(h.query); setEditSQL(h.sql); }}
                    style={{ padding:"8px 12px", borderRadius:"var(--border-radius-md)", cursor:"pointer",
                      background: i===0 ? C.bgS : "transparent", marginBottom:2,
                      transition:"background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background=C.bgS}
                    onMouseLeave={e => e.currentTarget.style.background=i===0?C.bgS:"transparent"}>
                    <div style={{ fontSize:12, color:C.tx, marginBottom:2, fontWeight:500 }}>{h.query}</div>
                    <div style={{ fontSize:11, color:C.txS, fontFamily:"var(--font-mono)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {h.sql} · {h.ts}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ SCHEMA TAB ════════════════════ */}
      {activeTab === "schema" && (
        <div style={{ border:`1px solid ${C.bd}`, borderRadius:"var(--border-radius-lg)", overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", background:C.bgS, borderBottom:`1px solid ${C.bd}` }}>
            <span style={{ fontSize:13, fontWeight:600, color:C.tx }}>📋 DB 스키마</span>
          </div>
          <div style={{ padding:16 }}>
            {tables.length === 0 ? (
              <div style={{ textAlign:"center", padding:"32px", color:C.txT, fontSize:13 }}>
                아직 테이블이 없습니다. '데이터 가져오기' 탭에서 테이블을 생성하세요.
              </div>
            ) : tables.map(t => {
              const db = dbRef.current;
              const cols = db.exec(`PRAGMA table_info("${t}")`);
              const cnt  = db.exec(`SELECT COUNT(*) FROM "${t}"`);
              const total = cnt[0]?.values?.[0]?.[0] ?? "?";
              return (
                <div key={t} style={{ marginBottom:14, border:`1px solid ${C.bd}`,
                  borderRadius:"var(--border-radius-md)", overflow:"hidden" }}>
                  <div style={{ padding:"8px 12px", background:"var(--color-background-success)",
                    borderBottom:`1px solid ${C.bd}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"var(--color-text-success)",
                      fontFamily:"var(--font-mono)" }}>{t}</span>
                    <span style={{ fontSize:11, color:C.txS }}>
                      {Number(total).toLocaleString()}행 · {(cols[0]?.values||[]).length}컬럼
                    </span>
                  </div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead>
                      <tr style={{ background:C.bgS }}>
                        {["#","컬럼명","타입","NOT NULL","기본값"].map(h => (
                          <th key={h} style={{ padding:"6px 10px", textAlign:"left", color:C.txS,
                            fontWeight:600, fontSize:11, borderBottom:`1px solid ${C.bd}`,
                            textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(cols[0]?.values || []).map((r, i) => (
                        <tr key={i} style={{ borderBottom:`1px solid ${C.bd}`,
                          background: i%2===0 ? C.bg : C.bgS }}>
                          <td style={{ padding:"5px 10px", color:C.txT, fontFamily:"var(--font-mono)" }}>{r[0]}</td>
                          <td style={{ padding:"5px 10px", color:C.tx, fontFamily:"var(--font-mono)", fontWeight:500 }}>{r[1]}</td>
                          <td style={{ padding:"5px 10px", color:C.infoTx, fontFamily:"var(--font-mono)" }}>{r[2]}</td>
                          <td style={{ padding:"5px 10px", color: r[3] ? C.dangerTx : C.txT }}>{r[3] ? "YES" : "-"}</td>
                          <td style={{ padding:"5px 10px", color:C.txT }}>{r[4] ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
