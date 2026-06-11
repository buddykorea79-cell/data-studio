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

// ── Polynomial Feature Expansion (degree 2) ───────────────────────────────────
export function polyFeatures(X) {
  return X.map(xi => {
    const out = [...xi];
    for (let i = 0; i < xi.length; i++)
      for (let j = i; j < xi.length; j++)
        out.push(xi[i] * xi[j]);
    return out;
  });
}

// ── Lasso Regression (L1, subgradient descent) ────────────────────────────────
export function lassoRegression(X, y, lambda = 0.05) {
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
    for (let j = 0; j < m; j++) {
      const sg = w[j] > 1e-8 ? 1 : w[j] < -1e-8 ? -1 : 0;
      w[j] -= lr * (dw[j] / n + lambda * sg);
    }
    b -= lr * db / n;
    if (ep % 80 === 0) losses.push({ epoch: ep, loss: +(loss / n).toFixed(4) });
  }
  const preds = X.map(xi => xi.reduce((s, x, j) => s + x * w[j], b));
  const ssRes = y.reduce((s, yi, i) => s + (yi - preds[i]) ** 2, 0);
  const mean = y.reduce((a, b) => a + b, 0) / n;
  const ssTot = y.reduce((s, yi) => s + (yi - mean) ** 2, 0);
  return { w, b, preds, r2: +(1 - ssRes / (ssTot || 1)).toFixed(4), rmse: +Math.sqrt(ssRes / n).toFixed(4), losses };
}

// ── Internal: Decision Tree Builder (shared by random forest) ─────────────────
function _buildDTree(rows, labels, isReg, maxDepth, minSamp, featRatio) {
  const majority = arr => {
    if (isReg) return arr.reduce((a, b) => a + b, 0) / arr.length;
    const f = {}; arr.forEach(v => { f[v] = (f[v] || 0) + 1; });
    return Object.entries(f).sort((a, b) => b[1] - a[1])[0][0];
  };
  const impurity = arr => {
    if (isReg) {
      const m = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length || 1);
    }
    const n = arr.length; if (!n) return 0;
    const f = {}; arr.forEach(v => { f[v] = (f[v] || 0) + 1; });
    return 1 - Object.values(f).reduce((s, c) => s + (c / n) ** 2, 0);
  };
  const build = (rows, labels, d) => {
    if (d >= maxDepth || rows.length < minSamp ||
        (!isReg && new Set(labels).size <= 1) ||
        (isReg && impurity(labels) < 1e-10))
      return { leaf: true, val: majority(labels) };
    let bG = -Infinity, bF = -1, bT = 0;
    const pImp = impurity(labels);
    const nF = Math.max(1, Math.floor(rows[0].length * featRatio));
    const featIdx = Array.from({ length: rows[0].length }, (_, i) => i)
      .sort(() => Math.random() - 0.5).slice(0, nF);
    for (const fi of featIdx) {
      const vals = [...new Set(rows.map(r => r[fi]))].sort((a, b) => a - b);
      for (let vi = 0; vi < vals.length - 1; vi++) {
        const t = (vals[vi] + vals[vi + 1]) / 2;
        const lI = [], rI = [];
        rows.forEach((r, i) => (r[fi] <= t ? lI : rI).push(i));
        if (!lI.length || !rI.length) continue;
        const g = pImp - (lI.length / rows.length) * impurity(lI.map(i => labels[i]))
                       - (rI.length / rows.length) * impurity(rI.map(i => labels[i]));
        if (g > bG) { bG = g; bF = fi; bT = t; }
      }
    }
    if (bF < 0) return { leaf: true, val: majority(labels) };
    const lI = rows.map((r, i) => r[bF] <= bT ? i : -1).filter(i => i >= 0);
    const rI = rows.map((r, i) => r[bF] > bT ? i : -1).filter(i => i >= 0);
    return {
      feat: bF, thresh: bT,
      left: build(lI.map(i => rows[i]), lI.map(i => labels[i]), d + 1),
      right: build(rI.map(i => rows[i]), rI.map(i => labels[i]), d + 1),
    };
  };
  return build(rows, labels, 0);
}

function _predictDTree(tree, xi) {
  if (tree.leaf) return tree.val;
  return xi[tree.feat] <= tree.thresh ? _predictDTree(tree.left, xi) : _predictDTree(tree.right, xi);
}

// ── Random Forest Regression ──────────────────────────────────────────────────
export function randomForestRegression(XTr, yTr, nTrees = 12, maxDepth = 5) {
  const n = XTr.length;
  const trees = Array.from({ length: nTrees }, () => {
    const idx = Array.from({ length: n }, () => Math.floor(Math.random() * n));
    return _buildDTree(idx.map(i => XTr[i]), idx.map(i => yTr[i]), true, maxDepth, 3, 0.7);
  });
  const predict = xi => {
    const ps = trees.map(t => _predictDTree(t, xi));
    return ps.reduce((a, b) => a + b, 0) / ps.length;
  };
  const preds = XTr.map(predict);
  const ssRes = yTr.reduce((s, yi, i) => s + (yi - preds[i]) ** 2, 0);
  const mean = yTr.reduce((a, b) => a + b, 0) / n;
  const ssTot = yTr.reduce((s, yi) => s + (yi - mean) ** 2, 0);
  return { predict, r2: +(1 - ssRes / (ssTot || 1)).toFixed(4), rmse: +Math.sqrt(ssRes / n).toFixed(4), losses: [] };
}

// ── Random Forest Classification ──────────────────────────────────────────────
export function randomForestClassification(XTr, yTr, classes, nTrees = 12, maxDepth = 5) {
  const n = XTr.length;
  const trees = Array.from({ length: nTrees }, () => {
    const idx = Array.from({ length: n }, () => Math.floor(Math.random() * n));
    return _buildDTree(idx.map(i => XTr[i]), idx.map(i => yTr[i]), false, maxDepth, 3, 0.7);
  });
  const predict = xi => {
    const votes = {};
    trees.forEach(t => { const p = _predictDTree(t, xi); votes[p] = (votes[p] || 0) + 1; });
    return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
  };
  const preds = XTr.map(predict);
  const acc = +(preds.filter((p, i) => p === yTr[i]).length / n * 100).toFixed(2);
  const cm = {};
  classes.forEach(a => { cm[a] = {}; classes.forEach(b => { cm[a][b] = 0; }); });
  yTr.forEach((actual, i) => { if (cm[actual]) cm[actual][preds[i]] = (cm[actual][preds[i]] || 0) + 1; });
  return { predict, preds, acc, cm, losses: [] };
}

// ── Gaussian Naive Bayes ──────────────────────────────────────────────────────
export function naiveBayes(XTr, yTr, classes) {
  const m = XTr[0].length;
  const params = {};
  classes.forEach(cls => {
    const idx = yTr.reduce((a, v, i) => (v === cls ? [...a, i] : a), []);
    const subset = idx.map(i => XTr[i]);
    const cnt = subset.length || 1;
    const prior = cnt / yTr.length;
    const means = Array.from({ length: m }, (_, j) =>
      subset.reduce((s, r) => s + r[j], 0) / cnt
    );
    const vars = Array.from({ length: m }, (_, j) => {
      const mu = means[j];
      return Math.max(1e-9, subset.reduce((s, r) => s + (r[j] - mu) ** 2, 0) / cnt);
    });
    params[cls] = { prior, means, vars };
  });
  const predict = xi => {
    let bestCls = classes[0], bestLog = -Infinity;
    classes.forEach(cls => {
      const { prior, means, vars } = params[cls];
      let logP = Math.log(prior + 1e-10);
      for (let j = 0; j < m; j++) {
        const diff = xi[j] - means[j];
        logP -= 0.5 * Math.log(2 * Math.PI * vars[j]) + diff * diff / (2 * vars[j]);
      }
      if (logP > bestLog) { bestLog = logP; bestCls = cls; }
    });
    return bestCls;
  };
  const preds = XTr.map(predict);
  const acc = +(preds.filter((p, i) => p === yTr[i]).length / yTr.length * 100).toFixed(2);
  const cm = {};
  classes.forEach(a => { cm[a] = {}; classes.forEach(b => { cm[a][b] = 0; }); });
  yTr.forEach((actual, i) => { if (cm[actual]) cm[actual][preds[i]] = (cm[actual][preds[i]] || 0) + 1; });
  return { predict, preds, acc, cm, losses: [], importance: Array(m).fill(0).map((_, j) => ({ name: `f${j}`, importance: 0 })) };
}

// ── Linear SVM (OVR, hinge loss via SGD) ─────────────────────────────────────
export function linearSVM(X, y, classes, C_param = 1.0) {
  const n = X.length, m = X[0].length;
  const models = {}, losses = [];
  classes.forEach(cls => {
    const yb = y.map(v => v === cls ? 1 : -1);
    let w = new Array(m).fill(0), b = 0;
    const lr0 = 0.1;
    for (let ep = 0; ep < 500; ep++) {
      const lr = lr0 / (1 + 0.01 * ep);
      let dw = new Array(m).fill(0), db = 0, loss = 0;
      for (let i = 0; i < n; i++) {
        const margin = yb[i] * (X[i].reduce((s, x, j) => s + x * w[j], b));
        if (margin < 1) {
          loss += 1 - margin;
          for (let j = 0; j < m; j++) dw[j] -= C_param * yb[i] * X[i][j];
          db -= C_param * yb[i];
        }
      }
      for (let j = 0; j < m; j++) w[j] -= lr * (w[j] / n + dw[j] / n);
      b -= lr * db / n;
      if (cls === classes[0] && ep % 50 === 0) losses.push({ epoch: ep, loss: +(loss / n).toFixed(4) });
    }
    models[cls] = { w, b };
  });
  const predict = xi => {
    let bestCls = classes[0], bestScore = -Infinity;
    classes.forEach(cls => {
      const score = xi.reduce((s, x, j) => s + x * models[cls].w[j], models[cls].b);
      if (score > bestScore) { bestScore = score; bestCls = cls; }
    });
    return bestCls;
  };
  const preds = X.map(predict);
  const acc = +(preds.filter((p, i) => p === y[i]).length / n * 100).toFixed(2);
  const importance = Array.from({ length: m }, (_, j) =>
    classes.reduce((s, cls) => s + Math.abs(models[cls].w[j]), 0) / classes.length
  );
  const cm = {};
  classes.forEach(a => { cm[a] = {}; classes.forEach(b => { cm[a][b] = 0; }); });
  y.forEach((actual, i) => { if (cm[actual]) cm[actual][preds[i]] = (cm[actual][preds[i]] || 0) + 1; });
  return { predict, preds, acc, cm, importance, losses };
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

// ── DBSCAN Clustering ─────────────────────────────────────────────────────────
export function dbscan(X, eps = 0.5, minPts = 3) {
  const n = X.length;
  const dist2 = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
  const eps2 = eps * eps;
  const labels = new Array(n).fill(-2);
  let clusterId = 0;
  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2) continue;
    const nb = X.map((_, j) => j).filter(j => j !== i && dist2(X[i], X[j]) <= eps2);
    if (nb.length < minPts) { labels[i] = -1; continue; }
    labels[i] = clusterId;
    const queue = [...nb];
    const visited = new Set([i, ...nb]);
    while (queue.length) {
      const q = queue.shift();
      if (labels[q] === -1) labels[q] = clusterId;
      if (labels[q] !== -2) continue;
      labels[q] = clusterId;
      const qNb = X.map((_, j) => j).filter(j => !visited.has(j) && dist2(X[q], X[j]) <= eps2);
      qNb.forEach(j => visited.add(j));
      if (qNb.length >= minPts) queue.push(...qNb);
    }
    clusterId++;
  }
  const nClusters = clusterId;
  const noise = labels.filter(l => l === -1).length;
  const sizes = Array.from({ length: nClusters }, (_, ci) => labels.filter(l => l === ci).length);
  return { labels, nClusters, noise, sizes, losses: [] };
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

// ── Autocorrelation Function (ACF) ────────────────────────────────────────────
export function autocorrelation(data, maxLag = 20) {
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const variance = data.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  if (variance < 1e-10) return [];
  return Array.from({ length: Math.min(maxLag, Math.floor(n / 2)) }, (_, k) => {
    const lag = k + 1;
    const cov = data.slice(0, n - lag).reduce((s, v, i) => s + (v - mean) * (data[i + lag] - mean), 0) / n;
    return { lag, acf: +(cov / variance).toFixed(4) };
  });
}

// ── Anomaly Detection (IQR + Z-score) ────────────────────────────────────────
export function detectAnomalies(data) {
  const n = data.length;
  const sorted = [...data].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const lowerIQR = q1 - 1.5 * iqr;
  const upperIQR = q3 + 1.5 * iqr;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(data.reduce((s, v) => s + (v - mean) ** 2, 0) / n) || 1;
  const outliers = data.map((v, i) => ({
    i, v,
    isIQR: v < lowerIQR || v > upperIQR,
    zScore: +((v - mean) / std).toFixed(3),
  })).filter(d => d.isIQR || Math.abs(d.zScore) > 3);
  return { outliers, lowerIQR: +lowerIQR.toFixed(3), upperIQR: +upperIQR.toFixed(3),
    mean: +mean.toFixed(3), std: +std.toFixed(3), q1: +q1.toFixed(3), q3: +q3.toFixed(3),
    chartData: data.map((v, i) => ({
      i, raw: v,
      upper: +upperIQR.toFixed(3),
      lower: +lowerIQR.toFixed(3),
      isAnomaly: v < lowerIQR || v > upperIQR || Math.abs((v - mean) / std) > 3,
    })),
  };
}

// ── Rolling Statistics ────────────────────────────────────────────────────────
export function rollingStats(data, window = 7) {
  return data.map((v, i) => {
    if (i < window - 1) return { i, raw: v, mean: null, std: null, min: null, max: null };
    const slice = data.slice(i - window + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / window;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / window);
    return {
      i, raw: v,
      mean: +mean.toFixed(3),
      std: +std.toFixed(3),
      min: +Math.min(...slice).toFixed(3),
      max: +Math.max(...slice).toFixed(3),
    };
  });
}

// ── Holt-Winters Triple Exponential Smoothing ─────────────────────────────────
export function holtWinters(data, season = 7, alpha = 0.3, beta = 0.1, gamma = 0.3, nForecast = 10) {
  const n = data.length;
  if (n < season * 2) return null;
  const L = new Array(n).fill(0);
  const T = new Array(n).fill(0);
  const S = new Array(n + season).fill(1);
  // Init: average of first season
  const grandMean = data.slice(0, season).reduce((a, b) => a + b, 0) / season || 1;
  for (let i = 0; i < season; i++) S[i] = data[i] / grandMean;
  L[season - 1] = grandMean;
  const trend0 = (data[Math.min(season * 2 - 1, n - 1)] - data[0]) / (season - 1 || 1);
  T[season - 1] = trend0 / season;
  for (let t = season; t < n; t++) {
    const prevL = L[t - 1], prevT = T[t - 1];
    const prevS = S[t - season] || 1;
    L[t] = alpha * (data[t] / prevS) + (1 - alpha) * (prevL + prevT);
    T[t] = beta * (L[t] - prevL) + (1 - beta) * prevT;
    S[t] = gamma * (data[t] / (L[t] || 1)) + (1 - gamma) * prevS;
  }
  const fitted = data.map((_, t) => {
    if (t < season) return null;
    return +((L[t - 1] + T[t - 1]) * (S[t - season] || 1)).toFixed(3);
  });
  const forecasts = Array.from({ length: nForecast }, (_, h) => {
    const si = (n - season + h) % season;
    return +((L[n - 1] + (h + 1) * T[n - 1]) * (S[n - season + si] || 1)).toFixed(3);
  });
  const residuals = data.slice(season).map((v, i) => fitted[i + season] !== null ? v - fitted[i + season] : 0);
  const rmse = +Math.sqrt(residuals.reduce((s, v) => s + v * v, 0) / (residuals.length || 1)).toFixed(4);
  const chartData = [
    ...data.map((v, i) => ({ i, raw: v, fitted: fitted[i] })),
    ...forecasts.map((v, h) => ({ i: n + h, forecast: v })),
  ];
  return { fitted, forecasts, chartData, season, rmse, alpha, beta, gamma };
}

// ── Seasonal Decomposition (Additive) ────────────────────────────────────────
export function seasonalDecompose(data, period) {
  const n = data.length;
  if (n < period * 2) return null;
  const half = Math.floor(period / 2);
  const trend = data.map((_, i) => {
    if (i < half || i >= n - half) return null;
    const w = data.slice(i - half, i + half + 1);
    return +(w.reduce((a, b) => a + b, 0) / w.length).toFixed(3);
  });
  const seasonalAvg = new Array(period).fill(0);
  const counts = new Array(period).fill(0);
  data.forEach((v, i) => {
    if (trend[i] !== null) { seasonalAvg[i % period] += v - trend[i]; counts[i % period]++; }
  });
  const seasonalComp = seasonalAvg.map((s, i) => +(s / (counts[i] || 1)).toFixed(3));
  const chartData = data.map((v, i) => ({
    i, raw: v,
    trend: trend[i],
    seasonal: +seasonalComp[i % period].toFixed(3),
    residual: trend[i] !== null ? +(v - trend[i] - seasonalComp[i % period]).toFixed(3) : null,
  }));
  return { trend, seasonalComp, chartData, period };
}

// ── Detect Dominant Seasonality Period via ACF ────────────────────────────────
export function detectSeasonality(data, maxPeriod = 30) {
  const acf = autocorrelation(data, maxPeriod);
  if (acf.length < 3) return 7;
  for (let i = 1; i < acf.length - 1; i++) {
    if (acf[i].acf > acf[i - 1].acf && acf[i].acf > acf[i + 1].acf && acf[i].acf > 0.25)
      return acf[i].lag;
  }
  return 7;
}

// ── Gemini API call (legacy, kept for compatibility) ──────────────────────────
export async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
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
