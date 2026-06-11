import { useState, useCallback } from "react";
import DataStudioApp from "./studio/Studio";

// ── 앱 카탈로그 ───────────────────────────────────────────────────────────────
const APPS = [
  {
    id: "edutalk",
    status: "live",
    icon: "🎓",
    label: "EduTalk",
    category: "교육",
    tagline: "강사와 학생의 소통 플랫폼",
    desc: "바이브코딩으로 만든 교육 채팅 플랫폼. 강의실 밖에서도 강사와 학생이 자유롭게 소통하고 질문하는 공간.",
    tags: ["채팅", "교육", "소통"],
    color: "#F59E0B",
    href: "https://buddybuddy-sle9.onrender.com/",
  },
  {
    id: "datastudio",
    status: "live",
    icon: "📊",
    label: "Data Studio",
    category: "데이터 분석",
    tagline: "데이터에서 의미를 쉽게 찾는 방법",
    desc: "CSV / Excel 파일을 올리면 자동 분석, 시각화, AI 해석, ML 예측까지. 코딩 없이 데이터를 탐색하는 도구.",
    tags: ["CSV/Excel", "시각화", "ML", "AI EDA"],
    color: "#3E63DD",
  },
  {
    id: "lifepeople",
    status: "wip",
    icon: "🗺️",
    label: "생활인구 분석",
    category: "지역 분석",
    tagline: "서울시 유동인구 탐색기",
    desc: "서울시 생활인구 공공데이터를 시간대·연령대·행정동별로 탐색합니다.",
    tags: ["공공데이터", "지도", "유동인구"],
    color: "#30A46C",
  },
  {
    id: "migration",
    status: "wip",
    icon: "🔀",
    label: "인구 이동 분석",
    category: "지역 분석",
    tagline: "전입·전출 흐름 시각화",
    desc: "지역 간 인구 이동 패턴을 시각화하고 전입·전출 밸런스를 비교합니다.",
    tags: ["전입/전출", "흐름 차트", "비교"],
    color: "#8E4EC6",
  },
];

const FUTURE = [
  { icon: "🤖", label: "AI 텍스트 도구",  desc: "글쓰기·요약·번역 AI 도우미" },
  { icon: "📝", label: "폼 빌더",          desc: "드래그앤드롭 설문·폼 제작" },
  { icon: "📈", label: "주식·코인 대시보드", desc: "실시간 가격 데이터 트래커" },
];

const SESSION_KEY = "ds_current_app";

// ── 카드 컴포넌트 ─────────────────────────────────────────────────────────────
function AppCard({ app, onSelect }) {
  const [hov, setHov] = useState(false);
  const live = app.status === "live";

  const handle = () => {
    if (!live) return;
    if (app.href) window.open(app.href, "_blank", "noopener,noreferrer");
    else onSelect(app.id);
  };

  return (
    <div
      onClick={handle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative",
        background: "var(--color-background-primary)",
        border: "1px solid " + (hov && live ? app.color : "var(--color-border-tertiary)"),
        borderRadius: 12,
        padding: "24px 24px 20px",
        cursor: live ? "pointer" : "default",
        opacity: live ? 1 : 0.55,
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
        boxShadow: hov && live
          ? "0 8px 28px " + app.color + "1A, 0 2px 8px " + app.color + "10"
          : "0 1px 4px rgba(0,0,0,0.04)",
        transform: hov && live ? "translateY(-2px)" : "none",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* 상태 뱃지 */}
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 6, alignItems: "center" }}>
        {live ? (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
            background: "var(--color-background-success)", color: "var(--color-text-success)",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-text-success)", display: "inline-block" }}/>
            라이브
          </span>
        ) : (
          <span style={{
            fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20,
            background: "var(--color-background-tertiary)", color: "var(--color-text-tertiary)",
          }}>준비 중</span>
        )}
        {app.href && (
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>↗</span>
        )}
      </div>

      {/* 아이콘 */}
      <div style={{
        width: 52, height: 52, borderRadius: 12, marginBottom: 16,
        background: app.color + "18",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26, transition: "background 0.15s",
        ...(hov && live ? { background: app.color + "28" } : {}),
      }}>
        {app.icon}
      </div>

      {/* 카테고리 */}
      <div style={{
        fontSize: 11, fontWeight: 600, color: app.color,
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
      }}>
        {app.category}
      </div>

      {/* 제목 + 태그라인 */}
      <div style={{
        fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 3,
        transition: "color 0.15s",
        ...(hov && live ? { color: app.color } : {}),
      }}>
        {app.label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 10 }}>
        {app.tagline}
      </div>

      {/* 설명 */}
      <div style={{
        fontSize: 13, color: "var(--color-text-tertiary)", lineHeight: 1.65, marginBottom: 18, flex: 1,
      }}>
        {app.desc}
      </div>

      {/* 태그들 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {app.tags.map(t => (
          <span key={t} style={{
            fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 6,
            background: "var(--color-background-tertiary)",
            color: "var(--color-text-secondary)",
          }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

// ── 홈 화면 ───────────────────────────────────────────────────────────────────
function HomeScreen({ onSelect }) {
  const liveApps = APPS.filter(a => a.status === "live");
  const wipApps  = APPS.filter(a => a.status === "wip");

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--color-background-primary)",
      fontFamily: "var(--font-sans)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* ── 상단 바 */}
      <header style={{
        height: 52,
        display: "flex", alignItems: "center",
        padding: "0 28px",
        borderBottom: "1px solid var(--color-border-tertiary)",
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--color-background-primary)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: "var(--color-brand)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 700,
          }}>🛝</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>
            그냥이의 놀이터
          </span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 20,
            background: "var(--color-background-tertiary)",
            color: "var(--color-text-tertiary)",
          }}>
            바이브코딩 실험실
          </span>
        </div>
      </header>

      <main style={{ flex: 1, padding: "0 28px 80px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* ── 히어로 */}
        <div style={{ padding: "72px 0 56px", borderBottom: "1px solid var(--color-border-tertiary)" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 600,
            color: "var(--color-brand-strong)",
            background: "var(--color-brand-soft)",
            padding: "5px 12px", borderRadius: 20,
            marginBottom: 22,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-brand)", display: "inline-block" }}/>
            vibe coding playground
          </div>
          <h1 style={{
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            marginBottom: 18,
            maxWidth: 640,
          }}>
            그냥이의 놀이터
          </h1>
          <p style={{
            fontSize: 17, color: "var(--color-text-secondary)",
            lineHeight: 1.7, maxWidth: 520, marginBottom: 0,
          }}>
            바이브코딩으로 이런저런 것을 만들어 보는 사이트.
            <br />
            아이디어가 생기면 일단 만들어 봅니다.
          </p>
        </div>

        {/* ── 라이브 앱 */}
        <section style={{ padding: "48px 0 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: "var(--color-text-success)",
              background: "var(--color-background-success)",
              padding: "3px 10px", borderRadius: 20,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-text-success)", display: "inline-block" }}/>
              LIVE
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>
              지금 바로 쓸 수 있는 것들
            </span>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 18,
          }}>
            {liveApps.map(app => (
              <AppCard key={app.id} app={app} onSelect={onSelect} />
            ))}
          </div>
        </section>

        {/* ── 구분선 */}
        <div style={{
          margin: "52px 0 0",
          padding: "48px 0 0",
          borderTop: "1px solid var(--color-border-tertiary)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: "var(--color-text-tertiary)",
              background: "var(--color-background-tertiary)",
              padding: "3px 10px", borderRadius: 20,
            }}>COMING SOON</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>
              만들고 있는 것들
            </span>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 18,
          }}>
            {wipApps.map(app => (
              <AppCard key={app.id} app={app} onSelect={onSelect} />
            ))}
          </div>
        </div>

        {/* ── 앞으로 섹션 */}
        <div style={{
          margin: "52px 0 0",
          padding: "48px 0 0",
          borderTop: "1px solid var(--color-border-tertiary)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: "var(--color-text-tertiary)",
              background: "var(--color-background-tertiary)",
              padding: "3px 10px", borderRadius: 20,
            }}>FUTURE</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>
              떠오르는 아이디어들
            </span>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}>
            {FUTURE.map(f => (
              <div key={f.label} style={{
                border: "1px dashed var(--color-border-secondary)",
                borderRadius: 10,
                padding: "20px 20px 18px",
                background: "var(--color-background-secondary)",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                <span style={{ fontSize: 22 }}>{f.icon}</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>{f.label}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            ))}
            {/* "아이디어 있으신가요?" 카드 */}
            <div style={{
              border: "1px dashed var(--color-border-secondary)",
              borderRadius: 10,
              padding: "20px 20px 18px",
              background: "transparent",
              display: "flex", flexDirection: "column", gap: 8,
              alignItems: "flex-start", justifyContent: "center",
            }}>
              <span style={{ fontSize: 22 }}>💬</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-tertiary)" }}>아이디어 있으신가요?</div>
              <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", lineHeight: 1.55 }}>만들어 볼 만한 것이 있으면 알려주세요.</div>
            </div>
          </div>
        </div>
      </main>

      {/* ── 푸터 */}
      <footer style={{
        borderTop: "1px solid var(--color-border-tertiary)",
        padding: "20px 28px",
        display: "flex", alignItems: "center", gap: 16,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 14 }}>🛝</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-tertiary)" }}>
            그냥이의 놀이터
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
          바이브코딩으로 세상을 조금씩 바꿔봅니다
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)" }}>
          2024 –
        </span>
      </footer>
    </div>
  );
}

// ── 메인 App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [currentApp, setCurrentApp] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) || null; } catch { return null; }
  });

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
      <div style={{ display: currentApp === null ? "block" : "none" }}>
        <HomeScreen onSelect={goApp} />
      </div>
      <div style={{ display: currentApp === "datastudio" ? "block" : "none" }}>
        <DataStudioApp onBack={goHome} />
      </div>
    </div>
  );
}
