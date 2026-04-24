import * as XLSX from "xlsx";

// ── Type detection & stats ────────────────────────────────────────────────────
export function detectType(vals) {
  const nn = vals.filter(v => v !== null && v !== undefined && v !== "");
  if (!nn.length) return "empty";
  if (nn.filter(v => !isNaN(Number(v)) && v !== "").length / nn.length > 0.85) return "number";
  if (nn.filter(v => /^\d{4}[-/]\d{2}[-/]\d{2}|^\d{2}[-/]\d{2}[-/]\d{4}/.test(String(v))).length / nn.length > 0.7) return "date";
  if (new Set(nn.map(String)).size <= Math.min(20, nn.length * 0.3)) return "category";
  return "text";
}

export function computeStats(vals, type) {
  const nn = vals.filter(v => v !== null && v !== undefined && v !== "");
  const base = { count: vals.length, nullCount: vals.length - nn.length, unique: new Set(nn.map(String)).size };
  if (type === "number") {
    const nums = nn.map(Number).filter(n => !isNaN(n));
    if (!nums.length) return base;
    const sorted = [...nums].sort((a,b) => a-b);
    const sum = nums.reduce((a,b) => a+b, 0);
    const mean = sum / nums.length;
    return {
      ...base,
      min: sorted[0], max: sorted[sorted.length-1],
      mean: +mean.toFixed(4),
      median: sorted[Math.floor(sorted.length/2)],
      std: +Math.sqrt(nums.reduce((a,b) => a+(b-mean)**2, 0)/nums.length).toFixed(4),
      sum: +sum.toFixed(4),
    };
  }
  if (type === "category") {
    const freq = {};
    nn.forEach(v => { freq[String(v)] = (freq[String(v)] || 0) + 1; });
    return { ...base, topValues: Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0, 5) };
  }
  return base;
}

export function buildColMeta(rows, columns) {
  return columns.map(col => {
    const vals = rows.map(r => r[col]);
    const type = detectType(vals);
    return { name: col, type, stats: computeStats(vals, type) };
  });
}

export function makeDataset(id, name, rows, extra = {}) {
  const columns = Object.keys(rows[0] || {});
  return { id, name, rows, columns, colMeta: buildColMeta(rows, columns), rowCount: rows.length, ...extra };
}

// ── File parsing ──────────────────────────────────────────────────────────────
export function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const ext = file.name.split(".").pop().toLowerCase();
    reader.onload = e => {
      try {
        let rows = [];
        if (ext === "csv") {
          const text = typeof e.target.result === "string"
            ? e.target.result
            : new TextDecoder().decode(e.target.result);
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
          rows = lines.slice(1).map(line => {
            const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
            const row = {};
            headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
            return row;
          });
        } else {
          const wb = XLSX.read(e.target.result, { type: "array" });
          const arr = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", header: 1 });
          const headers = arr[0].map(String);
          rows = arr.slice(1).map(row => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
            return obj;
          });
        }
        resolve(makeDataset(crypto.randomUUID(), file.name, rows));
      } catch (err) { reject(err); }
    };
    if (ext === "csv") reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  });
}

export function downloadCSV(ds) {
  const header = ds.columns.join(",");
  const body = ds.rows
    .map(r => ds.columns.map(c => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([header + "\n" + body], { type: "text/csv" }));
  a.download = `${ds.name.replace(/\.[^.]+$/, "")}_export.csv`;
  a.click();
}

// ── Join / Union ──────────────────────────────────────────────────────────────
export function performJoin(L, R, lKey, rKey, jType) {
  const rMap = {};
  R.rows.forEach(row => {
    const k = String(row[rKey] ?? "");
    if (!rMap[k]) rMap[k] = [];
    rMap[k].push(row);
  });
  const rOnly = R.columns.filter(c => c !== rKey);
  const rows = [];
  const matched = new Set();

  L.rows.forEach(lRow => {
    const k = String(lRow[lKey] ?? "");
    const ms = rMap[k] || [];
    if (ms.length) {
      ms.forEach(rRow => {
        matched.add(k);
        const m = { ...lRow };
        rOnly.forEach(c => {
          const tc = L.columns.includes(c) ? `${R.name.replace(/\.[^.]+$/, "")}.${c}` : c;
          m[tc] = rRow[c];
        });
        rows.push(m);
      });
    } else if (jType === "left" || jType === "outer") {
      const m = { ...lRow };
      rOnly.forEach(c => {
        const tc = L.columns.includes(c) ? `${R.name.replace(/\.[^.]+$/, "")}.${c}` : c;
        m[tc] = null;
      });
      rows.push(m);
    }
  });

  if (jType === "right" || jType === "outer") {
    R.rows.forEach(rRow => {
      const k = String(rRow[rKey] ?? "");
      if (!matched.has(k)) {
        const m = {};
        L.columns.forEach(c => { m[c] = null; });
        rOnly.forEach(c => {
          const tc = L.columns.includes(c) ? `${R.name.replace(/\.[^.]+$/, "")}.${c}` : c;
          m[tc] = rRow[c];
        });
        m[lKey] = rRow[rKey];
        rows.push(m);
      }
    });
  }
  return makeDataset(
    crypto.randomUUID(),
    `merge_${L.name.replace(/\.[^.]+$/, "")}_${R.name.replace(/\.[^.]+$/, "")}`,
    rows, { isMerged: true }
  );
}

export function performUnion(datasets, mode) {
  const allCols = mode === "strict"
    ? datasets[0].columns.filter(c => datasets.every(d => d.columns.includes(c)))
    : [...new Set(datasets.flatMap(d => d.columns))];
  const rows = datasets.flatMap(d =>
    d.rows.map(row => {
      const r = { _source: d.name };
      allCols.forEach(c => { r[c] = row[c] ?? null; });
      return r;
    })
  );
  return makeDataset(crypto.randomUUID(), `union_${datasets.length}files`, rows, { isMerged: true });
}

// ── Group / Pivot ─────────────────────────────────────────────────────────────
export function performGroup(ds, groupCols, valCol, aggFn) {
  const map = {};
  ds.rows.forEach(row => {
    const key = groupCols.map(c => String(row[c] ?? "")).join("|||");
    if (!map[key]) { map[key] = { _vals: [] }; groupCols.forEach(c => { map[key][c] = row[c]; }); }
    const v = parseFloat(row[valCol]);
    if (!isNaN(v)) map[key]._vals.push(v);
  });
  const rows = Object.values(map).map(g => {
    const v = g._vals; let agg = 0;
    if (aggFn === "sum")   agg = v.reduce((a,b) => a+b, 0);
    else if (aggFn === "mean") agg = v.length ? +(v.reduce((a,b) => a+b, 0)/v.length).toFixed(4) : 0;
    else if (aggFn === "count") agg = v.length;
    else if (aggFn === "min") agg = v.length ? Math.min(...v) : 0;
    else if (aggFn === "max") agg = v.length ? Math.max(...v) : 0;
    const r = {};
    groupCols.forEach(c => { r[c] = g[c]; });
    r[`${aggFn}(${valCol})`] = agg;
    return r;
  });
  return makeDataset(crypto.randomUUID(), `group_${ds.name.replace(/\.[^.]+$/, "")}`, rows, { isMerged: true });
}

export function performPivot(ds, rowCol, colCol, valCol, aggFn) {
  const colVals = [...new Set(ds.rows.map(r => String(r[colCol] ?? "")).filter(Boolean))].sort();
  const map = {};
  ds.rows.forEach(row => {
    const rk = String(row[rowCol] ?? ""), ck = String(row[colCol] ?? ""), v = parseFloat(row[valCol]);
    if (!map[rk]) { map[rk] = {}; map[rk][rowCol] = rk; colVals.forEach(c => { map[rk][c] = []; }); }
    if (!isNaN(v) && map[rk][ck] !== undefined) map[rk][ck].push(v);
  });
  const agg = arr => {
    if (!arr.length) return null;
    if (aggFn === "sum")   return +arr.reduce((a,b) => a+b, 0).toFixed(4);
    if (aggFn === "mean")  return +(arr.reduce((a,b) => a+b, 0)/arr.length).toFixed(4);
    if (aggFn === "count") return arr.length;
    if (aggFn === "min")   return Math.min(...arr);
    if (aggFn === "max")   return Math.max(...arr);
    return arr.length;
  };
  const rows = Object.values(map).map(r => {
    const nr = {}; nr[rowCol] = r[rowCol];
    colVals.forEach(c => { nr[c] = agg(r[c]); });
    return nr;
  });
  return makeDataset(crypto.randomUUID(), `pivot_${ds.name.replace(/\.[^.]+$/, "")}`, rows, { isMerged: true });
}
