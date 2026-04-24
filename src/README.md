# Data Studio — 파일 구조 설명

## 폴더 구조

```
src/
├── App.jsx                    ← 메인 앱 (탭 라우팅, ~100줄)
├── constants.js               ← 색상 토큰, 팔레트, 타입 정보 (~26줄)
├── utils/
│   ├── dataUtils.js           ← 데이터 파싱/처리/Join/Union/Group/Pivot (~220줄)
│   └── mlUtils.js             ← ML 알고리즘 + Gemini API (~250줄)
└── components/
    ├── UI.jsx                 ← 공통 UI (Btn, StatCard, Section, DataTable 등) (~195줄)
    ├── MergeUnion.jsx         ← Merge / Union 패널 (~135줄)
    ├── FileCard.jsx           ← 파일 목록 카드 (~27줄)
    ├── DataInfoTab.jsx        ← Data Info 탭 (~72줄)
    ├── SummaryTab.jsx         ← Group / Pivot 탭 (~82줄)
    ├── PreprocessTab.jsx      ← 전처리 탭 (~194줄)
    ├── VizTab.jsx             ← 시각화 탭 (~335줄)
    ├── EDATab.jsx             ← Gemini EDA 탭 (~110줄)
    └── MLTab.jsx              ← ML/DL 탭 (~204줄)
```

## 설치 및 실행

```bash
# 1. Vite React 프로젝트 생성
npm create vite@latest my-data-studio -- --template react
cd my-data-studio

# 2. 패키지 설치
npm install
npm install xlsx recharts

# 3. src/ 폴더를 이 파일들로 교체

# 4. 로컬 실행
npm run dev

# 5. 빌드
npm run build
```

## CSS 변수 (src/index.css)

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--color-background-tertiary); }
:root {
  --color-background-primary:   #ffffff;
  --color-background-secondary: #f5f5f4;
  --color-background-tertiary:  #eeede9;
  --color-background-info:      #e6f1fb;
  --color-background-success:   #eaf3de;
  --color-background-warning:   #faeeda;
  --color-background-danger:    #fcebeb;
  --color-text-primary:         #1a1a18;
  --color-text-secondary:       #5f5e5a;
  --color-text-tertiary:        #b4b2a9;
  --color-text-info:            #185fa5;
  --color-text-success:         #0f6e56;
  --color-text-warning:         #ba7517;
  --color-text-danger:          #a32d2d;
  --color-border-tertiary:      rgba(0,0,0,0.10);
  --color-border-secondary:     rgba(0,0,0,0.18);
  --color-border-primary:       rgba(0,0,0,0.28);
  --border-radius-md:           8px;
  --border-radius-lg:           12px;
  --border-radius-xl:           16px;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "SF Mono", "Fira Code", Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --color-background-primary:   #1c1c1a;
    --color-background-secondary: #252523;
    --color-background-tertiary:  #2c2c2a;
    --color-background-info:      #0c2d4a;
    --color-background-success:   #0a2e22;
    --color-background-warning:   #3a2a08;
    --color-background-danger:    #3a1010;
    --color-text-primary:         #e8e7e3;
    --color-text-secondary:       #a0a09a;
    --color-text-tertiary:        #5a5a55;
    --color-text-info:            #85b7eb;
    --color-text-success:         #5dcaa5;
    --color-text-warning:         #ef9f27;
    --color-text-danger:          #f09595;
    --color-border-tertiary:      rgba(255,255,255,0.10);
    --color-border-secondary:     rgba(255,255,255,0.18);
    --color-border-primary:       rgba(255,255,255,0.28);
  }
}
```
