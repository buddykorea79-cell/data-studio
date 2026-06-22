import { safeError } from "../../../../rag-service/lib/db";
import { generateRagAnswer, buildConditionQuery } from "../../../../rag-service/lib/ragAnswer";
import { answerRequestSchema } from "../../../../rag-service/lib/schema";
import { searchChunks } from "../../../../rag-service/lib/search";

export async function POST(request: Request) {
  try {
    const body = answerRequestSchema.parse(await request.json());
    const query = buildConditionQuery(body.question || "복지 조건 추천", body.welfareConditions || {});
    const chunks = await searchChunks(body.databaseUrl, body.openaiApiKey, body.embeddingModel || "text-embedding-3-small", query, 8);
    const answer = await generateRagAnswer(body.openaiApiKey, chunks, query);
    return Response.json({ ok: true, answer, chunks });
  } catch (error) {
    return Response.json({ ok: false, message: "RAG 답변 생성에 실패했습니다. 검색 근거와 OpenAI API Key를 확인하세요.", detail: safeError(error) }, { status: 400 });
  }
}
