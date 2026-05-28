import { useState } from "react";
import { C, TYPE_CLR } from "../constants";
import { Btn, DsSelector, MdBlock } from "./UI";
import { callGemini } from "../utils/mlUtils";
import {
  getNumCols, getCatCols, ChartCard,
  HistChart, BarFreq, PieFreq, CorrHeatmap, MissingChart, GroupedBar,
} from "./Charts";

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

  const base = `\n\n${dataCtx}`;
  const prompts = {
    overview: `당신은 데이터 분석 전문가입니다. EDA 보고서를 한국어로 작성해 주세요.\n1. 데이터 개요 및 품질\n2. 컬럼별 특성\n3. 패턴/이상값\n4. 컬럼 간 관계\n5. 활용 시 주의사항${base}`,
    quality:  `당신은 데이터 품질 전문가입니다. 품질 평가를 한국어로 해주세요.\n1. 결측값 처리 방안\n2. 이상값 가능성\n3. 타입 불일치\n4. 중복 가능성\n5. 정제 우선순위${base}`,
    insight:  `당신은 비즈니스 인사이트 전문가입니다. 한국어로 인사이트를 도출해 주세요.\n1. 핵심 인사이트 3~5개\n2. 주요 트렌드/패턴\n3. 비즈니스 시사점\n4. 추가 데이터 제안${base}`,
    custom:   `당신은 데이터 분석 전문가입니다. 한국어로 답변해 주세요.\n질문: ${customQ}${base}`,
  };
  return prompts[type] || prompts.overview;
}

// ── 자동 차트 섹션 (API 키 없이 항상 표시) ────────────────────────────────────
function AutoChartSection({ ds }) {
  const [open, setOpen] = useState(true);
  const numCols = getNumCols(ds);
  const catCols = getCatCols(ds);
  const totalMissing = ds.colMeta.reduce((s, c) => s + c.stats.nullCount, 0);

  return (
    <div style={{ border: `0.5px solid ${C.bd}`, borderRadius: "var(--border-radius-lg)", overflow: "hidden", marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        style={{ width: "100%", padding: "11px 14px", background: C.bgS,
          borderBottom: open ? `0.5px solid ${C.bd}` : "none",
          border: "none", cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "space-between", textAlign: "left" }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: C.tx }}>
          📊 데이터 자동 시각화 — {ds.name}
        </span>
        <span style={{ fontSize: 11, color: C.txS }}>{open ? "▲ 접기" : "▼ 펼치기"}</span>
      </button>

      {open && (
        <div style={{ padding: 14 }}>
          {/* 요약 통계 카드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 14 }}>
            {[
              ["전체 행", ds.rowCount.toLocaleString(), null],
              ["숫자형 컬럼", numCols.length, null],
              ["범주형 컬럼", catCols.length, null],
              ["결측값 총합", totalMissing.toLocaleString(), totalMissing > 0 ? "#BA7517" : "#1D9E75"],
            ].map(([l, v, color]) => (
              <div key={l} style={{ background: C.bgS, borderRadius: "var(--border-radius-md)", padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: C.txS, marginBottom: 3 }}>{l}</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: color || C.tx, fontFamily: "var(--font-mono)" }}>{v}</div>
              </div>
            ))}
          </div>

          {/* 숫자형 분포 */}
          {numCols.length > 0 && (
            <ChartCard
              title="숫자형 컬럼 분포 (히스토그램)"
              subtitle={numCols.slice(0, 4).map(c => c.name).join(" · ")}
              desc="막대가 한쪽으로 치우치면 왜도가 있는 데이터입니다. 양 끝에 극단값이 있으면 이상치(Outlier)를 의심해 보세요."
            >
              <div style={{ display: "grid", gridTemplateColumns: numCols.length > 1 ? "1fr 1fr" : "1fr", gap: 16 }}>
                {numCols.slice(0, 4).map(col => (
                  <div key={col.name}>
                    <div style={{ fontSize: 11, color: C.txS, marginBottom: 3, fontFamily: "var(--font-mono)" }}>
                      {col.name}
                      <span style={{ color: C.txT, marginLeft: 6 }}>
                        평균 {col.stats.mean} · 표준편차 {col.stats.std}
                      </span>
                    </div>
                    <HistChart ds={ds} col={col.name} />
                  </div>
                ))}
              </div>
            </ChartCard>
          )}

          {/* 범주형 분포 */}
          {catCols.length > 0 && (
            <ChartCard
              title="범주형 컬럼 빈도"
              subtitle={catCols.slice(0, 3).map(c => c.name).join(" · ")}
              desc="특정 범주가 압도적으로 많으면 클래스 불균형(Imbalanced) 데이터입니다. ML 분류 시 주의가 필요합니다."
            >
              <div style={{ display: "grid", gridTemplateColumns: catCols.length > 1 ? "1fr 1fr" : "1fr", gap: 18 }}>
                {catCols.slice(0, 4).map(col => (
                  <div key={col.name}>
                    <div style={{ fontSize: 11, color: C.txS, marginBottom: 3, fontFamily: "var(--font-mono)" }}>
                      {col.name}
                      <span style={{ color: C.txT, marginLeft: 6 }}>고유값 {col.stats.unique}개</span>
                    </div>
                    <BarFreq ds={ds} col={col.name} topN={8} />
                  </div>
                ))}
              </div>
            </ChartCard>
          )}

          {/* 상관관계 히트맵 */}
          {numCols.length >= 2 && (
            <ChartCard
              title="상관관계 히트맵"
              subtitle="숫자형 컬럼 간 피어슨 상관계수 (최대 10개 컬럼)"
              desc="파란색 진할수록 양의 상관(같이 증가), 빨간색 진할수록 음의 상관(반대 방향). |0.7| 이상이면 강한 관계입니다. 피처 선택 시 활용하세요."
            >
              <CorrHeatmap ds={ds} />
            </ChartCard>
          )}

          {/* 결측값 */}
          {totalMissing > 0 && (
            <ChartCard
              title="결측값 현황"
              subtitle="컬럼별 결측 비율 (빨강 30% 이상, 주황 10% 이상)"
              desc="결측 비율이 높은 컬럼은 분석 신뢰도를 낮춥니다. 전처리 탭에서 평균/최빈값 채우기 또는 컬럼 제거를 검토하세요."
            >
              <MissingChart ds={ds} />
            </ChartCard>
          )}

          {/* 범주별 수치 평균 */}
          {catCols.length > 0 && numCols.length > 0 && (
            <ChartCard
              title={`${catCols[0].name} 별 ${numCols[0].name} 평균`}
              subtitle="범주 간 수치 차이 비교"
              desc="범주 간 평균 차이가 클수록 해당 범주 컬럼이 예측 모델에서 중요한 피처일 가능성이 높습니다."
            >
              <GroupedBar ds={ds} catCol={catCols[0].name} numCol={numCols[0].name} />
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
}

// ── Gemini 결과 카드에 연결된 관련 차트 패널 ──────────────────────────────────
function ResultChartsPanel({ ds, aType }) {
  const [open, setOpen] = useState(false);
  if (!ds) return null;

  const numCols = getNumCols(ds);
  const catCols = getCatCols(ds);
  const totalMissing = ds.colMeta.reduce((s, c) => s + c.stats.nullCount, 0);

  let chartContent = null;
  let chartLabel = "";

  if (aType === "overview") {
    chartLabel = "개요 관련 차트: 분포 + 상관관계";
    chartContent = (
      <div>
        {numCols.length >= 2 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.txS, marginBottom: 4 }}>상관관계 히트맵</div>
            <div style={{ fontSize: 11, color: C.txT, marginBottom: 8 }}>
              색이 진할수록 두 컬럼의 선형 관계가 강합니다 (파랑=양의 상관, 빨강=음의 상관)
            </div>
            <CorrHeatmap ds={ds} />
          </div>
        )}
        {numCols.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.txS, marginBottom: 4 }}>숫자형 분포</div>
            <div style={{ fontSize: 11, color: C.txT, marginBottom: 8 }}>
              분포 모양이 종 모양(정규분포)에 가까울수록 표준 통계 기법을 적용하기 쉽습니다
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {numCols.slice(0, 4).map(col => (
                <div key={col.name}>
                  <div style={{ fontSize: 10, color: C.txS, marginBottom: 3, fontFamily: "var(--font-mono)" }}>{col.name}</div>
                  <HistChart ds={ds} col={col.name} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (aType === "quality") {
    chartLabel = "품질 관련 차트: 결측값 + 이상치 확인";
    chartContent = (
      <div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: C.txS, marginBottom: 4 }}>결측값 현황</div>
          <div style={{ fontSize: 11, color: C.txT, marginBottom: 8 }}>
            빨간색 컬럼은 결측값 30% 이상 — 삭제 또는 보간을 우선 검토하세요
          </div>
          {totalMissing > 0 ? <MissingChart ds={ds} /> : (
            <div style={{ padding: "12px", background: "#E1F5EE", borderRadius: 8, fontSize: 12, color: "#0F6E56" }}>
              ✓ 결측값 없음 — 데이터 품질 양호
            </div>
          )}
        </div>
        {numCols.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.txS, marginBottom: 4 }}>숫자형 분포 (이상치 확인)</div>
            <div style={{ fontSize: 11, color: C.txT, marginBottom: 8 }}>
              분포 양쪽 끝에 고립된 막대가 있으면 이상치(Outlier)일 수 있습니다
            </div>
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
          </div>
        )}
      </div>
    );
  }

  if (aType === "insight") {
    chartLabel = "인사이트 관련 차트: 주요 범주 + 비교";
    chartContent = (
      <div>
        {catCols.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.txS, marginBottom: 4 }}>
              {catCols[0].name} 분포
            </div>
            <div style={{ fontSize: 11, color: C.txT, marginBottom: 8 }}>
              가장 빈도가 높은 범주가 핵심 세그먼트입니다
            </div>
            <BarFreq ds={ds} col={catCols[0].name} topN={10} />
          </div>
        )}
        {catCols.length > 0 && numCols.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.txS, marginBottom: 4 }}>
              {catCols[0].name} 별 {numCols[0].name} 평균
            </div>
            <div style={{ fontSize: 11, color: C.txT, marginBottom: 8 }}>
              범주 간 차이가 클수록 해당 컬럼이 중요한 차별 인자입니다
            </div>
            <GroupedBar ds={ds} catCol={catCols[0].name} numCol={numCols[0].name} />
          </div>
        )}
        {catCols.length === 0 && numCols.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.txS, marginBottom: 4 }}>핵심 컬럼 분포</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {numCols.slice(0, 2).map(col => (
                <div key={col.name}>
                  <div style={{ fontSize: 10, color: C.txS, marginBottom: 3, fontFamily: "var(--font-mono)" }}>{col.name}</div>
                  <HistChart ds={ds} col={col.name} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!chartContent) return null;

  return (
    <div style={{ borderTop: `0.5px solid ${C.bd}` }}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        style={{ width: "100%", padding: "10px 18px", background: open ? C.bgS : "transparent",
          border: "none", cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "space-between", borderBottom: open ? `0.5px solid ${C.bd}` : "none" }}
      >
        <span style={{ fontSize: 12, color: C.infoTx, fontWeight: 500 }}>📊 {chartLabel}</span>
        <span style={{ fontSize: 11, color: C.txS }}>{open ? "▲ 접기" : "▼ 차트 보기"}</span>
      </button>
      {open && <div style={{ padding: "14px 18px" }}>{chartContent}</div>}
    </div>
  );
}

// ── EDATab ─────────────────────────────────────────────────────────────────────
export function EDATab({ allDs, summaryResults }) {
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem("gemini_key") || "");
  const [showKey, setShowKey] = useState(false);
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
  const saveKey = k => { setApiKey(k); sessionStorage.setItem("gemini_key", k); };

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
      const result = await callGemini(apiKey.trim(), prompt);
      const tl = ATYPES.find(t => t.id === aType)?.label || aType;
      setResults(p => [{
        id: crypto.randomUUID(),
        dsName: ds.name,
        dsId: ds.id,
        aType,
        type: tl,
        question: aType === "custom" ? customQ : tl,
        result,
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
      {/* 자동 시각화 섹션 (API 키 불필요) */}
      {ds && <AutoChartSection ds={ds} />}

      {/* API 키 */}
      <div style={{ border: `0.5px solid ${C.bd}`, borderRadius: "var(--border-radius-lg)", overflow: "hidden", marginBottom: 14 }}>
        <div style={{ padding: "11px 14px", background: C.bgS, borderBottom: `0.5px solid ${C.bd}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.tx }}>🔑 Gemini API 키</span>
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: C.infoTx, textDecoration: "none", padding: "2px 8px", borderRadius: 4, background: C.info }}>
            키 발급 →
          </a>
        </div>
        <div style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <input
              type={showKey ? "text" : "password"}
              placeholder="Google AI Studio API 키 (AIza...)"
              value={apiKey} onChange={e => saveKey(e.target.value)}
              style={{ flex: 1, fontSize: 13, padding: "7px 10px", borderRadius: "var(--border-radius-md)",
                border: `0.5px solid ${apiKey ? "#1D9E75" : C.bdS}`, background: C.bg, color: C.tx, fontFamily: "var(--font-mono)" }}
            />
            <button type="button" onClick={() => setShowKey(p => !p)} style={{ fontSize: 11, padding: "3px 8px", cursor: "pointer",
              borderRadius: "var(--border-radius-md)", background: "transparent", border: `0.5px solid ${C.bdS}`, color: C.txS }}>
              {showKey ? "숨기기" : "보기"}
            </button>
            {apiKey && <span style={{ fontSize: 11, color: "#1D9E75", whiteSpace: "nowrap" }}>✓ 입력됨</span>}
          </div>
          <div style={{ fontSize: 11, color: C.txS }}>키는 브라우저 세션에만 저장됩니다.</div>
        </div>
      </div>

      {/* 분석 설정 */}
      <div style={{ border: `0.5px solid ${C.bd}`, borderRadius: "var(--border-radius-lg)", overflow: "hidden", marginBottom: 14 }}>
        <div style={{ padding: "11px 14px", background: C.bgS, borderBottom: `0.5px solid ${C.bd}` }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.tx }}>✨ Gemini AI 분석 설정</span>
        </div>
        <div style={{ padding: 14 }}>
          <DsSelector datasets={allDs} value={selId} onChange={setSelId} label="분석 파일" />

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
              📤 전송: {sendMode === "stats" ? "통계만" : sendMode === "summary" ? "요약 테이블" : `샘플 ${Math.min(sampleN, ds.rowCount)}행`} · 모델: gemini-2.0-flash
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: "#A32D2D", background: "#FCEBEB",
              padding: "8px 10px", borderRadius: "var(--border-radius-md)", marginBottom: 10 }}>
              {error}
            </div>
          )}
          <Btn variant="primary" onClick={handle} disabled={loading || !apiKey || !ds}>
            {loading ? "Gemini 분석 중..." : "✨ Gemini EDA 분석 시작"}
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
        return (
          <div key={r.id} style={{ border: `0.5px solid ${C.bd}`, borderRadius: "var(--border-radius-lg)",
            overflow: "hidden", marginBottom: 14 }}>
            {/* 결과 헤더 */}
            <div style={{ padding: "11px 14px", background: "#E6F1FB", borderBottom: `0.5px solid ${C.bd}`,
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#185FA5", color: "#fff", fontWeight: 500 }}>Gemini</span>
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
            {/* AI 텍스트 결과 */}
            <div style={{ padding: "14px 18px", maxHeight: 560, overflowY: "auto" }}>
              <MdBlock text={r.result} />
            </div>
            {/* 관련 차트 (overview / quality / insight) */}
            {chartDs && r.aType !== "custom" && (
              <ResultChartsPanel ds={chartDs} aType={r.aType} />
            )}
          </div>
        );
      })}

      {results.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "36px", color: C.txT, fontSize: 13,
          border: `0.5px solid ${C.bd}`, borderRadius: "var(--border-radius-lg)" }}>
          {ds
            ? "위 시각화를 먼저 확인하고, API 키 입력 후 AI 분석을 실행해 보세요."
            : "파일을 선택해 주세요."}
        </div>
      )}
    </div>
  );
}
