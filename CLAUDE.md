# Data Studio

React 19 + Vite SPA. 클라이언트 전용 (서버 없음). 데이터 분석 도구 모음.

## 버전 규칙 (중요)

`src/studio/Studio.jsx`의 `APP_VERSION`은 **사용자가 수정 요청을 할 때마다 1씩 증가**시킨다.

- 형식: `v0.NN` (예: v0.22 → 다음 요청 시 v0.23)
- 한 요청에 커밋이 여러 개여도 버전은 +1만 올린다.
- `APP_BUILD`는 수정한 날짜(YYYY-MM-DD)로 갱신한다.

## 빌드 / 검증

```bash
npm run build   # 변경 후 반드시 빌드 확인
```

## 구조

- `src/App.jsx` — 랜딩 페이지 (그냥이의 놀이터)
- `src/studio/Studio.jsx` — Data Studio 앱 셸 (사이드바 + 탭)
- `src/studio/DBTab.jsx` — sql.js(SQLite WASM) 기반 SQL 탭, OpenRouter AI 쿼리 생성
- `src/studio/MLTab.jsx` — 회귀/분류/군집/시계열 모델 (mlUtils.js)
- `src/utils/dataUtils.js` — 파일 파싱, makeDataset/makeGridDataset, join/union/group/pivot
- 모든 데이터셋은 `makeDataset()` 형태: `{id, name, rows, columns, colMeta, rowCount}`

## Git

- 작업 브랜치: `claude/add-eda-ml-features-CH0Y8`에 푸시하되, 사용자가 배포 반영을 원하면 main에도 푸시 (사용자 승인 받음, 2026-06-12)
