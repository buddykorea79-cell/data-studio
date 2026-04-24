import { useState, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { C, PALETTE } from "../constants";
import { Btn, Section, DsSelector, MdBlock } from "./UI";
import {
  normalize, denorm, prepareFeatures, trainTestSplit,
  linearRegression, logisticRegression, kmeans, mlp,
  sigmoid, relu, softmax, callGemini,
} from "../utils/mlUtils";

function normalize(arr){const mn=Math.min(...arr),mx=Math.max(...arr),rng=mx-mn||1;return{scaled:arr.map(v=>(v-mn)/rng),min:mn,max:mx,range:rng};}
function denorm(v,min,range){return v*range+min;}
function oneHot(rows,cols){const maps={};cols.forEach(c=>{maps[c]=[...new Set(rows.map(r=>String(r[c]??"")))].sort();});return{maps,encode:(row)=>{const out={};cols.forEach(c=>{maps[c].forEach((v)=>{out[`${c}_${v}`]=row[c]===v?1:0;});});return out;}};}
function sigmoid(z){return 1/(1+Math.exp(-z));}
function softmax(arr){const mx=Math.max(...arr);const e=arr.map(v=>Math.exp(v-mx));const s=e.reduce((a,b)=>a+b,0);return e.map(v=>v/s);}
function relu(x){return Math.max(0,x);}

function linearRegression(X,y){
  const n=X.length,m=X[0].length;let w=new Array(m).fill(0),b=0;const lr=0.01;const losses=[];
  for(let ep=0;ep<800;ep++){let dw=new Array(m).fill(0),db=0,loss=0;for(let i=0;i<n;i++){const pred=X[i].reduce((s,x,j)=>s+x*w[j],b);const err=pred-y[i];loss+=err*err;for(let j=0;j<m;j++)dw[j]+=err*X[i][j];db+=err;}for(let j=0;j<m;j++)w[j]-=lr*dw[j]/n;b-=lr*db/n;if(ep%80===0)losses.push({epoch:ep,loss:+(loss/n).toFixed(4)});}
  const preds=X.map(xi=>xi.reduce((s,x,j)=>s+x*w[j],b));const ssRes=y.reduce((s,yi,i)=>s+(yi-preds[i])**2,0);const ssTot=y.reduce((s,yi)=>s+(yi-y.reduce((a,b)=>a+b,0)/n)**2,0);
  return{w,b,preds,r2:+(1-ssRes/(ssTot||1)).toFixed(4),rmse:+Math.sqrt(ssRes/n).toFixed(4),losses};
}
function logisticRegression(X,y,classes){
  const n=X.length,m=X[0].length;const models={};const losses=[];
  classes.forEach(cls=>{const yb=y.map(v=>v===cls?1:0);let w=new Array(m).fill(0),b=0;const lr=0.1;
    for(let ep=0;ep<600;ep++){let dw=new Array(m).fill(0),db=0,loss=0;for(let i=0;i<n;i++){const z=X[i].reduce((s,x,j)=>s+x*w[j],b);const p=sigmoid(z);const err=p-yb[i];loss-=yb[i]*Math.log(p+1e-9)+(1-yb[i])*Math.log(1-p+1e-9);for(let j=0;j<m;j++)dw[j]+=err*X[i][j];db+=err;}for(let j=0;j<m;j++)w[j]-=lr*dw[j]/n;b-=lr*db/n;if(cls===classes[0]&&ep%60===0)losses.push({epoch:ep,loss:+(loss/n).toFixed(4)});}
    models[cls]={w,b};});
  const preds=X.map(xi=>{const scores=classes.map(cls=>{const{w,b}=models[cls];return{cls,score:sigmoid(xi.reduce((s,x,j)=>s+x*w[j],b))};});return scores.sort((a,b)=>b.score-a.score)[0].cls;});
  const acc=+(preds.filter((p,i)=>p===y[i]).length/n*100).toFixed(2);
  const cm={};classes.forEach(a=>{cm[a]={};classes.forEach(b=>{cm[a][b]=0;});});y.forEach((actual,i)=>{if(cm[actual])cm[actual][preds[i]]=(cm[actual][preds[i]]||0)+1;});
  const importance=Array.from({length:m},(_,j)=>classes.reduce((s,cls)=>s+Math.abs(models[cls].w[j]),0)/classes.length);
  return{preds,acc,cm,importance,losses,models};
}
function kmeans(X,k,maxIter=100){
  let centroids=X.slice(0,k).map(x=>[...x]);let labels=new Array(X.length).fill(0);const losses=[];
  for(let it=0;it<maxIter;it++){labels=X.map(xi=>{let best=0,bestD=Infinity;centroids.forEach((c,ci)=>{const d=xi.reduce((s,v,j)=>s+(v-c[j])**2,0);if(d<bestD){bestD=d;best=ci;}});return best;});
    const newC=Array.from({length:k},()=>new Array(X[0].length).fill(0));const cnt=new Array(k).fill(0);X.forEach((xi,i)=>{xi.forEach((v,j)=>{newC[labels[i]][j]+=v;});cnt[labels[i]]++;});
    let moved=false;newC.forEach((c,ci)=>{if(cnt[ci]>0){const nc=c.map(v=>v/cnt[ci]);if(nc.some((v,j)=>Math.abs(v-centroids[ci][j])>1e-6))moved=true;centroids[ci]=nc;}});
    const inertia=X.reduce((s,xi,i)=>s+xi.reduce((ss,v,j)=>ss+(v-centroids[labels[i]][j])**2,0),0);if(it%10===0)losses.push({iter:it,inertia:+inertia.toFixed(2)});if(!moved)break;}
  return{labels,centroids,sizes:Array.from({length:k},(_,ci)=>labels.filter(l=>l===ci).length),losses};
}
function mlp(X,y,classes,hiddenSizes=[16,8],lr=0.05,epochs=300){
  const nIn=X[0].length,nOut=classes.length;const layers=[nIn,...hiddenSizes,nOut];
  const W=[],B=[];for(let l=0;l<layers.length-1;l++){const scale=Math.sqrt(2/layers[l]);W.push(Array.from({length:layers[l+1]},()=>Array.from({length:layers[l]},()=>(Math.random()*2-1)*scale)));B.push(new Array(layers[l+1]).fill(0));}
  const yIdx=y.map(v=>classes.indexOf(v));const losses=[];
  for(let ep=0;ep<epochs;ep++){let totalLoss=0;const idx=Array.from({length:X.length},(_,i)=>i).sort(()=>Math.random()-0.5);
    for(const i of idx){const xi=X[i],yi=yIdx[i];const acts=[xi];for(let l=0;l<W.length;l++){const prev=acts[l];const z=W[l].map((wRow,j)=>wRow.reduce((s,w,k)=>s+w*prev[k],B[l][j]));acts.push(l<W.length-1?z.map(relu):softmax(z));}
      const out=acts[acts.length-1];totalLoss-=Math.log(out[yi]+1e-9);let delta=out.map((v,j)=>v-(j===yi?1:0));
      for(let l=W.length-1;l>=0;l--){const prev=acts[l];const newDelta=new Array(layers[l]).fill(0);for(let j=0;j<layers[l+1];j++){for(let k=0;k<layers[l];k++){W[l][j][k]-=lr*delta[j]*prev[k];newDelta[k]+=delta[j]*W[l][j][k];}B[l][j]-=lr*delta[j];}if(l>0)delta=newDelta.map((v,k)=>v*(acts[l][k]>0?1:0));else delta=newDelta;}}
    if(ep%30===0)losses.push({epoch:ep,loss:+(totalLoss/X.length).toFixed(4)});}
  const preds=X.map(xi=>{let a=xi;for(let l=0;l<W.length;l++){const z=W[l].map((wRow,j)=>wRow.reduce((s,w,k)=>s+w*a[k],B[l][j]));a=l<W.length-1?z.map(relu):softmax(z);}return classes[a.indexOf(Math.max(...a))];});
  const acc=+(preds.filter((p,i)=>p===y[i]).length/X.length*100).toFixed(2);
  const cm={};classes.forEach(a=>{cm[a]={};classes.forEach(b=>{cm[a][b]=0;});});y.forEach((actual,i)=>{if(cm[actual])cm[actual][preds[i]]=(cm[actual][preds[i]]||0)+1;});
  return{preds,acc,cm,losses,W,B};
}

// ── ML UI helpers ─────────────────────────────────────────────────────────────
function gradeR2(v){if(v>=0.9)return{grade:"매우 우수",color:"#0F6E56",bg:"#EAF3DE"};if(v>=0.7)return{grade:"우수",color:"#1D9E75",bg:"#E1F5EE"};if(v>=0.5)return{grade:"보통",color:"#BA7517",bg:"#FAEEDA"};return{grade:"개선 필요",color:"#A32D2D",bg:"#FCEBEB"};}
function gradeAcc(v){if(v>=90)return{grade:"매우 우수",color:"#0F6E56",bg:"#EAF3DE"};if(v>=75)return{grade:"우수",color:"#1D9E75",bg:"#E1F5EE"};if(v>=60)return{grade:"보통",color:"#BA7517",bg:"#FAEEDA"};return{grade:"개선 필요",color:"#A32D2D",bg:"#FCEBEB"};}
function MLMetricCard({label,value,color}){return<div style={{background:C.bgS,border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-md)",padding:"12px 16px",textAlign:"center",minWidth:90}}><div style={{fontSize:11,color:C.txS,marginBottom:5}}>{label}</div><div style={{fontSize:20,fontWeight:500,color:color||C.tx,fontFamily:"var(--font-mono)"}}>{value}</div></div>;}
function LossCurve({data,xKey="epoch",title="학습 Loss 곡선"}){if(!data||data.length<2)return null;return<div style={{marginTop:16}}><div style={{fontSize:12,color:C.txS,fontWeight:500,marginBottom:4}}>{title}</div><div style={{fontSize:11,color:C.txT,marginBottom:6}}>값이 내려갈수록 모델이 잘 학습되고 있습니다</div><ResponsiveContainer width="100%" height={180}><LineChart data={data} margin={{top:4,right:12,left:0,bottom:4}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd}/><XAxis dataKey={xKey} tick={{fontSize:10,fill:C.txS}}/><YAxis tick={{fontSize:10,fill:C.txS}} width={50}/><Tooltip contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Line type="monotone" dataKey="loss" stroke="#185FA5" dot={false} strokeWidth={2} name="Loss"/>{data[0]?.inertia!==undefined&&<Line type="monotone" dataKey="inertia" stroke="#D85A30" dot={false} strokeWidth={2} name="Inertia"/>}</LineChart></ResponsiveContainer></div>;}
function MLConfMatrix({cm,classes}){if(!cm||!classes?.length)return null;const maxVal=Math.max(...classes.flatMap(a=>classes.map(b=>cm[a]?.[b]||0)));return<div style={{marginTop:16,overflowX:"auto"}}><div style={{fontSize:12,color:C.txS,fontWeight:500,marginBottom:4}}>혼동 행렬</div><div style={{fontSize:11,color:C.txT,marginBottom:8}}>초록=정답 / 빨강=오답</div><div style={{display:"inline-block"}}><div style={{display:"flex",marginLeft:60}}>{classes.map(c=><div key={c} style={{width:52,fontSize:10,color:C.txS,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",padding:"0 2px"}}>예측:{c}</div>)}</div>{classes.map(actual=><div key={actual} style={{display:"flex",alignItems:"center",marginBottom:2}}><div style={{width:56,fontSize:10,color:C.txS,textAlign:"right",paddingRight:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>실제:{actual}</div>{classes.map(pred=>{const v=cm[actual]?.[pred]||0;const isC=actual===pred;const intensity=maxVal>0?v/maxVal:0;return<div key={pred} style={{width:52,height:36,background:isC?`rgba(29,158,117,${0.1+intensity*0.8})`:`rgba(216,90,48,${intensity*0.6})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:500,color:intensity>0.5?"#fff":C.tx,borderRadius:3,margin:1}}>{v}</div>;})}</div>)}</div></div>;}
function MLFeatChart({data}){if(!data?.length)return null;const top=data.slice(0,10);return<div style={{marginTop:16}}><div style={{fontSize:12,color:C.txS,fontWeight:500,marginBottom:4}}>피처 중요도</div><ResponsiveContainer width="100%" height={Math.max(140,top.length*26)}><BarChart data={top} layout="vertical" margin={{top:4,right:40,left:8,bottom:4}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false}/><XAxis type="number" tick={{fontSize:10,fill:C.txS}}/><YAxis type="category" dataKey="name" tick={{fontSize:10,fill:C.txS}} width={110}/><Tooltip contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Bar dataKey="importance" name="중요도" radius={[0,3,3,0]}>{top.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Bar></BarChart></ResponsiveContainer></div>;}
function MLScatter({rows,xCol,yCol,labelKey,title}){const labels=[...new Set(rows.map(r=>String(r[labelKey])))].sort();const data=labels.flatMap((lbl,li)=>rows.filter(r=>String(r[labelKey])===lbl).map(r=>({x:parseFloat(r[xCol]),y:parseFloat(r[yCol]),label:lbl})).filter(p=>!isNaN(p.x)&&!isNaN(p.y)).slice(0,200));if(!data.length)return null;return<div style={{marginTop:16}}><div style={{fontSize:12,color:C.txS,fontWeight:500,marginBottom:6}}>{title}</div><ResponsiveContainer width="100%" height={260}><ScatterChart margin={{top:4,right:8,left:0,bottom:20}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd}/><XAxis type="number" dataKey="x" name={xCol} tick={{fontSize:10,fill:C.txS}} label={{value:xCol,position:"insideBottom",offset:-14,fontSize:10,fill:C.txS}}/><YAxis type="number" dataKey="y" name={yCol} tick={{fontSize:10,fill:C.txS}}/><Tooltip content={({payload})=>payload?.length?<div style={{background:C.bg,border:`0.5px solid ${C.bd}`,borderRadius:6,padding:"5px 8px",fontSize:11}}><div>그룹: {payload[0]?.payload?.label}</div><div>{xCol}: {payload[0]?.payload?.x?.toFixed(3)}</div><div>{yCol}: {payload[0]?.payload?.y?.toFixed(3)}</div></div>:null}/>{labels.map((lbl,li)=><Scatter key={lbl} name={`그룹 ${lbl}`} data={data.filter(d=>d.label===lbl)} fill={PALETTE[li%PALETTE.length]} fillOpacity={0.65} r={4}/>)}<Legend wrapperStyle={{fontSize:11}}/></ScatterChart></ResponsiveContainer></div>;}
function ActualVsPred({actual,predicted}){const data=actual.map((a,i)=>({actual:+Number(a).toFixed(3),predicted:+Number(predicted[i]).toFixed(3)})).slice(0,300);const mn=Math.min(...data.map(d=>Math.min(d.actual,d.predicted)));const mx=Math.max(...data.map(d=>Math.max(d.actual,d.predicted)));return<div style={{marginTop:16}}><div style={{fontSize:12,color:C.txS,fontWeight:500,marginBottom:4}}>실제값 vs 예측값</div><div style={{fontSize:11,color:C.txT,marginBottom:6}}>점들이 대각선에 가까울수록 예측이 정확합니다</div><ResponsiveContainer width="100%" height={240}><ScatterChart margin={{top:4,right:8,left:0,bottom:20}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd}/><XAxis type="number" dataKey="actual" name="실제값" tick={{fontSize:10,fill:C.txS}} label={{value:"실제값",position:"insideBottom",offset:-14,fontSize:10,fill:C.txS}} domain={[mn,mx]}/><YAxis type="number" dataKey="predicted" name="예측값" tick={{fontSize:10,fill:C.txS}} domain={[mn,mx]}/><Tooltip contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Scatter data={data} fill="#378ADD" fillOpacity={0.5} r={3}/></ScatterChart></ResponsiveContainer></div>;}
function EasyResultCard({result,targetCol}){
  if(!result)return null;
  if(result.task==="regression"){const g=gradeR2(result.testR2);return<div style={{borderRadius:"var(--border-radius-lg)",border:`2px solid ${g.color}`,background:g.bg,padding:"16px 18px",marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><span style={{fontSize:20}}>📈</span><div><div style={{fontSize:14,fontWeight:500,color:g.color}}>회귀 결과: {g.grade}</div><div style={{fontSize:12,color:C.txS}}>"{targetCol}" 값 예측 모델</div></div><span style={{marginLeft:"auto",fontSize:24,fontWeight:500,color:g.color,fontFamily:"var(--font-mono)"}}>R² {result.testR2}</span></div><div style={{fontSize:13,color:C.tx,lineHeight:1.7,background:"rgba(255,255,255,0.6)",borderRadius:8,padding:"10px 12px"}}>전체 데이터 변동의 <strong>{Math.round(result.testR2*100)}%</strong>를 이 모델이 설명합니다.<br/>평균 오차(RMSE): <strong>{result.testRmse}</strong> · 학습:{result.nTrain}행 / 검증:{result.nTest}행</div></div>;}
  if(result.task==="classification"||result.task==="neural"){const g=gradeAcc(result.testAcc);return<div style={{borderRadius:"var(--border-radius-lg)",border:`2px solid ${g.color}`,background:g.bg,padding:"16px 18px",marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><span style={{fontSize:20}}>{result.task==="neural"?"🧠":"🏷️"}</span><div><div style={{fontSize:14,fontWeight:500,color:g.color}}>{result.task==="neural"?"신경망":"분류"} 결과: {g.grade}</div><div style={{fontSize:12,color:C.txS}}>"{targetCol}" · {result.classes?.length}개 클래스</div></div><span style={{marginLeft:"auto",fontSize:24,fontWeight:500,color:g.color,fontFamily:"var(--font-mono)"}}>{result.testAcc}%</span></div><div style={{fontSize:13,color:C.tx,lineHeight:1.7,background:"rgba(255,255,255,0.6)",borderRadius:8,padding:"10px 12px"}}>검증 데이터 <strong>{result.nTest}행</strong> 중 <strong>{Math.round(result.nTest*result.testAcc/100)}행</strong> 정확히 분류.<br/>{result.testAcc>=90?"모델이 매우 잘 학습됐습니다! 🎉":result.testAcc>=75?"좋은 성능입니다.":result.testAcc>=60?"어느 정도 패턴을 학습했습니다.":"전처리와 피처 선택을 점검해 보세요."}</div></div>;}
  if(result.task==="clustering"){return<div style={{borderRadius:"var(--border-radius-lg)",border:"2px solid #185FA5",background:"#E6F1FB",padding:"16px 18px",marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><span style={{fontSize:20}}>🔵</span><div><div style={{fontSize:14,fontWeight:500,color:"#185FA5"}}>군집화 완료 — {result.k}개 그룹 발견</div><div style={{fontSize:12,color:C.txS}}>비슷한 특성끼리 자동 그룹화</div></div></div><div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>{result.sizes?.map((s,i)=><div key={i} style={{background:"rgba(255,255,255,0.7)",borderRadius:8,padding:"5px 10px",fontSize:12}}><span style={{color:PALETTE[i%PALETTE.length],fontWeight:500}}>그룹{i+1}</span><span style={{color:C.txS,marginLeft:6}}>{s}개 ({Math.round(s/result.sizes.reduce((a,b)=>a+b,0)*100)}%)</span></div>)}</div></div>;}
  return null;
}

// ── MLTab ─────────────────────────────────────────────────────────────────────
export function MLTab({allDs,apiKey}){
  const [selId,setSelId]=useState(()=>allDs[0]?.id??"");
  const [task,setTask]=useState("");
  const [targetCol,setTargetCol]=useState("");
  const [featureCols,setFeatureCols]=useState([]);
  const [kClusters,setKClusters]=useState(3);
  const [showAdv,setShowAdv]=useState(false);
  const [testRatio,setTestRatio]=useState(0.2);
  const [hiddenLayer,setHiddenLayer]=useState("16,8");
  const [lrRate,setLrRate]=useState(0.05);
  const [epochs,setEpochs]=useState(300);
  const [running,setRunning]=useState(false);
  const [result,setResult]=useState(null);
  const [geminiLoading,setGeminiLoading]=useState(false);
  const [geminiText,setGeminiText]=useState("");
  const [error,setError]=useState("");
  const [step,setStep]=useState(1);
  const ds=allDs.find(d=>d.id===selId);
  const prevId=useRef(selId);
  if(prevId.current!==selId){prevId.current=selId;setTask("");setFeatureCols([]);setTargetCol("");setResult(null);setGeminiText("");setError("");setStep(1);}
  const numCols=ds?ds.colMeta.filter(c=>c.type==="number").map(c=>c.name):[];
  const catCols=ds?ds.colMeta.filter(c=>c.type==="category"||c.type==="text").map(c=>c.name):[];
  const allCols=ds?ds.columns:[];
  const selectTask=t=>{setTask(t);setResult(null);setGeminiText("");setError("");if(!ds)return;if(t==="clustering"){setFeatureCols(numCols.slice(0,5));setTargetCol("");}else if(t==="regression"){setFeatureCols(numCols.slice(0,-1).slice(0,6));setTargetCol(numCols[numCols.length-1]||"");}else{setFeatureCols(numCols.slice(0,6));setTargetCol(catCols[0]||allCols[allCols.length-1]||"");}setStep(2);};
  const toggleFeat=c=>setFeatureCols(p=>p.includes(c)?p.filter(x=>x!==c):[...p,c]);
  const run=()=>{
    if(!ds||featureCols.length===0)return setError("피처 컬럼을 1개 이상 선택해 주세요.");
    if(task!=="clustering"&&!targetCol)return setError("타겟 컬럼을 선택해 주세요.");
    setError("");setRunning(true);setResult(null);setGeminiText("");
    setTimeout(()=>{
      try{
        const{X,y,allFeatNames}=prepareFeatures(ds,featureCols,task!=="clustering"?targetCol:null);
        if(X.length<10){setError("데이터가 너무 적습니다 (최소 10행)."); setRunning(false); return;}
        if(task==="regression"){
          const yNum=y.map(Number);if(yNum.some(isNaN)){setError("타겟 컬럼에 숫자가 아닌 값이 있습니다.");setRunning(false);return;}
          const norm=normalize(yNum);const{XTr,yTr,XTe,yTe}=trainTestSplit(X,norm.scaled,testRatio);
          const model=linearRegression(XTr,yTr);
          const testPreds=XTe.map(xi=>denorm(xi.reduce((s,v,j)=>s+v*model.w[j],model.b),norm.min,norm.range));
          const testActual=yTe.map(v=>denorm(v,norm.min,norm.range));
          const ssRes=testActual.reduce((s,a,i)=>s+(a-testPreds[i])**2,0);const ssTot=testActual.reduce((s,a)=>{const m=testActual.reduce((x,b)=>x+b,0)/testActual.length;return s+(a-m)**2;},0);
          const importance=allFeatNames.map((n,j)=>({name:n,importance:+Math.abs(model.w[j]).toFixed(4)})).sort((a,b)=>b.importance-a.importance);
          setResult({task:"regression",trainR2:model.r2,trainRmse:model.rmse,testR2:+(1-ssRes/(ssTot||1)).toFixed(4),testRmse:+Math.sqrt(ssRes/testActual.length).toFixed(4),losses:model.losses,importance,testActual,testPreds,nTrain:XTr.length,nTest:XTe.length});
        }else if(task==="classification"){
          const classes=[...new Set(y)].sort();if(classes.length<2){setError("클래스 2개 이상 필요.");setRunning(false);return;}if(classes.length>20){setError("클래스 최대 20개.");setRunning(false);return;}
          const{XTr,yTr,XTe,yTe}=trainTestSplit(X,y,testRatio);const model=logisticRegression(X,y,classes);const trModel=logisticRegression(XTr,yTr,classes);
          const testPreds=XTe.map(xi=>{const scores=classes.map(cls=>{const{w,b}=trModel.models[cls];return{cls,score:sigmoid(xi.reduce((s,v,j)=>s+v*w[j],b))};});return scores.sort((a,b)=>b.score-a.score)[0].cls;});
          const testAcc=+(testPreds.filter((p,i)=>p===yTe[i]).length/yTe.length*100).toFixed(2);
          const importance=allFeatNames.map((n,j)=>({name:n,importance:model.importance[j]??0})).sort((a,b)=>b.importance-a.importance);
          setResult({task:"classification",trainAcc:model.acc,testAcc,classes,cm:model.cm,losses:model.losses,importance,nTrain:XTr.length,nTest:XTe.length});
        }else if(task==="clustering"){
          const k=Math.max(2,Math.min(kClusters,10));const{labels,sizes,losses}=kmeans(X,k);
          const rowsWithCluster=ds.rows.slice(0,X.length).map((r,i)=>({...r,_cluster:`${labels[i]}`}));
          setResult({task:"clustering",k,sizes,losses,rowsWithCluster,vizX:featureCols[0],vizY:featureCols[1]||featureCols[0]});
        }else if(task==="neural"){
          const classes=[...new Set(y)].sort();if(classes.length<2||classes.length>30){setError("신경망: 클래스 2~30개 필요.");setRunning(false);return;}
          const hidden=hiddenLayer.split(",").map(v=>parseInt(v.trim())).filter(v=>v>0&&v<=256);
          const{XTr,yTr,XTe,yTe}=trainTestSplit(X,y,testRatio);const model=mlp(X,y,classes,hidden,lrRate,epochs);
          const m2=mlp(XTr,yTr,classes,hidden,lrRate,Math.floor(epochs*0.5));
          const testPreds=XTe.map(xi=>{let a=xi;for(let l=0;l<m2.W.length;l++){const z=m2.W[l].map((wRow,j)=>wRow.reduce((s,w,k)=>s+w*a[k],m2.B[l][j]));a=l<m2.W.length-1?z.map(relu):softmax(z);}return classes[a.indexOf(Math.max(...a))];});
          const testAcc=+(testPreds.filter((p,i)=>p===yTe[i]).length/yTe.length*100).toFixed(2);
          const cm={};classes.forEach(a=>{cm[a]={};classes.forEach(b=>{cm[a][b]=0;});});y.forEach((actual,i)=>{if(cm[actual])cm[actual][model.preds[i]]=(cm[actual][model.preds[i]]||0)+1;});
          setResult({task:"neural",trainAcc:model.acc,testAcc,classes,cm,losses:model.losses,nTrain:XTr.length,nTest:XTe.length,hiddenLayers:hidden});
        }
        setStep(3);
      }catch(e){setError(`오류: ${e.message}`);}
      setRunning(false);
    },60);
  };
  const askGemini=async()=>{
    if(!apiKey||!result)return;setGeminiLoading(true);setGeminiText("");
    try{
      const summary=JSON.stringify({task:result.task,데이터셋:ds?.name,행수:ds?.rowCount,성능:{R2:result.testR2,RMSE:result.testRmse,정확도:result.testAcc},상위피처:result.importance?.slice(0,5),클러스터크기:result.sizes,클래스수:result.classes?.length},null,2);
      const prompt=`당신은 친절한 데이터 분석 선생님입니다. 머신러닝 입문자에게 아래 결과를 쉽게 한국어로 설명해 주세요.\n\n${summary}\n\n1. 모델이 하는 일을 쉽게 설명\n2. 성능 평가 (좋은지/보통인지)\n3. 가장 중요한 피처와 의미\n4. 활용 방법\n5. 개선 방향`;
      const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;
      const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.4,maxOutputTokens:2048}})});
      if(!res.ok)throw new Error((await res.json()).error?.message||`HTTP ${res.status}`);
      const data=await res.json();setGeminiText(data.candidates?.[0]?.content?.parts?.[0]?.text||"응답 없음");
    }catch(e){setGeminiText(`오류: ${e.message}`);}
    setGeminiLoading(false);
  };
  if(!ds)return<div style={{padding:48,textAlign:"center",color:C.txT}}>파일을 업로드해 주세요.</div>;
  const TASKS=[{id:"regression",icon:"📈",label:"숫자 예측",sub:"회귀 (Regression)",desc:"집값, 매출 등 숫자 예측",when:"타겟이 숫자형일 때"},{id:"classification",icon:"🏷️",label:"카테고리 분류",sub:"분류 (Classification)",desc:"스팸/정상, 등급 분류 등",when:"타겟이 범주형일 때"},{id:"clustering",icon:"🔵",label:"자동 그룹 분류",sub:"군집화 (K-Means)",desc:"비슷한 것끼리 자동 묶기",when:"분류 기준 없을 때"},{id:"neural",icon:"🧠",label:"신경망 분류",sub:"딥러닝 (MLP)",desc:"복잡한 패턴 학습",when:"분류 정확도 높이고 싶을 때"}];
  return<div>
    {/* STEP 인디케이터 */}
    <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:20}}>
      {[{n:1,label:"목표 선택"},{n:2,label:"컬럼 확인"},{n:3,label:"결과 확인"}].map((s,i)=><div key={s.n} style={{display:"flex",alignItems:"center"}}><div onClick={()=>step>s.n&&setStep(s.n)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:20,background:step===s.n?C.info:step>s.n?C.success:C.bgS,cursor:step>s.n?"pointer":"default"}}><span style={{width:20,height:20,borderRadius:"50%",background:step===s.n?C.infoTx:step>s.n?C.successTx:C.bd,color:"#fff",fontSize:11,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center"}}>{step>s.n?"✓":s.n}</span><span style={{fontSize:12,fontWeight:step===s.n?500:400,color:step===s.n?C.infoTx:step>s.n?C.successTx:C.txS}}>{s.label}</span></div>{i<2&&<div style={{width:24,height:1,background:C.bd}}/>}</div>)}
    </div>
    {/* STEP 1 */}
    {step===1&&<div><div style={{fontSize:15,fontWeight:500,color:C.tx,marginBottom:6}}>어떤 분석을 하고 싶으신가요?</div><div style={{fontSize:13,color:C.txS,marginBottom:16}}>클릭하면 자동으로 설정됩니다</div><div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>{TASKS.map(t=><div key={t.id} onClick={()=>selectTask(t.id)} style={{padding:"16px",borderRadius:"var(--border-radius-lg)",border:`0.5px solid ${C.bd}`,cursor:"pointer",background:C.bg,transition:"all 0.15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.infoTx} onMouseLeave={e=>e.currentTarget.style.borderColor=C.bd}><div style={{fontSize:26,marginBottom:8}}>{t.icon}</div><div style={{fontSize:14,fontWeight:500,color:C.tx,marginBottom:2}}>{t.label}</div><div style={{fontSize:11,color:C.infoTx,marginBottom:6}}>{t.sub}</div><div style={{fontSize:12,color:C.txS,marginBottom:8}}>{t.desc}</div><div style={{fontSize:11,padding:"3px 8px",borderRadius:4,background:C.bgS,color:C.txT,display:"inline-block"}}>💡 {t.when}</div></div>)}</div></div>}
    {/* STEP 2 */}
    {step===2&&task&&<div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><span style={{fontSize:20}}>{TASKS.find(t=>t.id===task)?.icon}</span><div><div style={{fontSize:14,fontWeight:500,color:C.tx}}>{TASKS.find(t=>t.id===task)?.label}</div><div style={{fontSize:12,color:C.txS}}>자동으로 컬럼을 선택했습니다. 필요시 수정하세요.</div></div><Btn small onClick={()=>setStep(1)}>← 목표 재선택</Btn></div>
      <DsSelector datasets={allDs} value={selId} onChange={v=>{setSelId(v);setTask("");setStep(1);}} label="데이터셋"/>
      {task !== "clustering" && (() => {
        const targetTitle = "🎯 타겟 컬럼 — " + (targetCol ? targetCol : "선택 안 됨");
        return (
          <Section title={targetTitle} desc="예측/분류할 대상">
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {allCols.map(c => {
                const meta = ds.colMeta.find(m => m.name === c);
                const suit = task === "regression"
                  ? meta?.type === "number"
                  : meta?.type === "category" || meta?.type === "text";
                const isTarget = targetCol === c;
                const bg = isTarget ? (task==="regression" ? "#E6F1FB" : "#EEEDFE") : C.bg;
                const color = isTarget ? (task==="regression" ? "#0C447C" : "#3C3489") : suit ? C.tx : C.txT;
                const borderW = isTarget ? "2px" : "0.5px";
                const borderC = isTarget ? (task==="regression" ? "#185FA5" : "#7F77DD") : suit ? C.bdS : C.bd;
                return (
                  <span key={c} onClick={() => setTargetCol(c)} style={{
                    fontSize:12, padding:"5px 12px", borderRadius:10, cursor:"pointer",
                    background: bg, color: color,
                    border: borderW + " solid " + borderC,
                    fontFamily:"var(--font-mono)",
                    fontWeight: isTarget ? 500 : 400,
                    opacity: featureCols.includes(c) ? 0.4 : 1,
                  }}>{c}</span>
                );
              })}
            </div>
            {targetCol && (
              <div style={{ marginTop:8, fontSize:12, color:C.infoTx }}>
                {"✓ " + targetCol + " 선택됨"}
              </div>
            )}
          </Section>
        );
      })()}
      <Section title={`📊 피처 컬럼 — ${featureCols.length}개 선택됨`} desc="학습에 사용할 입력 컬럼"><div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>{allCols.filter(c=>c!==targetCol).map(c=>{const meta=ds.colMeta.find(m=>m.name===c);const isNum=meta?.type==="number";return<span key={c} onClick={()=>toggleFeat(c)} style={{fontSize:12,padding:"5px 12px",borderRadius:10,cursor:"pointer",background:featureCols.includes(c)?(isNum?"#E6F1FB":"#EEEDFE"):C.bg,color:featureCols.includes(c)?(isNum?"#0C447C":"#3C3489"):C.txS,border:`${featureCols.includes(c)?"2px":"0.5px"} solid ${featureCols.includes(c)?(isNum?"#185FA5":"#7F77DD"):C.bd}`,fontFamily:"var(--font-mono)",fontWeight:featureCols.includes(c)?500:400}}>{c}{featureCols.includes(c)?" ✓":""}</span>;})}}</Section>
      {task==="clustering"&&<Section title="몇 개 그룹으로 나눌까요?"><div style={{display:"flex",gap:8}}>{[2,3,4,5,6].map(k=><span key={k} onClick={()=>setKClusters(k)} style={{width:40,height:40,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",background:kClusters===k?C.info:C.bgS,color:kClusters===k?C.infoTx:C.txS,fontSize:14,fontWeight:kClusters===k?500:400,border:`${kClusters===k?"2px":"0.5px"} solid ${kClusters===k?C.infoTx:C.bd}`}}>{k}</span>)}</div></Section>}
      {/* 데이터 분리 비율 */}
      {task!=="clustering"&&<Section title="학습/검증 데이터 비율" desc="전체 데이터를 학습과 검증으로 나누는 비율입니다">
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[{v:0.1,label:"9:1"},{v:0.2,label:"8:2 (권장)"},{v:0.3,label:"7:3"},{v:0.4,label:"6:4"}].map(({v,label})=><div onClick={()=>setTestRatio(v)} style={{padding:"8px 16px",borderRadius:"var(--border-radius-md)",border:`${testRatio===v?"2px solid #185FA5":`0.5px solid ${C.bd}`}`,cursor:"pointer",background:testRatio===v?"#E6F1FB":C.bg}}><div style={{fontSize:13,fontWeight:500,color:testRatio===v?"#185FA5":C.tx}}>{label}</div><div style={{fontSize:11,color:C.txS}}>검증 {v*100}%</div></div>)}
        </div>
      </Section>}
      <div style={{marginBottom:14}}><button onClick={()=>setShowAdv(p=>!p)} style={{fontSize:12,color:C.txS,background:"transparent",border:"none",cursor:"pointer",padding:0}}>{showAdv?"▲ 고급 설정 숨기기":"▼ 고급 설정 (선택사항)"}</button>{showAdv&&task==="neural"&&<div style={{marginTop:10,padding:14,background:C.bgS,borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bd}`}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>{[{label:"은닉층 크기",node:<input value={hiddenLayer} onChange={e=>setHiddenLayer(e.target.value)} style={{width:"100%",fontSize:12,padding:"5px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}/>},{label:"학습률",node:<select value={lrRate} onChange={e=>setLrRate(+e.target.value)} style={{width:"100%",fontSize:12,padding:"5px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}>{[0.001,0.01,0.05,0.1].map(v=><option key={v} value={v}>{v}</option>)}</select>},{label:"에포크",node:<select value={epochs} onChange={e=>setEpochs(+e.target.value)} style={{width:"100%",fontSize:12,padding:"5px 8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${C.bdS}`,background:C.bg,color:C.tx}}>{[100,200,300,500].map(v=><option key={v} value={v}>{v}</option>)}</select>}].map(({label,node})=><div key={label}><div style={{fontSize:12,color:C.txS,marginBottom:4}}>{label}</div>{node}</div>)}</div></div>}</div>
      {error&&<div style={{fontSize:12,color:"#A32D2D",background:"#FCEBEB",padding:"8px 10px",borderRadius:"var(--border-radius-md)",marginBottom:12}}>{error}</div>}
      <Btn variant="primary" onClick={run} disabled={running||featureCols.length===0||(task!=="clustering"&&!targetCol)} full>{running?"⏳ 학습 중... (수 초~수십 초 소요)":"🚀 학습 시작하기"}</Btn>
      {running&&<div style={{fontSize:12,color:C.txS,marginTop:8,textAlign:"center"}}>브라우저에서 직접 학습합니다. 잠시만 기다려 주세요!</div>}
    </div>}
    {/* STEP 3 */}
    {step===3&&result&&<div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}><div style={{fontSize:14,fontWeight:500,color:C.tx}}>📋 학습 결과</div><div style={{display:"flex",gap:8}}><Btn small onClick={()=>{setStep(2);setResult(null);setGeminiText("");}}>← 다시 학습</Btn><Btn small onClick={()=>{setTask("");setStep(1);setResult(null);setGeminiText("");}}>처음으로</Btn></div></div>
      <EasyResultCard result={result} targetCol={targetCol}/>
      <div style={{border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-lg)",padding:16,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:500,color:C.tx,marginBottom:4}}>📊 상세 차트</div>
        {result.losses?.length>1&&<LossCurve data={result.losses} xKey={result.task==="clustering"?"iter":"epoch"} title={result.task==="clustering"?"학습 진행도 (Inertia)":"학습 진행도 (Loss)"}/>}
        {result.task==="regression"&&result.testActual&&<ActualVsPred actual={result.testActual} predicted={result.testPreds}/>}
        {(result.task==="classification"||result.task==="neural")&&result.cm&&result.classes?.length<=15&&<MLConfMatrix cm={result.cm} classes={result.classes}/>}
        {result.importance?.length>0&&<MLFeatChart data={result.importance}/>}
        {result.task==="clustering"&&result.rowsWithCluster&&featureCols.length>=2&&<MLScatter rows={result.rowsWithCluster} xCol={featureCols[0]} yCol={featureCols[1]} labelKey="_cluster" title={`그룹 분포 (${featureCols[0]} × ${featureCols[1]})`}/>}
      </div>
      <div style={{border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-lg)",overflow:"hidden"}}>
        <div style={{padding:"11px 14px",background:C.bgS,borderBottom:`0.5px solid ${C.bd}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><span style={{fontSize:13,fontWeight:500,color:C.tx}}>✨ AI 결과 해석</span><div style={{fontSize:11,color:C.txS,marginTop:2}}>Gemini가 입문자도 이해하기 쉽게 설명해 드립니다</div></div><Btn variant="primary" small onClick={askGemini} disabled={!apiKey||geminiLoading}>{geminiLoading?"분석 중...":apiKey?"✨ AI 해석 받기":"EDA 탭에서 API 키 입력"}</Btn></div>
        <div style={{padding:"14px 18px"}}>{geminiLoading&&<div style={{fontSize:13,color:C.txS}}>Gemini가 결과를 해석하고 있습니다...</div>}{geminiText&&<MdBlock text={geminiText}/>}{!geminiLoading&&!geminiText&&<div style={{fontSize:12,color:C.txT}}>위 버튼을 누르면 AI가 결과를 친절하게 설명해 드립니다.</div>}</div>
      </div>
    </div>}
  </div>;
}
