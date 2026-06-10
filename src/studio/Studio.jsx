import { useState, useRef, useCallback, useMemo, useEffect } from "react";

export const APP_VERSION = "v1.4.0";
export const APP_BUILD   = "2026-06-10";
import { C } from "../constants";
import { parseFile, makeDataset } from "../utils/dataUtils";
import { FileCard }          from "./FileCard";
import { MergePanel, UnionPanel } from "./MergeUnion";
import { DataInfoTab }       from "./DataInfoTab";
import { SummaryTab }        from "./SummaryTab";
import { PreprocessTab }     from "./PreprocessTab";
import { VizTab }            from "./VizTab";
import { EDATab }            from "./EDATab";
import { MLTab }             from "./MLTab";
import { DBTab }             from "./DBTab";

const TAB_KEY = "ds_active_tab";

// ── 샘플 데이터 (카페 매출) ────────────────────────────────────────────────────
const SAMPLE_ROWS = [
  {날짜:"2024-01-08",요일:"월",메뉴:"아메리카노",카테고리:"음료",수량:18,단가:4000,매출:72000,날씨:"맑음"},
  {날짜:"2024-01-08",요일:"월",메뉴:"카페라떼",카테고리:"음료",수량:12,단가:4500,매출:54000,날씨:"맑음"},
  {날짜:"2024-01-08",요일:"월",메뉴:"크로아상",카테고리:"베이커리",수량:7,단가:3500,매출:24500,날씨:"맑음"},
  {날짜:"2024-01-09",요일:"화",메뉴:"아메리카노",카테고리:"음료",수량:22,단가:4000,매출:88000,날씨:"흐림"},
  {날짜:"2024-01-09",요일:"화",메뉴:"바닐라라떼",카테고리:"음료",수량:9,단가:5000,매출:45000,날씨:"흐림"},
  {날짜:"2024-01-09",요일:"화",메뉴:"머핀",카테고리:"베이커리",수량:11,단가:3000,매출:33000,날씨:"흐림"},
  {날짜:"2024-01-10",요일:"수",메뉴:"아메리카노",카테고리:"음료",수량:20,단가:4000,매출:80000,날씨:"맑음"},
  {날짜:"2024-01-10",요일:"수",메뉴:"카페라떼",카테고리:"음료",수량:14,단가:4500,매출:63000,날씨:"맑음"},
  {날짜:"2024-01-10",요일:"수",메뉴:"샌드위치",카테고리:"푸드",수량:6,단가:5500,매출:33000,날씨:"맑음"},
  {날짜:"2024-01-11",요일:"목",메뉴:"아메리카노",카테고리:"음료",수량:16,단가:4000,매출:64000,날씨:"비"},
  {날짜:"2024-01-11",요일:"목",메뉴:"핫초코",카테고리:"음료",수량:13,단가:4500,매출:58500,날씨:"비"},
  {날짜:"2024-01-11",요일:"목",메뉴:"크로아상",카테고리:"베이커리",수량:5,단가:3500,매출:17500,날씨:"비"},
  {날짜:"2024-01-12",요일:"금",메뉴:"아메리카노",카테고리:"음료",수량:25,단가:4000,매출:100000,날씨:"맑음"},
  {날짜:"2024-01-12",요일:"금",메뉴:"카페라떼",카테고리:"음료",수량:18,단가:4500,매출:81000,날씨:"맑음"},
  {날짜:"2024-01-12",요일:"금",메뉴:"바닐라라떼",카테고리:"음료",수량:11,단가:5000,매출:55000,날씨:"맑음"},
  {날짜:"2024-01-12",요일:"금",메뉴:"머핀",카테고리:"베이커리",수량:14,단가:3000,매출:42000,날씨:"맑음"},
  {날짜:"2024-01-13",요일:"토",메뉴:"아메리카노",카테고리:"음료",수량:30,단가:4000,매출:120000,날씨:"맑음"},
  {날짜:"2024-01-13",요일:"토",메뉴:"카페라떼",카테고리:"음료",수량:24,단가:4500,매출:108000,날씨:"맑음"},
  {날짜:"2024-01-13",요일:"토",메뉴:"샌드위치",카테고리:"푸드",수량:10,단가:5500,매출:55000,날씨:"맑음"},
  {날짜:"2024-01-13",요일:"토",메뉴:"크로아상",카테고리:"베이커리",수량:9,단가:3500,매출:31500,날씨:"맑음"},
  {날짜:"2024-01-14",요일:"일",메뉴:"아메리카노",카테고리:"음료",수량:28,단가:4000,매출:112000,날씨:"흐림"},
  {날짜:"2024-01-14",요일:"일",메뉴:"바닐라라떼",카테고리:"음료",수량:15,단가:5000,매출:75000,날씨:"흐림"},
  {날짜:"2024-01-14",요일:"일",메뉴:"핫초코",카테고리:"음료",수량:10,단가:4500,매출:45000,날씨:"흐림"},
  {날짜:"2024-01-14",요일:"일",메뉴:"샌드위치",카테고리:"푸드",수량:8,단가:5500,매출:44000,날씨:"흐림"},
  {날짜:"2024-01-15",요일:"월",메뉴:"아메리카노",카테고리:"음료",수량:19,단가:4000,매출:76000,날씨:"맑음"},
  {날짜:"2024-01-15",요일:"월",메뉴:"카페라떼",카테고리:"음료",수량:10,단가:4500,매출:45000,날씨:"맑음"},
  {날짜:"2024-01-15",요일:"월",메뉴:"머핀",카테고리:"베이커리",수량:8,단가:3000,매출:24000,날씨:"맑음"},
];

export default function DataStudioApp({ onBack = null }) {
  const [datasets,       setDatasets]       = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [dragOver,       setDragOver]       = useState(false);
  const [summaryResults, setSummaryResults] = useState([]);

  // ✅ activeTab도 sessionStorage로 영속화 — 리마운트 시 복원
  const [activeTab, setActiveTab] = useState(() => {
    try { return sessionStorage.getItem(TAB_KEY) || "files"; } catch { return "files"; }
  });

  const inputRef = useRef();

  // activeTab 변경 시 sessionStorage에 저장
  const changeTab = useCallback((tab) => {
    try { sessionStorage.setItem(TAB_KEY, tab); } catch {}
    setActiveTab(tab);
  }, []);

  const handleFiles = useCallback(async (files) => {
    if (!files.length) return;
    setLoading(true);
    const results = [];
    for (const file of files) {
      try {
        results.push(await parseFile(file));
      } catch (e) {
        alert(file.name + " 파싱 실패: " + e.message);
      }
    }
    if (results.length) {
      setDatasets(prev => [...prev, ...results]);
      changeTab("files");
    }
    setLoading(false);
  }, [changeTab]);

  const onDrop = useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files)
      .filter(f => /\.(csv|xlsx|xls)$/i.test(f.name));
    if (files.length) handleFiles(files);
  }, [handleFiles]);

  const allDs = useMemo(
    () => [...datasets, ...summaryResults],
    [datasets, summaryResults]
  );

  const handleUpdate = useCallback((updated, mode) => {
    if (mode === "add") {
      setDatasets(p => [...p, updated]);
    } else {
      setDatasets(p => p.map(d => d.id === updated.id ? updated : d));
    }
  }, []);

  const hasData = datasets.length > 0;

  const loadSampleData = useCallback(() => {
    const ds = makeDataset(crypto.randomUUID(), "카페_샘플데이터", SAMPLE_ROWS);
    setDatasets(prev => [...prev, ds]);
    changeTab("files");
  }, [changeTab]);

  const NAV_TABS = [
    { id: "files",   label: "① 데이터 확인",  count: allDs.length },
    { id: "info",    label: "② 데이터 정보",   disabled: !hasData },
    { id: "prep",    label: "③ 전처리",        disabled: !hasData },
    { id: "summary", label: "④ 요약·집계",    disabled: !hasData },
    { id: "viz",     label: "⑤ 📊 차트",      disabled: !hasData },
    { id: "eda",     label: "⑥ ✨ AI 분석",    disabled: !hasData },
    { id: "db",      label: "⑦ 🗄️ SQL",        disabled: !hasData },
    { id: "ml",      label: "⑧ 🤖 예측모델",   disabled: !hasData },
    { id: "merge",   label: "파일 합치기" },
  ];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "var(--font-sans)" }}>

      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        {onBack && (
          <button
            type="button"
            onClick={e => { e.preventDefault(); e.stopPropagation(); onBack(); }}
            style={{
              fontSize: 12, fontWeight: 500, cursor: "pointer", marginBottom: 14,
              background: "transparent", border: "1px solid var(--color-border-secondary)",
              borderRadius: "var(--border-radius-md)", padding: "5px 12px",
              color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 5,
            }}
          >
            ← 메인으로
          </button>
        )}
        <h1 style={{ fontSize: 22, fontWeight: 500, color: C.tx, margin: "0 0 4px" }}>📊 Data Studio</h1>
        <p style={{ fontSize: 13, color: C.txS, margin: 0 }}>
          CSV / Excel · Merge · Union · 전처리 · 요약 · 시각화 · EDA · ML/DL
        </p>
      </div>

      {/* 업로드 영역 */}
      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
        style={{
          border: "1.5px dashed " + (dragOver ? C.infoTx : C.bdS),
          borderRadius: "var(--border-radius-lg)",
          padding: "22px 20px", textAlign: "center", cursor: "pointer",
          background: dragOver ? C.info : C.bgS,
          transition: "all 0.15s", marginBottom: 18,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls"
          onChange={e => { handleFiles(Array.from(e.target.files)); e.target.value = ""; }}
          style={{ display: "none" }}
        />
        <div style={{ fontSize: 20, marginBottom: 6 }}>📂</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.tx, marginBottom: 3 }}>
          파일을 드래그하거나 클릭하여 업로드
        </div>
        <div style={{ fontSize: 12, color: C.txS }}>
          CSV · Excel (.xlsx, .xls) · 여러 파일 동시 가능
        </div>
      </div>

      {!hasData && !loading && (
        <div style={{ textAlign: "center", marginTop: -10, marginBottom: 14 }}>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); loadSampleData(); }}
            style={{
              fontSize: 12, color: C.infoTx, background: "transparent", border: "none",
              cursor: "pointer", padding: "4px 8px", textDecoration: "underline",
            }}
          >
            🎁 파일이 없으신가요? 샘플 데이터로 시작하기
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 14, color: C.txS, fontSize: 14 }}>
          파일 분석 중...
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 18,
        borderBottom: "0.5px solid " + C.bd, overflowX: "auto",
      }}>
        {NAV_TABS.map(t => (
          <button
            type="button"
            key={t.id}
            onClick={() => !t.disabled && changeTab(t.id)}
            disabled={t.disabled}
            style={{
              fontSize: 13, padding: "9px 12px",
              cursor: t.disabled ? "not-allowed" : "pointer",
              background: "transparent", border: "none",
              borderBottom: activeTab === t.id ? "2px solid " + C.infoTx : "2px solid transparent",
              color: t.disabled ? C.txT : activeTab === t.id ? C.infoTx : C.txS,
              fontWeight: activeTab === t.id ? 500 : 400,
              display: "flex", alignItems: "center", gap: 5,
              marginBottom: -0.5, opacity: t.disabled ? 0.4 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{
                fontSize: 11, padding: "1px 6px", borderRadius: 10,
                background: activeTab === t.id ? C.info : C.bgS,
                color: activeTab === t.id ? C.infoTx : C.txS,
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* 빈 상태 */}
      {!hasData && !loading && activeTab !== "merge" && (
        <div style={{
          textAlign: "center", padding: "48px 24px", color: C.txT, fontSize: 14,
          border: "0.5px solid " + C.bd, borderRadius: "var(--border-radius-lg)",
        }}>
          파일을 업로드해 주세요.
        </div>
      )}

      {/* Merge / Union */}
      {activeTab === "merge" && (
        <div>
          {datasets.length === 0 && (
            <div style={{
              textAlign: "center", padding: "32px", color: C.txT, fontSize: 13,
              border: "0.5px solid " + C.bd, borderRadius: "var(--border-radius-lg)", marginBottom: 14,
            }}>
              파일을 업로드하면 Merge / Union을 진행할 수 있습니다.
            </div>
          )}
          {datasets.length === 1 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                padding: "12px 16px", background: C.info,
                borderRadius: "var(--border-radius-md)", fontSize: 13,
                color: C.infoTx, marginBottom: 10,
              }}>
                파일 1개 업로드됨 — 파일을 추가해 Merge / Union을 진행하세요.
              </div>
              <FileCard dataset={datasets[0]} isMergeResult={false} onRemove={() => setDatasets([])} />
            </div>
          )}
          {datasets.length >= 2 && (
            <MergePanel datasets={datasets} onResult={r => {
              setDatasets(p => [...p, r]); changeTab("files");
            }} />
          )}
          {datasets.length >= 2 && (
            <UnionPanel datasets={datasets} onResult={r => {
              setDatasets(p => [...p, r]); changeTab("files");
            }} />
          )}
        </div>
      )}

      {/* 파일 목록 */}
      {activeTab === "files" && allDs.map(ds => (
        <FileCard
          key={ds.id}
          dataset={ds}
          isMergeResult={!!ds.isMerged}
          onRemove={() => {
            setDatasets(p => p.filter(d => d.id !== ds.id));
            setSummaryResults(p => p.filter(d => d.id !== ds.id));
          }}
        />
      ))}

      {activeTab === "info"    && hasData && <DataInfoTab datasets={allDs} onUpdate={handleUpdate} />}
      {activeTab === "summary" && hasData && <SummaryTab  datasets={allDs} onResult={r => setSummaryResults(p => [...p, r])} />}
      {activeTab === "prep"    && hasData && <PreprocessTab datasets={datasets} onUpdate={d => setDatasets(p => p.map(x => x.id === d.id ? d : x))} />}
      {activeTab === "db"      && hasData && <DBTab   allDs={allDs} />}
      {activeTab === "viz"     && hasData && <VizTab  allDs={allDs} />}
      {activeTab === "eda"     && hasData && <EDATab  allDs={allDs} summaryResults={summaryResults} />}
      {activeTab === "ml"      && hasData && <MLTab   allDs={allDs} apiKey={sessionStorage.getItem("openrouter_key") || ""} />}

      {/* 버전 정보 */}
      <div style={{
        marginTop: 32, paddingTop: 12,
        borderTop: "0.5px solid " + C.bd,
        display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 11, color: C.txT, fontFamily: "var(--font-mono)" }}>
          Data Studio {APP_VERSION}
        </span>
        <span style={{ fontSize: 10, color: C.txT }}>·</span>
        <span style={{ fontSize: 11, color: C.txT }}>
          인코딩 자동 감지 (UTF-8 / EUC-KR)
        </span>
        <span style={{ fontSize: 10, color: C.txT }}>·</span>
        <span style={{ fontSize: 11, color: C.txT, fontFamily: "var(--font-mono)" }}>
          {APP_BUILD}
        </span>
      </div>
    </div>
  );
}
