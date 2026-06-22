import { embedTexts } from "./embedding";
import { toSqlVector, withPgClient } from "./db";
import type { RetrievedChunk } from "../types/rag";

export async function searchChunks(databaseUrl: string, openaiApiKey: string, embeddingModel: string, query: string, limit = 8): Promise<RetrievedChunk[]> {
  const [embedding] = await embedTexts(openaiApiKey, embeddingModel || "text-embedding-3-small", [query]);
  return withPgClient(databaseUrl, async (client) => {
    const result = await client.query("select * from match_welfare_rag_chunks($1::vector, $2, $3)", [toSqlVector(embedding), 0.15, limit]);
    return result.rows.map((row) => ({ id: row.chunk_id, documentId: row.document_id, content: row.content, section: row.section, title: row.title, provider: row.provider, region: row.region, url: row.url, similarity: Number(row.similarity), metadata: row.metadata || {} }));
  });
}
