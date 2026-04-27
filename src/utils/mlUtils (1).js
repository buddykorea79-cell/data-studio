// ── Math helpers ──────────────────────────────────────────────────────────────
export function normalize(arr) {
  const mn = Math.min(...arr), mx = Math.max(...arr), rng = mx - mn || 1;
  return { scaled: arr.map(v => (v - mn) / rng), min: mn, max: mx, range: rng };
}
export function denorm(v, min, range) { return v * range + min; }

export function oneHot(rows, cols) {
  const maps = {};
  cols.forEach(c => { maps[c] = [...new Set(rows.map(r => String(r[c] ?? "")))].sort(); });
  return {
    maps,
    encode: row => {
      const out = {};
      cols.forEach(c => { maps[c].forEach(v => { out[`${c}_${v}`] = row[c] === v ? 1 : 0; }); });
      return out;
    },
  };
}

export function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
export function softmax(arr) {
  const mx = Math.max(...arr);
  const e = arr.map(v => Math.exp(v - mx));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / s);
}
export function relu(x) { return Math.max(0, x); }

// ── Data preparation ──────────────────────────────────────────────────────────
export function prepareFeatures(ds, featureCols, targetCol) {
  const rows = ds.rows.filter(r =>
    featureCols.every(c => r[c] !== null && r[c] !== undefined && r[c] !== "") &&
    (targetCol ? r[targetCol] !== null && r[targetCol] !== undefined && r[targetCol] !== "" : true)
  );
  const catFcols = featureCols.filter(c => {
    const t = ds.colMeta.find(m => m.name === c)?.type;
    return t === "category" || t === "text";
  });
  const numFcols = featureCols.filter(c => !catFcols.includes(c));
  const { maps, encode } = oneHot(rows, catFcols);
  const normStats = {};
  numFcols.forEach(c => {
    const vals = rows.map(r => parseFloat(r[c])).filter(v => !isNaN(v));
    normStats[c] = normalize(vals);
  });
  const X = rows.map(r => {
    const numPart = numFcols.map(c => {
      const v = parseFloat(r[c]);
      const s = normStats[c];
      return isNaN(v) ? 0 : (v - s.min) / (s.range || 1);
    });
    const ohPart = catFcols.length ? Object.values(encode(r)) : [];
    return [...numPart, ...ohPart];
  });
  const allFeatNames = [
    ...numFcols,
    ...catFcols.flatMap(c => maps[c].map(v => `${c}_${v}`)),
  ];
  const y = targetCol ? rows.map(r => r[targetCol]) : null;
  return { X, y, allFeatNames, normStats, rows };
}

export function trainTestSplit(X, y, testRatio = 0.2) {
  const n = X.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
  const splitAt = Math.floor(n * (1 - testRatio));
  const trIdx = idx.slice(0, splitAt), teIdx = idx.slice(splitAt);
  return {
    XTr: trIdx.map(i => X[i]), yTr: trIdx.map(i => y[i]),
    XTe: teIdx.map(i => X[i]), yTe: teIdx.map(i => y[i]),
  };
}

// ── Linear Regression (gradient descent) ─────────────────────────────────────
export function linearRegression(X, y) {
  const n = X.length, m = X[0].length;
  let w = new Array(m).fill(0), b = 0;
  const lr = 0.01, losses = [];
  for (let ep = 0; ep < 800; ep++) {
    let dw = new Array(m).fill(0), db = 0, loss = 0;
    for (let i = 0; i < n; i++) {
      const pred = X[i].reduce((s, x, j) => s + x * w[j], b);
      const err = pred - y[i];
      loss += err * err;
      for (let j = 0; j < m; j++) dw[j] += err * X[i][j];
      db += err;
    }
    for (let j = 0; j < m; j++) w[j] -= lr * dw[j] / n;
    b -= lr * db / n;
    if (ep % 80 === 0) losses.push({ epoch: ep, loss: +(loss / n).toFixed(4) });
  }
  const preds = X.map(xi => xi.reduce((s, x, j) => s + x * w[j], b));
  const ssRes = y.reduce((s, yi, i) => s + (yi - preds[i]) ** 2, 0);
  const ssTot = y.reduce((s, yi) => s + (yi - y.reduce((a,b) => a+b, 0)/n) ** 2, 0);
  return { w, b, preds, r2: +(1 - ssRes/(ssTot||1)).toFixed(4), rmse: +Math.sqrt(ssRes/n).toFixed(4), losses };
}

// ── Logistic Regression (One-vs-Rest) ────────────────────────────────────────
export function logisticRegression(X, y, classes) {
  const n = X.length, m = X[0].length;
  const models = {}, losses = [];
  classes.forEach(cls => {
    const yb = y.map(v => v === cls ? 1 : 0);
    let w = new Array(m).fill(0), b = 0;
    const lr = 0.1;
    for (let ep = 0; ep < 600; ep++) {
      let dw = new Array(m).fill(0), db = 0, loss = 0;
      for (let i = 0; i < n; i++) {
        const z = X[i].reduce((s, x, j) => s + x * w[j], b);
        const p = sigmoid(z);
        const err = p - yb[i];
        loss -= yb[i] * Math.log(p + 1e-9) + (1 - yb[i]) * Math.log(1 - p + 1e-9);
        for (let j = 0; j < m; j++) dw[j] += err * X[i][j];
        db += err;
      }
      for (let j = 0; j < m; j++) w[j] -= lr * dw[j] / n;
      b -= lr * db / n;
      if (cls === classes[0] && ep % 60 === 0) losses.push({ epoch: ep, loss: +(loss/n).toFixed(4) });
    }
    models[cls] = { w, b };
  });
  const preds = X.map(xi => {
    const scores = classes.map(cls => ({
      cls,
      score: sigmoid(xi.reduce((s, x, j) => s + x * models[cls].w[j], models[cls].b)),
    }));
    return scores.sort((a, b) => b.score - a.score)[0].cls;
  });
  const acc = +(preds.filter((p, i) => p === y[i]).length / n * 100).toFixed(2);
  const cm = {};
  classes.forEach(a => { cm[a] = {}; classes.forEach(b => { cm[a][b] = 0; }); });
  y.forEach((actual, i) => { if (cm[actual]) cm[actual][preds[i]] = (cm[actual][preds[i]] || 0) + 1; });
  const importance = Array.from({ length: m }, (_, j) =>
    classes.reduce((s, cls) => s + Math.abs(models[cls].w[j]), 0) / classes.length
  );
  return { preds, acc, cm, importance, losses, models };
}

// ── K-Means Clustering ────────────────────────────────────────────────────────
export function kmeans(X, k, maxIter = 100) {
  let centroids = X.slice(0, k).map(x => [...x]);
  let labels = new Array(X.length).fill(0);
  const losses = [];
  for (let it = 0; it < maxIter; it++) {
    labels = X.map(xi => {
      let best = 0, bestD = Infinity;
      centroids.forEach((c, ci) => {
        const d = xi.reduce((s, v, j) => s + (v - c[j]) ** 2, 0);
        if (d < bestD) { bestD = d; best = ci; }
      });
      return best;
    });
    const newC = Array.from({ length: k }, () => new Array(X[0].length).fill(0));
    const cnt = new Array(k).fill(0);
    X.forEach((xi, i) => { xi.forEach((v, j) => { newC[labels[i]][j] += v; }); cnt[labels[i]]++; });
    let moved = false;
    newC.forEach((c, ci) => {
      if (cnt[ci] > 0) {
        const nc = c.map(v => v / cnt[ci]);
        if (nc.some((v, j) => Math.abs(v - centroids[ci][j]) > 1e-6)) moved = true;
        centroids[ci] = nc;
      }
    });
    const inertia = X.reduce((s, xi, i) =>
      s + xi.reduce((ss, v, j) => ss + (v - centroids[labels[i]][j]) ** 2, 0), 0
    );
    if (it % 10 === 0) losses.push({ iter: it, inertia: +inertia.toFixed(2) });
    if (!moved) break;
  }
  return { labels, centroids, sizes: Array.from({ length: k }, (_, ci) => labels.filter(l => l === ci).length), losses };
}

// ── MLP Neural Network ────────────────────────────────────────────────────────
export function mlp(X, y, classes, hiddenSizes = [16, 8], lr = 0.05, epochs = 300) {
  const nIn = X[0].length, nOut = classes.length;
  const layers = [nIn, ...hiddenSizes, nOut];
  const W = [], B = [];
  for (let l = 0; l < layers.length - 1; l++) {
    const scale = Math.sqrt(2 / layers[l]);
    W.push(Array.from({ length: layers[l+1] }, () =>
      Array.from({ length: layers[l] }, () => (Math.random() * 2 - 1) * scale)
    ));
    B.push(new Array(layers[l+1]).fill(0));
  }
  const yIdx = y.map(v => classes.indexOf(v));
  const losses = [];
  for (let ep = 0; ep < epochs; ep++) {
    let totalLoss = 0;
    const idx = Array.from({ length: X.length }, (_, i) => i).sort(() => Math.random() - 0.5);
    for (const i of idx) {
      const xi = X[i], yi = yIdx[i];
      const acts = [xi];
      for (let l = 0; l < W.length; l++) {
        const prev = acts[l];
        const z = W[l].map((wRow, j) => wRow.reduce((s, w, k) => s + w * prev[k], B[l][j]));
        acts.push(l < W.length - 1 ? z.map(relu) : softmax(z));
      }
      const out = acts[acts.length - 1];
      totalLoss -= Math.log(out[yi] + 1e-9);
      let delta = out.map((v, j) => v - (j === yi ? 1 : 0));
      for (let l = W.length - 1; l >= 0; l--) {
        const prev = acts[l];
        const newDelta = new Array(layers[l]).fill(0);
        for (let j = 0; j < layers[l+1]; j++) {
          for (let k = 0; k < layers[l]; k++) {
            W[l][j][k] -= lr * delta[j] * prev[k];
            newDelta[k] += delta[j] * W[l][j][k];
          }
          B[l][j] -= lr * delta[j];
        }
        delta = l > 0 ? newDelta.map((v, k) => v * (acts[l][k] > 0 ? 1 : 0)) : newDelta;
      }
    }
    if (ep % 30 === 0) losses.push({ epoch: ep, loss: +(totalLoss / X.length).toFixed(4) });
  }
  const preds = X.map(xi => {
    let a = xi;
    for (let l = 0; l < W.length; l++) {
      const z = W[l].map((wRow, j) => wRow.reduce((s, w, k) => s + w * a[k], B[l][j]));
      a = l < W.length - 1 ? z.map(relu) : softmax(z);
    }
    return classes[a.indexOf(Math.max(...a))];
  });
  const acc = +(preds.filter((p, i) => p === y[i]).length / X.length * 100).toFixed(2);
  const cm = {};
  classes.forEach(a => { cm[a] = {}; classes.forEach(b => { cm[a][b] = 0; }); });
  y.forEach((actual, i) => { if (cm[actual]) cm[actual][preds[i]] = (cm[actual][preds[i]] || 0) + 1; });
  return { preds, acc, cm, losses, W, B };
}

// ── Gemini API call ───────────────────────────────────────────────────────────
// 🚨 모델명을 현재 서비스 중인 최신 경량 모델(gemini-3.1-flash-lite-preview)로 변경
export async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "응답이 없습니다.";
}
