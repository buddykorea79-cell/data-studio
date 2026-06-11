import { useState, useRef } from "react";
import { BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { C, PALETTE } from "../constants";
import { Btn, Section, DsSelector, MdBlock } from "./UI";
import { normalize, denorm, prepareFeatures, trainTestSplit,
  linearRegression, logisticRegression, kmeans, mlp, sigmoid,
  polyFeatures, lassoRegression, randomForestRegression, naiveBayes,
  randomForestClassification, linearSVM, dbscan,
  holtWinters, seasonalDecompose, detectAnomalies, autocorrelation, detectSeasonality, rollingStats,
} from "../utils/mlUtils";
import { ChartCard, SpecChart, specValid, DownloadableChart } from "./Charts";

const OR_MODEL = "deepseek/deepseek-v4-flash";

async function callOpenRouter(apiKey, systemPrompt, userMsg, maxTokens = 2000) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "Data Studio",
    },
    body: JSON.stringify({
      model: OR_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMsg },
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// AI 응답에서 JSON 객체 추출 (코드블록 우선, 실패 시 본문에서 탐색)
function extractJSON(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text].filter(Boolean);
  for (const cand of candidates) {
    const start = cand.indexOf("{");
    const end   = cand.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try { return JSON.parse(cand.slice(start, end + 1)); } catch { /* 다음 후보 */ }
  }
  return null;
}

// AI 해석 응답에서 차트 스펙 분리 (EDA 탭과 동일 형식)
function extractChartSpecs(text) {
  const m = text.match(/```json\s*([\s\S]*?)```\s*$/) || text.match(/```json\s*([\s\S]*?)```/);
  if (m) {
    try {
      const obj = JSON.parse(m[1]);
      if (Array.isArray(obj?.charts) && obj.charts.length) {
        return { clean: text.replace(m[0], "").trim(), specs: obj.charts.slice(0, 3) };
      }
    } catch { /* 원문 그대로 */ }
  }
  return { clean: text, specs: null };
}

// ── Grade helpers ─────────────────────────────────────────────────────────────
function gradeR2(v) {
  if (v >= 0.9) return { grade:"매우 우수", color:"#0F6E56", bg:"#EAF3DE" };
  if (v >= 0.7) return { grade:"우수",     color:"#1D9E75", bg:"#E1F5EE" };
  if (v >= 0.5) return { grade:"보통",     color:"#BA7517", bg:"#FAEEDA" };
  return { grade:"개선 필요", color:"#A32D2D", bg:"#FCEBEB" };
}
function gradeAcc(v) {
  if (v >= 90) return { grade:"매우 우수", color:"#0F6E56", bg:"#EAF3DE" };
  if (v >= 75) return { grade:"우수",     color:"#1D9E75", bg:"#E1F5EE" };
  if (v >= 60) return { grade:"보통",     color:"#BA7517", bg:"#FAEEDA" };
  return { grade:"개선 필요", color:"#A32D2D", bg:"#FCEBEB" };
}

// ── Result card ───────────────────────────────────────────────────────────────
function EasyResultCard({ result, targetCol }) {
  if (!result) return null;

  if (result.task === "regression") {
    const g = gradeR2(result.testR2);
    const overfitWarn = result.trainR2 && result.testR2 && (result.trainR2 - result.testR2) > 0.2;
    return (
      <div style={{ borderRadius:"var(--border-radius-lg)", border:"2px solid "+g.color,
        background:g.bg, padding:"16px 18px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <span style={{ fontSize:20 }}>📈</span>
          <div>
            <div style={{ fontSize:14, fontWeight:500, color:g.color }}>회귀 결과: {g.grade}</div>
            <div style={{ fontSize:12, color:C.txS }}>"{targetCol}" 값 예측 모델</div>
          </div>
          <div style={{ marginLeft:"auto", textAlign:"right" }}>
            <div style={{ fontSize:22, fontWeight:700, color:g.color, fontFamily:"var(--font-mono)" }}>R² {result.testR2}</div>
            <div style={{ fontSize:11, color:C.txS }}>RMSE: {result.testRmse}</div>
          </div>
        </div>
        <div style={{ fontSize:13, color:C.tx, lineHeight:1.8, background:"rgba(255,255,255,0.6)", borderRadius:8, padding:"10px 12px" }}>
          📊 <strong>R² 해석</strong>: "{targetCol}"의 전체 변동 중 <strong>{Math.round(result.testR2*100)}%</strong>를 이 모델이 설명합니다.
          {result.testR2 >= 0.9 ? " (10% 미만 설명 못 함 — 매우 높은 예측력)" : result.testR2 >= 0.7 ? " (꽤 잘 예측하지만 개선 여지 있음)" : result.testR2 >= 0.5 ? " (절반 이상 설명 — 추가 피처가 도움될 것)" : " (설명력 부족 — 피처 점검 권장)"}<br/>
          📏 <strong>RMSE 해석</strong>: 예측값이 평균적으로 실제값과 <strong>{result.testRmse}</strong> 차이납니다.<br/>
          📦 학습 데이터: {result.nTrain}행 / 검증 데이터: {result.nTest}행
          {overfitWarn && <><br/>⚠️ <strong style={{color:"#A32D2D"}}>과적합 경고</strong>: 학습 R²({result.trainR2}) &gt; 검증 R²({result.testR2}) 차이가 큽니다. 릿지·라쏘 정규화를 시도해 보세요.</>}
        </div>
      </div>
    );
  }

  if (result.task === "classification" || result.task === "neural") {
    const g = gradeAcc(result.testAcc);
    const label = result.task === "neural" ? "신경망" : "분류";
    const trainTestGap = result.trainAcc && result.testAcc && (result.trainAcc - result.testAcc) > 15;
    return (
      <div style={{ borderRadius:"var(--border-radius-lg)", border:"2px solid "+g.color,
        background:g.bg, padding:"16px 18px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <span style={{ fontSize:20 }}>{result.task==="neural" ? "🧠" : "🏷️"}</span>
          <div>
            <div style={{ fontSize:14, fontWeight:500, color:g.color }}>{label} 결과: {g.grade}</div>
            <div style={{ fontSize:12, color:C.txS }}>"{targetCol}" · {result.classes?.length}개 클래스</div>
          </div>
          <div style={{ marginLeft:"auto", textAlign:"right" }}>
            <div style={{ fontSize:22, fontWeight:700, color:g.color, fontFamily:"var(--font-mono)" }}>{result.testAcc}%</div>
            {result.trainAcc && <div style={{ fontSize:11, color:C.txS }}>학습: {result.trainAcc}%</div>}
          </div>
        </div>
        <div style={{ fontSize:13, color:C.tx, lineHeight:1.8, background:"rgba(255,255,255,0.6)", borderRadius:8, padding:"10px 12px" }}>
          🎯 검증 <strong>{result.nTest}행</strong> 중 <strong>{Math.round(result.nTest*result.testAcc/100)}행</strong> 정확히 분류했습니다.<br/>
          📋 클래스 수: {result.classes?.length}개 ({result.classes?.slice(0,5).join(", ")}{result.classes?.length>5?"...":""})<br/>
          {result.testAcc >= 90 ? "🎉 매우 우수! 모델이 클래스 패턴을 잘 파악했습니다."
            : result.testAcc >= 75 ? "✅ 좋은 성능. 혼동 행렬에서 틀린 클래스를 확인해 보세요."
            : result.testAcc >= 60 ? "⚠️ 보통 수준. 더 많은 피처 추가나 불균형 클래스 처리를 고려하세요."
            : "❌ 개선 필요. 피처 선택·전처리·클래스 불균형을 점검하세요."}
          {trainTestGap && <><br/>⚠️ <strong style={{color:"#A32D2D"}}>과적합 의심</strong>: 학습 정확도({result.trainAcc}%)와 검증({result.testAcc}%) 차이가 큽니다.</>}
        </div>
      </div>
    );
  }

  if (result.task === "clustering") {
    const total = result.sizes?.reduce((a,b)=>a+b,0)||1;
    const method = result.modelId === "dbscan" ? "DBSCAN" : `K-Means (K=${result.k})`;
    return (
      <div style={{ borderRadius:"var(--border-radius-lg)", border:"2px solid #185FA5",
        background:"#E6F1FB", padding:"16px 18px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <span style={{ fontSize:20 }}>🔵</span>
          <div>
            <div style={{ fontSize:14, fontWeight:500, color:"#185FA5" }}>군집화 완료 — {method}</div>
            <div style={{ fontSize:12, color:C.txS }}>
              {result.modelId==="dbscan"
                ? `${result.nClusters}개 군집 + 이상치 ${result.noise}개 발견`
                : "비슷한 특성끼리 자동 그룹화"}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
          {result.sizes?.map((s, i) => (
            <div key={i} style={{ background:"rgba(255,255,255,0.7)", borderRadius:8, padding:"5px 10px", fontSize:12 }}>
              <span style={{ color:PALETTE[i%PALETTE.length], fontWeight:500 }}>그룹{i+1}</span>
              <span style={{ color:C.txS, marginLeft:6 }}>{s}개 ({Math.round(s/total*100)}%)</span>
            </div>
          ))}
          {result.noise > 0 && (
            <div style={{ background:"rgba(255,255,255,0.7)", borderRadius:8, padding:"5px 10px", fontSize:12 }}>
              <span style={{ color:"#A32D2D", fontWeight:500 }}>이상치</span>
              <span style={{ color:C.txS, marginLeft:6 }}>{result.noise}개 ({Math.round(result.noise/total*100)}%)</span>
            </div>
          )}
        </div>
        {result.modelId==="dbscan" && (
          <div style={{ fontSize:12, color:C.tx, background:"rgba(255,255,255,0.6)", borderRadius:8, padding:"8px 10px", lineHeight:1.7 }}>
            💡 DBSCAN은 밀도 기반 군집화로, K 값을 미리 정하지 않아도 됩니다. <strong>이상치(노이즈)</strong>로 표시된 점들은 어느 군집에도 속하지 않는 특이 데이터입니다. eps·minPts 값을 조정해 군집 수를 조절할 수 있습니다.
          </div>
        )}
      </div>
    );
  }

  if (result.task === "timeseries") {
    const vals = result.rawVals || [];
    const n = vals.length;
    const mean = n ? (vals.reduce((a,b)=>a+b,0)/n).toFixed(2) : "-";
    const std = n ? Math.sqrt(vals.reduce((s,v)=>s+(v-(vals.reduce((a,b)=>a+b,0)/n))**2,0)/n).toFixed(2) : "-";
    const trendDir = result.slope > 0.001 ? "📈 상승" : result.slope < -0.001 ? "📉 하락" : "➡️ 보합";
    const modelLabels = { ma:"이동평균(MA)", ewm:"지수가중(EWM)", trend:"추세분해", holtwinters:"Holt-Winters", decompose:"계절분해", anomaly:"이상치탐지" };
    return (
      <div style={{ borderRadius:"var(--border-radius-lg)", border:"2px solid #7F77DD",
        background:"#F3F2FE", padding:"16px 18px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <span style={{ fontSize:20 }}>📉</span>
          <div>
            <div style={{ fontSize:14, fontWeight:500, color:"#3C3489" }}>시계열 분석 완료 — {modelLabels[result.modelId]||result.modelId}</div>
            <div style={{ fontSize:12, color:C.txS }}>"{result.colName}" · {n}개 데이터 포인트</div>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))", gap:8, marginBottom:10 }}>
          {[["데이터 수", n], ["평균", mean], ["표준편차", std],
            ...(result.slope !== undefined ? [["추세", trendDir]] : []),
            ...(result.rmse !== undefined ? [["RMSE", result.rmse]] : []),
            ...(result.anomalyResult ? [["이상치", result.anomalyResult.outliers?.length+"개"]] : []),
          ].map(([l, v]) => (
            <div key={l} style={{ background:"rgba(255,255,255,0.7)", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
              <div style={{ fontSize:10, color:C.txS, marginBottom:2 }}>{l}</div>
              <div style={{ fontSize:13, fontWeight:600, color:"#3C3489" }}>{v}</div>
            </div>
          ))}
        </div>
        {result.forecasts?.length > 0 && (
          <div style={{ fontSize:12, color:"#3C3489", background:"rgba(255,255,255,0.7)", borderRadius:8, padding:"8px 10px" }}>
            🔮 향후 {result.forecasts.length}스텝 예측: {result.forecasts.slice(0,5).join(", ")}{result.forecasts.length>5?"...":""}
          </div>
        )}
      </div>
    );
  }
  return null;
}

// ── Chart components ──────────────────────────────────────────────────────────
function LossCurve({ data, xKey="epoch", title="학습 Loss 곡선" }) {
  if (!data || data.length < 2) return null;
  return (
    <div style={{ marginTop:16 }}>
      <div style={{ fontSize:12, color:C.txS, fontWeight:500, marginBottom:4 }}>{title}</div>
      <div style={{ fontSize:11, color:C.txT, marginBottom:6 }}>값이 내려갈수록 모델이 잘 학습되고 있습니다</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top:4, right:12, left:0, bottom:4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd}/>
          <XAxis dataKey={xKey} tick={{ fontSize:10, fill:C.txS }}/>
          <YAxis tick={{ fontSize:10, fill:C.txS }} width={50}/>
          <Tooltip contentStyle={{ fontSize:11, borderRadius:6, border:"0.5px solid "+C.bd }}/>
          <Line type="monotone" dataKey="loss" stroke="#185FA5" dot={false} strokeWidth={2} name="Loss"/>
          {data[0]?.inertia !== undefined && (
            <Line type="monotone" dataKey="inertia" stroke="#D85A30" dot={false} strokeWidth={2} name="Inertia"/>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MLConfMatrix({ cm, classes }) {
  if (!cm || !classes?.length) return null;
  const maxVal = Math.max(...classes.flatMap(a => classes.map(b => cm[a]?.[b] || 0)));
  return (
    <div style={{ marginTop:16, overflowX:"auto" }}>
      <div style={{ fontSize:12, color:C.txS, fontWeight:500, marginBottom:4 }}>혼동 행렬</div>
      <div style={{ fontSize:11, color:C.txT, marginBottom:8 }}>초록=정답 / 빨강=오답</div>
      <div style={{ display:"inline-block" }}>
        <div style={{ display:"flex", marginLeft:60 }}>
          {classes.map(c => (
            <div key={c} style={{ width:52, fontSize:10, color:C.txS, textAlign:"center",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", padding:"0 2px" }}>
              예측:{c}
            </div>
          ))}
        </div>
        {classes.map(actual => (
          <div key={actual} style={{ display:"flex", alignItems:"center", marginBottom:2 }}>
            <div style={{ width:56, fontSize:10, color:C.txS, textAlign:"right", paddingRight:6,
              whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              실제:{actual}
            </div>
            {classes.map(pred => {
              const v = cm[actual]?.[pred] || 0;
              const isC = actual === pred;
              const intensity = maxVal > 0 ? v / maxVal : 0;
              return (
                <div key={pred} style={{ width:52, height:36,
                  background: isC ? "rgba(29,158,117,"+(0.1+intensity*0.8)+")" : "rgba(216,90,48,"+(intensity*0.6)+")",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:12, fontWeight:500, color:intensity>0.5?"#fff":C.tx, borderRadius:3, margin:1 }}>
                  {v}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MLFeatChart({ data }) {
  if (!data?.length) return null;
  const top = data.slice(0, 10);
  return (
    <div style={{ marginTop:16 }}>
      <div style={{ fontSize:12, color:C.txS, fontWeight:500, marginBottom:4 }}>피처 중요도</div>
      <ResponsiveContainer width="100%" height={Math.max(140, top.length*26)}>
        <BarChart data={top} layout="vertical" margin={{ top:4, right:40, left:8, bottom:4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false}/>
          <XAxis type="number" tick={{ fontSize:10, fill:C.txS }}/>
          <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill:C.txS }} width={110}/>
          <Tooltip contentStyle={{ fontSize:11, borderRadius:6, border:"0.5px solid "+C.bd }}/>
          <Bar dataKey="importance" name="중요도" radius={[0,3,3,0]}>
            {top.map((_,i) => <Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MLScatter({ rows, xCol, yCol, labelKey, title }) {
  const labels = [...new Set(rows.map(r => String(r[labelKey])))].sort();
  const data = labels.flatMap(lbl =>
    rows.filter(r => String(r[labelKey]) === lbl)
      .map(r => ({ x:parseFloat(r[xCol]), y:parseFloat(r[yCol]), label:lbl }))
      .filter(p => !isNaN(p.x) && !isNaN(p.y))
      .slice(0, 200)
  );
  if (!data.length) return null;
  return (
    <div style={{ marginTop:16 }}>
      <div style={{ fontSize:12, color:C.txS, fontWeight:500, marginBottom:6 }}>{title}</div>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top:4, right:8, left:0, bottom:20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd}/>
          <XAxis type="number" dataKey="x" name={xCol} tick={{ fontSize:10, fill:C.txS }}
            label={{ value:xCol, position:"insideBottom", offset:-14, fontSize:10, fill:C.txS }}/>
          <YAxis type="number" dataKey="y" name={yCol} tick={{ fontSize:10, fill:C.txS }}/>
          <Tooltip content={({ payload }) => payload?.length ? (
            <div style={{ background:C.bg, border:"0.5px solid "+C.bd, borderRadius:6, padding:"5px 8px", fontSize:11 }}>
              <div>그룹: {payload[0]?.payload?.label}</div>
              <div>{xCol}: {payload[0]?.payload?.x?.toFixed(3)}</div>
              <div>{yCol}: {payload[0]?.payload?.y?.toFixed(3)}</div>
            </div>
          ) : null}/>
          {labels.map((lbl, li) => (
            <Scatter key={lbl} name={"그룹 "+lbl}
              data={data.filter(d => d.label === lbl)}
              fill={PALETTE[li%PALETTE.length]} fillOpacity={0.65} r={4}/>
          ))}
          <Legend wrapperStyle={{ fontSize:11 }}/>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActualVsPred({ actual, predicted }) {
  const data = actual.map((a, i) => ({
    actual: +Number(a).toFixed(3),
    predicted: +Number(predicted[i]).toFixed(3),
  })).slice(0, 300);
  const mn = Math.min(...data.map(d => Math.min(d.actual, d.predicted)));
  const mx = Math.max(...data.map(d => Math.max(d.actual, d.predicted)));
  return (
    <div style={{ marginTop:16 }}>
      <div style={{ fontSize:12, color:C.txS, fontWeight:500, marginBottom:4 }}>실제값 vs 예측값</div>
      <div style={{ fontSize:11, color:C.txT, marginBottom:6 }}>점들이 대각선에 가까울수록 예측이 정확합니다</div>
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{ top:4, right:8, left:0, bottom:20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd}/>
          <XAxis type="number" dataKey="actual" name="실제값" tick={{ fontSize:10, fill:C.txS }}
            label={{ value:"실제값", position:"insideBottom", offset:-14, fontSize:10, fill:C.txS }}
            domain={[mn, mx]}/>
          <YAxis type="number" dataKey="predicted" name="예측값" tick={{ fontSize:10, fill:C.txS }} domain={[mn, mx]}/>
          <Tooltip contentStyle={{ fontSize:11, borderRadius:6, border:"0.5px solid "+C.bd }}/>
          <Scatter data={data} fill="#378ADD" fillOpacity={0.5} r={3}/>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── ACF Chart ─────────────────────────────────────────────────────────────────
function ACFChart({ data, colName }) {
  if (!data || data.length < 2) return null;
  const conf = 1.96 / Math.sqrt(data.length + 20);
  return (
    <div style={{ marginTop:16 }}>
      <div style={{ fontSize:12, color:C.txS, fontWeight:500, marginBottom:2 }}>자기상관(ACF) — {colName}</div>
      <div style={{ fontSize:11, color:C.txT, marginBottom:6 }}>파란 점선(±{conf.toFixed(2)}) 벗어나면 유의미한 주기성 · 지연 관계가 있습니다</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top:4, right:12, left:0, bottom:4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd}/>
          <XAxis dataKey="lag" tick={{ fontSize:10, fill:C.txS }} label={{ value:"Lag", position:"insideBottom", offset:-2, fontSize:10, fill:C.txS }}/>
          <YAxis tick={{ fontSize:10, fill:C.txS }} domain={[-1.1,1.1]}/>
          <Tooltip contentStyle={{ fontSize:11, borderRadius:6, border:"0.5px solid "+C.bd }} formatter={v=>[v,"ACF"]}/>
          <Bar dataKey="acf" name="ACF" radius={[2,2,0,0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={Math.abs(d.acf) > conf ? "#185FA5" : "#B0C4DE"}/>
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Rolling Stats Chart ───────────────────────────────────────────────────────
function RollingChart({ data, colName, window: win }) {
  if (!data || data.length < 2) return null;
  return (
    <div style={{ marginTop:16 }}>
      <div style={{ fontSize:12, color:C.txS, fontWeight:500, marginBottom:2 }}>롤링 통계 (window={win}) — {colName}</div>
      <div style={{ fontSize:11, color:C.txT, marginBottom:6 }}>회색=원본, 파랑=이동평균, 음영=±1 표준편차 범위</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top:4, right:16, left:0, bottom:4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd}/>
          <XAxis dataKey="i" tick={{ fontSize:10, fill:C.txS }}/>
          <YAxis tick={{ fontSize:10, fill:C.txS }}/>
          <Tooltip contentStyle={{ fontSize:11, borderRadius:6, border:"0.5px solid "+C.bd }}/>
          <Legend wrapperStyle={{ fontSize:11 }}/>
          <Line type="monotone" dataKey="raw" stroke={C.bd} dot={false} strokeWidth={1} name="원본"/>
          <Line type="monotone" dataKey="mean" stroke="#185FA5" dot={false} strokeWidth={2} name="이동평균"/>
          <Line type="monotone" dataKey="max" stroke="#D85A30" dot={false} strokeWidth={1} strokeDasharray="4 2" name="최대"/>
          <Line type="monotone" dataKey="min" stroke="#1D9E75" dot={false} strokeWidth={1} strokeDasharray="4 2" name="최소"/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Anomaly Chart ─────────────────────────────────────────────────────────────
function AnomalyChart({ result, colName }) {
  if (!result?.chartData) return null;
  const anomalies = result.chartData.filter(d => d.isAnomaly);
  return (
    <div style={{ marginTop:16 }}>
      <div style={{ fontSize:12, color:C.txS, fontWeight:500, marginBottom:2 }}>이상치 탐지 — {colName}</div>
      <div style={{ fontSize:11, color:C.txT, marginBottom:6 }}>
        빨간 점: IQR 또는 Z-score 이상치 ({anomalies.length}개) · 점선: IQR 경계 (하한 {result.lowerIQR} / 상한 {result.upperIQR})
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top:4, right:16, left:0, bottom:4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd}/>
          <XAxis type="number" dataKey="i" name="인덱스" tick={{ fontSize:10, fill:C.txS }}/>
          <YAxis type="number" dataKey="raw" name="값" tick={{ fontSize:10, fill:C.txS }}/>
          <Tooltip contentStyle={{ fontSize:11, borderRadius:6, border:"0.5px solid "+C.bd }} formatter={v=>[v,"값"]}/>
          <Scatter name="정상" data={result.chartData.filter(d=>!d.isAnomaly)} fill="#B0C4DE" r={3}/>
          <Scatter name="이상치" data={anomalies} fill="#A32D2D" r={5}/>
          <Legend wrapperStyle={{ fontSize:11 }}/>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Model Usage Guide ─────────────────────────────────────────────────────────
const MODEL_GUIDE = {
  linear:     { when:"피처-타겟 관계가 선형일 때", deploy:"계수(w)를 그대로 규칙으로 사용 가능", limit:"비선형 패턴 포착 불가", improve:"피처 스케일링, 다항 피처 추가" },
  ridge:      { when:"피처 수가 많고 과적합이 우려될 때", deploy:"선형 회귀와 동일하게 배포, 정규화 계수 λ 기록", limit:"L2 패널티로 계수 축소, 피처 제거 안 됨", improve:"λ 값 튜닝, 교차검증" },
  lasso:      { when:"불필요한 피처가 많을 때 (피처 선택 효과)", deploy:"계수 0인 피처 제외 후 배포", limit:"상관된 피처 중 하나만 선택하는 경향", improve:"λ 값 조정, ElasticNet 시도" },
  poly:       { when:"피처와 타겟 간 곡선 관계가 있을 때", deploy:"다항 피처 확장 로직 함께 배포", limit:"고차원 시 과적합 위험, 속도 저하", improve:"정규화 추가, 차수 3 이상은 주의" },
  knn_reg:    { when:"유사 사례 기반 예측이 필요할 때", deploy:"학습 데이터 전체를 저장해야 함 (메모리 주의)", limit:"데이터 많을수록 예측 속도 느림", improve:"k 값 튜닝, 피처 스케일링 필수" },
  rf_reg:     { when:"비선형 패턴, 피처 중요도 파악이 필요할 때", deploy:"여러 결정 나무 앙상블 저장", limit:"해석이 어렵고, 메모리·속도 부담", improve:"나무 수(nTrees)·깊이 조정, 피처 중요도 확인" },
  logistic:   { when:"이진 또는 다중 분류, 확률 값이 필요할 때", deploy:"시그모이드 출력이 확률로 바로 활용 가능", limit:"선형 결정 경계만 학습 가능", improve:"피처 엔지니어링, 다항 피처 추가" },
  knn_cls:    { when:"결정 경계가 복잡하고 학습 데이터가 충분할 때", deploy:"학습 데이터 전체 저장 필요", limit:"고차원 데이터에서 성능 저하 (차원의 저주)", improve:"k 값 홀수로 설정, 피처 스케일링" },
  dtree:      { when:"규칙 기반 설명이 필요할 때 (의사결정 트리)", deploy:"if-else 규칙으로 변환 가능, 가장 쉬운 배포", limit:"깊은 나무는 과적합, 작은 변화에 민감", improve:"최대 깊이 제한, 가지치기 (pruning)" },
  rf_cls:     { when:"정확도가 중요하고 피처 중요도를 파악하고 싶을 때", deploy:"여러 결정 나무 앙상블 모두 저장", limit:"단일 나무보다 느리고 해석 어려움", improve:"나무 수 증가, 최대 피처 비율 조정" },
  naive_bayes:{ when:"텍스트 분류, 실시간 예측, 학습 데이터가 적을 때", deploy:"클래스별 평균·분산 저장 (매우 가벼움)", limit:"피처 독립 가정이 현실과 다를 수 있음", improve:"피처 변환(로그 등), 라플라스 스무딩" },
  svm:        { when:"클래스 경계가 명확하고 중간 크기 데이터일 때", deploy:"지지벡터만 저장하면 됨", limit:"대용량 데이터에서 느리고, 커널 선택 중요", improve:"피처 스케일링 필수, C 파라미터 조정" },
  kmeans:     { when:"둥근 형태의 군집이 예상될 때, K 값을 알 때", deploy:"센트로이드 좌표 저장 후 최근접 거리로 분류", limit:"구형 군집 가정, K 미리 지정 필요, 이상치 민감", improve:"K 값 엘보우 분석, 표준화 필수" },
  dbscan:     { when:"불규칙 형태 군집, 이상치 탐지가 필요할 때", deploy:"핵심 포인트와 eps 저장 후 배포", limit:"eps·minPts 파라미터 선택 어려움, 고차원 취약", improve:"데이터 스케일링, 반경(eps) 시각화로 결정" },
  ma:         { when:"단기 추세 파악, 노이즈 제거가 필요할 때", deploy:"window 크기 고정 후 새 데이터에 적용", limit:"지연(lag) 발생, 급격한 변화 감지 느림", improve:"window 크기 조정, EWM과 비교" },
  ewm:        { when:"최근 데이터에 더 큰 가중치를 주고 싶을 때", deploy:"마지막 EWM 값과 α 저장 후 온라인 업데이트 가능", limit:"α 선택이 결과에 큰 영향", improve:"α 값 그리드 탐색으로 최적화" },
  trend:      { when:"장기 추세 방향 파악, 추세 제거(detrending)가 필요할 때", deploy:"선형 계수(slope, intercept)로 미래 예측 가능", limit:"비선형 추세 포착 불가", improve:"잔차 분석 후 추가 모델 적용" },
  holtwinters:{ when:"추세와 계절성이 모두 있는 시계열 예측", deploy:"α·β·γ·마지막 L/T/S 값 저장 후 롤링 업데이트", limit:"계절 주기가 명확해야 함, 초기값 민감", improve:"계절 주기 정확히 설정, 파라미터 최적화" },
  decompose:  { when:"데이터에서 추세/계절성/잔차를 분리해 이해하고 싶을 때", deploy:"분해 후 각 성분을 별도 모델로 처리 가능", limit:"가법 분해 가정, 복잡한 패턴 어려움", improve:"계절 주기 검증, 잔차에 ARIMA 적용" },
  anomaly:    { when:"데이터 품질 점검, 사기 탐지, 장비 이상 감지", deploy:"IQR 경계값 저장 후 실시간 적용 가능", limit:"정상/이상 경계가 데이터 분포에만 의존", improve:"Z-score 임계값 도메인 지식으로 조정, 여러 기준 앙상블" },
};

function ModelGuide({ task, modelId }) {
  const g = MODEL_GUIDE[modelId];
  if (!g) return null;
  const taskColors = {
    regression:"#185FA5", classification:"#3C3489", clustering:"#185FA5", timeseries:"#3C3489"
  };
  const tc = taskColors[task] || C.tx;
  return (
    <div style={{ border:`0.5px solid ${C.bd}`, borderRadius:"var(--border-radius-lg)", padding:16, marginBottom:16 }}>
      <div style={{ fontSize:13, fontWeight:500, color:C.tx, marginBottom:10 }}>🚀 이 모델 활용 방법</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:10 }}>
        {[
          { icon:"✅", label:"언제 쓰나요?", text: g.when },
          { icon:"📦", label:"배포 방법",    text: g.deploy },
          { icon:"⚠️", label:"주의사항",    text: g.limit },
          { icon:"💡", label:"성능 개선",    text: g.improve },
        ].map(({ icon, label, text }) => (
          <div key={label} style={{ background:C.bgS, borderRadius:"var(--border-radius-md)", padding:"10px 12px" }}>
            <div style={{ fontSize:11, fontWeight:600, color:tc, marginBottom:4 }}>{icon} {label}</div>
            <div style={{ fontSize:12, color:C.tx, lineHeight:1.6 }}>{text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FeatureTag helper ─────────────────────────────────────────────────────────
function FeatTag({ c, isSelected, isNum, onClick, dim }) {
  const bg = isSelected ? (isNum ? "#E6F1FB" : "#EEEDFE") : C.bgS;
  const color = isSelected ? (isNum ? "#0C447C" : "#3C3489") : C.tx;
  const bw = isSelected ? "2px" : "1px";
  const bc = isSelected ? (isNum ? "#185FA5" : "#7F77DD") : C.bdS;
  return (
    <span onClick={onClick} style={{
      fontSize:12, padding:"6px 14px", borderRadius:20, cursor:"pointer",
      background:bg, color:color,
      border: bw + " solid " + bc,
      fontFamily:"var(--font-mono)", fontWeight:isSelected?600:400,
      opacity: dim ? 0.4 : 1,
      transition:"all 0.1s",
    }}>
      {c}{isSelected ? " ✓" : ""}
    </span>
  );
}

function TargetTag({ c, isSelected, task, isDisabled, onClick }) {
  const bg = isSelected ? (task==="regression" ? "#E6F1FB" : "#EEEDFE") : isDisabled ? C.bgT : C.bgS;
  const color = isSelected ? (task==="regression" ? "#0C447C" : "#3C3489") : isDisabled ? C.txT : C.tx;
  const bw = isSelected ? "2px" : "1px";
  const bc = isSelected ? (task==="regression" ? "#185FA5" : "#7F77DD") : isDisabled ? C.bd : C.bdS;
  return (
    <span onClick={!isDisabled ? onClick : undefined} style={{
      fontSize:12, padding:"6px 14px", borderRadius:20, cursor:isDisabled?"not-allowed":"pointer",
      background:bg, color:color,
      border: bw + " solid " + bc,
      fontFamily:"var(--font-mono)", fontWeight:isSelected?600:400,
      opacity: isDisabled ? 0.5 : 1,
      transition:"all 0.1s",
    }}>
      {c}{isSelected ? " ✓" : ""}
    </span>
  );
}

// ── MLTab main ────────────────────────────────────────────────────────────────
export function MLTab({ allDs, apiKey }) {
  const [selId, setSelId] = useState(() => allDs[0]?.id ?? "");
  const [task, setTask] = useState("");
  const [modelId, setModelId] = useState("");
  const [targetCol, setTargetCol] = useState("");
  const [featureCols, setFeatureCols] = useState([]);
  const [kClusters, setKClusters] = useState(null);  // null = 아직 미선택
  const [elbowPreview, setElbowPreview] = useState(null); // 미리 계산된 엘보우
  const [showAdv, setShowAdv] = useState(false);
  const [testRatio, setTestRatio] = useState(0.2);
  const [hiddenLayer, setHiddenLayer] = useState("16,8");
  const [lrRate, setLrRate] = useState(0.05);
  const [epochs, setEpochs] = useState(300);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiSpecs, setAiSpecs] = useState(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);

  // ── AI 제안 (Step 0) 상태 ──
  const [orKey, setOrKey] = useState(() => apiKey || sessionStorage.getItem("openrouter_key") || "");
  const [showKey, setShowKey] = useState(false);
  const [userCtx, setUserCtx] = useState("");
  const [proposals, setProposals] = useState(null);
  const [prevTitles, setPrevTitles] = useState([]);
  const [propLoading, setPropLoading] = useState(false);
  const [propError, setPropError] = useState("");

  // ── 모델 비교용 실행 이력 ──
  const [runHistory, setRunHistory] = useState([]);

  const saveKey = k => { setOrKey(k); try { sessionStorage.setItem("openrouter_key", k); } catch {} };

  const ds = allDs.find(d => d.id === selId);
  const prevId = useRef(selId);
  if (prevId.current !== selId) {
    prevId.current = selId;
    setTask(""); setModelId(""); setFeatureCols([]); setTargetCol("");
    setResult(null); setAiText(""); setAiSpecs(null); setError(""); setStep(0);
    setProposals(null); setPrevTitles([]); setPropError(""); setRunHistory([]);
  }

  const numCols = ds ? ds.colMeta.filter(c => c.type==="number").map(c => c.name) : [];
  const catCols = ds ? ds.colMeta.filter(c => c.type==="category" || c.type==="text").map(c => c.name) : [];
  const allCols = ds ? ds.columns : [];

  // AI 제안 카드 클릭 → 태스크/모델/타겟/피처 자동 세팅 후 Step 2로
  const applyProposal = p => {
    const validTasks = ["regression", "classification", "clustering", "timeseries"];
    if (!validTasks.includes(p.task)) { setPropError("지원하지 않는 분석 유형입니다: " + p.task); return; }
    const cols = ds ? ds.columns : [];
    const tgt = cols.includes(p.target) ? p.target : "";
    const feats = (Array.isArray(p.features) ? p.features : [])
      .filter(c => cols.includes(c) && c !== tgt);
    setTask(p.task);
    setModelId(p.model || "");
    setTargetCol(p.task === "clustering" ? "" : tgt);
    setFeatureCols(feats.length ? feats : numCols.filter(c => c !== tgt).slice(0, 5));
    setElbowPreview(null); setKClusters(null);
    setResult(null); setAiText(""); setAiSpecs(null); setError("");
    setStep(2);
  };

  // AI에게 분석 3가지 제안 요청 (다시 제안 시 이전 제안 제외)
  const fetchProposals = async (excludePrev = false) => {
    if (!orKey.trim()) { setPropError("OpenRouter API 키를 입력해 주세요."); return; }
    if (!ds) return;
    setPropLoading(true); setPropError("");
    try {
      const colInfo = ds.colMeta.map(c => {
        let s = `- ${c.name} (${c.type}): 고유 ${c.stats.unique}개, 결측 ${c.stats.nullCount}개`;
        if (c.type === "number" && c.stats.mean !== undefined)
          s += `, 평균 ${c.stats.mean}, min ${c.stats.min}, max ${c.stats.max}`;
        if (c.stats.topValues) s += `, 상위값: ${c.stats.topValues.slice(0, 3).map(([v]) => v).join(",")}`;
        return s;
      }).join("\n");

      const exclusion = excludePrev && prevTitles.length
        ? `\n\n## 제외 조건\n다음 제안들과 겹치지 않는 새로운 분석을 제안하세요:\n${prevTitles.map(t => `- ${t}`).join("\n")}`
        : "";
      const ctx = userCtx.trim() ? `\n\n## 사용자가 알려준 데이터 배경\n${userCtx.trim()}\n이 배경을 반드시 제안에 반영하세요.` : "";

      const sys = `당신은 머신러닝 교육 전문가입니다. 초보자가 따라할 수 있는 ML/DL 분석을 제안합니다.
사용 가능한 분석과 모델:
- regression (숫자 예측): linear(선형회귀), ridge(릿지L2), lasso(라쏘L1), poly(다항회귀), knn_reg(KNN회귀), rf_reg(랜덤포레스트)
- classification (분류): logistic(로지스틱), knn_cls(KNN), dtree(의사결정나무), rf_cls(랜덤포레스트), naive_bayes(나이브베이즈), svm(SVM선형)
- clustering (군집화): kmeans(K평균), dbscan(밀도기반)
- timeseries (시계열): ma(이동평균), ewm(지수가중), trend(추세), holtwinters(홀트윈터스), decompose(계절분해), anomaly(이상치탐지)
반드시 아래 JSON 형식으로만 응답하세요. 컬럼명은 실제 데이터의 컬럼명만 사용하세요.
\`\`\`json
{"proposals":[{"title":"제안 제목","task":"regression","model":"linear","target":"타겟컬럼명","features":["피처컬럼명1","피처컬럼명2"],"difficulty":"초급","reason":"이 분석과 모델을 추천하는 이유 (2~3문장)","use_case":"비즈니스 활용 예시 1문장"}]}
\`\`\`
- 정확히 3개의 서로 다른 제안 (서로 다른 task나 model 사용)
- regression의 target은 숫자형, classification의 target은 범주형/텍스트 컬럼
- clustering은 target 없이 features만, timeseries는 target에 숫자형 컬럼 1개
- difficulty: "초급" | "중급" | "고급"
- 시계열 데이터가 있으면 holtwinters나 anomaly를 적극 추천하세요`;

      const user = `## 데이터셋: ${ds.name}\n- ${ds.rowCount.toLocaleString()}행 × ${ds.columns.length}열\n\n## 컬럼 정보\n${colInfo}${ctx}${exclusion}`;
      const raw = await callOpenRouter(orKey.trim(), sys, user);
      const obj = extractJSON(raw);
      const list = Array.isArray(obj?.proposals) ? obj.proposals.slice(0, 3) : null;
      if (!list || !list.length) throw new Error("AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.");
      setProposals(list);
      setPrevTitles(t => [...t, ...list.map(p => p.title).filter(Boolean)].slice(-9));
    } catch (e) {
      setPropError("제안 실패: " + e.message);
    } finally {
      setPropLoading(false);
    }
  };

  const selectTask = t => {
    setTask(t); setResult(null); setAiText(""); setAiSpecs(null); setError("");
    const defaults = { regression:"linear", classification:"logistic", clustering:"kmeans", timeseries:"holtwinters" };
    setModelId(defaults[t] || "");
    setElbowPreview(null); setKClusters(null);
    if (!ds) { setStep(2); return; }
    if (t === "clustering") {
      setFeatureCols(numCols.slice(0, 5)); setTargetCol("");
    } else if (t === "regression") {
      setFeatureCols(numCols.slice(0, -1).slice(0, 6));
      setTargetCol(numCols[numCols.length - 1] || "");
    } else if (t === "timeseries") {
      setFeatureCols([]);
      setTargetCol(numCols[0] || "");
    } else {
      setFeatureCols(numCols.slice(0, 6));
      setTargetCol(catCols[0] || allCols[allCols.length - 1] || "");
    }
    setStep(2);
  };

  const toggleFeat = c => setFeatureCols(p =>
    p.includes(c) ? p.filter(x => x !== c) : [...p, c]
  );

  const run = () => {
    if (!ds) return setError("데이터셋을 선택해 주세요.");
    if (task !== "clustering" && task !== "timeseries" && featureCols.length === 0)
      return setError("피처 컬럼을 1개 이상 선택해 주세요.");
    if (task === "timeseries" && !targetCol)
      return setError("분석할 컬럼을 선택해 주세요.");
    if (task !== "clustering" && task !== "timeseries" && !targetCol)
      return setError("타겟 컬럼을 선택해 주세요.");

    setError(""); setRunning(true); setResult(null); setAiText(""); setAiSpecs(null);
    setTimeout(() => {
      try {
        // ── 시계열 (prepareFeatures 불필요)
        if (task === "timeseries") {
          const rawVals = ds.rows.map(r => parseFloat(r[targetCol])).filter(v => !isNaN(v));
          if (rawVals.length < 10) { setError("최소 10개 이상의 값이 필요합니다."); setRunning(false); return; }
          const n = rawVals.length;
          let tsResult = { task:"timeseries", modelId, rawVals, colName:targetCol };

          if (modelId === "ma") {
            const win = Math.min(7, Math.floor(n / 3));
            const ma = rawVals.map((_, i) => {
              if (i < win - 1) return null;
              return +(rawVals.slice(i - win + 1, i + 1).reduce((a, b) => a + b, 0) / win).toFixed(3);
            });
            const acfData = autocorrelation(rawVals, 20);
            const rolling = rollingStats(rawVals, win);
            tsResult = { ...tsResult, ma, win, acfData, rolling,
              chartData: rawVals.map((v, i) => ({ i, raw: v, ma: ma[i] })) };

          } else if (modelId === "ewm") {
            const alpha = 0.3;
            const ewm = [rawVals[0]];
            for (let i = 1; i < n; i++) ewm.push(+(alpha * rawVals[i] + (1 - alpha) * ewm[i - 1]).toFixed(3));
            const acfData = autocorrelation(rawVals, 20);
            tsResult = { ...tsResult, ewm, alpha, acfData,
              chartData: rawVals.map((v, i) => ({ i, raw: v, ewm: ewm[i] })) };

          } else if (modelId === "trend") {
            const xs = rawVals.map((_, i) => i);
            const mX = xs.reduce((a, b) => a + b, 0) / n;
            const mY = rawVals.reduce((a, b) => a + b, 0) / n;
            const slope = xs.reduce((s, x, i) => s + (x - mX) * (rawVals[i] - mY), 0) /
                          xs.reduce((s, x) => s + (x - mX) ** 2, 0);
            const intercept = mY - slope * mX;
            const trend = xs.map(x => +(slope * x + intercept).toFixed(3));
            const residual = rawVals.map((v, i) => +(v - trend[i]).toFixed(3));
            // Forecast 10 steps
            const forecasts = Array.from({length:10}, (_, h) => +(slope*(n+h)+intercept).toFixed(3));
            const acfData = autocorrelation(rawVals, 20);
            tsResult = { ...tsResult, slope: +slope.toFixed(4), intercept: +intercept.toFixed(4),
              forecasts, acfData,
              chartData: [
                ...rawVals.map((v, i) => ({ i, raw: v, trend: trend[i], residual: residual[i] })),
                ...forecasts.map((v, h) => ({ i: n+h, forecast: v })),
              ] };

          } else if (modelId === "holtwinters") {
            if (rawVals.length < 14) { setError("Holt-Winters: 최소 14개 이상의 값이 필요합니다."); setRunning(false); return; }
            const period = detectSeasonality(rawVals, Math.min(30, Math.floor(n / 2)));
            const hwResult = holtWinters(rawVals, period, 0.3, 0.1, 0.3, 12);
            if (!hwResult) { setError("Holt-Winters: 데이터가 부족합니다 (계절 주기의 2배 이상 필요)."); setRunning(false); return; }
            const acfData = autocorrelation(rawVals, 20);
            tsResult = { ...tsResult, ...hwResult, acfData, period,
              chartData: hwResult.chartData };

          } else if (modelId === "decompose") {
            if (rawVals.length < 14) { setError("계절분해: 최소 14개 이상의 값이 필요합니다."); setRunning(false); return; }
            const period = detectSeasonality(rawVals, Math.min(30, Math.floor(n / 2)));
            const dec = seasonalDecompose(rawVals, period);
            if (!dec) { setError("계절분해: 데이터가 부족합니다."); setRunning(false); return; }
            const acfData = autocorrelation(rawVals, 20);
            tsResult = { ...tsResult, ...dec, acfData, period,
              chartData: dec.chartData };

          } else if (modelId === "anomaly") {
            const anomalyResult = detectAnomalies(rawVals);
            const rolling = rollingStats(rawVals, Math.min(7, Math.floor(n / 3)));
            const acfData = autocorrelation(rawVals, 20);
            tsResult = { ...tsResult, anomalyResult, rolling, acfData,
              chartData: anomalyResult.chartData };
          }

          setResult(tsResult);
          setStep(3); setRunning(false); return;
        }

        const { X, y, allFeatNames } = prepareFeatures(ds, featureCols, task !== "clustering" ? targetCol : null);
        if (X.length < 10) { setError("데이터가 너무 적습니다 (최소 10행)."); setRunning(false); return; }

        // ── 회귀
        if (task === "regression") {
          const yNum = y.map(Number);
          if (yNum.some(isNaN)) { setError("타겟 컬럼에 숫자가 아닌 값이 있습니다."); setRunning(false); return; }
          const norm = normalize(yNum);

          // poly uses expanded features
          const usePolyX = modelId === "poly";
          const Xreg = usePolyX ? polyFeatures(X) : X;
          const polyFeatNames = usePolyX
            ? [...allFeatNames, ...allFeatNames.flatMap((a, i) => allFeatNames.slice(i).map(b => `${a}×${b}`))]
            : allFeatNames;

          const { XTr, yTr, XTe, yTe } = trainTestSplit(Xreg, norm.scaled, testRatio);
          let model, _predict = null;

          if (modelId === "ridge") {
            const rn = XTr.length, rm = XTr[0].length, lam = 0.1;
            let w = new Array(rm).fill(0), b = 0; const losses = [];
            for (let ep = 0; ep < 800; ep++) {
              let dw = new Array(rm).fill(0), db = 0, loss = 0;
              for (let i = 0; i < rn; i++) {
                const p = XTr[i].reduce((s, x, j) => s + x * w[j], b);
                const e = p - yTr[i]; loss += e * e;
                for (let j = 0; j < rm; j++) dw[j] += e * XTr[i][j]; db += e;
              }
              for (let j = 0; j < rm; j++) w[j] -= 0.01 * (dw[j] / rn + lam * w[j]);
              b -= 0.01 * db / rn;
              if (ep % 80 === 0) losses.push({ epoch: ep, loss: +(loss / rn).toFixed(4) });
            }
            const rP = XTr.map(xi => xi.reduce((s, x, j) => s + x * w[j], b));
            const rR = yTr.reduce((s, v, i) => s + (v - rP[i]) ** 2, 0);
            const rT = yTr.reduce((s, v) => s + (v - yTr.reduce((a, b) => a + b, 0) / rn) ** 2, 0);
            model = { w, b, losses, r2: +(1 - rR / (rT || 1)).toFixed(4), rmse: +Math.sqrt(rR / rn).toFixed(4) };

          } else if (modelId === "lasso") {
            model = lassoRegression(XTr, yTr, 0.05);

          } else if (modelId === "knn_reg") {
            const kk = 5;
            _predict = xi => {
              const d = XTr.map((xj, i) => ({ i, d: xi.reduce((s, v, j) => s + (v - xj[j]) ** 2, 0) }))
                          .sort((a, b) => a.d - b.d).slice(0, kk);
              return d.reduce((s, { i }) => s + yTr[i], 0) / kk;
            };
            const kPreds = XTr.map(_predict);
            const kR = yTr.reduce((s, v, i) => s + (v - kPreds[i]) ** 2, 0);
            const kT = yTr.reduce((s, v) => s + (v - yTr.reduce((a, b) => a + b, 0) / yTr.length) ** 2, 0);
            model = { w: new Array(XTr[0].length).fill(0), b: 0, losses: [],
              r2: +(1 - kR / (kT || 1)).toFixed(4), rmse: +Math.sqrt(kR / yTr.length).toFixed(4) };

          } else if (modelId === "rf_reg") {
            const rfModel = randomForestRegression(XTr, yTr, 10, 5);
            _predict = rfModel.predict;
            const rfPreds = XTr.map(rfModel.predict);
            const rfR = yTr.reduce((s, v, i) => s + (v - rfPreds[i]) ** 2, 0);
            const rfT = yTr.reduce((s, v) => s + (v - yTr.reduce((a, b) => a + b, 0) / yTr.length) ** 2, 0);
            model = { w: null, b: 0, losses: rfModel.losses,
              r2: +(1 - rfR / (rfT || 1)).toFixed(4), rmse: +Math.sqrt(rfR / yTr.length).toFixed(4) };

          } else { // linear or poly (same algorithm after expansion)
            model = linearRegression(XTr, yTr);
          }

          const tP = (_predict ? XTe.map(_predict) : XTe.map(xi => xi.reduce((s, v, j) => s + v * model.w[j], model.b)))
            .map(v => denorm(v, norm.min, norm.range));
          const tA = yTe.map(v => denorm(v, norm.min, norm.range));
          const ssR = tA.reduce((s, a, i) => s + (a - tP[i]) ** 2, 0);
          const ssT = tA.reduce((s, a) => { const m = tA.reduce((x, b) => x + b, 0) / tA.length; return s + (a - m) ** 2; }, 0);
          const imp = model.w ? polyFeatNames.map((n, j) => ({ name: n, importance: +Math.abs(model.w[j] || 0).toFixed(4) })).sort((a, b) => b.importance - a.importance) : [];
          const regTestR2 = +(1 - ssR / (ssT || 1)).toFixed(4);
          const regTestRmse = +Math.sqrt(ssR / tA.length).toFixed(4);
          setResult({ task: "regression", modelId,
            trainR2: model.r2, trainRmse: model.rmse,
            testR2: regTestR2, testRmse: regTestRmse,
            losses: model.losses, importance: imp, testActual: tA, testPreds: tP,
            nTrain: XTr.length, nTest: XTe.length });
          setRunHistory(p => [...p, { task: "regression", target: targetCol, modelId,
            metric: "R²", value: regTestR2, sub: `RMSE ${regTestRmse}`, ts: new Date().toLocaleTimeString() }]);

        // ── 분류
        } else if (task === "classification") {
          const classes = [...new Set(y)].sort();
          if (classes.length < 2) { setError("클래스 2개 이상 필요합니다."); setRunning(false); return; }
          if (classes.length > 20) { setError("클래스 최대 20개입니다."); setRunning(false); return; }
          const { XTr, yTr, XTe, yTe } = trainTestSplit(X, y, testRatio);
          let trPreds, testPreds, trainAcc, lossData = [], impData = [];
          const cm = {}; classes.forEach(a => { cm[a] = {}; classes.forEach(b => { cm[a][b] = 0; }); });

          if (modelId === "knn_cls") {
            const kk = 5;
            const kP = xi => {
              const d = XTr.map((xj, i) => ({ i, d: xi.reduce((s, v, j) => s + (v - xj[j]) ** 2, 0) }))
                          .sort((a, b) => a.d - b.d).slice(0, kk);
              const f = {}; d.forEach(({ i }) => { f[yTr[i]] = (f[yTr[i]] || 0) + 1; });
              return Object.entries(f).sort((a, b) => b[1] - a[1])[0][0];
            };
            trPreds = XTr.map(kP); testPreds = XTe.map(kP);
            trainAcc = +(trPreds.filter((p, i) => p === yTr[i]).length / yTr.length * 100).toFixed(2);
            impData = allFeatNames.map(n => ({ name: n, importance: 0 }));

          } else if (modelId === "dtree") {
            const gini = arr => {
              const n = arr.length; if (!n) return 0;
              const f = {}; arr.forEach(v => { f[v] = (f[v] || 0) + 1; });
              return 1 - Object.values(f).reduce((s, c) => s + (c / n) ** 2, 0);
            };
            const build = (rows, labels, d = 0) => {
              if (d >= 4 || new Set(labels).size === 1 || rows.length < 4) {
                const f = {}; labels.forEach(l => { f[l] = (f[l] || 0) + 1; });
                return { leaf: true, cls: Object.entries(f).sort((a, b) => b[1] - a[1])[0][0] };
              }
              let bG = -1, bF = -1, bT = 0;
              const pG = gini(labels);
              for (let fi = 0; fi < rows[0].length; fi++) {
                const vals = [...new Set(rows.map(r => r[fi]))].sort((a, b) => a - b);
                for (let vi = 0; vi < vals.length - 1; vi++) {
                  const thresh = (vals[vi] + vals[vi + 1]) / 2;
                  const lI = rows.map((r, i) => r[fi] <= thresh ? i : -1).filter(i => i >= 0);
                  const rI = rows.map((r, i) => r[fi] > thresh ? i : -1).filter(i => i >= 0);
                  if (!lI.length || !rI.length) continue;
                  const g = pG - (lI.length / rows.length) * gini(lI.map(i => labels[i]))
                                - (rI.length / rows.length) * gini(rI.map(i => labels[i]));
                  if (g > bG) { bG = g; bF = fi; bT = thresh; }
                }
              }
              if (bF < 0) { const f = {}; labels.forEach(l => { f[l] = (f[l] || 0) + 1; }); return { leaf: true, cls: Object.entries(f).sort((a, b) => b[1] - a[1])[0][0] }; }
              const lI = rows.map((r, i) => r[bF] <= bT ? i : -1).filter(i => i >= 0);
              const rI = rows.map((r, i) => r[bF] > bT ? i : -1).filter(i => i >= 0);
              return { feat: bF, thresh: bT, left: build(lI.map(i => rows[i]), lI.map(i => labels[i]), d + 1), right: build(rI.map(i => rows[i]), rI.map(i => labels[i]), d + 1) };
            };
            const predict = (tree, xi) => tree.leaf ? tree.cls : xi[tree.feat] <= tree.thresh ? predict(tree.left, xi) : predict(tree.right, xi);
            const tree = build(XTr, yTr);
            trPreds = XTr.map(xi => predict(tree, xi)); testPreds = XTe.map(xi => predict(tree, xi));
            trainAcc = +(trPreds.filter((p, i) => p === yTr[i]).length / yTr.length * 100).toFixed(2);
            impData = allFeatNames.map(n => ({ name: n, importance: 0 }));

          } else if (modelId === "rf_cls") {
            const rfModel = randomForestClassification(XTr, yTr, classes, 10, 5);
            trPreds = rfModel.preds; testPreds = XTe.map(rfModel.predict);
            trainAcc = rfModel.acc;
            lossData = rfModel.losses;
            impData = allFeatNames.map(n => ({ name: n, importance: 0 }));

          } else if (modelId === "naive_bayes") {
            const nbModel = naiveBayes(XTr, yTr, classes);
            trPreds = nbModel.preds; testPreds = XTe.map(nbModel.predict);
            trainAcc = nbModel.acc;
            impData = allFeatNames.map(n => ({ name: n, importance: 0 }));

          } else if (modelId === "svm") {
            const svmModel = linearSVM(XTr, yTr, classes, 1.0);
            trPreds = svmModel.preds; testPreds = XTe.map(svmModel.predict);
            trainAcc = svmModel.acc; lossData = svmModel.losses;
            impData = allFeatNames.map((n, j) => ({ name: n, importance: +svmModel.importance[j].toFixed(4) })).sort((a, b) => b.importance - a.importance);

          } else { // logistic
            const model = logisticRegression(X, y, classes);
            const trModel = logisticRegression(XTr, yTr, classes);
            testPreds = XTe.map(xi => {
              const sc = classes.map(cls => ({ cls, score: sigmoid(xi.reduce((s, v, j) => s + v * (trModel.models[cls]?.w[j] || 0), trModel.models[cls]?.b || 0)) }));
              return sc.sort((a, b) => b.score - a.score)[0].cls;
            });
            trPreds = model.preds; trainAcc = model.acc; lossData = model.losses;
            impData = allFeatNames.map((n, j) => ({ name: n, importance: model.importance[j] ?? 0 })).sort((a, b) => b.importance - a.importance);
          }

          const testAcc = +(testPreds.filter((p, i) => p === yTe[i]).length / yTe.length * 100).toFixed(2);
          y.forEach((actual, i) => { if (cm[actual]) cm[actual][trPreds[i]] = (cm[actual][trPreds[i]] || 0) + 1; });
          setResult({ task: "classification", modelId, trainAcc, testAcc, classes,
            cm, losses: lossData, importance: impData, nTrain: XTr.length, nTest: XTe.length });
          setRunHistory(p => [...p, { task: "classification", target: targetCol, modelId,
            metric: "정확도", value: testAcc, sub: `학습 ${trainAcc}%`, ts: new Date().toLocaleTimeString() }]);

        // ── 군집화
        } else if (task === "clustering") {
          if (modelId === "dbscan") {
            // DBSCAN: auto-estimate eps from median distance
            const sampleSize = Math.min(X.length, 100);
            const sampleX = X.slice(0, sampleSize);
            const dists = [];
            for (let i = 0; i < sampleSize; i++)
              for (let j = i + 1; j < sampleSize; j++)
                dists.push(Math.sqrt(sampleX[i].reduce((s, v, k) => s + (v - sampleX[j][k]) ** 2, 0)));
            dists.sort((a, b) => a - b);
            const eps = dists[Math.floor(dists.length * 0.15)] || 0.5;
            const { labels, nClusters, noise, sizes } = dbscan(X, eps, Math.max(2, Math.floor(X.length * 0.03)));
            const rowsWithCluster = ds.rows.slice(0, X.length).map((r, i) => ({
              ...r,
              _cluster: labels[i] === -1 ? "noise" : String(labels[i]),
            }));
            setResult({ task: "clustering", modelId: "dbscan", k: nClusters, nClusters, noise, sizes,
              losses: [], rowsWithCluster, vizX: featureCols[0], vizY: featureCols[1] || featureCols[0],
              elbowData: [], eps: +eps.toFixed(3) });
          } else {
            if (!kClusters) { setError("K 값을 선택해 주세요. 먼저 엘보우 곡선을 확인하세요."); setRunning(false); return; }
            const k = Math.max(2, Math.min(kClusters, 10));
            const { labels, sizes, losses } = kmeans(X, k);
            const rowsWithCluster = ds.rows.slice(0, X.length).map((r, i) => ({ ...r, _cluster: String(labels[i]) }));
            setResult({ task: "clustering", modelId: "kmeans", k, sizes, losses, rowsWithCluster,
              vizX: featureCols[0], vizY: featureCols[1] || featureCols[0],
              elbowData: elbowPreview || [] });
          }
        }

        setStep(3);
      } catch (e) {
        setError("오류: " + e.message);
      }
      setRunning(false);
    }, 60);
  };
  const askAI = async () => {
    if (!orKey.trim() || !result) return;
    setAiLoading(true); setAiText(""); setAiSpecs(null);
    try {
      const summary = JSON.stringify({
        task:result.task, 모델:modelId, 데이터셋:ds?.name, 행수:ds?.rowCount,
        타겟:targetCol, 피처:featureCols,
        성능:{ R2:result.testR2, RMSE:result.testRmse, 정확도:result.testAcc },
        상위피처:result.importance?.slice(0,5),
        클러스터크기:result.sizes, 클래스수:result.classes?.length,
      }, null, 2);
      const sys = "당신은 친절한 데이터 분석 선생님입니다. 머신러닝 입문자에게 결과를 쉽게 한국어로 설명합니다.";
      const colList = ds.colMeta.map(c => `${c.name}(${c.type})`).join(", ");
      const user = `아래 머신러닝 결과를 초보자에게 쉽게 설명해 주세요.\n\n${summary}\n
1. **모델 결과 요약** — 이 모델이 한 일과 결과를 1~2문장으로
2. **성능 평가** — 수치(R², 정확도, RMSE 등)의 실질적 의미, 잘된 점과 아쉬운 점
3. **중요한 피처 분석** — 상위 피처가 왜 중요한지 도메인 관점에서 해석
4. **실제 활용 시나리오** — 이 모델을 실무에서 어떻게 쓸 수 있는지 구체적 예시 2~3개
5. **개선 방향** — 성능을 높이기 위한 실행 가능한 방법 3가지
6. **다음 단계 분석 제안** — 이 결과를 바탕으로 해볼 만한 다음 분석 2가지

## 차트 추천 (필수)
답변 맨 마지막에 아래 형식의 json 코드블록을 추가하세요. 분석 결과를 이해하는 데 도움이 되는 차트 1~2개를 추천하고, 컬럼명은 실제 컬럼(${colList})만 사용하세요.
\`\`\`json
{"charts":[{"type":"bar","x":"범주형컬럼","y":"숫자컬럼","agg":"mean","title":"차트 제목","reason":"추천 이유"}]}
\`\`\`
- type: "bar" | "line" | "pie" | "hist"(y만) | "scatter"(x·y 숫자)`;
      const raw = await callOpenRouter(orKey.trim(), sys, user, 2500);
      const { clean, specs } = extractChartSpecs(raw);
      setAiText(clean);
      setAiSpecs(specs);
    } catch (e) {
      setAiText("오류: " + e.message);
    }
    setAiLoading(false);
  };

  if (!ds) return <div style={{ padding:48, textAlign:"center", color:C.txT }}>파일을 업로드해 주세요.</div>;

  const TASKS = [
    { id:"regression",     icon:"📈", label:"숫자 예측",      sub:"회귀 (6가지 모델)",                     desc:"집값·매출·수량 등 숫자 예측",          when:"타겟이 숫자형일 때" },
    { id:"classification", icon:"🏷️", label:"카테고리 분류",  sub:"분류 (6가지 모델)",                     desc:"스팸/정상, 등급, 고객 유형 분류",       when:"타겟이 범주형일 때" },
    { id:"clustering",     icon:"🔵", label:"자동 그룹 분류", sub:"군집화 (K-Means / DBSCAN)",             desc:"비슷한 것끼리 자동 묶기, 이상치 탐지", when:"분류 기준 없을 때" },
    { id:"timeseries",     icon:"📉", label:"시계열 분석",    sub:"Time Series (6가지 모델)",              desc:"추세·계절성·이상치·예측 분석",          when:"시간 순서 데이터일 때" },
  ];
  // 태스크별 사용 가능 모델
  const MODELS = {
    regression: [
      { id:"linear",  label:"선형 회귀",      desc:"빠르고 해석 쉬움, 기준선 모델" },
      { id:"ridge",   label:"릿지 회귀",      desc:"과적합 방지 (L2 정규화)" },
      { id:"lasso",   label:"라쏘 회귀",      desc:"피처 선택 효과 (L1 정규화)" },
      { id:"poly",    label:"다항 회귀",      desc:"비선형 2차 패턴 포착" },
      { id:"knn_reg", label:"KNN 회귀",       desc:"가까운 이웃 평균 예측" },
      { id:"rf_reg",  label:"랜덤포레스트",   desc:"앙상블 — 높은 정확도" },
    ],
    classification: [
      { id:"logistic",    label:"로지스틱 회귀", desc:"빠른 분류 기준선, 확률 출력" },
      { id:"knn_cls",     label:"KNN 분류",      desc:"가까운 이웃 다수결" },
      { id:"dtree",       label:"의사결정나무",  desc:"규칙 기반, 해석 용이" },
      { id:"rf_cls",      label:"랜덤포레스트",  desc:"앙상블 — 높은 정확도" },
      { id:"naive_bayes", label:"나이브 베이즈", desc:"확률 기반, 빠르고 가벼움" },
      { id:"svm",         label:"SVM (선형)",    desc:"최대 마진 분류기" },
    ],
    clustering: [
      { id:"kmeans", label:"K-Means",  desc:"빠른 중심 기반 군집화" },
      { id:"dbscan", label:"DBSCAN",   desc:"밀도 기반 — 이상치 자동 감지" },
    ],
    timeseries: [
      { id:"ma",          label:"이동평균 (MA)",    desc:"단순 평균 평활화" },
      { id:"ewm",         label:"지수가중 (EWM)",   desc:"최근 값에 더 큰 가중치" },
      { id:"trend",       label:"추세 분해",        desc:"선형 추세 + 잔차 분리" },
      { id:"holtwinters", label:"Holt-Winters",     desc:"추세 + 계절성 동시 포착 + 예측" },
      { id:"decompose",   label:"계절성 분해",      desc:"추세·계절·잔차 3성분 분리" },
      { id:"anomaly",     label:"이상치 탐지",      desc:"IQR + Z-score 이상치 감지" },
    ],
  };


  // ── Step indicator
  const STEPS = [{n:0,label:"AI 제안"},{n:1,label:"목표 선택"},{n:2,label:"컬럼 확인"},{n:3,label:"결과 확인"}];
  const StepBar = () => (
    <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:20, flexWrap:"wrap" }}>
      {STEPS.map((s,i) => (
        <div key={s.n} style={{ display:"flex", alignItems:"center" }}>
          <div onClick={() => step > s.n && setStep(s.n)} style={{
            display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:20,
            background: step===s.n ? C.info : step>s.n ? C.success : C.bgS,
            cursor: step > s.n ? "pointer" : "default",
          }}>
            <span style={{ width:20, height:20, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
              background: step===s.n ? C.infoTx : step>s.n ? C.successTx : C.bd,
              color:"#fff", fontSize:11, fontWeight:500 }}>
              {step > s.n ? "✓" : s.n===0 ? "✨" : s.n}
            </span>
            <span style={{ fontSize:12, fontWeight:step===s.n?500:400,
              color: step===s.n ? C.infoTx : step>s.n ? C.successTx : C.txS }}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length-1 && <div style={{ width:20, height:1, background:C.bd }}/>}
        </div>
      ))}
    </div>
  );

  const DIFF_CLR = { "초급":{bg:"#E1F5EE",tx:"#0F6E56"}, "중급":{bg:"#FAEEDA",tx:"#BA7517"}, "고급":{bg:"#FCEBEB",tx:"#A32D2D"} };
  const TASK_LABEL = { regression:"📈 숫자 예측", classification:"🏷️ 분류", clustering:"🔵 군집화", timeseries:"📉 시계열" };

  return (
    <div>
      <StepBar/>

      {/* ── STEP 0: AI 분석 제안 */}
      {step === 0 && (
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6, flexWrap:"wrap", gap:8 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:500, color:C.tx }}>✨ AI에게 분석 방법을 제안받아 보세요</div>
              <div style={{ fontSize:13, color:C.txS, marginTop:3 }}>
                데이터 정보를 AI에게 보내면 적합한 예측·분류 분석 3가지를 제안받습니다. 실제 학습은 브라우저에서 직접 실행됩니다.
              </div>
            </div>
            <Btn small onClick={() => setStep(1)}>건너뛰고 직접 선택 →</Btn>
          </div>

          <DsSelector datasets={allDs} value={selId} onChange={setSelId} label="분석할 데이터"/>

          {/* API 키 */}
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12, marginTop:4 }}>
            <span style={{ fontSize:12, color:C.txS, whiteSpace:"nowrap" }}>🔑 OpenRouter 키</span>
            <input type={showKey ? "text" : "password"} placeholder="sk-or-v1-... (AI 분석 탭과 동일한 키)"
              value={orKey} onChange={e => saveKey(e.target.value)}
              style={{ flex:1, fontSize:12, padding:"6px 10px", borderRadius:"var(--border-radius-md)",
                border:`0.5px solid ${orKey ? C.successTx+"88" : C.bdS}`, background:C.bg, color:C.tx,
                fontFamily:"var(--font-mono)" }}/>
            <button type="button" onClick={() => setShowKey(p => !p)}
              style={{ fontSize:11, padding:"3px 8px", cursor:"pointer", borderRadius:"var(--border-radius-md)",
                background:"transparent", border:`0.5px solid ${C.bdS}`, color:C.txS }}>
              {showKey ? "숨기기" : "보기"}
            </button>
          </div>

          {/* 도메인 컨텍스트 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, color:C.txS, marginBottom:4, fontWeight:500 }}>
              💬 내가 아는 내용 알려주기 (선택)
            </div>
            <textarea value={userCtx} onChange={e => setUserCtx(e.target.value)} rows={2}
              placeholder={"예: 이 데이터는 카페 매출 기록입니다. 메뉴별 매출을 예측하고 싶어요.\n예: 분류 분석은 빼고 제안해 주세요."}
              style={{ width:"100%", fontSize:13, padding:"8px 10px", borderRadius:"var(--border-radius-md)",
                border:`0.5px solid ${C.bdS}`, background:C.bg, color:C.tx,
                resize:"vertical", boxSizing:"border-box", lineHeight:1.6 }}/>
          </div>

          {propError && (
            <div style={{ fontSize:12, color:"#A32D2D", background:"#FCEBEB",
              padding:"8px 10px", borderRadius:"var(--border-radius-md)", marginBottom:10 }}>
              {propError}
            </div>
          )}

          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            <Btn variant="primary" onClick={() => fetchProposals(false)} disabled={propLoading || !orKey}>
              {propLoading ? "AI가 데이터를 분석 중..." : proposals ? "✨ 새로 제안받기" : "✨ AI 분석 제안받기"}
            </Btn>
            {proposals && (
              <Btn onClick={() => fetchProposals(true)} disabled={propLoading}>
                🔄 다시 제안 (이전 제안 제외)
              </Btn>
            )}
          </div>

          {/* 제안 카드 */}
          {proposals && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12 }}>
              {proposals.map((p, i) => {
                const dc = DIFF_CLR[p.difficulty] || DIFF_CLR["중급"];
                const tgtOk = !p.target || ds?.columns.includes(p.target);
                return (
                  <div key={i} style={{
                    border:`1.5px solid ${C.bdS}`, borderRadius:"var(--border-radius-lg)",
                    padding:16, background:C.bg, display:"flex", flexDirection:"column", gap:8,
                    boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background:"#E6F1FB", color:"#185FA5", fontWeight:500 }}>
                        {TASK_LABEL[p.task] || p.task}
                      </span>
                      <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background:dc.bg, color:dc.tx, fontWeight:500 }}>
                        {p.difficulty || "중급"}
                      </span>
                    </div>
                    <div style={{ fontSize:14, fontWeight:600, color:C.tx }}>{p.title}</div>
                    <div style={{ fontSize:12, color:C.txS, lineHeight:1.6 }}>{p.reason}</div>
                    {p.use_case && (
                      <div style={{ fontSize:11, color:C.infoTx, background:C.info, borderRadius:6, padding:"6px 8px", lineHeight:1.5 }}>
                        💡 {p.use_case}
                      </div>
                    )}
                    <div style={{ fontSize:11, color:C.txS, fontFamily:"var(--font-mono)", lineHeight:1.7 }}>
                      {p.target && <div>🎯 타겟: <strong style={{ color: tgtOk ? C.tx : "#A32D2D" }}>{p.target}{!tgtOk && " (컬럼 없음)"}</strong></div>}
                      {p.features?.length > 0 && <div>📊 피처: {p.features.join(", ")}</div>}
                      <div>🤖 모델: {p.model}</div>
                    </div>
                    <button type="button" onClick={() => applyProposal(p)} style={{
                      marginTop:"auto", padding:"9px", fontSize:13, fontWeight:600, cursor:"pointer",
                      borderRadius:"var(--border-radius-md)", border:"none",
                      background:"linear-gradient(135deg,#185FA5 0%,#1D9E75 100%)", color:"#fff",
                    }}>
                      이 제안으로 시작 →
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!proposals && !propLoading && (
            <div style={{ textAlign:"center", padding:"28px 24px", color:C.txT, fontSize:13,
              border:`0.5px dashed ${C.bd}`, borderRadius:"var(--border-radius-lg)" }}>
              버튼을 누르면 컬럼 정보·통계가 AI에게 전송되고, 추천 타겟·피처·모델이 포함된 분석 3가지를 제안받습니다.
            </div>
          )}
        </div>
      )}

      {/* ── STEP 1 */}
      {step === 1 && (
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
            <div style={{ fontSize:15, fontWeight:500, color:C.tx }}>어떤 분석을 하고 싶으신가요?</div>
            <Btn small onClick={() => setStep(0)}>← AI 제안받기</Btn>
          </div>
          <div style={{ fontSize:13, color:C.txS, marginBottom:16 }}>클릭하면 자동으로 설정됩니다</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
            {TASKS.map(t => (
              <div key={t.id} onClick={() => selectTask(t.id)} style={{
                padding:18, borderRadius:"var(--border-radius-lg)",
                border: "1.5px solid " + C.bdS,
                cursor:"pointer", background:C.bg, transition:"all 0.15s",
                boxShadow:"0 1px 3px rgba(0,0,0,0.06)",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="#185FA5"; e.currentTarget.style.boxShadow="0 3px 10px rgba(24,95,165,0.15)"; e.currentTarget.style.background="#F5F9FF"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=C.bdS; e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.06)"; e.currentTarget.style.background=C.bg; }}
              >
                <div style={{ fontSize:28, marginBottom:10 }}>{t.icon}</div>
                <div style={{ fontSize:14, fontWeight:600, color:C.tx, marginBottom:3 }}>{t.label}</div>
                <div style={{ fontSize:12, color:"#185FA5", fontWeight:500, marginBottom:6 }}>{t.sub}</div>
                <div style={{ fontSize:12, color:C.txS, marginBottom:10, lineHeight:1.5 }}>{t.desc}</div>
                <div style={{ fontSize:11, padding:"4px 10px", borderRadius:20, background:"#E6F1FB", color:"#185FA5", display:"inline-block", fontWeight:500 }}>
                  💡 {t.when}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 2 */}
      {step === 2 && task && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <span style={{ fontSize:20 }}>{TASKS.find(t => t.id===task)?.icon}</span>
            <div>
              <div style={{ fontSize:14, fontWeight:500, color:C.tx }}>{TASKS.find(t => t.id===task)?.label}</div>
              <div style={{ fontSize:12, color:C.txS }}>자동으로 컬럼을 선택했습니다. 필요시 수정하세요.</div>
            </div>
            <Btn small onClick={() => setStep(1)}>← 목표 재선택</Btn>
          </div>

          <DsSelector datasets={allDs} value={selId}
            onChange={v => { setSelId(v); setTask(""); setStep(1); }} label="데이터셋"/>

          {/* 모델 선택 */}
          {task && MODELS[task] && MODELS[task].length > 1 && (
            <Section title="🤖 모델 선택" desc="사용할 알고리즘을 선택하세요">
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:8 }}>
                {MODELS[task].map(m => (
                  <div key={m.id} onClick={() => setModelId(m.id)} style={{
                    padding:"12px 14px", borderRadius:"var(--border-radius-md)", cursor:"pointer",
                    border: modelId===m.id ? "2px solid #185FA5" : "1px solid "+C.bdS,
                    background: modelId===m.id ? "#E6F1FB" : C.bgS,
                    transition:"all 0.15s",
                  }}>
                    <div style={{ fontSize:13, fontWeight:600, color:modelId===m.id?"#185FA5":C.tx, marginBottom:3 }}>{m.label}</div>
                    <div style={{ fontSize:11, color:C.txS }}>{m.desc}</div>
                    {modelId===m.id && <div style={{ marginTop:6, fontSize:10, color:"#185FA5", fontWeight:500 }}>✓ 선택됨</div>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 시계열: 분석 컬럼 */}
          {task === "timeseries" && (
            <Section title={"📈 분석 컬럼 — " + (targetCol || "선택 안 됨")} desc="시계열로 분석할 숫자형 컬럼">
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {numCols.map(c => (
                  <span key={c} onClick={() => setTargetCol(c)} style={{
                    fontSize:12, padding:"6px 14px", borderRadius:20, cursor:"pointer",
                    background: targetCol===c ? "#E6F1FB" : C.bgS,
                    color: targetCol===c ? "#0C447C" : C.tx,
                    border: (targetCol===c ? "2px" : "1px") + " solid " + (targetCol===c ? "#185FA5" : C.bdS),
                    fontFamily:"var(--font-mono)", fontWeight: targetCol===c ? 600 : 400,
                  }}>{c}{targetCol===c ? " ✓" : ""}</span>
                ))}
              </div>
            </Section>
          )}

          {/* 타겟 컬럼 */}
          {task !== "clustering" && task !== "timeseries" && (
            <Section title={"🎯 타겟 컬럼 — " + (targetCol || "선택 안 됨")} desc="예측/분류할 대상 컬럼">
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {allCols.map(c => {
                  const meta = ds.colMeta.find(m => m.name === c);
                  const suit = task === "regression"
                    ? meta?.type === "number"
                    : meta?.type === "category" || meta?.type === "text";
                  return (
                    <TargetTag key={c} c={c} isSelected={targetCol===c} task={task}
                      isDisabled={!suit} onClick={() => setTargetCol(c)}/>
                  );
                })}
              </div>
              {targetCol && (
                <div style={{ marginTop:8, fontSize:12, color:C.infoTx }}>
                  {"✓ " + targetCol + " 선택됨"}
                </div>
              )}
            </Section>
          )}

          {/* 피처 컬럼 */}
          <Section title={"📊 피처 컬럼 — " + featureCols.length + "개 선택됨"} desc="학습에 사용할 입력 컬럼">
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
              {allCols.filter(c => c !== targetCol).map(c => {
                const meta = ds.colMeta.find(m => m.name === c);
                const isNum = meta?.type === "number";
                return (
                  <FeatTag key={c} c={c} isSelected={featureCols.includes(c)}
                    isNum={isNum} onClick={() => toggleFeat(c)} dim={false}/>
                );
              })}
            </div>
          </Section>

          {/* 군집화: 엘보우 계산 → K 선택 (K-Means만) */}
          {task === "clustering" && modelId !== "dbscan" && featureCols.length > 0 && (
            <Section title="📐 최적 K 값 찾기 (엘보우 곡선)" desc="피처 컬럼 선택 후 아래 버튼을 눌러 적정 K를 확인하세요">
              {!elbowPreview ? (
                <div>
                  <div style={{ fontSize:13, color:C.txS, marginBottom:12, lineHeight:1.6 }}>
                    엘보우 곡선은 K(클러스터 수)에 따른 응집도 변화를 보여줍니다.<br/>
                    <strong>꺾이는 지점</strong>이 최적 K입니다.
                  </div>
                  <button type="button" onClick={() => {
                    const { X } = prepareFeatures(ds, featureCols, null);
                    if (X.length < 4) return;
                    const eData = [];
                    for (let ki=2; ki<=Math.min(8,X.length-1); ki++) {
                      const res = kmeans(X, ki, 50);
                      const inertia = X.reduce((s,xi,i) =>
                        s+xi.reduce((ss,v,j)=>ss+(v-res.centroids[res.labels[i]][j])**2,0),0);
                      eData.push({ k:ki, inertia:+inertia.toFixed(1) });
                    }
                    setElbowPreview(eData);
                  }} style={{
                    padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer",
                    borderRadius:"var(--border-radius-md)", border:"1.5px solid #185FA5",
                    background:"#E6F1FB", color:"#185FA5",
                  }}>
                    🔍 엘보우 곡선 계산하기
                  </button>
                </div>
              ) : (
                <div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={elbowPreview} margin={{ top:4, right:16, left:0, bottom:4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.bd}/>
                      <XAxis dataKey="k" tick={{ fontSize:10, fill:C.txS }} tickFormatter={v=>Number.isInteger(v)?v:Math.round(v)} label={{ value:"K (클러스터 수)", position:"insideBottom", offset:-2, fontSize:10, fill:C.txS }}/>
                      <YAxis tick={{ fontSize:10, fill:C.txS }} width={60} tickFormatter={v=>v>=1000?Math.round(v/100)*100:Math.round(v)}/>
                      <Tooltip contentStyle={{ fontSize:11, borderRadius:6, border:"0.5px solid "+C.bd }} formatter={v=>[+v.toFixed(1),"Inertia"]}/>
                      <Line type="monotone" dataKey="inertia" stroke="#D85A30" strokeWidth={2} dot={{ r:5, fill:"#D85A30" }} name="Inertia"/>
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop:12, fontSize:12, color:C.txS, marginBottom:8 }}>
                    꺾이는 지점의 K를 선택하세요
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {elbowPreview.map(({ k }) => (
                      <div key={k} onClick={() => setKClusters(k)} style={{
                        padding:"10px 18px", borderRadius:"var(--border-radius-md)", cursor:"pointer",
                        background: kClusters===k ? "#E6F1FB" : C.bgS,
                        color: kClusters===k ? "#185FA5" : C.tx,
                        fontSize:16, fontWeight: kClusters===k ? 700 : 400,
                        border: (kClusters===k?"2px":"1px") + " solid " + (kClusters===k?"#185FA5":C.bdS),
                        textAlign:"center", minWidth:56, transition:"all 0.1s",
                        boxShadow: kClusters===k ? "0 2px 8px rgba(24,95,165,0.25)" : "none",
                      }}>
                        <div>K={k}</div>
                        {kClusters===k && <div style={{ fontSize:10, color:"#185FA5", marginTop:2 }}>✓ 선택됨</div>}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:8 }}>
                    <button type="button" onClick={() => { setElbowPreview(null); setKClusters(null); }}
                      style={{ fontSize:11, color:C.txS, background:"transparent", border:"none", cursor:"pointer", padding:0 }}>
                      ↺ 다시 계산
                    </button>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* 학습/검증 비율 */}
          {task !== "clustering" && (
            <Section title="학습/검증 데이터 비율" desc="전체 데이터를 학습과 검증으로 나누는 비율입니다">
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {[{v:0.1,label:"9:1"},{v:0.2,label:"8:2",rec:true},{v:0.3,label:"7:3"},{v:0.4,label:"6:4"}].map(({v,label,rec}) => (
                  <div key={v} onClick={() => setTestRatio(v)} style={{
                    padding:"10px 16px", borderRadius:"var(--border-radius-md)", cursor:"pointer",
                    border: (testRatio===v?"2px solid #185FA5":"1px solid "+C.bdS),
                    background: testRatio===v ? "#E6F1FB" : C.bgS,
                    transition:"all 0.1s", textAlign:"center",
                  }}>
                    <div style={{ fontSize:14, fontWeight:700, color:testRatio===v?"#185FA5":C.tx }}>{label}</div>
                    <div style={{ fontSize:10, color:testRatio===v?"#185FA5":C.txS }}>{"검증 " + (v*100) + "%" + (rec?" ⭐":"") }</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 고급 설정 */}
          <div style={{ marginBottom:14 }}>
            <button type="button" onClick={() => setShowAdv(p => !p)} style={{
              fontSize:12, color:C.txS, background:"transparent", border:"none", cursor:"pointer", padding:0,
            }}>
              {showAdv ? "▲ 고급 설정 숨기기" : "▼ 고급 설정 (선택사항)"}
            </button>
            {showAdv && task === "neural" && (
              <div style={{ marginTop:10, padding:14, background:C.bgS,
                borderRadius:"var(--border-radius-md)", border:"0.5px solid "+C.bd }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10 }}>
                  <div>
                    <div style={{ fontSize:12, color:C.txS, marginBottom:4 }}>은닉층 크기</div>
                    <input value={hiddenLayer} onChange={e => setHiddenLayer(e.target.value)}
                      style={{ width:"100%", fontSize:12, padding:"5px 8px", borderRadius:"var(--border-radius-md)",
                        border:"0.5px solid "+C.bdS, background:C.bg, color:C.tx }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:12, color:C.txS, marginBottom:4 }}>학습률</div>
                    <select value={lrRate} onChange={e => setLrRate(+e.target.value)}
                      style={{ width:"100%", fontSize:12, padding:"5px 8px", borderRadius:"var(--border-radius-md)",
                        border:"0.5px solid "+C.bdS, background:C.bg, color:C.tx }}>
                      {[0.001,0.01,0.05,0.1].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:12, color:C.txS, marginBottom:4 }}>에포크</div>
                    <select value={epochs} onChange={e => setEpochs(+e.target.value)}
                      style={{ width:"100%", fontSize:12, padding:"5px 8px", borderRadius:"var(--border-radius-md)",
                        border:"0.5px solid "+C.bdS, background:C.bg, color:C.tx }}>
                      {[100,200,300,500].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div style={{ fontSize:12, color:"#A32D2D", background:"#FCEBEB",
              padding:"8px 10px", borderRadius:"var(--border-radius-md)", marginBottom:12 }}>
              {error}
            </div>
          )}
          <div style={{ marginTop:8 }}>
            <button type="button" onClick={run}
              disabled={running || (task!=="clustering"&&task!=="timeseries"&&featureCols.length===0) || (task!=="clustering"&&task!=="timeseries"&&!targetCol) || (task==="timeseries"&&!targetCol)}
              style={{
                width:"100%", padding:"14px", fontSize:15, fontWeight:700, cursor:"pointer",
                borderRadius:"var(--border-radius-lg)", border:"none",
                background: running ? "#8ab3d4" : "linear-gradient(135deg,#185FA5 0%,#1D9E75 100%)",
                color:"#fff", letterSpacing:"0.02em",
                boxShadow: running ? "none" : "0 3px 10px rgba(24,95,165,0.3)",
                transition:"all 0.2s",
              }}>
              {running ? "⏳ 학습 중... 잠시만 기다려 주세요" : "🚀 학습 시작하기"}
            </button>
            {running && (
              <div style={{ fontSize:12, color:C.txS, marginTop:8, textAlign:"center" }}>
                브라우저에서 직접 학습합니다. 잠시만 기다려 주세요!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 3 */}
      {step === 3 && result && (
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:500, color:C.tx }}>📋 학습 결과</div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn small onClick={() => { setStep(2); setResult(null); setAiText(""); setAiSpecs(null); }}>← 다시 학습</Btn>
              <Btn small onClick={() => { setTask(""); setStep(0); setResult(null); setAiText(""); setAiSpecs(null); }}>처음으로</Btn>
            </div>
          </div>

          <EasyResultCard result={result} targetCol={targetCol}/>

          {/* 모델 비교 — 같은 태스크·타겟으로 2회 이상 실행 시 */}
          {(() => {
            const comparable = runHistory.filter(h => h.task === result.task && h.target === targetCol);
            if (comparable.length < 2) return null;
            const best = Math.max(...comparable.map(h => h.value));
            const mLabel = id => (MODELS[result.task] || []).find(m => m.id === id)?.label || id;
            return (
              <div style={{ border:"0.5px solid "+C.bd, borderRadius:"var(--border-radius-lg)", padding:16, marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:500, color:C.tx, marginBottom:4 }}>⚖️ 모델 비교</div>
                <div style={{ fontSize:11, color:C.txT, marginBottom:10 }}>
                  같은 타겟("{targetCol}")으로 실행한 모델들의 성능입니다. 다른 모델로 다시 학습해 보세요.
                </div>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead><tr style={{ background:C.bgS }}>
                    {["모델", comparable[0].metric, "참고", "실행 시각"].map(h => (
                      <th key={h} style={{ padding:"7px 10px", textAlign:"left", color:C.txS, fontWeight:500, borderBottom:"0.5px solid "+C.bd }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {comparable.map((h, i) => (
                      <tr key={i} style={{ borderBottom:"0.5px solid "+C.bd, background: h.value === best ? "#EAF3DE" : "transparent" }}>
                        <td style={{ padding:"7px 10px", fontWeight:500, color:C.tx }}>
                          {mLabel(h.modelId)}{h.value === best && <span style={{ marginLeft:6, fontSize:10, color:"#0F6E56" }}>🏆 최고</span>}
                        </td>
                        <td style={{ padding:"7px 10px", fontFamily:"var(--font-mono)", color:C.tx }}>{h.value}{h.metric === "정확도" ? "%" : ""}</td>
                        <td style={{ padding:"7px 10px", color:C.txS }}>{h.sub}</td>
                        <td style={{ padding:"7px 10px", color:C.txT }}>{h.ts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          <div style={{ border:"0.5px solid "+C.bd, borderRadius:"var(--border-radius-lg)", padding:16, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:500, color:C.tx, marginBottom:4 }}>📊 상세 차트 <span style={{ fontSize:10, color:C.txT, fontWeight:400 }}>각 차트의 ⬇ PNG 버튼으로 저장 가능</span></div>
            {result.losses?.length > 1 && (
              <DownloadableChart filename="loss_curve">
                <LossCurve data={result.losses}
                  xKey={result.task==="clustering" ? "iter" : "epoch"}
                  title={result.task==="clustering" ? "학습 진행도 (Inertia)" : "학습 진행도 (Loss)"}/>
              </DownloadableChart>
            )}
            {result.task === "regression" && result.testActual && (
              <DownloadableChart filename="actual_vs_predicted">
                <ActualVsPred actual={result.testActual} predicted={result.testPreds}/>
              </DownloadableChart>
            )}
            {(result.task === "classification" || result.task === "neural") && result.cm && result.classes?.length <= 15 && (
              <MLConfMatrix cm={result.cm} classes={result.classes}/>
            )}
            {result.importance?.length > 0 && (
              <DownloadableChart filename="feature_importance">
                <MLFeatChart data={result.importance}/>
              </DownloadableChart>
            )}
            {result.task === "clustering" && result.rowsWithCluster && featureCols.length >= 2 && (
              <DownloadableChart filename="cluster_scatter">
                <MLScatter rows={result.rowsWithCluster} xCol={featureCols[0]} yCol={featureCols[1]}
                  labelKey="_cluster" title={"그룹 분포 (" + featureCols[0] + " × " + featureCols[1] + ")"}/>
              </DownloadableChart>
            )}
            {result.task === "clustering" && result.elbowData?.length > 1 && (
              <DownloadableChart filename="elbow_curve">
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:12, color:C.txS, fontWeight:500, marginBottom:4 }}>📐 엘보우 곡선 (최적 K 찾기)</div>
                <div style={{ fontSize:11, color:C.txT, marginBottom:8 }}>
                  꺾이는 지점(팔꿈치)이 최적 K입니다. 현재 선택: <strong style={{ color:C.infoTx }}>K={result.k}</strong>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={result.elbowData} margin={{ top:4, right:16, left:0, bottom:4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.bd}/>
                    <XAxis dataKey="k" tick={{ fontSize:10, fill:C.txS }} label={{ value:"K (클러스터 수)", position:"insideBottom", offset:-2, fontSize:10, fill:C.txS }}/>
                    <YAxis tick={{ fontSize:10, fill:C.txS }} width={60} tickFormatter={v=>v.toLocaleString()}/>
                    <Tooltip contentStyle={{ fontSize:11, borderRadius:6, border:"0.5px solid "+C.bd }} formatter={v=>[v.toLocaleString(),"Inertia"]}/>
                    <Line type="monotone" dataKey="inertia" stroke="#D85A30" strokeWidth={2} dot={{ r:5, fill:"#D85A30" }} name="Inertia"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
              </DownloadableChart>
            )}
            {result.task === "timeseries" && result.chartData?.length > 0 && (
              <DownloadableChart filename="timeseries">
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:12, color:C.txS, fontWeight:500, marginBottom:4 }}>
                  {"📈 시계열 분석 — " + result.colName}
                  {result.modelId === "ma" && <span style={{ fontSize:11, color:C.txT, marginLeft:8 }}>{"이동평균 window=" + result.win}</span>}
                  {result.modelId === "ewm" && <span style={{ fontSize:11, color:C.txT, marginLeft:8 }}>{"지수가중 α=" + result.alpha}</span>}
                  {result.modelId === "trend" && <span style={{ fontSize:11, color:C.txT, marginLeft:8 }}>{"기울기=" + result.slope}</span>}
                  {result.modelId === "holtwinters" && <span style={{ fontSize:11, color:C.txT, marginLeft:8 }}>{"계절주기=" + result.period + " · RMSE=" + result.rmse}</span>}
                  {result.modelId === "decompose" && <span style={{ fontSize:11, color:C.txT, marginLeft:8 }}>{"계절주기=" + result.period}</span>}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={result.chartData} margin={{ top:4, right:16, left:0, bottom:4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.bd}/>
                    <XAxis dataKey="i" tick={{ fontSize:10, fill:C.txS }} label={{ value:"인덱스", position:"insideBottom", offset:-2, fontSize:10, fill:C.txS }}/>
                    <YAxis tick={{ fontSize:10, fill:C.txS }}/>
                    <Tooltip contentStyle={{ fontSize:11, borderRadius:6, border:"0.5px solid "+C.bd }}/>
                    <Legend wrapperStyle={{ fontSize:11 }}/>
                    <Line type="monotone" dataKey="raw" stroke="#378ADD" dot={false} strokeWidth={1.5} name="원본" strokeOpacity={0.7}/>
                    {result.modelId==="ma"          && <Line type="monotone" dataKey="ma"       stroke="#D85A30" dot={false} strokeWidth={2} name={"MA("+result.win+")"}/>}
                    {result.modelId==="ewm"         && <Line type="monotone" dataKey="ewm"      stroke="#1D9E75" dot={false} strokeWidth={2} name="EWM"/>}
                    {result.modelId==="trend"       && <Line type="monotone" dataKey="trend"    stroke="#D85A30" dot={false} strokeWidth={2} name="추세선"/>}
                    {result.modelId==="trend"       && <Line type="monotone" dataKey="residual" stroke="#7F77DD" dot={false} strokeWidth={1.5} name="잔차"/>}
                    {result.modelId==="trend"       && <Line type="monotone" dataKey="forecast" stroke="#D85A30" dot={{ r:3 }} strokeWidth={2} strokeDasharray="6 3" name="예측"/>}
                    {result.modelId==="holtwinters" && <Line type="monotone" dataKey="fitted"   stroke="#1D9E75" dot={false} strokeWidth={2} name="피팅"/>}
                    {result.modelId==="holtwinters" && <Line type="monotone" dataKey="forecast" stroke="#D85A30" dot={{ r:3 }} strokeWidth={2} strokeDasharray="6 3" name="예측"/>}
                    {result.modelId==="decompose"   && <Line type="monotone" dataKey="trend"    stroke="#D85A30" dot={false} strokeWidth={2} name="추세"/>}
                    {result.modelId==="decompose"   && <Line type="monotone" dataKey="seasonal" stroke="#7F77DD" dot={false} strokeWidth={1.5} name="계절성"/>}
                    {result.modelId==="decompose"   && <Line type="monotone" dataKey="residual" stroke="#1D9E75" dot={false} strokeWidth={1} strokeDasharray="3 2" name="잔차"/>}
                    {result.modelId==="anomaly"     && <Line type="monotone" dataKey="upper"    stroke="#A32D2D" dot={false} strokeWidth={1} strokeDasharray="4 2" name="상한(IQR)"/>}
                    {result.modelId==="anomaly"     && <Line type="monotone" dataKey="lower"    stroke="#A32D2D" dot={false} strokeWidth={1} strokeDasharray="4 2" name="하한(IQR)"/>}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              </DownloadableChart>
            )}
            {/* 이상치 탐지 scatter */}
            {result.task === "timeseries" && result.modelId === "anomaly" && result.anomalyResult && (
              <DownloadableChart filename="anomaly_scatter">
                <AnomalyChart result={result.anomalyResult} colName={result.colName}/>
              </DownloadableChart>
            )}
            {/* 롤링 통계 */}
            {result.task === "timeseries" && result.rolling && (
              <DownloadableChart filename="rolling_stats">
                <RollingChart data={result.rolling} colName={result.colName} window={result.win||7}/>
              </DownloadableChart>
            )}
            {/* ACF 차트 */}
            {result.task === "timeseries" && result.acfData?.length > 0 && (
              <DownloadableChart filename="acf">
                <ACFChart data={result.acfData} colName={result.colName}/>
              </DownloadableChart>
            )}
          </div>

          <ModelGuide task={result.task} modelId={result.modelId || modelId}/>

          <div style={{ border:"0.5px solid "+C.bd, borderRadius:"var(--border-radius-lg)", overflow:"hidden" }}>
            <div style={{ padding:"11px 14px", background:C.bgS, borderBottom:"0.5px solid "+C.bd,
              display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
              <div>
                <span style={{ fontSize:13, fontWeight:500, color:C.tx }}>✨ AI 결과 해석</span>
                <div style={{ fontSize:11, color:C.txS, marginTop:2 }}>
                  성능 평가 · 피처 의미 · 활용 방법 · 다음 분석 제안까지 AI가 설명해 드립니다
                </div>
              </div>
              <Btn variant="primary" small onClick={askAI} disabled={!orKey || aiLoading}>
                {aiLoading ? "분석 중..." : orKey ? "✨ AI 해석 받기" : "AI 제안 단계에서 API 키 입력"}
              </Btn>
            </div>
            <div style={{ padding:"14px 18px" }}>
              {aiLoading && <div style={{ fontSize:13, color:C.txS }}>AI가 결과를 해석하고 있습니다...</div>}
              {aiText && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:16 }}>
                  <div style={{ flex:"1 1 340px" }}>
                    <MdBlock text={aiText}/>
                  </div>
                  {ds && aiSpecs?.filter(s => specValid(ds, s)).length > 0 && (
                    <div style={{ flex:"1 1 300px" }}>
                      <div style={{ fontSize:12, fontWeight:600, color:C.txS, marginBottom:8,
                        textTransform:"uppercase", letterSpacing:"0.05em" }}>📊 AI 추천 차트</div>
                      {aiSpecs.filter(s => specValid(ds, s)).map((s, i) => (
                        <ChartCard key={i} title={s.title || `${s.x || s.y} 차트`} desc={s.reason}>
                          <SpecChart ds={ds} spec={s}/>
                        </ChartCard>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!aiLoading && !aiText && (
                <div style={{ fontSize:12, color:C.txT }}>위 버튼을 누르면 AI가 결과를 친절하게 설명하고 관련 차트를 추천합니다.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
