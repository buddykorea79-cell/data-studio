# Data Studio

브라우저에서 실행되는 데이터 분석 도구입니다. 서버 없이 CSV / Excel 파일을 업로드해 전처리·시각화·AI 분석까지 진행할 수 있습니다.

## 기능

| 탭 | 설명 |
|---|---|
| Merge / Union | 파일 병합 및 수직 결합 |
| Data Info | 컬럼 타입·통계 확인 및 수정 |
| 데이터 요약 | Group By / Pivot 집계 |
| 전처리 | 결측값 처리, 컬럼 변환, 필터링 |
| DB 분석 | 브라우저 SQLite + 자연어 → SQL (OpenRouter AI) |
| 시각화 | 막대·선·파이·산점도·히트맵 등 인터랙티브 차트 |
| EDA | 자동 시각화 + Gemini AI 탐색적 분석 |
| ML/DL | 선형회귀·로지스틱회귀·K-Means·MLP 학습 |

## 파일 구조

```
src/
├── main.jsx          # 진입점
├── App.jsx           # 홈 화면 (도구 선택)
├── index.css         # 디자인 토큰 (Sage & Forest 팔레트)
├── constants.js      # 색상 상수
├── utils/
│   ├── dataUtils.js  # CSV/Excel 파싱, 인코딩 자동 감지, Join/Pivot
│   └── mlUtils.js    # ML 알고리즘, Gemini API
└── studio/
    ├── Studio.jsx    # Data Studio 메인 레이아웃 및 탭 라우터
    ├── UI.jsx        # 공통 컴포넌트 (Btn, DataTable, Section 등)
    ├── Charts.jsx    # recharts 차트 컴포넌트
    ├── FileCard.jsx  # 파일 목록 카드
    ├── MergeUnion.jsx
    ├── DataInfoTab.jsx
    ├── SummaryTab.jsx
    ├── PreprocessTab.jsx
    ├── DBTab.jsx     # sql.js + OpenRouter
    ├── VizTab.jsx
    ├── EDATab.jsx    # Gemini EDA
    └── MLTab.jsx
```

## 시작하기

```bash
npm install
npm run dev
```

> `public/sql-wasm.wasm` 파일이 있어야 DB 분석 탭이 동작합니다.
> `node_modules/sql.js/dist/sql-wasm.wasm` 을 `public/` 에 복사하세요.

## 외부 API

| 기능 | API | 키 발급 |
|---|---|---|
| EDA AI 분석 | Google Gemini | [aistudio.google.com](https://aistudio.google.com/apikey) |
| DB 자연어 쿼리 | OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) |

API 키는 브라우저 세션에만 저장되며 서버로 전송되지 않습니다.

## 기술 스택

- React 19 + Vite 8
- recharts 3 (차트)
- sql.js 1.14 (브라우저 SQLite / WebAssembly)
- xlsx (Excel 파싱)
