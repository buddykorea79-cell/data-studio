import { safeError } from "../../../../rag-service/lib/db";
import { searchRequestSchema } from "../../../../rag-service/lib/schema";
import { searchChunks } from "../../../../rag-service/lib/search";

export async function POST(request: Request) {
  try {
    const body = searchRequestSchema.parse(await request.json());
    const chunks = await searchChunks(body.databaseUrl, body.openaiApiKey, body.embeddingModel || "text-embedding-3-small", body.query);
    return Response.json({ ok: true, chunks });
  } catch (error) {
    return Response.json({ ok: false, message: "검색에 실패했습니다. 질문, API Key, DB 연결 정보를 확인하세요.", detail: safeError(error) }, { status: 400 });
  }
}
