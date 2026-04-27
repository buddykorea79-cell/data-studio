import { useState, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { C, PALETTE } from "../../constants";
import { DsSelector } from "./UI";

function getNumCols(ds){return ds.colMeta.filter(c=>c.type==="number");}
function getCatCols(ds){return ds.colMeta.filter(c=>c.type==="category");}
function NoData(){return <div style={{padding:32,textAlign:"center",color:C.txT,fontSize:13}}>데이터 없음</div>;}
function ChartCard({title,subtitle,children}){return <div style={{border:`0.5px solid ${C.bd}`,borderRadius:"var(--border-radius-lg)",overflow:"hidden",marginBottom:14}}><div style={{padding:"10px 14px",background:C.bgS,borderBottom:`0.5px solid ${C.bd}`}}><div style={{fontSize:13,fontWeight:500,color:C.tx}}>{title}</div>{subtitle&&<div style={{fontSize:11,color:C.txS,marginTop:2}}>{subtitle}</div>}</div><div style={{padding:"14px 14px 10px"}}>{children}</div></div>;}
function HistChart({ds,col}){
  const vals=ds.rows.map(r=>parseFloat(r[col])).filter(v=>!isNaN(v));
  if(!vals.length)return <NoData/>;
  const mn=Math.min(...vals),mx=Math.max(...vals),w=(mx-mn)/20||1;
  const counts=Array.from({length:20},(_,i)=>({x:+(mn+i*w).toFixed(2),count:0}));
  vals.forEach(v=>{counts[Math.min(Math.floor((v-mn)/w),19)].count++;});
  return <ResponsiveContainer width="100%" height={220}><BarChart data={counts} margin={{top:4,right:8,left:0,bottom:20}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd}/><XAxis dataKey="x" tick={{fontSize:10,fill:C.txS}} label={{value:col,position:"insideBottom",offset:-14,fontSize:10,fill:C.txS}}/><YAxis tick={{fontSize:10,fill:C.txS}}/><Tooltip formatter={v=>[v,"빈도"]} contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Bar dataKey="count" fill="#378ADD" radius={[2,2,0,0]}/></BarChart></ResponsiveContainer>;
}
function BarFreq({ds,col,topN=12}){
  const freq={};ds.rows.forEach(r=>{const v=String(r[col]??"");freq[v]=(freq[v]||0)+1;});
  const data=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,topN).map(([name,value])=>({name,value}));
  if(!data.length)return <NoData/>;
  return <ResponsiveContainer width="100%" height={Math.max(180,data.length*26)}><BarChart data={data} layout="vertical" margin={{top:4,right:36,left:8,bottom:4}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false}/><XAxis type="number" tick={{fontSize:10,fill:C.txS}}/><YAxis type="category" dataKey="name" tick={{fontSize:10,fill:C.txS}} width={90}/><Tooltip contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Bar dataKey="value" name="빈도" radius={[0,3,3,0]}>{data.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Bar></BarChart></ResponsiveContainer>;
}
function PieFreq({ds,col}){
  const freq={};ds.rows.forEach(r=>{const v=String(r[col]??"");freq[v]=(freq[v]||0)+1;});
  const sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]);
  const top=sorted.slice(0,8);const other=sorted.slice(8).reduce((a,[,c])=>a+c,0);
  const data=[...top.map(([n,v])=>({name:n,value:v})),...(other>0?[{name:"기타",value:other}]:[])];
  if(!data.length)return <NoData/>;
  const R=Math.PI/180;
  const lbl=({cx,cy,midAngle,innerRadius,outerRadius,percent})=>{if(percent<0.04)return null;const r=innerRadius+(outerRadius-innerRadius)*0.55;return <text x={cx+r*Math.cos(-midAngle*R)} y={cy+r*Math.sin(-midAngle*R)} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11}>{`${(percent*100).toFixed(0)}%`}</text>;};
  return <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data} cx="50%" cy="50%" outerRadius={100} dataKey="value" labelLine={false} label={lbl}>{data.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Pie><Tooltip formatter={(v,n)=>[v.toLocaleString(),n]} contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Legend iconSize={10} wrapperStyle={{fontSize:11}}/></PieChart></ResponsiveContainer>;
}
function ScatterPlot({ds,xCol,yCol}){
  const data=ds.rows.map(r=>({x:parseFloat(r[xCol]),y:parseFloat(r[yCol])})).filter(p=>!isNaN(p.x)&&!isNaN(p.y)).slice(0,1000);
  if(!data.length)return <NoData/>;
  const n=data.length,sx=data.reduce((a,p)=>a+p.x,0)/n,sy=data.reduce((a,p)=>a+p.y,0)/n;
  const num=data.reduce((a,p)=>a+(p.x-sx)*(p.y-sy),0),den=Math.sqrt(data.reduce((a,p)=>a+(p.x-sx)**2,0)*data.reduce((a,p)=>a+(p.y-sy)**2,0));
  const r=den?+(num/den).toFixed(3):0;
  return <div><div style={{fontSize:11,color:C.txS,marginBottom:6}}>상관계수(r): <strong style={{color:Math.abs(r)>0.7?"#1D9E75":Math.abs(r)>0.4?"#BA7517":C.tx}}>{r}</strong> · {data.length>=1000?"최대 1,000개 표시":`${data.length}개`}</div><ResponsiveContainer width="100%" height={260}><ScatterChart margin={{top:4,right:8,left:0,bottom:20}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd}/><XAxis type="number" dataKey="x" name={xCol} tick={{fontSize:10,fill:C.txS}} label={{value:xCol,position:"insideBottom",offset:-14,fontSize:10,fill:C.txS}}/><YAxis type="number" dataKey="y" name={yCol} tick={{fontSize:10,fill:C.txS}}/><Tooltip content={({payload})=>payload?.length?<div style={{background:C.bg,border:`0.5px solid ${C.bd}`,borderRadius:6,padding:"5px 8px",fontSize:11}}><div>{xCol}: {payload[0]?.payload?.x}</div><div>{yCol}: {payload[0]?.payload?.y}</div></div>:null}/><Scatter data={data} fill="#378ADD" fillOpacity={0.5} r={3}/></ScatterChart></ResponsiveContainer></div>;
}
function LineChart_({ds,xCol,yCol}){
  const data=ds.rows.map(r=>({x:String(r[xCol]??""),y:parseFloat(r[yCol])})).filter(p=>p.x&&!isNaN(p.y)).sort((a,b)=>a.x.localeCompare(b.x)).slice(0,500);
  if(!data.length)return <NoData/>;
  return <ResponsiveContainer width="100%" height={260}><LineChart data={data} margin={{top:4,right:8,left:0,bottom:24}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd}/><XAxis dataKey="x" tick={{fontSize:10,fill:C.txS}} interval="preserveStartEnd" label={{value:xCol,position:"insideBottom",offset:-16,fontSize:10,fill:C.txS}}/><YAxis tick={{fontSize:10,fill:C.txS}}/><Tooltip contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Line type="monotone" dataKey="y" name={yCol} stroke="#185FA5" dot={false} strokeWidth={2}/></LineChart></ResponsiveContainer>;
}
function GroupedBar({ds,catCol,numCol,topN=12}){
  const agg={};ds.rows.forEach(r=>{const k=String(r[catCol]??"");const v=parseFloat(r[numCol]);if(!isNaN(v)){if(!agg[k])agg[k]={sum:0,count:0};agg[k].sum+=v;agg[k].count++;}});
  const data=Object.entries(agg).map(([name,{sum,count}])=>({name,avg:+(sum/count).toFixed(3)})).sort((a,b)=>b.avg-a.avg).slice(0,topN);
  if(!data.length)return <NoData/>;
  return <ResponsiveContainer width="100%" height={Math.max(180,data.length*26)}><BarChart data={data} layout="vertical" margin={{top:4,right:40,left:8,bottom:4}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false}/><XAxis type="number" tick={{fontSize:10,fill:C.txS}}/><YAxis type="category" dataKey="name" tick={{fontSize:10,fill:C.txS}} width={90}/><Tooltip contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Bar dataKey="avg" name={`${numCol} 평균`} radius={[0,3,3,0]}>{data.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Bar></BarChart></ResponsiveContainer>;
}
function CorrHeatmap({ds}){
  const numCols=getNumCols(ds).map(c=>c.name).slice(0,10);
  if(numCols.length<2)return <div style={{padding:24,textAlign:"center",color:C.txT,fontSize:13}}>숫자형 컬럼 2개 이상 필요</div>;
  const vals={};numCols.forEach(c=>{vals[c]=ds.rows.map(r=>parseFloat(r[c])).filter(v=>!isNaN(v));});
  const mean=arr=>arr.reduce((a,b)=>a+b,0)/arr.length;
  const corr=(a,b)=>{const ma=mean(a),mb=mean(b),num=a.reduce((s,v,i)=>s+(v-ma)*(b[i]-mb),0),den=Math.sqrt(a.reduce((s,v)=>s+(v-ma)**2,0)*b.reduce((s,v)=>s+(v-mb)**2,0));return den?+(num/den).toFixed(2):0;};
  const matrix=numCols.map(c1=>numCols.map(c2=>{const ml=Math.min(vals[c1].length,vals[c2].length);return corr(vals[c1].slice(0,ml),vals[c2].slice(0,ml));}));
  const cs=Math.min(60,Math.floor(540/numCols.length));
  const clr=v=>v>=0?`rgba(24,95,165,${0.1+Math.abs(v)*0.85})`:`rgba(216,90,48,${0.1+Math.abs(v)*0.85})`;
  return <div style={{overflowX:"auto"}}><div style={{display:"inline-block"}}><div style={{display:"flex",marginLeft:cs+4}}>{numCols.map(c=><div key={c} style={{width:cs,fontSize:9,color:C.txS,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",transform:"rotate(-30deg)",transformOrigin:"bottom left",marginBottom:4,height:38}}>{c}</div>)}</div>{matrix.map((row,i)=><div key={i} style={{display:"flex",alignItems:"center",marginBottom:2}}><div style={{width:cs,fontSize:9,color:C.txS,textAlign:"right",paddingRight:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flexShrink:0}}>{numCols[i]}</div>{row.map((v,j)=><div key={j} title={`${numCols[i]}×${numCols[j]}: ${v}`} style={{width:cs,height:cs,background:clr(v),display:"flex",alignItems:"center",justifyContent:"center",fontSize:cs>44?10:8,fontWeight:500,color:Math.abs(v)>0.5?"#fff":C.tx,borderRadius:2,margin:1,cursor:"default",flexShrink:0}}>{v}</div>)}</div>)}</div></div>;
}
function MissingChart({ds}){
  const data=ds.colMeta.filter(c=>c.stats.nullCount>0).map(c=>({name:c.name,pct:+((c.stats.nullCount/ds.rowCount)*100).toFixed(1),missing:c.stats.nullCount})).sort((a,b)=>b.pct-a.pct);
  if(!data.length)return <div style={{padding:24,textAlign:"center",color:C.successTx,fontSize:13}}>결측값 없음</div>;
  return <ResponsiveContainer width="100%" height={Math.max(160,data.length*28)}><BarChart data={data} layout="vertical" margin={{top:4,right:40,left:8,bottom:4}}><CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false}/><XAxis type="number" tickFormatter={v=>`${v}%`} tick={{fontSize:10,fill:C.txS}} domain={[0,100]}/><YAxis type="category" dataKey="name" tick={{fontSize:10,fill:C.txS}} width={100}/><Tooltip formatter={(v,n,p)=>[`${p.payload?.missing?.toLocaleString()}개 (${p.payload?.pct}%)`,""]} contentStyle={{fontSize:11,borderRadius:6,border:`0.5px solid ${C.bd}`}}/><Bar dataKey="pct" radius={[0,3,3,0]}>{data.map((d,i)=><Cell key={i} fill={d.pct>30?"#E24B4A":d.pct>10?"#EF9F27":"#F09595"}/>)}</Bar></BarChart></ResponsiveContainer>;
}
// ── Custom chart components ───────────────────────────────────────────────────
function aggData(rows, col, numCol, mode) {
  const freq = {};
  rows.forEach(r => {
    const k = String(r[col] ?? "");
    if (!freq[k]) freq[k] = { vals: [], count: 0 };
    freq[k].count++;
    const v = numCol ? parseFloat(r[numCol]) : NaN;
    if (!isNaN(v)) freq[k].vals.push(v);
  });
  return Object.entries(freq).map(([name, { vals, count }]) => {
    let value = count;
    if (mode === "sum") value = vals.reduce((a, b) => a + b, 0);
    else if (mode === "mean") value = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3) : 0;
    else if (mode === "max") value = vals.length ? Math.max(...vals) : 0;
    else if (mode === "min") value = vals.length ? Math.min(...vals) : 0;
    return { name, value: +value.toFixed ? +value.toFixed(3) : value };
  }).sort((a, b) => b.value - a.value).slice(0, 15);
}

const CL = ["label", { position: "insideRight", offset: -4, fontSize: 10, fill: "#fff" }];

function CustomBarChart({ ds, col, mode, barStyle, showLabel, chartH=1, autoAxis=false }) {
  const data = aggData(ds.rows, col, mode !== "count" ? null : null, mode);
  if (!data.length) return <NoData />;
  const baseH = Math.max(200, data.length * 28);
  const h = Math.round(baseH * chartH);
  const vals = data.map(d => d.value);
  const xDomain = autoAxis
    ? [Math.max(0, Math.min(...vals) * 0.9), Math.max(...vals) * 1.05]
    : [0, "auto"];
  const labelProps = showLabel ? { position: "right", fontSize: 10, fill: C.txS, formatter: v => v.toLocaleString() } : false;
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: showLabel ? 70 : 36, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} domain={xDomain} tickFormatter={v => v.toLocaleString()} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={90} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "0.5px solid " + C.bd }} formatter={v => [v.toLocaleString(), mode]} />
        <Bar dataKey="value" name={mode} radius={[0, 3, 3, 0]} label={labelProps}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CustomGroupedBar({ ds, catCol, numCol, mode, showLabel, chartH=1, autoAxis=false }) {
  const data = aggData(ds.rows, catCol, numCol, mode || "mean");
  if (!data.length) return <NoData />;
  const h = Math.round(Math.max(200, data.length * 28) * chartH);
  const vals = data.map(d => d.value);
  const xDomain = autoAxis
    ? [Math.max(0, Math.min(...vals) * 0.9), Math.max(...vals) * 1.05]
    : [0, "auto"];
  const labelProps = showLabel ? { position: "right", fontSize: 10, fill: C.txS, formatter: v => v.toLocaleString() } : false;
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: showLabel ? 70 : 40, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} domain={xDomain} tickFormatter={v => v.toLocaleString()} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={90} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "0.5px solid " + C.bd }} formatter={v => [v.toLocaleString(), mode]} />
        <Bar dataKey="value" name={mode} radius={[0, 3, 3, 0]} label={labelProps}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CustomPieChart({ ds, col, donut, chartH=1 }) {
  const freq = {};
  ds.rows.forEach(r => { const v = String(r[col] ?? ""); freq[v] = (freq[v] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 8);
  const other = sorted.slice(8).reduce((a, [, c]) => a + c, 0);
  const data = [...top.map(([n, v]) => ({ name: n, value: v })), ...(other > 0 ? [{ name: "기타", value: other }] : [])];
  if (!data.length) return <NoData />;
  const R = Math.PI / 180;
  const lbl = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
    if (percent < 0.04) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    return <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11}>{`${(percent * 100).toFixed(0)}%`}</text>;
  };
  return (
    <ResponsiveContainer width="100%" height={Math.round(270 * chartH)}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={110} innerRadius={donut ? 50 : 0} dataKey="value" labelLine={false} label={lbl}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip formatter={(v, n) => [v.toLocaleString(), n]} contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function CustomHistChart({ ds, col, hueCol, chartH=1, autoAxis=false }) {
  const allVals = ds.rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
  if (!allVals.length) return <NoData />;
  const mn = Math.min(...allVals), mx = Math.max(...allVals), w = (mx - mn) / 20 || 1;
  if (!hueCol) {
    const counts = Array.from({ length: 20 }, (_, i) => ({ x: +(mn + i * w).toFixed(2), count: 0 }));
    allVals.forEach(v => { counts[Math.min(Math.floor((v - mn) / w), 19)].count++; });
    const h1 = Math.round(240 * chartH);
    const yVals = counts.map(c => c.count);
    const yDomain = autoAxis ? [0, Math.max(...yVals) * 1.1] : [0, "auto"];
    return (
      <ResponsiveContainer width="100%" height={h1}>
        <BarChart data={counts} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
          <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.txS }} tickFormatter={v => Number.isInteger(v)?v:+v.toFixed(1)} label={{ value: col, position: "insideBottom", offset: -14, fontSize: 10, fill: C.txS }} />
          <YAxis tick={{ fontSize: 10, fill: C.txS }} domain={yDomain} tickFormatter={v => Number.isInteger(v)?v:Math.round(v)} />
          <Tooltip formatter={v => [v, "빈도"]} contentStyle={{ fontSize: 11, borderRadius: 6, border: "0.5px solid " + C.bd }} />
          <Bar dataKey="count" fill="#378ADD" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  // Hue mode: multiple lines
  const hueVals = [...new Set(ds.rows.map(r => String(r[hueCol] ?? "")))].slice(0, 6);
  const binData = Array.from({ length: 20 }, (_, i) => {
    const obj = { x: +(mn + i * w).toFixed(2) };
    hueVals.forEach(hv => { obj[hv] = 0; });
    return obj;
  });
  ds.rows.forEach(r => {
    const v = parseFloat(r[col]); if (isNaN(v)) return;
    const hv = String(r[hueCol] ?? ""); if (!hueVals.includes(hv)) return;
    binData[Math.min(Math.floor((v - mn) / w), 19)][hv]++;
  });
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={binData} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
        <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.txS }} label={{ value: col, position: "insideBottom", offset: -14, fontSize: 10, fill: C.txS }} />
        <YAxis tick={{ fontSize: 10, fill: C.txS }} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {hueVals.map((hv, i) => <Bar key={hv} dataKey={hv} stackId="a" fill={PALETTE[i % PALETTE.length]} radius={i === hueVals.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

function CustomScatterChart({ ds, xCol, yCol, hueCol, chartH=1, autoAxis=false }) {
  const hueVals = hueCol ? [...new Set(ds.rows.map(r => String(r[hueCol] ?? "")))].slice(0, 8) : ["all"];
  const getRows = hv => ds.rows.filter(r => !hueCol || String(r[hueCol] ?? "") === hv).map(r => ({ x: parseFloat(r[xCol]), y: parseFloat(r[yCol]) })).filter(p => !isNaN(p.x) && !isNaN(p.y)).slice(0, 400);
  const n = ds.rows.length;
  const sx = ds.rows.map(r => parseFloat(r[xCol])).filter(v => !isNaN(v));
  const sy = ds.rows.map(r => parseFloat(r[yCol])).filter(v => !isNaN(v));
  const mxv = sx.reduce((a, b) => a + b, 0) / sx.length, myv = sy.reduce((a, b) => a + b, 0) / sy.length;
  const num = sx.reduce((s, v, i) => s + (v - mxv) * ((sy[i] || 0) - myv), 0);
  const den = Math.sqrt(sx.reduce((s, v) => s + (v - mxv) ** 2, 0) * sy.reduce((s, v) => s + (v - myv) ** 2, 0));
  const r = den ? +(num / den).toFixed(3) : 0;
  const scatH = Math.round(260 * chartH);
  const xDom = autoAxis && sx.length ? [Math.min(...sx)*0.95, Math.max(...sx)*1.05] : ["auto","auto"];
  const yDom = autoAxis && sy.length ? [Math.min(...sy)*0.95, Math.max(...sy)*1.05] : ["auto","auto"];
  return (
    <div>
      <div style={{ fontSize: 11, color: C.txS, marginBottom: 6 }}>상관계수 r = <strong style={{ color: Math.abs(r) > 0.7 ? "#1D9E75" : Math.abs(r) > 0.4 ? "#BA7517" : C.tx }}>{r}</strong></div>
      <ResponsiveContainer width="100%" height={scatH}>
        <ScatterChart margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
          <XAxis type="number" dataKey="x" name={xCol} tick={{ fontSize: 10, fill: C.txS }} domain={xDom} tickFormatter={v=>Number.isInteger(v)?v:+v.toFixed(1)} label={{ value: xCol, position: "insideBottom", offset: -14, fontSize: 10, fill: C.txS }} />
          <YAxis type="number" dataKey="y" name={yCol} tick={{ fontSize: 10, fill: C.txS }} domain={yDom} tickFormatter={v=>Number.isInteger(v)?v:+v.toFixed(1)} />
          <Tooltip content={({ payload }) => payload?.length ? <div style={{ background: C.bg, border: `0.5px solid ${C.bd}`, borderRadius: 6, padding: "5px 8px", fontSize: 11 }}>{hueCol && <div>{hueCol}: {payload[0]?.payload?.hue}</div>}<div>{xCol}: {payload[0]?.payload?.x}</div><div>{yCol}: {payload[0]?.payload?.y}</div></div> : null} />
          {hueVals.map((hv, i) => <Scatter key={hv} name={hv === "all" ? `${xCol} × ${yCol}` : hv} data={getRows(hv).map(p => ({ ...p, hue: hv }))} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.55} r={3} />)}
          {hueCol && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomLineChart({ ds, xCol, yCol, hueCol, chartH=1, autoAxis=false }) {
  if (!hueCol) {
    const data = ds.rows.map(r => ({ x: String(r[xCol] ?? ""), y: parseFloat(r[yCol]) })).filter(p => p.x && !isNaN(p.y)).sort((a, b) => a.x.localeCompare(b.x)).slice(0, 500);
    if (!data.length) return <NoData />;
    const lineH = Math.round(260 * chartH);
    const yVals2 = data.map(d => d.y).filter(v => v != null);
    const yDom2 = autoAxis && yVals2.length ? [Math.min(...yVals2)*0.95, Math.max(...yVals2)*1.05] : ["auto","auto"];
    return (
      <ResponsiveContainer width="100%" height={lineH}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
          <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.txS }} interval="preserveStartEnd" label={{ value: xCol, position: "insideBottom", offset: -16, fontSize: 10, fill: C.txS }} />
          <YAxis tick={{ fontSize: 10, fill: C.txS }} domain={yDom2} tickFormatter={v=>Number.isInteger(v)?v:+v.toFixed(1)} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
          <Line type="monotone" dataKey="y" name={yCol} stroke="#185FA5" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  const hueVals = [...new Set(ds.rows.map(r => String(r[hueCol] ?? "")))].slice(0, 6);
  const xVals = [...new Set(ds.rows.map(r => String(r[xCol] ?? "")))].sort().slice(0, 100);
  const data = xVals.map(x => {
    const obj = { x };
    hueVals.forEach(hv => {
      const rows = ds.rows.filter(r => String(r[xCol] ?? "") === x && String(r[hueCol] ?? "") === hv);
      const vals = rows.map(r => parseFloat(r[yCol])).filter(v => !isNaN(v));
      obj[hv] = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3) : null;
    });
    return obj;
  });
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
        <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.txS }} interval="preserveStartEnd" label={{ value: xCol, position: "insideBottom", offset: -16, fontSize: 10, fill: C.txS }} />
        <YAxis tick={{ fontSize: 10, fill: C.txS }} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {hueVals.map((hv, i) => <Line key={hv} type="monotone" dataKey={hv} stroke={PALETTE[i % PALETTE.length]} dot={false} strokeWidth={2} connectNulls />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

function CustomBoxPlot({ ds, col, groupCol, chartH=1, autoAxis=false }) {
  const calcBox = vals => {
    if (!vals.length) return null;
    const s = [...vals].sort((a, b) => a - b);
    const q1 = s[Math.floor(s.length * 0.25)];
    const median = s[Math.floor(s.length * 0.5)];
    const q3 = s[Math.floor(s.length * 0.75)];
    const iqr = q3 - q1;
    const lo = Math.max(s[0], q1 - 1.5 * iqr);
    const hi = Math.min(s[s.length - 1], q3 + 1.5 * iqr);
    return { lo, q1, median, q3, hi };
  };
  const groups = groupCol
    ? [...new Set(ds.rows.map(r => String(r[groupCol] ?? "")))].slice(0, 12)
    : ["전체"];
  // 원본 absolute 값 보존
  const boxData = groups.map(g => {
    const vals = ds.rows
      .filter(r => !groupCol || String(r[groupCol] ?? "") === g)
      .map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    const box = calcBox(vals);
    if (!box) return null;
    return { name: g, _lo: box.lo, _q1: box.q1, _med: box.median, _q3: box.q3, _hi: box.hi };
  }).filter(Boolean);
  if (!boxData.length) return <NoData />;

  // XAxis domain: autoAxis=true면 실제값 범위, false면 0 기준
  const allAbsVals = boxData.flatMap(d => [d._lo, d._hi]);
  const domainMin = autoAxis ? +Math.min(...allAbsVals).toFixed(2) : 0;
  const domainMax = +(Math.max(...allAbsVals) * 1.05).toFixed(2);

  // 스택 바 데이터: lo(투명 오프셋) + q1구간 + med구간 + q3구간 + hi구간(투명)
  const stackData = boxData.map(d => ({
    name: d.name,
    _lo: d._lo, _q1: d._q1, _med: d._med, _q3: d._q3, _hi: d._hi,
    offset: d._lo - domainMin,          // 투명 시작 오프셋
    q1span: d._q1 - d._lo,             // Q1 ~ lo 구간
    medspan: d._med - d._q1,           // median ~ Q1 구간
    q3span: d._q3 - d._med,            // Q3 ~ median 구간
    hispan: d._hi - d._q3,             // hi ~ Q3 구간
  }));

  const h = Math.round(Math.max(220, boxData.length * 52) * chartH);
  const tickFmt = v => {
    const n = domainMin + v;
    return Number.isInteger(n) ? n : +n.toFixed(1);
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: C.txS, marginBottom: 6 }}>
        박스: Q1~Q3 범위 · 짙은선: 중앙값 · 수염: 최솟값~최댓값 (1.5×IQR 클리핑)
        {autoAxis && <span style={{ marginLeft:8, color:C.infoTx }}>· 실제값 축 표시 중</span>}
      </div>
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={stackData} layout="vertical"
          margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }}
            tickFormatter={v => {
              const actual = domainMin + v;
              return Number.isInteger(actual) ? actual : +actual.toFixed(1);
            }}
            domain={[0, domainMax - domainMin]} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={80} />
          <Tooltip content={({ payload, label }) => {
            if (!payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div style={{ background: C.bg, border: "0.5px solid "+C.bd, borderRadius: 6, padding: "7px 10px", fontSize: 11 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                <div>최솟값: <strong>{+d._lo.toFixed(3)}</strong></div>
                <div>Q1: <strong>{+d._q1.toFixed(3)}</strong></div>
                <div>중앙값: <strong>{+d._med.toFixed(3)}</strong></div>
                <div>Q3: <strong>{+d._q3.toFixed(3)}</strong></div>
                <div>최댓값: <strong>{+d._hi.toFixed(3)}</strong></div>
              </div>
            );
          }} />
          <Bar dataKey="offset"  stackId="box" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="q1span"  stackId="box" fill="#B5D4F4"    isAnimationActive={false} />
          <Bar dataKey="medspan" stackId="box" fill="#185FA5"    isAnimationActive={false} name="중앙값 구간" />
          <Bar dataKey="q3span"  stackId="box" fill="#B5D4F4"    isAnimationActive={false} />
          <Bar dataKey="hispan"  stackId="box" fill="transparent" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── VizTab main ───────────────────────────────────────────────────────────────
export function VizTab({ allDs }) {
  const [selId, setSelId] = useState(() => allDs[0]?.id ?? "");
  const [sec, setSec] = useState("auto");
  // custom chart state
  const [ct, setCt] = useState("bar");
  const [xCol, setXCol] = useState("");
  const [yCol, setYCol] = useState("");
  const [xCol2, setXCol2] = useState("");
  const [yCol2, setYCol2] = useState("");
  const [catCol, setCatCol] = useState("");
  const [numCol, setNumCol] = useState("");
  const [hueCol, setHueCol] = useState("");
  const [barMode, setBarMode] = useState("count");
  const [barStyle, setBarStyle] = useState("normal");
  const [donut, setDonut] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const [chartH, setChartH] = useState(1);      // 1 = 기본, 1.5 = 1.5배
  const [autoAxis, setAutoAxis] = useState(false); // 축 실제값 중심

  const ds = allDs.find(d => d.id === selId);
  const prevId = useRef(selId);
  if (prevId.current !== selId) {
    prevId.current = selId;
    setXCol(""); setYCol(""); setXCol2(""); setYCol2("");
    setCatCol(""); setNumCol(""); setHueCol(""); setSec("auto");
  }

  if (!ds) return <div style={{ padding: 48, textAlign: "center", color: C.txT }}>파일을 업로드해 주세요.</div>;

  const numCols = getNumCols(ds);
  const catCols = getCatCols(ds);

  const SECS = [
    { id: "auto",    label: "자동 분석" },
    { id: "dist",    label: "분포" },
    { id: "cat",     label: "범주형" },
    { id: "corr",    label: "상관관계" },
    { id: "missing", label: "결측값" },
    { id: "custom",  label: "커스텀" },
  ];

  const CHART_TYPES = [
    { id: "bar",     label: "막대",       desc: "누적/그룹 선택가능" },
    { id: "pie",     label: "파이/도넛",  desc: "비율" },
    { id: "hist",    label: "히스토그램", desc: "분포+Hue" },
    { id: "scatter", label: "산점도",     desc: "숫자×숫자+Hue" },
    { id: "line",    label: "라인",       desc: "추세+Hue" },
    { id: "grouped", label: "그룹막대",   desc: "범주별 집계" },
    { id: "box",     label: "박스플롯",   desc: "분포+이상치" },
  ];

  const tabStyle = active => ({
    fontSize: 12, padding: "8px 14px", cursor: "pointer", background: "transparent",
    border: "none", borderBottom: active ? "2px solid " + C.infoTx : "2px solid transparent",
    color: active ? C.infoTx : C.txS, fontWeight: active ? 500 : 400,
    whiteSpace: "nowrap", marginBottom: -0.5,
  });

  const chipStyle = active => ({
    fontSize: 11, padding: "3px 9px", borderRadius: 10, cursor: "pointer",
    background: active ? C.info : C.bg, color: active ? C.infoTx : C.txS,
    border: "0.5px solid " + (active ? C.infoTx : C.bd),
    fontWeight: active ? 500 : 400,
  });

  const selStyle = {
    width: "100%", fontSize: 13, padding: "6px 8px",
    borderRadius: "var(--border-radius-md)",
    border: "0.5px solid " + C.bdS, background: C.bg, color: C.tx,
  };

  return (
    <div>
      {/* 파일 선택 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: C.txS, whiteSpace: "nowrap" }}>데이터셋</span>
        <select value={selId} onChange={e => setSelId(e.target.value)} style={{ ...selStyle }}>
          {allDs.map(d => (
            <option key={d.id} value={d.id}>{d.name} ({d.rowCount.toLocaleString()}행 × {d.columns.length}열)</option>
          ))}
        </select>
      </div>

      {/* 섹션 탭 */}
      <div style={{ display: "flex", gap: 0, marginBottom: 18, borderBottom: "0.5px solid " + C.bd, overflowX: "auto" }}>
        {SECS.map(s => (
          <button type="button" key={s.id} onClick={() => setSec(s.id)} style={tabStyle(sec === s.id)}>{s.label}</button>
        ))}
      </div>

      {/* 자동 분석 */}
      {sec === "auto" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 18 }}>
            {[["전체 행", ds.rowCount.toLocaleString()], ["숫자형", numCols.length], ["범주형", catCols.length]].map(([l, v]) => (
              <div key={l} style={{ background: C.bgS, borderRadius: "var(--border-radius-md)", padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: C.txS, marginBottom: 3 }}>{l}</div>
                <div style={{ fontSize: 18, fontWeight: 500, color: C.tx, fontFamily: "var(--font-mono)" }}>{v}</div>
              </div>
            ))}
          </div>
          {numCols.length > 0 && (
            <ChartCard title="숫자형 컬럼 분포" subtitle={numCols.slice(0,4).map(c=>c.name).join(" · ")}>
              <div style={{ display: "grid", gridTemplateColumns: numCols.length > 1 ? "1fr 1fr" : "1fr", gap: 14 }}>
                {numCols.slice(0, 4).map(col => (
                  <div key={col.name}>
                    <div style={{ fontSize: 11, color: C.txS, marginBottom: 4, fontFamily: "var(--font-mono)" }}>{col.name}</div>
                    <HistChart ds={ds} col={col.name}/>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}
          {catCols.length > 0 && (
            <ChartCard title="범주형 컬럼 분포" subtitle={catCols.slice(0,2).map(c=>c.name).join(" · ")}>
              <div style={{ display: "grid", gridTemplateColumns: catCols.length > 1 ? "1fr 1fr" : "1fr", gap: 18 }}>
                {catCols.slice(0, 2).map(col => (
                  <div key={col.name}>
                    <div style={{ fontSize: 11, color: C.txS, marginBottom: 4, fontFamily: "var(--font-mono)" }}>{col.name}</div>
                    <BarFreq ds={ds} col={col.name} topN={8}/>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}
          {numCols.length >= 2 && (
            <ChartCard title="상관관계 히트맵" subtitle="색이 진할수록 상관관계가 강함">
              <CorrHeatmap ds={ds}/>
            </ChartCard>
          )}
          {ds.colMeta.some(c => c.stats.nullCount > 0) && (
            <ChartCard title="결측값 현황">
              <MissingChart ds={ds}/>
            </ChartCard>
          )}
          {catCols.length > 0 && numCols.length > 0 && (
            <ChartCard title={catCols[0].name + " 별 " + numCols[0].name + " 평균"}>
              <GroupedBar ds={ds} catCol={catCols[0].name} numCol={numCols[0].name}/>
            </ChartCard>
          )}
        </div>
      )}

      {/* 분포 */}
      {sec === "dist" && (
        <div>
          {numCols.length === 0
            ? <div style={{ padding: 40, textAlign: "center", color: C.txT, fontSize: 13 }}>숫자형 컬럼이 없습니다.</div>
            : numCols.map(col => (
              <ChartCard key={col.name} title={"분포: " + col.name}
                subtitle={"평균 " + col.stats.mean + " · 중앙값 " + col.stats.median + " · 표준편차 " + col.stats.std}>
                <HistChart ds={ds} col={col.name}/>
              </ChartCard>
            ))
          }
        </div>
      )}

      {/* 범주형 */}
      {sec === "cat" && (
        <div>
          {catCols.length === 0
            ? <div style={{ padding: 40, textAlign: "center", color: C.txT, fontSize: 13 }}>범주형 컬럼이 없습니다.</div>
            : catCols.map(col => (
              <ChartCard key={col.name} title={"범주 분포: " + col.name} subtitle={"고유값 " + col.stats.unique + "개"}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div><div style={{ fontSize: 11, color: C.txS, marginBottom: 6 }}>막대 차트</div><BarFreq ds={ds} col={col.name}/></div>
                  <div><div style={{ fontSize: 11, color: C.txS, marginBottom: 6 }}>파이 차트</div><PieFreq ds={ds} col={col.name}/></div>
                </div>
              </ChartCard>
            ))
          }
        </div>
      )}

      {/* 상관관계 */}
      {sec === "corr" && (
        <div>
          <ChartCard title="상관관계 히트맵" subtitle="숫자형 컬럼 간 피어슨 상관계수 (-1 ~ 1)">
            <CorrHeatmap ds={ds}/>
          </ChartCard>
          {numCols.length >= 2 && (
            <ChartCard title="산점도 선택" subtitle="두 컬럼을 선택해 관계를 확인합니다">
              <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                {[{ label: "X 축", val: xCol2, set: setXCol2 }, { label: "Y 축", val: yCol2, set: setYCol2 }].map(({ label, val, set }) => (
                  <div key={label} style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 12, color: C.txS, marginBottom: 4 }}>{label}</div>
                    <select value={val} onChange={e => set(e.target.value)} style={selStyle}>
                      <option value="">— 선택 —</option>
                      {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {xCol2 && yCol2 && xCol2 !== yCol2
                ? <ScatterPlot ds={ds} xCol={xCol2} yCol={yCol2}/>
                : <div style={{ padding: 24, textAlign: "center", color: C.txT, fontSize: 13 }}>서로 다른 두 컬럼을 선택해 주세요.</div>
              }
            </ChartCard>
          )}
        </div>
      )}

      {/* 결측값 */}
      {sec === "missing" && (
        <ChartCard title="결측값 현황" subtitle="컬럼별 결측 비율">
          <MissingChart ds={ds}/>
        </ChartCard>
      )}

      {/* 커스텀 */}
      {sec === "custom" && (
        <div>
          <div style={{ border: "0.5px solid " + C.bd, borderRadius: "var(--border-radius-lg)", overflow: "hidden", marginBottom: 14 }}>
            <div style={{ padding: "11px 14px", background: C.bgS, borderBottom: "0.5px solid " + C.bd }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.tx }}>차트 유형 & 컬럼 선택</span>
            </div>
            <div style={{ padding: 14 }}>
              {/* 차트 유형 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, marginBottom: 14 }}>
                {CHART_TYPES.map(t => (
                  <div key={t.id} onClick={() => { setCt(t.id); setXCol(""); setYCol(""); setCatCol(""); setNumCol(""); setHueCol(""); setBarMode("count"); setBarStyle("normal"); setDonut(false); }}
                    style={{ padding: "8px 10px", borderRadius: "var(--border-radius-md)", cursor: "pointer",
                      border: ct===t.id ? "2px solid #185FA5" : "0.5px solid " + C.bd,
                      background: ct===t.id ? "#E6F1FB" : C.bg }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: ct===t.id ? "#185FA5" : C.tx }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: C.txS }}>{t.desc}</div>
                  </div>
                ))}
              </div>

              {/* 컬럼 선택 */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                {(ct === "bar" || ct === "pie") && (
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <div style={{ fontSize: 12, color: C.txS, marginBottom: 4 }}>범주 컬럼</div>
                    <select value={catCol} onChange={e => setCatCol(e.target.value)} style={selStyle}>
                      <option value="">— 선택 —</option>
                      {[...catCols, ...numCols].map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                {ct === "hist" && (
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <div style={{ fontSize: 12, color: C.txS, marginBottom: 4 }}>숫자 컬럼</div>
                    <select value={xCol} onChange={e => setXCol(e.target.value)} style={selStyle}>
                      <option value="">— 선택 —</option>
                      {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                {(ct === "scatter" || ct === "box") && (
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 12, color: C.txS, marginBottom: 4 }}>{ct === "box" ? "숫자 컬럼" : "X 축"}</div>
                    <select value={xCol} onChange={e => setXCol(e.target.value)} style={selStyle}>
                      <option value="">— 선택 —</option>
                      {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                {ct === "scatter" && (
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 12, color: C.txS, marginBottom: 4 }}>Y 축</div>
                    <select value={yCol} onChange={e => setYCol(e.target.value)} style={selStyle}>
                      <option value="">— 선택 —</option>
                      {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                {ct === "line" && (
                  <>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 12, color: C.txS, marginBottom: 4 }}>X 축</div>
                      <select value={xCol} onChange={e => setXCol(e.target.value)} style={selStyle}>
                        <option value="">— 선택 —</option>
                        {ds.columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 12, color: C.txS, marginBottom: 4 }}>Y 축</div>
                      <select value={yCol} onChange={e => setYCol(e.target.value)} style={selStyle}>
                        <option value="">— 선택 —</option>
                        {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {ct === "grouped" && (
                  <>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 12, color: C.txS, marginBottom: 4 }}>범주 컬럼</div>
                      <select value={catCol} onChange={e => setCatCol(e.target.value)} style={selStyle}>
                        <option value="">— 선택 —</option>
                        {catCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 12, color: C.txS, marginBottom: 4 }}>숫자 컬럼</div>
                      <select value={numCol} onChange={e => setNumCol(e.target.value)} style={selStyle}>
                        <option value="">— 선택 —</option>
                        {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {ct === "box" && (
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 12, color: C.txS, marginBottom: 4 }}>그룹 컬럼 (선택)</div>
                    <select value={catCol} onChange={e => setCatCol(e.target.value)} style={selStyle}>
                      <option value="">— 전체 —</option>
                      {catCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                {(ct === "hist" || ct === "scatter" || ct === "line") && (
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 12, color: C.txS, marginBottom: 4 }}>Hue (색상 구분)</div>
                    <select value={hueCol} onChange={e => setHueCol(e.target.value)} style={selStyle}>
                      <option value="">— 없음 —</option>
                      {[...catCols, ...numCols.slice(0,3)].map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* 옵션 행 1: 차트별 옵션 */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                {ct === "bar" && (
                  <>
                    <span style={{ fontSize: 12, color: C.txS }}>스타일</span>
                    {[{ id:"normal", label:"기본" }, { id:"stacked", label:"누적" }, { id:"group", label:"그룹" }].map(s => (
                      <span key={s.id} onClick={() => setBarStyle(s.id)} style={chipStyle(barStyle === s.id)}>{s.label}</span>
                    ))}
                  </>
                )}
                {ct === "pie" && (
                  <>
                    <span style={{ fontSize: 12, color: C.txS }}>모양</span>
                    <span onClick={() => setDonut(false)} style={chipStyle(!donut)}>파이</span>
                    <span onClick={() => setDonut(true)} style={chipStyle(donut)}>도넛</span>
                  </>
                )}
                {(ct === "bar" || ct === "grouped") && (
                  <>
                    <span style={{ fontSize: 12, color: C.txS, marginLeft: 8 }}>집계</span>
                    {[{ id:"count", label:"건수" }, { id:"sum", label:"합계" }, { id:"mean", label:"평균" }, { id:"max", label:"최댓값" }, { id:"min", label:"최솟값" }].map(m => (
                      <span key={m.id} onClick={() => setBarMode(m.id)} style={chipStyle(barMode === m.id)}>{m.label}</span>
                    ))}
                    <span style={{ fontSize: 12, color: C.txS, marginLeft: 8 }}>값표시</span>
                    <span onClick={() => setShowLabel(p => !p)} style={chipStyle(showLabel)}>{showLabel ? "켜짐" : "꺼짐"}</span>
                  </>
                )}
              </div>
              {/* 옵션 행 2: 공통 - 높이/축 */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", paddingTop: 8, borderTop: "0.5px solid " + C.bd }}>
                <span style={{ fontSize: 12, color: C.txS }}>그래프 높이</span>
                {[{ v:1, label:"기본" }, { v:1.5, label:"1.5배 크게" }].map(h => (
                  <span key={h.v} onClick={() => setChartH(h.v)} style={chipStyle(chartH === h.v)}>{h.label}</span>
                ))}
                {ct !== "pie" && (
                  <>
                    <span style={{ fontSize: 12, color: C.txS, marginLeft: 8 }}>축</span>
                    <span onClick={() => setAutoAxis(false)} style={chipStyle(!autoAxis)}>전체</span>
                    <span onClick={() => setAutoAxis(true)} style={chipStyle(autoAxis)}>값 중심</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 차트 결과 */}
          <ChartCard title={CHART_TYPES.find(t => t.id===ct)?.label || ""} subtitle="컬럼을 선택하면 차트가 표시됩니다">
            {ct==="bar"     && catCol  ? <CustomBarChart     ds={ds} col={catCol} mode={barMode} barStyle={barStyle} showLabel={showLabel} chartH={chartH} autoAxis={autoAxis}/> : null}
            {ct==="pie"     && catCol  ? <CustomPieChart     ds={ds} col={catCol} donut={donut} chartH={chartH}/> : null}
            {ct==="hist"    && xCol    ? <CustomHistChart    ds={ds} col={xCol} hueCol={hueCol} chartH={chartH} autoAxis={autoAxis}/> : null}
            {ct==="scatter" && xCol && yCol && xCol!==yCol ? <CustomScatterChart ds={ds} xCol={xCol} yCol={yCol} hueCol={hueCol} chartH={chartH} autoAxis={autoAxis}/> : null}
            {ct==="line"    && xCol && yCol ? <CustomLineChart   ds={ds} xCol={xCol} yCol={yCol} hueCol={hueCol} chartH={chartH} autoAxis={autoAxis}/> : null}
            {ct==="grouped" && catCol && numCol ? <CustomGroupedBar ds={ds} catCol={catCol} numCol={numCol} mode={barMode} showLabel={showLabel} chartH={chartH} autoAxis={autoAxis}/> : null}
            {ct==="box"     && xCol    ? <CustomBoxPlot     ds={ds} col={xCol} groupCol={catCol || ""} chartH={chartH}/> : null}
            {!(
              (ct==="bar"&&catCol)||(ct==="pie"&&catCol)||(ct==="hist"&&xCol)||
              (ct==="scatter"&&xCol&&yCol&&xCol!==yCol)||(ct==="line"&&xCol&&yCol)||
              (ct==="grouped"&&catCol&&numCol)||(ct==="box"&&xCol)
            ) && <div style={{ padding: 32, textAlign: "center", color: C.txT, fontSize: 13 }}>위에서 컬럼을 선택해 주세요.</div>}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
