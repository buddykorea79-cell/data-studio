import { useState } from "react";
import ConnectionPanel from "./ConnectionPanel";
import FileUploadPanel from "./FileUploadPanel";
import IngestResultPanel from "./IngestResultPanel";
import NaturalSearchPanel from "./NaturalSearchPanel";
import WelfareConditionSearchPanel from "./WelfareConditionSearchPanel";
import RetrievedChunkList from "./RetrievedChunkList";
import RagAnswerPanel from "./RagAnswerPanel";
import type { ConnectionInfo, RetrievedChunk, WelfareConditions } from "../types/rag";

const apiBase = "/api/rag-challenge";

export default function RagChallengePage() {
  const [connection, setConnection] = useState<ConnectionInfo>({ databaseUrl: "", openaiApiKey: "", embeddingModel: "text-embedding-3-small", tablePrefix: "welfare_rag" });
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [conditions, setConditions] = useState<WelfareConditions>({});
  const [chunks, setChunks] = useState<RetrievedChunk[]>([]);
  const [answer, setAnswer] = useState("");

  async function readJson(response: Response) { const data = await response.json(); if (!response.ok || data.ok === false) throw new Error(`${data.message || "요청 실패"} ${data.detail || ""}`); return data; }
  async function setup() { setBusy(true); try { const data = await readJson(await fetch(`${apiBase}/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ databaseUrl: connection.databaseUrl, tablePrefix: connection.tablePrefix }) })); setResult(`✅ ${data.message}`); } catch (error) { setResult(`❌ ${error instanceof Error ? error.message : "테이블 생성 실패"}\n해결 방법: Connection String, Supabase 권한, pgvector extension을 확인하세요.`); } finally { setBusy(false); } }
  async function preview() { if (!file) return; setBusy(true); try { const form = new FormData(); form.set("mode", "preview"); form.set("file", file); const data = await readJson(await fetch(`${apiBase}/ingest`, { method: "POST", body: form })); setResult(`✅ 감지된 문서 수: ${data.documentCount}, 예상 chunk 수: ${data.estimatedChunkCount}, 필드 미리보기: ${data.fields.join(", ")}`); } catch (error) { setResult(`❌ ${error instanceof Error ? error.message : "파일 분석 실패"}\n해결 방법: 지원 파일 형식과 인코딩을 확인하세요.`); } finally { setBusy(false); } }
  async function ingest() { if (!file) return; setBusy(true); try { const form = new FormData(); form.set("file", file); form.set("databaseUrl", connection.databaseUrl); form.set("openaiApiKey", connection.openaiApiKey); form.set("embeddingModel", connection.embeddingModel); const data = await readJson(await fetch(`${apiBase}/ingest`, { method: "POST", body: form })); setResult(`✅ 저장된 documents 수: ${data.documentCount}, chunks 수: ${data.chunkCount}`); } catch (error) { setResult(`❌ ${error instanceof Error ? error.message : "벡터 DB 생성 실패"}\n해결 방법: 테이블 생성 여부, API Key, 파일 내용을 확인하세요.`); } finally { setBusy(false); } }
  async function search() { setBusy(true); try { const data = await readJson(await fetch(`${apiBase}/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...connection, query }) })); setChunks(data.chunks); setResult(`✅ ${data.chunks.length}개 chunk를 찾았습니다.`); } catch (error) { setResult(`❌ ${error instanceof Error ? error.message : "검색 실패"}\n해결 방법: 질문과 연결 정보를 확인하세요.`); } finally { setBusy(false); } }
  async function answerWithRag() { setBusy(true); try { const data = await readJson(await fetch(`${apiBase}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...connection, question: query, welfareConditions: conditions }) })); setChunks(data.chunks); setAnswer(data.answer); setResult(`✅ RAG 답변을 생성했습니다. 근거 chunk ${data.chunks.length}개`); } catch (error) { setResult(`❌ ${error instanceof Error ? error.message : "답변 생성 실패"}\n해결 방법: 검색 근거가 충분한지 확인하세요.`); } finally { setBusy(false); } }

  return <div className="rag-page"><a className="rag-skip" href="#rag-main">본문 바로가기</a><header className="rag-header"><button type="button" onClick={() => { window.history.pushState(null, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); }}>← 홈</button><h1>RAG 도전하기</h1><p>복지서비스 파일 기반 벡터 DB 검색 실습</p></header><main id="rag-main"><section className="rag-card rag-notice"><h2>해커톤 연습용/시연용 안내</h2><p>관리자 시연용 기능입니다. 공개 배포 환경에서는 관리자 인증이 필요하며, 연결 정보와 API Key를 저장하지 않습니다.</p></section><ConnectionPanel value={connection} onChange={setConnection} onSetup={setup} /><FileUploadPanel file={file} onFile={setFile} onPreview={preview} onIngest={ingest} busy={busy} /><IngestResultPanel result={result} /><NaturalSearchPanel query={query} onQuery={setQuery} onSearch={search} /><WelfareConditionSearchPanel value={conditions} onChange={setConditions} onAnswer={answerWithRag} /><RetrievedChunkList chunks={chunks} /><RagAnswerPanel answer={answer} /></main></div>;
}
