import { useState, useCallback, useEffect } from "react";
import DataStudioApp from "./studio/Studio";

// ── 앱 메뉴 정의 ──────────────────────────────────────────────────────────────
const APPS = [
  {
    id: "edutalk",
    icon: "🎓",
    label: "EduTalk",
    desc: "AI 기반 학습 대화 플랫폼 · 질문하고 배우는 교육 챗봇",
    tags: ["AI 학습", "대화형", "교육"],
    accentColor: "#C05A00",
    accentBg: "#FFF0E0",
    ready: true,
    href: "https://buddybuddy-sle9.onrender.com/",
  },
  {
    id: "datastudio",
    icon: "📊",
    label: "Data Studio",
    desc: "CSV / Excel 파일 업로드 · 데이터 전처리 · 시각화 · AI EDA · ML/DL 분석",
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

const SESSION_KEY = "ds_current_app";

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
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{
          width: 56, height: 56,
          background: "var(--color-background-primary)",
          borderRadius: "var(--border-radius-lg)",
          border: "1.5px solid var(--color-border-secondary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, margin: "0 auto 1rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}>🛝</div>
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: "0 0 8px", color: "var(--color-text-primary)" }}>
          그냥이의 놀이터
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0 }}>
          사용할 도구를 선택하세요
        </p>
      </div>

      <div style={{
        display: "flex", flexDirection: "column",
        gap: 14, width: "100%", maxWidth: 540,
      }}>
        {APPS.map(app => {
          const isHovered = hovered === app.id;
          return (
            <div
              key={app.id}
              onClick={() => {
                if (!app.ready) return;
                if (app.href) { window.open(app.href, "_blank", "noopener,noreferrer"); return; }
                onSelect(app.id);
              }}
              onMouseEnter={() => setHovered(app.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: "var(--color-background-primary)",
                borderRadius: "var(--border-radius-lg)",
                border: isHovered && app.ready
                  ? "2px solid " + app.accentColor
                  : "1.5px solid var(--color-border-secondary)",
                padding: "1.1rem 1.4rem",
                cursor: app.ready ? "pointer" : "default",
                transition: "all 0.18s",
                boxShadow: isHovered && app.ready
                  ? "0 6px 20px " + app.accentColor + "22"
                  : "0 1px 4px rgba(0,0,0,0.06)",
                opacity: app.ready ? 1 : 0.65,
                position: "relative",
                display: "flex", alignItems: "center", gap: "1.1rem",
              }}
            >
              {!app.ready && (
                <div style={{
                  position: "absolute", top: 10, right: 12,
                  fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                  background: "var(--color-background-warning)",
                  color: "var(--color-text-warning)",
                  border: "1px solid var(--color-text-warning)",
                }}>준비중</div>
              )}
              <div style={{
                width: 48, height: 48, flexShrink: 0,
                background: isHovered && app.ready ? app.accentColor : app.accentBg,
                borderRadius: "var(--border-radius-md)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, transition: "all 0.18s",
              }}>{app.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15, fontWeight: 600, marginBottom: 3, transition: "color 0.18s",
                  color: isHovered && app.ready ? app.accentColor : "var(--color-text-primary)",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {app.label}
                  {app.href && <span style={{ fontSize: 10, color: app.accentColor, fontWeight: 400 }}>↗ 외부</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55, marginBottom: 6 }}>
                  {app.desc}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {app.tags.map(t => (
                    <span key={t} style={{
                      fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 20,
                      background: app.accentBg, color: app.accentColor,
                      border: "1px solid " + app.accentColor + "33",
                    }}>{t}</span>
                  ))}
                </div>
              </div>
              {app.ready && (
                <div style={{
                  fontSize: 18, color: isHovered ? app.accentColor : "var(--color-text-tertiary)",
                  transition: "all 0.18s", flexShrink: 0,
                  transform: isHovered ? "translateX(3px)" : "none",
                }}>→</div>
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
export default function App() {
  // ✅ 핵심 수정: sessionStorage로 currentApp 상태 영속화
  // App이 리마운트되거나 HMR이 발생해도 이전 선택이 복원됨
  const [currentApp, setCurrentApp] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) || null;
    } catch {
      return null;
    }
  });

  // currentApp 변경 시 sessionStorage에도 저장
  const goHome = useCallback(() => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    setCurrentApp(null);
  }, []);

  const goApp = useCallback((id) => {
    try { sessionStorage.setItem(SESSION_KEY, id); } catch {}
    setCurrentApp(id);
  }, []);

  return (
    <div>
      {/* 홈 화면 */}
      <div style={{ display: currentApp === null ? "block" : "none" }}>
        <HomeScreen onSelect={goApp} />
      </div>

      {/* Data Studio — 항상 마운트, display로만 전환 */}
      <div style={{ display: currentApp === "datastudio" ? "block" : "none" }}>
        <DataStudioApp onBack={goHome} />
      </div>

      {/* 추후 앱 추가 시 아래 주석 해제
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
