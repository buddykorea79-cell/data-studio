import { useState, useCallback } from "react";
import DataStudioApp from "./datastudio/DataStudioApp";

// ── 앱 메뉴 정의 ──────────────────────────────────────────────────────────────
const APPS = [
  {
    id: "datastudio",
    icon: "📊",
    label: "Data Studio",
    desc: "CSV / Excel 파일 업로드 · 데이터 전처리 · 시각화 · Gemini EDA · ML/DL 분석",
    tags: ["파일 분석", "ML/DL", "시각화", "EDA"],
    accentColor: "#185FA5",
    accentBg: "#E6F1FB",
    ready: true,
  },
  {
    id: "lifepeople",
    icon: "🗺️",
    label: "생활인구 분석",
    desc: "서울시 생활인구 데이터 · 시간대별 · 연령별 · 행정동별 유동인구 분석",
    tags: ["시간대 분석", "연령별", "지역별"],
    accentColor: "#0F6E56",
    accentBg: "#E1F5EE",
    ready: false,
  },
  {
    id: "migration",
    icon: "🔀",
    label: "인구 이동 분석",
    desc: "지역 간 인구 이동 패턴 · 전입 / 전출 분석 · 이동 흐름 시각화",
    tags: ["전입/전출", "이동 패턴", "지역 비교"],
    accentColor: "#7F77DD",
    accentBg: "#EEEDFE",
    ready: false,
  },
];

// ── 홈 화면 ───────────────────────────────────────────────────────────────────
function HomeScreen({ onSelect }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--color-background-tertiary)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "2rem 1rem", fontFamily: "var(--font-sans)",
    }}>
      {/* 헤더 */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{
          width: 56, height: 56,
          background: "var(--color-background-primary)",
          borderRadius: "var(--border-radius-lg)",
          border: "1.5px solid var(--color-border-secondary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, margin: "0 auto 1rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}>🧭</div>
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: "0 0 8px", color: "var(--color-text-primary)" }}>
          분석 도구 모음
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0 }}>
          사용할 분석 도구를 선택하세요
        </p>
      </div>

      {/* 앱 카드 그리드 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16, width: "100%", maxWidth: 780,
      }}>
        {APPS.map(app => {
          const isHovered = hovered === app.id;
          return (
            <div
              key={app.id}
              onClick={() => app.ready && onSelect(app.id)}
              onMouseEnter={() => setHovered(app.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: "var(--color-background-primary)",
                borderRadius: "var(--border-radius-lg)",
                border: isHovered && app.ready
                  ? "2px solid " + app.accentColor
                  : "1.5px solid var(--color-border-secondary)",
                padding: "1.75rem 1.5rem",
                cursor: app.ready ? "pointer" : "default",
                transition: "all 0.18s",
                boxShadow: isHovered && app.ready
                  ? "0 6px 20px " + app.accentColor + "22"
                  : "0 1px 4px rgba(0,0,0,0.06)",
                opacity: app.ready ? 1 : 0.65,
                position: "relative",
              }}
            >
              {!app.ready && (
                <div style={{
                  position: "absolute", top: 12, right: 12,
                  fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                  background: "var(--color-background-warning)",
                  color: "var(--color-text-warning)",
                  border: "1px solid var(--color-text-warning)",
                }}>준비중</div>
              )}
              <div style={{
                width: 52, height: 52,
                background: isHovered && app.ready ? app.accentColor : app.accentBg,
                borderRadius: "var(--border-radius-md)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "1.1rem", fontSize: 24, transition: "all 0.18s",
              }}>{app.icon}</div>
              <div style={{
                fontSize: 16, fontWeight: 600, marginBottom: 6, transition: "color 0.18s",
                color: isHovered && app.ready ? app.accentColor : "var(--color-text-primary)",
              }}>{app.label}</div>
              <div style={{
                fontSize: 13, color: "var(--color-text-secondary)",
                lineHeight: 1.65, marginBottom: "1.1rem",
              }}>{app.desc}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {app.tags.map(t => (
                  <span key={t} style={{
                    fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 20,
                    background: app.accentBg, color: app.accentColor,
                    border: "1px solid " + app.accentColor + "33",
                  }}>{t}</span>
                ))}
              </div>
              {app.ready && (
                <div style={{
                  marginTop: "1.1rem", fontSize: 12, fontWeight: 600,
                  color: isHovered ? app.accentColor : "var(--color-text-tertiary)",
                  transition: "color 0.18s",
                }}>
                  {isHovered ? "→ 시작하기" : "클릭하여 시작"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "2rem", fontSize: 12, color: "var(--color-text-tertiary)", textAlign: "center" }}>
        준비중 메뉴는 순차적으로 업데이트됩니다
      </div>
    </div>
  );
}

// ── 메인 App ──────────────────────────────────────────────────────────────────
//
// ⚠️ 핵심: display 토글 방식 사용
//
// 문제: if/return 조건부 렌더링을 쓰면 앱 전환 시 컴포넌트가 언마운트(unmount)되어
//       업로드한 파일, 선택한 탭, 분석 결과 등 내부 state가 전부 초기화됩니다.
//
// 해결: 모든 앱을 항상 마운트(mount)해두고 display:none / display:block으로
//       화면 전환만 합니다. DOM은 살아있으므로 state가 완전히 보존됩니다.
//
export default function App() {
  const [currentApp, setCurrentApp] = useState(null); // null = 홈화면

  const goHome = useCallback(() => setCurrentApp(null), []);
  const goApp  = useCallback((id) => setCurrentApp(id), []);

  return (
    <div>
      {/* 홈 화면 */}
      <div style={{ display: currentApp === null ? "block" : "none" }}>
        <HomeScreen onSelect={goApp} />
      </div>

      {/* Data Studio — 항상 마운트, 숨김만 전환 */}
      <div style={{ display: currentApp === "datastudio" ? "block" : "none" }}>
        <DataStudioApp onBack={goHome} />
      </div>

      {/* 추후 앱 추가 시 아래 주석 해제 */}
      {/*
      <div style={{ display: currentApp === "lifepeople" ? "block" : "none" }}>
        <LifePeopleApp onBack={goHome} />
      </div>
      <div style={{ display: currentApp === "migration" ? "block" : "none" }}>
        <MigrationApp onBack={goHome} />
      </div>
      */}
    </div>
  );
}
