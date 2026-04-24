import { useState, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { C, PALETTE } from "../constants";
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

function CustomBarChart({ ds, col, mode, barStyle, showLabel }) {
  const data = aggData(ds.rows, col, mode !== "count" ? null : null, mode);
  if (!data.length) return <NoData />;
  if (barStyle === "stacked" || barStyle === "group") {
    const top5 = data.slice(0, 5);
    // stacked/group by top categories: each row is a "group" col value, bars = top5 categories
    const allCats = [...new Set(ds.rows.map(r => String(r[col] ?? "")))].slice(0, 6);
    const pivotData = allCats.map(cat => {
      const obj = { name: cat };
      allCats.forEach(c2 => { obj[c2] = ds.rows.filter(r => String(r[col] ?? "") === c2).length; });
      return { name: cat, value: ds.rows.filter(r => String(r[col] ?? "") === cat).length };
    });
    return (
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: showLabel ? 60 : 36, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={90} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
          <Bar dataKey="value" name={mode} radius={[0, 3, 3, 0]} label={showLabel ? { position: "right", fontSize: 10, fill: C.txS } : false}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: showLabel ? 60 : 36, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={90} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
        <Bar dataKey="value" name={mode} radius={[0, 3, 3, 0]} label={showLabel ? { position: "right", fontSize: 10, fill: C.txS } : false}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CustomGroupedBar({ ds, catCol, numCol, mode, showLabel }) {
  const data = aggData(ds.rows, catCol, numCol, mode || "mean");
  if (!data.length) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: showLabel ? 60 : 40, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={90} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} formatter={v => [v, mode]} />
        <Bar dataKey="value" name={mode} radius={[0, 3, 3, 0]} label={showLabel ? { position: "right", fontSize: 10, fill: C.txS } : false}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CustomPieChart({ ds, col, donut }) {
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
    <ResponsiveContainer width="100%" height={270}>
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

function CustomHistChart({ ds, col, hueCol }) {
  const allVals = ds.rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
  if (!allVals.length) return <NoData />;
  const mn = Math.min(...allVals), mx = Math.max(...allVals), w = (mx - mn) / 20 || 1;
  if (!hueCol) {
    const counts = Array.from({ length: 20 }, (_, i) => ({ x: +(mn + i * w).toFixed(2), count: 0 }));
    allVals.forEach(v => { counts[Math.min(Math.floor((v - mn) / w), 19)].count++; });
    return (
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={counts} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
          <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.txS }} label={{ value: col, position: "insideBottom", offset: -14, fontSize: 10, fill: C.txS }} />
          <YAxis tick={{ fontSize: 10, fill: C.txS }} />
          <Tooltip formatter={v => [v, "빈도"]} contentStyle={{ fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.bd}` }} />
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

function CustomScatterChart({ ds, xCol, yCol, hueCol }) {
  const hueVals = hueCol ? [...new Set(ds.rows.map(r => String(r[hueCol] ?? "")))].slice(0, 8) : ["all"];
  const getRows = hv => ds.rows.filter(r => !hueCol || String(r[hueCol] ?? "") === hv).map(r => ({ x: parseFloat(r[xCol]), y: parseFloat(r[yCol]) })).filter(p => !isNaN(p.x) && !isNaN(p.y)).slice(0, 400);
  const n = ds.rows.length;
  const sx = ds.rows.map(r => parseFloat(r[xCol])).filter(v => !isNaN(v));
  const sy = ds.rows.map(r => parseFloat(r[yCol])).filter(v => !isNaN(v));
  const mxv = sx.reduce((a, b) => a + b, 0) / sx.length, myv = sy.reduce((a, b) => a + b, 0) / sy.length;
  const num = sx.reduce((s, v, i) => s + (v - mxv) * ((sy[i] || 0) - myv), 0);
  const den = Math.sqrt(sx.reduce((s, v) => s + (v - mxv) ** 2, 0) * sy.reduce((s, v) => s + (v - myv) ** 2, 0));
  const r = den ? +(num / den).toFixed(3) : 0;
  return (
    <div>
      <div style={{ fontSize: 11, color: C.txS, marginBottom: 6 }}>상관계수 r = <strong style={{ color: Math.abs(r) > 0.7 ? "#1D9E75" : Math.abs(r) > 0.4 ? "#BA7517" : C.tx }}>{r}</strong></div>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
          <XAxis type="number" dataKey="x" name={xCol} tick={{ fontSize: 10, fill: C.txS }} label={{ value: xCol, position: "insideBottom", offset: -14, fontSize: 10, fill: C.txS }} />
          <YAxis type="number" dataKey="y" name={yCol} tick={{ fontSize: 10, fill: C.txS }} />
          <Tooltip content={({ payload }) => payload?.length ? <div style={{ background: C.bg, border: `0.5px solid ${C.bd}`, borderRadius: 6, padding: "5px 8px", fontSize: 11 }}>{hueCol && <div>{hueCol}: {payload[0]?.payload?.hue}</div>}<div>{xCol}: {payload[0]?.payload?.x}</div><div>{yCol}: {payload[0]?.payload?.y}</div></div> : null} />
          {hueVals.map((hv, i) => <Scatter key={hv} name={hv === "all" ? `${xCol} × ${yCol}` : hv} data={getRows(hv).map(p => ({ ...p, hue: hv }))} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.55} r={3} />)}
          {hueCol && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomLineChart({ ds, xCol, yCol, hueCol }) {
  if (!hueCol) {
    const data = ds.rows.map(r => ({ x: String(r[xCol] ?? ""), y: parseFloat(r[yCol]) })).filter(p => p.x && !isNaN(p.y)).sort((a, b) => a.x.localeCompare(b.x)).slice(0, 500);
    if (!data.length) return <NoData />;
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
          <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.txS }} interval="preserveStartEnd" label={{ value: xCol, position: "insideBottom", offset: -16, fontSize: 10, fill: C.txS }} />
          <YAxis tick={{ fontSize: 10, fill: C.txS }} />
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

function CustomBoxPlot({ ds, col, groupCol }) {
  const calcBox = vals => {
    if (!vals.length) return null;
    const s = [...vals].sort((a, b) => a - b);
    const q1 = s[Math.floor(s.length * 0.25)];
    const median = s[Math.floor(s.length * 0.5)];
    const q3 = s[Math.floor(s.length * 0.75)];
    const iqr = q3 - q1;
    const lo = Math.max(s[0], q1 - 1.5 * iqr);
    const hi = Math.min(s[s.length - 1], q3 + 1.5 * iqr);
    return { lo, q1, median, q3, hi, min: s[0], max: s[s.length - 1] };
  };
  const groups = groupCol
    ? [...new Set(ds.rows.map(r => String(r[groupCol] ?? "")))].slice(0, 12)
    : ["전체"];
  const data = groups.map(g => {
    const vals = ds.rows.filter(r => !groupCol || String(r[groupCol] ?? "") === g).map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    const box = calcBox(vals);
    if (!box) return null;
    return { name: g, lo: +box.lo.toFixed(3), q1: +(box.q1 - box.lo).toFixed(3), med: +(box.median - box.q1).toFixed(3), q3: +(box.q3 - box.median).toFixed(3), hi: +(box.hi - box.q3).toFixed(3), _q1: box.q1, _med: box.median, _q3: box.q3, _lo: box.lo, _hi: box.hi };
  }).filter(Boolean);
  if (!data.length) return <NoData />;
  return (
    <div>
      <div style={{ fontSize: 11, color: C.txS, marginBottom: 6 }}>박스: Q1~Q3 범위 · 선: 중앙값 · 수염: 1.5×IQR</div>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 50, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.bd} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: C.txS }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.txS }} width={80} />
          <Tooltip content={({ payload, label }) => payload?.length ? <div style={{ background: C.bg, border: `0.5px solid ${C.bd}`, borderRadius: 6, padding: "7px 10px", fontSize: 11 }}><div style={{ fontWeight: 500, marginBottom: 4 }}>{label}</div><div>최솟값: {payload[0]?.payload?._lo}</div><div>Q1: {payload[0]?.payload?._q1}</div><div>중앙값: {payload[0]?.payload?._med}</div><div>Q3: {payload[0]?.payload?._q3}</div><div>최댓값: {payload[0]?.payload?._hi}</div></div> : null} />
          <Bar dataKey="lo" stackId="box" fill="transparent" />
          <Bar dataKey="q1" stackId="box" fill="#B5D4F4" name="Q1-Q3" />
          <Bar dataKey="med" stackId="box" fill="#185FA5" name="중앙값" />
          <Bar dataKey="q3" stackId="box" fill="#B5D4F4" />
          <Bar dataKey="hi" stackId="box" fill="transparent" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
