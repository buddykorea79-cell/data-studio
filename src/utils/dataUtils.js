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

// ── CSV encoding detection ────────────────────────────────────────────────────
// strict UTF-8 파싱 실패 시 EUC-KR/CP949 fallback (한글 엑셀 기본 저장 인코딩)
function decodeCsvBuffer(buffer) {
  const bytes = new Uint8Array(buffer);

  // UTF-8 BOM (EF BB BF)
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder("utf-8").decode(bytes.slice(3));
  }

  // strict UTF-8: 유효하면 즉시 반환
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch { /* not valid UTF-8 */ }

  // EUC-KR / CP949
  try {
    return new TextDecoder("euc-kr", { fatal: true }).decode(bytes);
  } catch { /* not valid EUC-KR */ }

  // 최후 fallback
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

// CSV 파서: 따옴표 안의 쉼표/개행 처리
function parseCsvText(text) {
  const rows = [];
  let cur = "", row = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (ch === "\r") { /* skip */ }
      else cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c !== ""));
}

// ── Grid → Dataset (헤더 행 지정 가능) ────────────────────────────────────────
// grid: 2차원 배열, headerRow: 1부터 시작하는 헤더 행 번호 (데이터는 그 다음 행부터)
export function makeGridDataset(id, name, grid, headerRow = 1) {
  if (!grid.length || headerRow < 1 || headerRow > grid.length) {
    return makeDataset(id, name, [], { rawGrid: grid, headerRow });
  }
  const width = Math.max(...grid.slice(0, headerRow + 5).map(r => r.length));
  const rawNames = grid[headerRow - 1] || [];
  const seen = {};
  const headers = Array.from({ length: Math.max(width, rawNames.length) }, (_, i) => {
    let n = String(rawNames[i] ?? "").trim();
    if (!n) n = `열${i + 1}`;
    seen[n] = (seen[n] || 0) + 1;
    return seen[n] > 1 ? `${n}_${seen[n]}` : n;
  });
  const rows = grid.slice(headerRow).map(vals => {
    const o = {};
    headers.forEach((h, i) => { o[h] = vals[i] ?? ""; });
    return o;
  });
  return makeDataset(id, name, rows, { rawGrid: grid, headerRow });
}

// 이미 파싱된 데이터셋의 헤더 행을 변경 (rawGrid 보유 시에만)
export function reheaderDataset(ds, headerRow) {
  if (!ds.rawGrid) return ds;
  return makeGridDataset(ds.id, ds.name, ds.rawGrid, headerRow);
}

// ── File parsing ──────────────────────────────────────────────────────────────
export function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const ext = file.name.split(".").pop().toLowerCase();
    reader.onload = e => {
      try {
        let grid;
        if (ext === "csv") {
          const text = decodeCsvBuffer(e.target.result);
          grid = parseCsvText(text);
        } else {
          const wb = XLSX.read(e.target.result, { type: "array" });
          grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", header: 1 });
        }
        resolve(makeGridDataset(crypto.randomUUID(), file.name, grid, 1));
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsArrayBuffer(file);
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
