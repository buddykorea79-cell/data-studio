import { useState, useRef } from "react";
import { BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { C, PALETTE } from "../constants";
import { Btn, Section, DsSelector, MdBlock } from "./UI";
import { normalize, denorm, prepareFeatures, trainTestSplit,
  linearRegression, logisticRegression, kmeans, mlp, sigmoid, relu, softmax, callGemini,
} from "../utils/mlUtils";

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
    return (
      <div style={{ borderRadius:"var(--border-radius-lg)", border:"2px solid "+g.color,
        background:g.bg, padding:"16px 18px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <span style={{ fontSize:20 }}>📈</span>
          <div>
            <div style={{ fontSize:14, fontWeight:500, color:g.color }}>회귀 결과: {g.grade}</div>
            <div style={{ fontSize:12, color:C.txS }}>"{targetCol}" 값 예측 모델</div>
          </div>
          <span style={{ marginLeft:"auto", fontSize:24, fontWeight:500, color:g.color, fontFamily:"var(--font-mono)" }}>
            R² {result.testR2}
          </span>
        </div>
        <div style={{ fontSize:13, color:C.tx, lineHeight:1.7, background:"rgba(255,255,255,0.6)", borderRadius:8, padding:"10px 12px" }}>
          전체 데이터 변동의 <strong>{Math.round(result.testR2*100)}%</strong>를 이 모델이 설명합니다.<br/>
          평균 오차(RMSE): <strong>{result.testRmse}</strong> · 학습:{result.nTrain}행 / 검증:{result.nTest}행
        </div>
      </div>
    );
  }

  if (result.task === "classification" || result.task === "neural") {
    const g = gradeAcc(result.testAcc);
    const label = result.task === "neural" ? "신경망" : "분류";
    return (
      <div style={{ borderRadius:"var(--border-radius-lg)", border:"2px solid "+g.color,
        background:g.bg, padding:"16px 18px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <span style={{ fontSize:20 }}>{result.task==="neural" ? "🧠" : "🏷️"}</span>
          <div>
            <div style={{ fontSize:14, fontWeight:500, color:g.color }}>{label} 결과: {g.grade}</div>
            <div style={{ fontSize:12, color:C.txS }}>"{targetCol}" · {result.classes?.length}개 클래스</div>
          </div>
          <span style={{ marginLeft:"auto", fontSize:24, fontWeight:500, color:g.color, fontFamily:"var(--font-mono)" }}>
            {result.testAcc}%
          </span>
        </div>
        <div style={{ fontSize:13, color:C.tx, lineHeight:1.7, background:"rgba(255,255,255,0.6)", borderRadius:8, padding:"10px 12px" }}>
          검증 데이터 <strong>{result.nTest}행</strong> 중 <strong>{Math.round(result.nTest*result.testAcc/100)}행</strong> 정확히 분류.<br/>
          {result.testAcc >= 90 ? "모델이 매우 잘 학습됐습니다! 🎉"
            : result.testAcc >= 75 ? "좋은 성능입니다."
            : result.testAcc >= 60 ? "어느 정도 패턴을 학습했습니다."
            : "전처리와 피처 선택을 점검해 보세요."}
        </div>
      </div>
    );
  }

  if (result.task === "clustering") {
    return (
      <div style={{ borderRadius:"var(--border-radius-lg)", border:"2px solid #185FA5",
        background:"#E6F1FB", padding:"16px 18px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <span style={{ fontSize:20 }}>🔵</span>
          <div>
            <div style={{ fontSize:14, fontWeight:500, color:"#185FA5" }}>군집화 완료 — {result.k}개 그룹 발견</div>
            <div style={{ fontSize:12, color:C.txS }}>비슷한 특성끼리 자동 그룹화</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {result.sizes?.map((s, i) => (
            <div key={i} style={{ background:"rgba(255,255,255,0.7)", borderRadius:8, padding:"5px 10px", fontSize:12 }}>
              <span style={{ color:PALETTE[i%PALETTE.length], fontWeight:500 }}>그룹{i+1}</span>
              <span style={{ color:C.txS, marginLeft:6 }}>{s}개 ({Math.round(s/result.sizes.reduce((a,b)=>a+b,0)*100)}%)</span>
            </div>
          ))}
        </div>
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

// ── FeatureTag helper ─────────────────────────────────────────────────────────
function FeatTag({ c, isSelected, isNum, onClick, dim }) {
  const bg = isSelected ? (isNum ? "#E6F1FB" : "#EEEDFE") : C.bg;
  const color = isSelected ? (isNum ? "#0C447C" : "#3C3489") : C.txS;
  const bw = isSelected ? "2px" : "0.5px";
  const bc = isSelected ? (isNum ? "#185FA5" : "#7F77DD") : C.bd;
  return (
    <span onClick={onClick} style={{
      fontSize:12, padding:"5px 12px", borderRadius:10, cursor:"pointer",
      background:bg, color:color,
      border: bw + " solid " + bc,
      fontFamily:"var(--font-mono)", fontWeight:isSelected?500:400,
      opacity: dim ? 0.4 : 1,
    }}>
      {c}{isSelected ? " ✓" : ""}
    </span>
  );
}

function TargetTag({ c, isSelected, task, isDisabled, onClick }) {
  const bg = isSelected ? (task==="regression" ? "#E6F1FB" : "#EEEDFE") : C.bg;
  const color = isSelected ? (task==="regression" ? "#0C447C" : "#3C3489") : isDisabled ? C.txT : C.tx;
  const bw = isSelected ? "2px" : "0.5px";
  const bc = isSelected ? (task==="regression" ? "#185FA5" : "#7F77DD") : isDisabled ? C.bd : C.bdS;
  return (
    <span onClick={onClick} style={{
      fontSize:12, padding:"5px 12px", borderRadius:10, cursor:"pointer",
      background:bg, color:color,
      border: bw + " solid " + bc,
      fontFamily:"var(--font-mono)", fontWeight:isSelected?500:400,
    }}>
      {c}
    </span>
  );
}

// ── MLTab main ────────────────────────────────────────────────────────────────
export function MLTab({ allDs, apiKey }) {
  const [selId, setSelId] = useState(() => allDs[0]?.id ?? "");
  const [task, setTask] = useState("");
  const [targetCol, setTargetCol] = useState("");
  const [featureCols, setFeatureCols] = useState([]);
  const [kClusters, setKClusters] = useState(3);
  const [showAdv, setShowAdv] = useState(false);
  const [testRatio, setTestRatio] = useState(0.2);
  const [hiddenLayer, setHiddenLayer] = useState("16,8");
  const [lrRate, setLrRate] = useState(0.05);
  const [epochs, setEpochs] = useState(300);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiText, setGeminiText] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  const ds = allDs.find(d => d.id === selId);
  const prevId = useRef(selId);
  if (prevId.current !== selId) {
    prevId.current = selId;
    setTask(""); setFeatureCols([]); setTargetCol("");
    setResult(null); setGeminiText(""); setError(""); setStep(1);
  }

  const numCols = ds ? ds.colMeta.filter(c => c.type==="number").map(c => c.name) : [];
  const catCols = ds ? ds.colMeta.filter(c => c.type==="category" || c.type==="text").map(c => c.name) : [];
  const allCols = ds ? ds.columns : [];

  const selectTask = t => {
    setTask(t); setResult(null); setGeminiText(""); setError("");
    if (!ds) return;
    if (t === "clustering") {
      setFeatureCols(numCols.slice(0, 5)); setTargetCol("");
    } else if (t === "regression") {
      setFeatureCols(numCols.slice(0, -1).slice(0, 6));
      setTargetCol(numCols[numCols.length-1] || "");
    } else {
      setFeatureCols(numCols.slice(0, 6));
      setTargetCol(catCols[0] || allCols[allCols.length-1] || "");
    }
    setStep(2);
  };

  const toggleFeat = c => setFeatureCols(p =>
    p.includes(c) ? p.filter(x => x !== c) : [...p, c]
  );

  const run = () => {
    if (!ds || featureCols.length === 0) return setError("피처 컬럼을 1개 이상 선택해 주세요.");
    if (task !== "clustering" && !targetCol) return setError("타겟 컬럼을 선택해 주세요.");
    setError(""); setRunning(true); setResult(null); setGeminiText("");

    setTimeout(() => {
      try {
        const { X, y, allFeatNames } = prepareFeatures(ds, featureCols, task !== "clustering" ? targetCol : null);
        if (X.length < 10) { setError("데이터가 너무 적습니다 (최소 10행)."); setRunning(false); return; }

        if (task === "regression") {
          const yNum = y.map(Number);
          if (yNum.some(isNaN)) { setError("타겟 컬럼에 숫자가 아닌 값이 있습니다."); setRunning(false); return; }
          const norm = normalize(yNum);
          const { XTr, yTr, XTe, yTe } = trainTestSplit(X, norm.scaled, testRatio);
          // 모델별 분기
          let model;
          if (modelId === "ridge") {
            const rn=XTr.length,rm=XTr[0].length,lambda=0.1;
            let w=new Array(rm).fill(0),b=0;const lr=0.01;const losses=[];
            for(let ep=0;ep<800;ep++){let dw=new Array(rm).fill(0),db=0,loss=0;for(let i=0;i<rn;i++){const pred=XTr[i].reduce((s,x,j)=>s+x*w[j],b);const err=pred-yTr[i];loss+=err*err;for(let j=0;j<rm;j++)dw[j]+=err*XTr[i][j];db+=err;}for(let j=0;j<rm;j++)w[j]-=lr*(dw[j]/rn+lambda*w[j]);b-=lr*db/rn;if(ep%80===0)losses.push({epoch:ep,loss:+(loss/rn).toFixed(4)});}
            const rPreds=XTr.map(xi=>xi.reduce((s,x,j)=>s+x*w[j],b));
            const rssR=yTr.reduce((s,yi,i)=>s+(yi-rPreds[i])**2,0);const rssT=yTr.reduce((s,yi)=>s+(yi-yTr.reduce((a,b)=>a+b,0)/rn)**2,0);
            model={w,b,preds:rPreds,r2:+(1-rssR/(rssT||1)).toFixed(4),rmse:+Math.sqrt(rssR/rn).toFixed(4),losses,_type:"ridge"};
          } else if (modelId === "knn_reg") {
            const kk=5;
            const knnP=xi=>{const dists=XTr.map((xj,i)=>({i,d:xi.reduce((s,v,j)=>s+(v-xj[j])**2,0)})).sort((a,b)=>a.d-b.d).slice(0,kk);return dists.reduce((s,{i})=>s+yTr[i],0)/kk;};
            const kPreds=XTr.map(knnP);const kssR=yTr.reduce((s,yi,i)=>s+(yi-kPreds[i])**2,0);const kssT=yTr.reduce((s,yi)=>s+(yi-yTr.reduce((a,b)=>a+b,0)/yTr.length)**2,0);
            model={w:new Array(XTr[0].length).fill(0),b:0,preds:kPreds,r2:+(1-kssR/(kssT||1)).toFixed(4),rmse:+Math.sqrt(kssR/yTr.length).toFixed(4),losses:[],_predict:knnP};
          } else {
            model = linearRegression(XTr, yTr);
          }
          const testPreds = model._predict
            ? XTe.map(model._predict)
            : XTe.map(xi => denorm(xi.reduce((s,v,j) => s+v*model.w[j], model.b), norm.min, norm.range));
          const testActual = yTe.map(v => denorm(v, norm.min, norm.range));
          const ssRes = testActual.reduce((s,a,i) => s+(a-testPreds[i])**2, 0);
          const ssTot = testActual.reduce((s,a) => { const mm=testActual.reduce((x,b)=>x+b,0)/testActual.length; return s+(a-mm)**2; }, 0);
          const importance = model.w ? allFeatNames.map((n,j) => ({ name:n, importance:+Math.abs(model.w[j]).toFixed(4) })).sort((a,b) => b.importance-a.importance) : [];
          setResult({ task:"regression", modelId, trainR2:model.r2, trainRmse:model.rmse,
            testR2:+(1-ssRes/(ssTot||1)).toFixed(4), testRmse:+Math.sqrt(ssRes/testActual.length).toFixed(4),
            losses:model.losses, importance, testActual, testPreds, nTrain:XTr.length, nTest:XTe.length });
        } else if (task === "classification") {
          const classes = [...new Set(y)].sort();
          if (classes.length < 2) { setError("클래스 2개 이상 필요합니다."); setRunning(false); return; }
          if (classes.length > 20) { setError("클래스 최대 20개입니다."); setRunning(false); return; }
          const { XTr, yTr, XTe, yTe } = trainTestSplit(X, y, testRatio);
          let allPreds, testPreds, trainAcc, lossData=[], importanceData=[];
          const cm = {}; classes.forEach(a => { cm[a]={}; classes.forEach(b => { cm[a][b]=0; }); });
          if (modelId === "knn_cls") {
            const kk=5;
            const knnP=xi=>{const dists=XTr.map((xj,i)=>({i,d:xi.reduce((s,v,j)=>s+(v-xj[j])**2,0)})).sort((a,b)=>a.d-b.d).slice(0,kk);const f={};dists.forEach(({i})=>{f[yTr[i]]=(f[yTr[i]]||0)+1;});return Object.entries(f).sort((a,b)=>b[1]-a[1])[0][0];};
            allPreds=XTr.map(knnP); testPreds=XTe.map(knnP);
            trainAcc=+(allPreds.filter((p,i)=>p===yTr[i]).length/yTr.length*100).toFixed(2);
            importanceData=allFeatNames.map(n=>({name:n,importance:0}));
          } else if (modelId === "dtree") {
            const gini=arr=>{const n=arr.length;if(!n)return 0;const f={};arr.forEach(v=>{f[v]=(f[v]||0)+1;});return 1-Object.values(f).reduce((s,c)=>s+(c/n)**2,0);};
            const buildTree=(rows,labels,depth=0)=>{if(depth>=4||new Set(labels).size===1||rows.length<4){const f={};labels.forEach(l=>{f[l]=(f[l]||0)+1;});return{leaf:true,cls:Object.entries(f).sort((a,b)=>b[1]-a[1])[0][0]};}let bG=-1,bF=-1,bT=0;const pG=gini(labels);for(let fi=0;fi<rows[0].length;fi++){const vals=[...new Set(rows.map(r=>r[fi]))].sort((a,b)=>a-b);for(let vi=0;vi<vals.length-1;vi++){const thresh=(vals[vi]+vals[vi+1])/2;const lI=rows.map((r,i)=>r[fi]<=thresh?i:-1).filter(i=>i>=0);const rI=rows.map((r,i)=>r[fi]>thresh?i:-1).filter(i=>i>=0);if(!lI.length||!rI.length)continue;const g=pG-(lI.length/rows.length)*gini(lI.map(i=>labels[i]))-(rI.length/rows.length)*gini(rI.map(i=>labels[i]));if(g>bG){bG=g;bF=fi;bT=thresh;}}}if(bF<0){const f={};labels.forEach(l=>{f[l]=(f[l]||0)+1;});return{leaf:true,cls:Object.entries(f).sort((a,b)=>b[1]-a[1])[0][0]};}const lI=rows.map((r,i)=>r[bF]<=bT?i:-1).filter(i=>i>=0);const rI=rows.map((r,i)=>r[bF]>bT?i:-1).filter(i=>i>=0);return{feat:bF,thresh:bT,left:buildTree(lI.map(i=>rows[i]),lI.map(i=>labels[i]),depth+1),right:buildTree(rI.map(i=>rows[i]),rI.map(i=>labels[i]),depth+1)};};
            const predict=(tree,xi)=>{if(tree.leaf)return tree.cls;return xi[tree.feat]<=tree.thresh?predict(tree.left,xi):predict(tree.right,xi);};
            const tree=buildTree(XTr,yTr);
            allPreds=XTr.map(xi=>predict(tree,xi)); testPreds=XTe.map(xi=>predict(tree,xi));
            trainAcc=+(allPreds.filter((p,i)=>p===yTr[i]).length/yTr.length*100).toFixed(2);
            importanceData=allFeatNames.map(n=>({name:n,importance:0}));
          } else {
            const model=logisticRegression(X,y,classes); const trModel=logisticRegression(XTr,yTr,classes);
            testPreds=XTe.map(xi=>{const sc=classes.map(cls=>({cls,score:sigmoid(xi.reduce((s,v,j)=>s+v*(trModel.models[cls]?.w[j]||0),trModel.models[cls]?.b||0))}));return sc.sort((a,b)=>b.score-a.score)[0].cls;});
            allPreds=model.preds; trainAcc=model.acc; lossData=model.losses;
            importanceData=allFeatNames.map((n,j)=>({name:n,importance:model.importance[j]??0})).sort((a,b)=>b.importance-a.importance);
          }
          const testAcc=+(testPreds.filter((p,i)=>p===yTe[i]).length/yTe.length*100).toFixed(2);
          y.forEach((actual,i)=>{if(cm[actual])cm[actual][allPreds[i]]=(cm[actual][allPreds[i]]||0)+1;});
          setResult({ task:"classification", modelId, trainAcc, testAcc, classes,
            cm, losses:lossData, importance:importanceData, nTrain:XTr.length, nTest:XTe.length });
        } else if (task === "clustering") {
          const k = Math.max(2, Math.min(kClusters, 10));
          const { labels, sizes, losses } = kmeans(X, k);
          const rowsWithCluster = ds.rows.slice(0, X.length).map((r,i) => ({ ...r, _cluster:String(labels[i]) }));
          setResult({ task:"clustering", k, sizes, losses, rowsWithCluster,
            vizX:featureCols[0], vizY:featureCols[1]||featureCols[0] });

        } else if (task === "neural") {
          const classes = [...new Set(y)].sort();
          if (classes.length < 2 || classes.length > 30) { setError("신경망: 클래스 2~30개 필요합니다."); setRunning(false); return; }
          const hidden = hiddenLayer.split(",").map(v => parseInt(v.trim())).filter(v => v>0 && v<=256);
          const { XTr, yTr, XTe, yTe } = trainTestSplit(X, y, testRatio);
          const model = mlp(X, y, classes, hidden, lrRate, epochs);
          const m2 = mlp(XTr, yTr, classes, hidden, lrRate, Math.floor(epochs*0.5));
          const testPreds = XTe.map(xi => {
            let a = xi;
            for (let l=0; l<m2.W.length; l++) {
              const z = m2.W[l].map((wRow,j) => wRow.reduce((s,w,k) => s+w*a[k], m2.B[l][j]));
              a = l < m2.W.length-1 ? z.map(v => Math.max(0,v)) : softmax(z);
            }
            return classes[a.indexOf(Math.max(...a))];
          });
          const testAcc = +(testPreds.filter((p,i) => p===yTe[i]).length/yTe.length*100).toFixed(2);
          const cm = {};
          classes.forEach(a => { cm[a]={}; classes.forEach(b => { cm[a][b]=0; }); });
          y.forEach((actual,i) => { if (cm[actual]) cm[actual][model.preds[i]]=(cm[actual][model.preds[i]]||0)+1; });
          setResult({ task:"neural", trainAcc:model.acc, testAcc, classes, cm,
            losses:model.losses, nTrain:XTr.length, nTest:XTe.length, hiddenLayers:hidden });
        }
        setStep(3);
      } catch (e) {
        setError("오류: " + e.message);
      }
      setRunning(false);
    }, 60);
  };

  const askGemini = async () => {
    if (!apiKey || !result) return;
    setGeminiLoading(true); setGeminiText("");
    try {
      const summary = JSON.stringify({
        task:result.task, 데이터셋:ds?.name, 행수:ds?.rowCount,
        성능:{ R2:result.testR2, RMSE:result.testRmse, 정확도:result.testAcc },
        상위피처:result.importance?.slice(0,5),
        클러스터크기:result.sizes, 클래스수:result.classes?.length,
      }, null, 2);
      const prompt = "당신은 친절한 데이터 분석 선생님입니다. 머신러닝 입문자에게 아래 결과를 쉽게 한국어로 설명해 주세요.\n\n"
        + summary
        + "\n\n1. 모델이 하는 일을 쉽게 설명\n2. 성능 평가\n3. 가장 중요한 피처와 의미\n4. 활용 방법\n5. 개선 방향";
      const text = await callGemini(apiKey, prompt);
      setGeminiText(text);
    } catch (e) {
      setGeminiText("오류: " + e.message);
    }
    setGeminiLoading(false);
  };

  if (!ds) return <div style={{ padding:48, textAlign:"center", color:C.txT }}>파일을 업로드해 주세요.</div>;

  const TASKS = [
    { id:"regression",     icon:"📈", label:"숫자 예측",      sub:"회귀 (Regression)",       desc:"집값, 매출 등 숫자 예측",     when:"타겟이 숫자형일 때" },
    { id:"classification", icon:"🏷️", label:"카테고리 분류",  sub:"분류 (Classification)",    desc:"스팸/정상, 등급 분류 등",     when:"타겟이 범주형일 때" },
    { id:"clustering",     icon:"🔵", label:"자동 그룹 분류", sub:"군집화 (K-Means)",         desc:"비슷한 것끼리 자동 묶기",     when:"분류 기준 없을 때" },
    { id:"neural",         icon:"🧠", label:"신경망 분류",    sub:"딥러닝 (MLP)",             desc:"복잡한 패턴 학습",            when:"분류 정확도 높이고 싶을 때" },
  ];
  // 태스크별 사용 가능 모델
  const MODELS = {
    regression:     [
      { id:"linear",  label:"선형 회귀",    desc:"빠르고 해석 쉬움" },
      { id:"ridge",   label:"릿지 회귀",    desc:"과적합 방지 (L2)" },
      { id:"knn_reg", label:"KNN 회귀",     desc:"가까운 이웃 평균" },
    ],
    classification: [
      { id:"logistic", label:"로지스틱 회귀", desc:"빠른 분류 기준선" },
      { id:"knn_cls",  label:"KNN 분류",      desc:"가까운 이웃 다수결" },
      { id:"dtree",    label:"의사결정나무",  desc:"규칙 기반 해석 쉬움" },
    ],
    clustering: [
      { id:"kmeans", label:"K-Means", desc:"빠른 중심 기반 군집화" },
    ],
    timeseries: [
      { id:"ma",    label:"이동평균 (MA)",    desc:"단순 평균 평활화" },
      { id:"ewm",   label:"지수가중 (EWM)",   desc:"최근 값에 가중치" },
      { id:"trend", label:"추세 분해",        desc:"추세+잔차 분리" },
    ],
  };


  // ── Step indicator
  const StepBar = () => (
    <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:20 }}>
      {[{n:1,label:"목표 선택"},{n:2,label:"컬럼 확인"},{n:3,label:"결과 확인"}].map((s,i) => (
        <div key={s.n} style={{ display:"flex", alignItems:"center" }}>
          <div onClick={() => step > s.n && setStep(s.n)} style={{
            display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:20,
            background: step===s.n ? C.info : step>s.n ? C.success : C.bgS,
            cursor: step > s.n ? "pointer" : "default",
          }}>
            <span style={{ width:20, height:20, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
              background: step===s.n ? C.infoTx : step>s.n ? C.successTx : C.bd,
              color:"#fff", fontSize:11, fontWeight:500 }}>
              {step > s.n ? "✓" : s.n}
            </span>
            <span style={{ fontSize:12, fontWeight:step===s.n?500:400,
              color: step===s.n ? C.infoTx : step>s.n ? C.successTx : C.txS }}>
              {s.label}
            </span>
          </div>
          {i < 2 && <div style={{ width:24, height:1, background:C.bd }}/>}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <StepBar/>

      {/* ── STEP 1 */}
      {step === 1 && (
        <div>
          <div style={{ fontSize:15, fontWeight:500, color:C.tx, marginBottom:6 }}>어떤 분석을 하고 싶으신가요?</div>
          <div style={{ fontSize:13, color:C.txS, marginBottom:16 }}>클릭하면 자동으로 설정됩니다</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
            {TASKS.map(t => (
              <div key={t.id} onClick={() => selectTask(t.id)} style={{
                padding:16, borderRadius:"var(--border-radius-lg)", border:"0.5px solid "+C.bd,
                cursor:"pointer", background:C.bg, transition:"all 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.infoTx}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.bd}
              >
                <div style={{ fontSize:26, marginBottom:8 }}>{t.icon}</div>
                <div style={{ fontSize:14, fontWeight:500, color:C.tx, marginBottom:2 }}>{t.label}</div>
                <div style={{ fontSize:11, color:C.infoTx, marginBottom:6 }}>{t.sub}</div>
                <div style={{ fontSize:12, color:C.txS, marginBottom:8 }}>{t.desc}</div>
                <div style={{ fontSize:11, padding:"3px 8px", borderRadius:4, background:C.bgS, color:C.txT, display:"inline-block" }}>
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

          {/* 타겟 컬럼 */}
          {task !== "clustering" && (
            <Section title={"🎯 타겟 컬럼 — " + (targetCol || "선택 안 됨")} desc="예측/분류할 대상">
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

          {/* 군집화 K */}
          {task === "clustering" && (
            <Section title="몇 개 그룹으로 나눌까요?">
              <div style={{ display:"flex", gap:8 }}>
                {[2,3,4,5,6].map(k => (
                  <span key={k} onClick={() => setKClusters(k)} style={{
                    width:40, height:40, borderRadius:"50%", display:"flex",
                    alignItems:"center", justifyContent:"center", cursor:"pointer",
                    background: kClusters===k ? C.info : C.bgS,
                    color: kClusters===k ? C.infoTx : C.txS,
                    fontSize:14, fontWeight: kClusters===k ? 500 : 400,
                    border: (kClusters===k?"2px":"0.5px") + " solid " + (kClusters===k?C.infoTx:C.bd),
                  }}>{k}</span>
                ))}
              </div>
            </Section>
          )}

          {/* 학습/검증 비율 */}
          {task !== "clustering" && (
            <Section title="학습/검증 데이터 비율" desc="전체 데이터를 학습과 검증으로 나누는 비율입니다">
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {[{v:0.1,label:"9:1"},{v:0.2,label:"8:2 (권장)"},{v:0.3,label:"7:3"},{v:0.4,label:"6:4"}].map(({v,label}) => (
                  <div key={v} onClick={() => setTestRatio(v)} style={{
                    padding:"8px 16px", borderRadius:"var(--border-radius-md)", cursor:"pointer",
                    border: (testRatio===v?"2px solid #185FA5":"0.5px solid "+C.bd),
                    background: testRatio===v ? "#E6F1FB" : C.bg,
                  }}>
                    <div style={{ fontSize:13, fontWeight:500, color:testRatio===v?"#185FA5":C.tx }}>{label}</div>
                    <div style={{ fontSize:11, color:C.txS }}>{"검증 " + (v*100) + "%"}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 고급 설정 */}
          <div style={{ marginBottom:14 }}>
            <button onClick={() => setShowAdv(p => !p)} style={{
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
          <Btn variant="primary" onClick={run}
            disabled={running || featureCols.length===0 || (task!=="clustering" && !targetCol)}
            full>
            {running ? "⏳ 학습 중... (수 초~수십 초 소요)" : "🚀 학습 시작하기"}
          </Btn>
          {running && (
            <div style={{ fontSize:12, color:C.txS, marginTop:8, textAlign:"center" }}>
              브라우저에서 직접 학습합니다. 잠시만 기다려 주세요!
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3 */}
      {step === 3 && result && (
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:500, color:C.tx }}>📋 학습 결과</div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn small onClick={() => { setStep(2); setResult(null); setGeminiText(""); }}>← 다시 학습</Btn>
              <Btn small onClick={() => { setTask(""); setStep(1); setResult(null); setGeminiText(""); }}>처음으로</Btn>
            </div>
          </div>

          <EasyResultCard result={result} targetCol={targetCol}/>

          <div style={{ border:"0.5px solid "+C.bd, borderRadius:"var(--border-radius-lg)", padding:16, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:500, color:C.tx, marginBottom:4 }}>📊 상세 차트</div>
            {result.losses?.length > 1 && (
              <LossCurve data={result.losses}
                xKey={result.task==="clustering" ? "iter" : "epoch"}
                title={result.task==="clustering" ? "학습 진행도 (Inertia)" : "학습 진행도 (Loss)"}/>
            )}
            {result.task === "regression" && result.testActual && (
              <ActualVsPred actual={result.testActual} predicted={result.testPreds}/>
            )}
            {(result.task === "classification" || result.task === "neural") && result.cm && result.classes?.length <= 15 && (
              <MLConfMatrix cm={result.cm} classes={result.classes}/>
            )}
            {result.importance?.length > 0 && <MLFeatChart data={result.importance}/>}
            {result.task === "clustering" && result.rowsWithCluster && featureCols.length >= 2 && (
              <MLScatter rows={result.rowsWithCluster} xCol={featureCols[0]} yCol={featureCols[1]}
                labelKey="_cluster" title={"그룹 분포 (" + featureCols[0] + " × " + featureCols[1] + ")"}/>
            )}
            {result.task === "clustering" && result.elbowData?.length > 1 && (
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
            )}
            {result.task === "timeseries" && result.chartData?.length > 0 && (
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:12, color:C.txS, fontWeight:500, marginBottom:4 }}>
                  {"📈 시계열 분석 — " + result.colName}
                  {result.modelId === "ma" && <span style={{ fontSize:11, color:C.txT, marginLeft:8 }}>{"이동평균 window=" + result.win}</span>}
                  {result.modelId === "ewm" && <span style={{ fontSize:11, color:C.txT, marginLeft:8 }}>{"지수가중 α=" + result.alpha}</span>}
                  {result.modelId === "trend" && <span style={{ fontSize:11, color:C.txT, marginLeft:8 }}>{"기울기=" + result.slope}</span>}
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={result.chartData} margin={{ top:4, right:16, left:0, bottom:4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.bd}/>
                    <XAxis dataKey="i" tick={{ fontSize:10, fill:C.txS }} label={{ value:"인덱스", position:"insideBottom", offset:-2, fontSize:10, fill:C.txS }}/>
                    <YAxis tick={{ fontSize:10, fill:C.txS }}/>
                    <Tooltip contentStyle={{ fontSize:11, borderRadius:6, border:"0.5px solid "+C.bd }}/>
                    <Legend wrapperStyle={{ fontSize:11 }}/>
                    <Line type="monotone" dataKey="raw" stroke="#378ADD" dot={false} strokeWidth={1.5} name="원본" strokeOpacity={0.6}/>
                    {result.modelId==="ma"    && <Line type="monotone" dataKey="ma"       stroke="#D85A30" dot={false} strokeWidth={2} name={"MA("+result.win+")"}/>}
                    {result.modelId==="ewm"   && <Line type="monotone" dataKey="ewm"      stroke="#1D9E75" dot={false} strokeWidth={2} name="EWM"/>}
                    {result.modelId==="trend" && <Line type="monotone" dataKey="trend"    stroke="#D85A30" dot={false} strokeWidth={2} name="추세선"/>}
                    {result.modelId==="trend" && <Line type="monotone" dataKey="residual" stroke="#7F77DD" dot={false} strokeWidth={1.5} name="잔차"/>}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div style={{ border:"0.5px solid "+C.bd, borderRadius:"var(--border-radius-lg)", overflow:"hidden" }}>
            <div style={{ padding:"11px 14px", background:C.bgS, borderBottom:"0.5px solid "+C.bd,
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <span style={{ fontSize:13, fontWeight:500, color:C.tx }}>✨ AI 결과 해석</span>
                <div style={{ fontSize:11, color:C.txS, marginTop:2 }}>
                  Gemini가 입문자도 이해하기 쉽게 설명해 드립니다
                </div>
              </div>
              <Btn variant="primary" small onClick={askGemini} disabled={!apiKey || geminiLoading}>
                {geminiLoading ? "분석 중..." : apiKey ? "✨ AI 해석 받기" : "EDA 탭에서 API 키 입력"}
              </Btn>
            </div>
            <div style={{ padding:"14px 18px" }}>
              {geminiLoading && <div style={{ fontSize:13, color:C.txS }}>Gemini가 결과를 해석하고 있습니다...</div>}
              {geminiText && <MdBlock text={geminiText}/>}
              {!geminiLoading && !geminiText && (
                <div style={{ fontSize:12, color:C.txT }}>위 버튼을 누르면 AI가 결과를 친절하게 설명해 드립니다.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
