# RAG 도전하기

해커톤 연습용/관리자 시연용 RAG 서비스입니다. 기존 앱과 분리된 `rag-service/` 폴더에 UI 컴포넌트, 파싱, 정규화, chunk, embedding, Supabase 검색, RAG 답변 로직을 둡니다.

## 보안 원칙

- Supabase Postgres Connection String과 OpenAI API Key는 저장하지 않습니다.
- 브라우저 React state와 1회성 API 요청 body에서만 사용합니다.
- localStorage, DB, `.env` 파일에 저장하지 않습니다.
- 공개 배포 환경에서는 반드시 관리자 인증과 서버 측 접근 제어를 추가해야 합니다.

## 필요한 패키지

`pg`, `openai`, `zod`, `papaparse`, `fast-xml-parser`, `@types/pg`

## 테이블 생성

1. `/rag-challenge` 화면에서 Supabase Postgres Connection String을 입력합니다.
2. “테이블 생성 실행”을 누르면 `rag-service/sql/schema.sql`이 실행됩니다.
3. SQL은 `vector` extension, documents/chunks 테이블, metadata GIN index, embedding HNSW cosine index, `match_welfare_rag_chunks` 함수를 생성합니다.

## 흐름

1. CSV, JSON, JSONL, XML, TXT 파일을 업로드합니다.
2. 파일 분석으로 문서 수, 예상 chunk 수, 필드 미리보기를 확인합니다.
3. 벡터 DB 생성 실행으로 문서를 정규화하고 서비스별 5개 섹션 chunk를 생성합니다.
4. `text-embedding-3-small` 기본 embedding을 생성하고 Supabase pgvector에 저장합니다.
5. 자연어 검색 또는 복지 조건 검색으로 유사 chunk를 조회합니다.
6. 검색 근거만 사용해 한국어 RAG 답변을 생성합니다.
