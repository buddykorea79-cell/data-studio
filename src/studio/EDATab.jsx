import { useState } from "react";
import { C, TYPE_CLR } from "../constants";
import { Btn, DsSelector, MdBlock } from "./UI";
import {
  getNumCols, getCatCols, ChartCard,
  HistChart, BarFreq, CorrHeatmap, MissingChart, GroupedBar,
  SpecChart, specValid,
} from "./Charts";

const MODELS = [
  { id: "deepseek/deepseek-v4-flash",   label: "DeepSeek V4 Flash" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
];

async function callOpenRouter(apiKey, model, prompt) {
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
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ── EDA helpers ───────────────────────────────────────────────────────────────
function buildSummary(ds, sampleN) {
  const rows = ds.rows.slice(0, sampleN);
  const colSum = ds.colMeta.map(col => {
    const base = `  - ${col.name} (${col.type}): 고유 ${col.stats.unique}개, 결측 ${col.stats.nullCount}개`;
    if (col.type === "number" && col.stats.mean !== undefined)
      return base + `, 평균 ${col.stats.mean}, min ${col.stats.min}, max ${col.stats.max}, std ${col.stats.std}`;
    if (col.type === "category" && col.stats.topValues)
      return base + `, 상위: ${col.stats.topValues.map(([v, c]) => `${v}(${c})`).join(",")}`;
    return base;
  });
  const esc = s => String(s ?? "").replace(/"/g, '""');
  const csv = [
    ds.columns.join(","),
    ...rows.map(r => ds.columns.map(c => `"${esc(r[c])}"`).join(",")),
  ].join("\n");
  return { colSum, csv, rowCount: ds.rowCount, colCount: ds.columns.length, sampleN: rows.length };
}

function buildPrompt(ds, type, customQ, sendMode, sampleN, summaryDs) {
  const sep = "\n";
  let dataCtx = "";

  if (sendMode === "stats") {
    const { colSum, rowCount, colCount } = buildSummary(ds, 0);
    dataCtx = ["## 데이터셋", `- 파일명: ${ds.name}`, `- 행: ${rowCount.toLocaleString()}, 열: ${colCount}`,
      "## 컬럼 통계", colSum.join(sep)].join(sep);
  } else if (sendMode === "summary" && summaryDs) {
    const { colSum, rowCount, colCount } = buildSummary(summaryDs, 0);
    const esc = s => String(s ?? "").replace(/"/g, '""');
    const csv = [
      summaryDs.columns.join(","),
      ...summaryDs.rows.slice(0, 50).map(r => summaryDs.columns.map(c => `"${esc(r[c])}"`).join(",")),
    ].join("\n");
    dataCtx = ["## 원본", `- ${ds.name}, 행: ${rowCount.toLocaleString()}, 열: ${colCount}`,
      "## 컬럼 통계", colSum.join(sep),
      `## 요약 테이블 (${summaryDs.name})`, "```csv", csv, "```"].join(sep);
  } else {
    const { colSum, csv, rowCount, colCount, sampleN: sn } = buildSummary(ds, sampleN);
    dataCtx = ["## 데이터셋", `- 파일명: ${ds.name}`,
      `- 행: ${rowCount.toLocaleString()}, 열: ${colCount}, 샘플: ${sn}행`,
      "## 컬럼 통계", colSum.join(sep), "## 샘플", "```csv", csv, "```"].join(sep);
  }

  // AI가 분석 결과와 어울리는 차트를 직접 추천하도록 스펙 JSON을 요구
  const chartInstr = `

## 차트 추천 (필수)
답변 맨 마지막에 아래 형식의 json 코드블록을 정확히 추가하세요. 분석 내용과 가장 관련 있는 차트 2~3개를 추천하고, 컬럼명은 위 데이터의 실제 컬럼명만 사용하세요.
\`\`\`json
{"charts":[{"type":"bar","x":"범주형컬럼명","y":"숫자컬럼명","agg":"mean","title":"차트 제목","reason":"추천 이유 한 줄"}]}
\`\`\`
- type: "bar"(범주별 비교) | "line"(추세) | "pie"(구성비) | "hist"(분포, y만 필요) | "scatter"(상관관계, x·y 모두 숫자 컬럼)
- agg: "mean" | "sum" | "count" — bar/line/pie에서 y 집계 방식 (count면 y 생략 가능)`;

  const base = `\n\n${dataCtx}${chartInstr}`;
  const prompts = {
    overview: `당신은 데이터 분석 전문가입니다. EDA 보고서를 한국어로 작성해 주세요.\n1. 데이터 개요 및 품질\n2. 컬럼별 특성\n3. 패턴/이상값\n4. 컬럼 간 관계\n5. 활용 시 주의사항${base}`,
    quality:  `당신은 데이터 품질 전문가입니다. 품질 평가를 한국어로 해주세요.\n1. 결측값 처리 방안\n2. 이상값 가능성\n3. 타입 불일치\n4. 중복 가능성\n5. 정제 우선순위${base}`,
    insight:  `당신은 비즈니스 인사이트 전문가입니다. 한국어로 인사이트를 도출해 주세요.\n1. 핵심 인사이트 3~5개\n2. 주요 트렌드/패턴\n3. 비즈니스 시사점\n4. 추가 데이터 제안${base}`,
    custom:   `당신은 데이터 분석 전문가입니다. 한국어로 답변해 주세요.\n질문: ${customQ}${base}`,
  };
  return prompts[type] || prompts.overview;
}

// ── AI 응답에서 차트 스펙 JSON 추출 ────────────────────────────────────────────
function extractChartSpecs(text) {
  const m = text.match(/```json\s*([\s\S]*?)```\s*$/) || text.match(/```json\s*([\s\S]*?)```/);
  if (m) {
    try {
      const obj = JSON.parse(m[1]);
      if (Array.isArray(obj?.charts) && obj.charts.length) {
        return { clean: text.replace(m[0], "").trim(), specs: obj.charts.slice(0, 4) };
      }
    } catch { /* JSON 파싱 실패 시 원문 그대로 표시 */ }
  }
  return { clean: text, specs: null };
}

// ── AI 결과 카드에 포함되는 관련 차트 (기본 펼침) ────────────────────────────────
function ResultChartsPanel({ ds, aType }) {
  if (!ds) return null;
  const numCols = getNumCols(ds);
  const catCols = getCatCols(ds);
  const totalMissing = ds.colMeta.reduce((s, c) => s + c.stats.nullCount, 0);

  if (aType === "overview") {
    return (
      <div style={{ padding: "14px 18px", borderTop: `0.5px solid ${C.bd}`, background: C.bgS }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.txS, marginBottom: 10,
          textTransform: "uppercase", letterSpacing: "0.05em" }}>
          📊 분석 관련 차트
        </div>
        {numCols.length >= 2 && (
          <ChartCard title="상관관계 히트맵"
            desc="색이 진할수록 두 컬럼의 선형 관계가 강합니다 (파랑=양의 상관, 빨강=음의 상관)">
            <CorrHeatmap ds={ds} />
          </ChartCard>
        )}
        {numCols.length > 0 && (
          <ChartCard title="숫자형 분포"
            desc="분포 모양이 종 모양에 가까울수록 표준 통계 기법 적용이 쉽습니다">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {numCols.slice(0, 4).map(col => (
                <div key={col.name}>
                  <div style={{ fontSize: 10, color: C.txS, marginBottom: 3, fontFamily: "var(--font-mono)" }}>{col.name}</div>
                  <HistChart ds={ds} col={col.name} />
                </div>
              ))}
            </div>
          </ChartCard>
        )}
      </div>
    );
  }

  if (aType === "quality") {
    return (
      <div style={{ padding: "14px 18px", borderTop: `0.5px solid ${C.bd}`, background: C.bgS }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.txS, marginBottom: 10,
          textTransform: "uppercase", letterSpacing: "0.05em" }}>
          📊 품질 관련 차트
        </div>
        <ChartCard title="결측값 현황"
          desc="빨간색 컬럼은 결측값 30% 이상 — 삭제 또는 보간을 우선 검토하세요">
          {totalMissing > 0 ? <MissingChart ds={ds} /> : (
            <div style={{ padding: "12px", background: "#E1F5EE", borderRadius: 8, fontSize: 12, color: "#0F6E56" }}>
              ✓ 결측값 없음 — 데이터 품질 양호
            </div>
          )}
        </ChartCard>
        {numCols.length > 0 && (
          <ChartCard title="숫자형 분포 (이상치 확인)"
            desc="분포 양쪽 끝에 고립된 막대가 있으면 이상치(Outlier)일 수 있습니다">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {numCols.slice(0, 4).map(col => (
                <div key={col.name}>
                  <div style={{ fontSize: 10, color: C.txS, marginBottom: 3, fontFamily: "var(--font-mono)" }}>
                    {col.name} <span style={{ color: C.txT }}>min {col.stats.min} / max {col.stats.max}</span>
                  </div>
                  <HistChart ds={ds} col={col.name} />
                </div>
              ))}
            </div>
          </ChartCard>
        )}
      </div>
    );
  }

  if (aType === "insight") {
    return (
      <div style={{ padding: "14px 18px", borderTop: `0.5px solid ${C.bd}`, background: C.bgS }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.txS, marginBottom: 10,
          textTransform: "uppercase", letterSpacing: "0.05em" }}>
          📊 인사이트 관련 차트
        </div>
        {catCols.length > 0 && (
          <ChartCard title={`${catCols[0].name} 분포`}
            desc="가장 빈도가 높은 범주가 핵심 세그먼트입니다">
            <BarFreq ds={ds} col={catCols[0].name} topN={10} />
          </ChartCard>
        )}
        {catCols.length > 0 && numCols.length > 0 && (
          <ChartCard title={`${catCols[0].name} 별 ${numCols[0].name} 평균`}
            desc="범주 간 차이가 클수록 해당 컬럼이 중요한 차별 인자입니다">
            <GroupedBar ds={ds} catCol={catCols[0].name} numCol={numCols[0].name} />
          </ChartCard>
        )}
        {catCols.length === 0 && numCols.length > 0 && (
          <ChartCard title="핵심 컬럼 분포">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {numCols.slice(0, 2).map(col => (
                <div key={col.name}>
                  <div style={{ fontSize: 10, color: C.txS, marginBottom: 3, fontFamily: "var(--font-mono)" }}>{col.name}</div>
                  <HistChart ds={ds} col={col.name} />
                </div>
              ))}
            </div>
          </ChartCard>
        )}
      </div>
    );
  }

  return null;
}

// ── EDATab ─────────────────────────────────────────────────────────────────────
export function EDATab({ allDs, summaryResults }) {
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem("openrouter_key") || "");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(MODELS[0].id);
  const [selId, setSelId] = useState(() => allDs[0]?.id ?? "");
  const [aType, setAType] = useState("overview");
  const [customQ, setCustomQ] = useState("");
  const [sendMode, setSendMode] = useState("sample");
  const [sampleN, setSampleN] = useState(30);
  const [summaryId, setSummaryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  const ds = allDs.find(d => d.id === selId);
  const saveKey = k => { setApiKey(k); sessionStorage.setItem("openrouter_key", k); };

  const ATYPES = [
    { id: "overview", label: "전체 EDA",         icon: "📊" },
    { id: "quality",  label: "데이터 품질",       icon: "🔍" },
    { id: "insight",  label: "비즈니스 인사이트", icon: "💡" },
    { id: "custom",   label: "직접 질문",         icon: "💬" },
  ];
  const SMODES = [
    { id: "sample",  label: "샘플 데이터", desc: "통계+샘플 전송" },
    { id: "stats",   label: "통계만",      desc: "토큰 최소화" },
    { id: "summary", label: "요약 테이블", desc: "Group/Pivot 결과" },
  ];

  const handle = async () => {
    if (!apiKey.trim()) return setError("API 키를 입력해 주세요.");
    if (!ds)            return setError("파일을 선택해 주세요.");
    if (aType === "custom" && !customQ.trim()) return setError("질문을 입력해 주세요.");
    if (sendMode === "summary" && !summaryId)  return setError("요약 테이블을 선택해 주세요.");

    const sumDs = summaryResults.find(d => d.id === summaryId);
    setError(""); setLoading(true);
    try {
      const prompt = buildPrompt(ds, aType, customQ, sendMode, sampleN, sumDs);
      const raw = await callOpenRouter(apiKey.trim(), model, prompt);
      const { clean, specs } = extractChartSpecs(raw);
      const tl = ATYPES.find(t => t.id === aType)?.label || aType;
      setResults(p => [{
        id: crypto.randomUUID(),
        dsName: ds.name,
        dsId: ds.id,
        aType,
        type: tl,
        question: aType === "custom" ? customQ : tl,
        result: clean,
        chartSpecs: specs,
        ts: new Date().toLocaleTimeString(),
      }, ...p]);
    } catch (e) {
      setError(`오류: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const btnStyle = active => ({
    padding: "9px 11px", borderRadius: "var(--border-radius-md)", cursor: "pointer",
    border: active ? "2px solid #185FA5" : `0.5px solid ${C.bd}`,
    background: active ? "#E6F1FB" : C.bg,
  });

  return (
    <div>
      {/* API 키 */}
      <div style={{ border: `0.5px solid ${C.bd}`, borderRadius: "var(--border-radius-lg)", overflow: "hidden", marginBottom: 14 }}>
        <div style={{ padding: "11px 14px", background: C.bgS, borderBottom: `0.5px solid ${C.bd}`,
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.tx }}>🔑 OpenRouter API 키</span>
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: C.infoTx, textDecoration: "none", padding: "2px 8px",
              borderRadius: 4, background: C.info, border: `1px solid ${C.infoTx}44` }}>
            무료 키 발급 →
          </a>
        </div>
        <div style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <input type={showKey ? "text" : "password"} placeholder="sk-or-v1-..."
              value={apiKey} onChange={e => saveKey(e.target.value)}
              style={{ flex: 1, fontSize: 13, padding: "7px 10px", borderRadius: "var(--border-radius-md)",
                border: `0.5px solid ${apiKey ? C.successTx+"88" : C.bdS}`,
                background: C.bg, color: C.tx, fontFamily: "var(--font-mono)" }} />
            <button type="button" onClick={() => setShowKey(p => !p)}
              style={{ fontSize: 11, padding: "3px 8px", cursor: "pointer",
                borderRadius: "var(--border-radius-md)", background: "transparent",
                border: `0.5px solid ${C.bdS}`, color: C.txS }}>
              {showKey ? "숨기기" : "보기"}
            </button>
            {apiKey && <span style={{ fontSize: 11, color: C.successTx, whiteSpace: "nowrap" }}>✓ 입력됨</span>}
          </div>
          <div style={{ fontSize: 11, color: C.txS }}>DB 분석 탭과 동일한 키 · 브라우저 세션에만 저장됩니다.</div>
        </div>
      </div>

      {/* 분석 설정 */}
      <div style={{ border: `0.5px solid ${C.bd}`, borderRadius: "var(--border-radius-lg)", overflow: "hidden", marginBottom: 14 }}>
        <div style={{ padding: "11px 14px", background: C.bgS, borderBottom: `0.5px solid ${C.bd}` }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.tx }}>✨ AI EDA 분석 설정</span>
        </div>
        <div style={{ padding: 14 }}>
          <DsSelector datasets={allDs} value={selId} onChange={setSelId} label="분석 파일" />

          {/* 모델 선택 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: C.txS, whiteSpace: "nowrap" }}>AI 모델</span>
            <select value={model} onChange={e => setModel(e.target.value)}
              style={{ flex: 1, fontSize: 13, padding: "6px 8px", borderRadius: "var(--border-radius-md)",
                border: `0.5px solid ${C.bdS}`, background: C.bg, color: C.tx }}>
              {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>

          {ds && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
              {ds.colMeta.slice(0, 8).map(col => (
                <span key={col.name} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4,
                  background: TYPE_CLR[col.type]?.bg || C.bgS, color: TYPE_CLR[col.type]?.tx || C.txS,
                  fontFamily: "var(--font-mono)" }}>
                  {col.name}
                </span>
              ))}
              {ds.colMeta.length > 8 && <span style={{ fontSize: 11, color: C.txT }}>+{ds.colMeta.length - 8}개</span>}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: C.txS, marginBottom: 6, fontWeight: 500 }}>분석 유형</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
              {ATYPES.map(t => (
                <div key={t.id} onClick={() => setAType(t.id)} style={btnStyle(aType === t.id)}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: aType === t.id ? "#185FA5" : C.tx }}>
                    {t.icon} {t.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {aType === "custom" && (
            <div style={{ marginBottom: 14 }}>
              <textarea placeholder={"예: 매출과 관련있는 컬럼은?\n이상치가 의심되는 행은?"}
                value={customQ} onChange={e => setCustomQ(e.target.value)} rows={3}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: "var(--border-radius-md)",
                  border: `0.5px solid ${C.bdS}`, background: C.bg, color: C.tx,
                  resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: C.txS, marginBottom: 6, fontWeight: 500 }}>데이터 전송 방식</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SMODES.map(m => (
                <div key={m.id} onClick={() => setSendMode(m.id)}
                  style={{ ...btnStyle(sendMode === m.id), flex: 1, minWidth: 110 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: sendMode === m.id ? "#185FA5" : C.tx }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: C.txS }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {sendMode === "sample" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: C.txS }}>샘플 행 수</span>
              <input type="number" min={5} max={200} value={sampleN}
                onChange={e => setSampleN(Math.max(5, Math.min(200, +e.target.value)))}
                style={{ width: 72, fontSize: 13, padding: "5px 8px", borderRadius: "var(--border-radius-md)",
                  border: `0.5px solid ${C.bdS}`, background: C.bg, color: C.tx }} />
              <span style={{ fontSize: 11, color: C.txS }}>행 (전체: {ds?.rowCount.toLocaleString()})</span>
            </div>
          )}

          {sendMode === "summary" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.txS, marginBottom: 4 }}>요약/피벗 테이블 선택</div>
              {summaryResults.length === 0
                ? <div style={{ fontSize: 12, color: C.txT }}>데이터 요약 탭에서 Group/Pivot 실행 후 사용 가능합니다.</div>
                : (
                  <select value={summaryId} onChange={e => setSummaryId(e.target.value)}
                    style={{ width: "100%", fontSize: 13, padding: "6px 8px", borderRadius: "var(--border-radius-md)",
                      border: `0.5px solid ${C.bdS}`, background: C.bg, color: C.tx }}>
                    <option value="">— 선택 —</option>
                    {summaryResults.map(d => <option key={d.id} value={d.id}>{d.name} ({d.rowCount}행)</option>)}
                  </select>
                )
              }
            </div>
          )}

          {ds && (
            <div style={{ fontSize: 11, color: C.txS, background: C.bgS, padding: "8px 10px",
              borderRadius: "var(--border-radius-md)", marginBottom: 12 }}>
              📤 전송: {sendMode === "stats" ? "통계만" : sendMode === "summary" ? "요약 테이블" : `샘플 ${Math.min(sampleN, ds.rowCount)}행`}
              {" · "}모델: {MODELS.find(m => m.id === model)?.label}
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: C.dangerTx, background: C.danger,
              padding: "8px 10px", borderRadius: "var(--border-radius-md)", marginBottom: 10 }}>
              {error}
            </div>
          )}
          <Btn variant="primary" onClick={handle} disabled={loading || !apiKey || !ds}>
            {loading ? "AI 분석 중..." : "✨ AI EDA 분석 시작"}
          </Btn>
        </div>
      </div>

      {loading && (
        <div style={{ border: `0.5px solid ${C.bd}`, borderRadius: "var(--border-radius-lg)",
          padding: "28px 24px", textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 18, marginBottom: 10 }}>✨</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.tx, marginBottom: 5 }}>분석 중...</div>
          <div style={{ fontSize: 12, color: C.txS }}>5~20초 소요될 수 있습니다</div>
        </div>
      )}

      {results.map(r => {
        const chartDs = allDs.find(d => d.id === r.dsId);
        const validSpecs = chartDs && r.chartSpecs ? r.chartSpecs.filter(s => specValid(chartDs, s)) : [];
        return (
          <div key={r.id} style={{ border: `0.5px solid ${C.bd}`, borderRadius: "var(--border-radius-lg)",
            overflow: "hidden", marginBottom: 14 }}>
            {/* 결과 헤더 */}
            <div style={{ padding: "11px 14px", background: "#E6F1FB", borderBottom: `0.5px solid ${C.bd}`,
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#185FA5", color: "#fff", fontWeight: 500 }}>AI</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#0C447C" }}>{r.type}</span>
                <span style={{ fontSize: 12, color: "#185FA5" }}>— {r.dsName}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#378ADD" }}>{r.ts}</span>
                <button type="button" onClick={() => navigator.clipboard.writeText(r.result)}
                  style={{ fontSize: 11, padding: "3px 8px", cursor: "pointer", borderRadius: "var(--border-radius-md)",
                    background: "transparent", border: `0.5px solid ${C.bdS}`, color: C.txS }}>복사</button>
                <button type="button" onClick={() => setResults(p => p.filter(x => x.id !== r.id))}
                  style={{ fontSize: 11, padding: "3px 8px", cursor: "pointer", borderRadius: "var(--border-radius-md)",
                    background: "transparent", border: `0.5px solid ${C.bdS}`, color: C.txS }}>제거</button>
              </div>
            </div>
            {r.aType === "custom" && (
              <div style={{ padding: "8px 14px", background: C.bgS, borderBottom: `0.5px solid ${C.bd}`,
                fontSize: 12, color: C.txS }}>Q: {r.question}</div>
            )}

            {/* 텍스트 + 차트를 나란히 (wide) 또는 세로 (narrow) */}
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {/* AI 텍스트 결과 */}
              <div style={{ flex: "1 1 340px", padding: "14px 18px", maxHeight: 600,
                overflowY: "auto", borderRight: `0.5px solid ${C.bd}` }}>
                <MdBlock text={r.result} />
              </div>

              {/* AI 추천 차트 — AI가 응답에 포함한 차트 스펙을 그대로 렌더링 */}
              {validSpecs.length > 0 ? (
                <div style={{ flex: "1 1 340px", overflowY: "auto", maxHeight: 600 }}>
                  <div style={{ padding: "14px 18px", borderTop: `0.5px solid ${C.bd}`, background: C.bgS }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.txS, marginBottom: 10,
                      textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      📊 AI 추천 차트
                    </div>
                    {validSpecs.map((s, i) => (
                      <ChartCard key={i} title={s.title || `${s.x || s.y} 차트`} desc={s.reason}>
                        <SpecChart ds={chartDs} spec={s} />
                      </ChartCard>
                    ))}
                  </div>
                </div>
              ) : chartDs && r.aType !== "custom" && (
                <div style={{ flex: "1 1 340px", overflowY: "auto", maxHeight: 600 }}>
                  <ResultChartsPanel ds={chartDs} aType={r.aType} />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {results.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "36px", color: C.txT, fontSize: 13,
          border: `0.5px solid ${C.bd}`, borderRadius: "var(--border-radius-lg)" }}>
          {ds
            ? "API 키 입력 후 AI 분석을 실행하면, 분석 결과와 함께 AI가 추천하는 차트가 표시됩니다. (일반 시각화는 ⑤ 차트 탭 이용)"
            : "파일을 선택해 주세요."}
        </div>
      )}
    </div>
  );
}
