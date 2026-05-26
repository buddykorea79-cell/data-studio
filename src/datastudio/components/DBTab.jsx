import { useState, useEffect, useRef } from "react";
import { C } from "../../constants";
import { Btn, DsSelector, DataTable } from "./UI";

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
      temperature: 0.1,
      max_tokens: 1024,
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

export function DBTab({ allDs }) {
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
  const [history,  setHistory]        = useState([]);
  const [loading,  setLoading]        = useState(false);
  const [error,    setError]          = useState("");
  const [activeTab,setActiveTab]      = useState("import");

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
      setImportMsg(`✅ "${name}" 테이블 생성 완료 (${ds.rowCount.toLocaleString()}행)`);
      setTblName("");
      setActiveTab("query");
    } catch (e) {
      setError(`가져오기 실패: ${e.message}`);
    } finally {
      setImporting(false);
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
    setError("");
    try {
      const res = db.exec(sql);
      if (!res.length) {
        setResults({ columns: ["결과"], rows: [{ 결과: "쿼리 실행 완료 (반환 행 없음)" }] });
      } else {
        const { columns, values } = res[0];
        setResults({
          columns,
          rows: values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]]))),
        });
      }
      setHistory(p => [{ query, sql, ts: new Date().toLocaleTimeString() }, ...p].slice(0, 10));
      refreshTables();
    } catch (e) {
      setError(`실행 오류: ${e.message}`);
      setResults(null);
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

          {/* Results */}
          {results && (
            <div style={{ border:`1px solid ${C.bd}`, borderRadius:"var(--border-radius-lg)",
              overflow:"hidden", marginBottom:14 }}>
              <div style={{ padding:"10px 16px", background:"#E3F1E8", borderBottom:`1px solid ${C.bd}`,
                display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:12, fontWeight:600, color:"var(--color-text-success)" }}>
                  ✅ 결과 — {results.rows.length.toLocaleString()}행 × {results.columns.length}열
                </span>
              </div>
              <div style={{ padding:12 }}>
                <DataTable rows={results.rows} columns={results.columns} maxH={400} />
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
