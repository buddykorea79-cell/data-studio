import { useState, useRef, useCallback, useMemo, useEffect } from "react";

export const APP_VERSION = "v0.22";
export const APP_BUILD   = "2026-06-12";
import { C } from "../constants";
import { parseFile, makeDataset } from "../utils/dataUtils";
import { FileCard }          from "./FileCard";
import { MergePanel, UnionPanel, StartRowPanel } from "./MergeUnion";
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

  const NAV_STEPS = [
    { id: "files",   num: "1", icon: "📁", label: "데이터 확인", count: allDs.length },
    { id: "info",    num: "2", icon: "🔎", label: "데이터 정보", disabled: !hasData },
    { id: "prep",    num: "3", icon: "🧹", label: "전처리",      disabled: !hasData },
    { id: "summary", num: "4", icon: "Σ",  label: "요약·집계",  disabled: !hasData },
    { id: "viz",     num: "5", icon: "📊", label: "차트",        disabled: !hasData },
    { id: "eda",     num: "6", icon: "✨", label: "AI 분석",     disabled: !hasData },
    { id: "db",      num: "7", icon: "🗄️", label: "SQL",         disabled: !hasData },
    { id: "ml",      num: "8", icon: "🤖", label: "예측모델",    disabled: !hasData },
  ];
  const NAV_TOOLS = [
    { id: "merge", icon: "⊕", label: "파일 합치기" },
  ];
  const currentNav = [...NAV_STEPS, ...NAV_TOOLS].find(t => t.id === activeTab);

  const NavItem = ({ t }) => (
    <button
      type="button"
      className={"ds-nav-item" + (activeTab === t.id ? " active" : "")}
      onClick={() => !t.disabled && changeTab(t.id)}
      disabled={t.disabled}
    >
      <span style={{ width: 18, textAlign: "center", fontSize: 13, flexShrink: 0 }}>{t.icon}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
        {t.num && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginRight: 6, opacity: 0.55 }}>{t.num}</span>}
        {t.label}
      </span>
      {t.count !== undefined && t.count > 0 && (
        <span style={{
          fontSize: 11, padding: "0px 6px", borderRadius: 10, flexShrink: 0,
          background: activeTab === t.id ? "var(--color-brand)" : C.bgT,
          color: activeTab === t.id ? "#fff" : C.txS,
          fontWeight: 600,
        }}>{t.count}</span>
      )}
    </button>
  );

  return (
    <div className="ds-shell" style={{ fontFamily: "var(--font-sans)" }}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls"
        onChange={e => { handleFiles(Array.from(e.target.files)); e.target.value = ""; }}
        style={{ display: "none" }}
      />

      {/* ── 사이드바 */}
      <aside className="ds-sidebar">
        <div className="ds-side-head" style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: "16px 16px 12px", borderBottom: "1px solid " + C.bd,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            background: "var(--color-brand)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700,
          }}>D</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.tx, lineHeight: 1.2 }}>Data Studio</div>
            <div style={{ fontSize: 10, color: C.txT, fontFamily: "var(--font-mono)" }}>{APP_VERSION}</div>
          </div>
        </div>

        <div className="ds-nav-group">분석 단계</div>
        {NAV_STEPS.map(t => <NavItem key={t.id} t={t} />)}
        <div className="ds-nav-group">도구</div>
        {NAV_TOOLS.map(t => <NavItem key={t.id} t={t} />)}

        <div className="ds-side-foot" style={{ marginTop: "auto", padding: "12px 8px 14px", borderTop: "1px solid " + C.bd }}>
          {onBack && (
            <button
              type="button"
              className="ds-nav-item"
              onClick={e => { e.preventDefault(); e.stopPropagation(); onBack(); }}
            >
              <span style={{ width: 18, textAlign: "center" }}>←</span>
              <span>메인으로</span>
            </button>
          )}
          <div className="ds-foot-meta" style={{ fontSize: 10, color: C.txT, padding: "8px 18px 0", lineHeight: 1.6 }}>
            인코딩 자동 감지<br/>UTF-8 / EUC-KR · {APP_BUILD}
          </div>
        </div>
      </aside>

      {/* ── 메인 영역 */}
      <div
        className="ds-main"
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
      >
        {/* 드래그 오버레이 */}
        {dragOver && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none",
            background: "var(--color-brand-soft)",
            border: "2px dashed var(--color-brand)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              background: C.bg, borderRadius: "var(--border-radius-lg)",
              padding: "18px 32px", boxShadow: "var(--shadow-md)",
              fontSize: 15, fontWeight: 600, color: "var(--color-brand-strong)",
            }}>
              📂 파일을 놓아 업로드
            </div>
          </div>
        )}

        {/* 상단 바 */}
        <header className="ds-topbar">
          <div style={{ fontSize: 14, fontWeight: 600, color: C.tx, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span>{currentNav?.icon}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentNav?.label || "Data Studio"}</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {loading && <span style={{ fontSize: 12, color: C.txS }}>파일 분석 중...</span>}
            {!hasData && !loading && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); loadSampleData(); }}
                style={{
                  fontSize: 12, fontWeight: 500, cursor: "pointer", padding: "6px 12px",
                  borderRadius: "var(--border-radius-md)", border: "1px solid " + C.bdS,
                  background: "transparent", color: C.txS, whiteSpace: "nowrap",
                }}
              >
                🎁 샘플 데이터
              </button>
            )}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
              style={{
                fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "6px 14px",
                borderRadius: "var(--border-radius-md)", border: "none",
                background: "var(--color-brand)", color: "#fff", whiteSpace: "nowrap",
              }}
            >
              ⬆ 파일 업로드
            </button>
          </div>
        </header>

        <div className="ds-content">

      {/* 빈 상태 */}
      {!hasData && !loading && activeTab !== "merge" && (
        <div
          onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
          style={{
            textAlign: "center", padding: "72px 24px", cursor: "pointer",
            border: "1.5px dashed " + C.bdS, borderRadius: "var(--border-radius-xl)",
            background: C.bgS, transition: "all 0.15s",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 14 }}>📂</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.tx, marginBottom: 6 }}>
            파일을 드래그하거나 클릭하여 업로드
          </div>
          <div style={{ fontSize: 13, color: C.txS, marginBottom: 20 }}>
            CSV · Excel (.xlsx, .xls) · 여러 파일 동시 가능
          </div>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); loadSampleData(); }}
            style={{
              fontSize: 13, fontWeight: 500, color: "var(--color-brand-strong)",
              background: "var(--color-brand-soft)", border: "none",
              cursor: "pointer", padding: "8px 18px", borderRadius: "var(--border-radius-md)",
            }}
          >
            🎁 파일이 없으신가요? 샘플 데이터로 시작하기
          </button>
        </div>
      )}

      {/* Merge / Union */}
      {activeTab === "merge" && (
        <div>
          {datasets.length >= 1 && (
            <StartRowPanel
              datasets={datasets}
              onUpdate={d => setDatasets(p => p.map(x => x.id === d.id ? d : x))}
            />
          )}
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
            <MergePanel datasets={datasets} onResult={(r, removeIds = []) => {
              setDatasets(p => [...p.filter(d => !removeIds.includes(d.id)), r]); changeTab("files");
            }} />
          )}
          {datasets.length >= 2 && (
            <UnionPanel datasets={datasets} onResult={(r, removeIds = []) => {
              setDatasets(p => [...p.filter(d => !removeIds.includes(d.id)), r]); changeTab("files");
            }} />
          )}
        </div>
      )}

      {/* 파일 목록 */}
      {activeTab === "files" && hasData && (
        <div
          onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
          style={{
            border: "1px dashed " + C.bdS, borderRadius: "var(--border-radius-lg)",
            padding: "10px 16px", textAlign: "center", cursor: "pointer",
            fontSize: 12, color: C.txS, background: C.bgS, marginBottom: 14,
          }}
        >
          ⊕ 파일 추가 — 드래그하거나 클릭하여 업로드
        </div>
      )}
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
      {activeTab === "db"      && hasData && <DBTab   allDs={allDs} onAddDataset={ds => { setDatasets(p => [...p, ds]); changeTab("files"); }} />}
      {activeTab === "viz"     && hasData && <VizTab  allDs={allDs} />}
      {activeTab === "eda"     && hasData && <EDATab  allDs={allDs} summaryResults={summaryResults} />}
      {activeTab === "ml"      && hasData && <MLTab   allDs={allDs} apiKey={sessionStorage.getItem("openrouter_key") || ""} />}

        </div>
      </div>
    </div>
  );
}
