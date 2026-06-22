import type { RetrievedChunk } from "../types/rag";
export default function RetrievedChunkList({ chunks }: { chunks: RetrievedChunk[] }) {
  return <section aria-live="polite" className="rag-card"><h2>유사 chunk 결과</h2>{chunks.length === 0 ? <p>검색 결과가 아직 없습니다.</p> : <ol>{chunks.map((chunk) => <li key={chunk.id || `${chunk.title}-${chunk.section}`}><strong>{chunk.title}</strong> <span>({chunk.section}, 유사도 {Math.round((chunk.similarity || 0) * 100)}%)</span><p>{chunk.content}</p>{chunk.url && <p>URL: {chunk.url}</p>}</li>)}</ol>}</section>;
}
