import { safeError } from "../../../../rag-service/lib/db";
import { ingestFile, previewFile } from "../../../../rag-service/lib/ingest";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("파일을 첨부하세요.");
    const mode = String(form.get("mode") || "ingest");
    if (mode === "preview") return Response.json({ ok: true, ...(await previewFile(file)) });
    const databaseUrl = String(form.get("databaseUrl") || "");
    const openaiApiKey = String(form.get("openaiApiKey") || "");
    const embeddingModel = String(form.get("embeddingModel") || "text-embedding-3-small");
    const result = await ingestFile(databaseUrl, openaiApiKey, embeddingModel, file);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ ok: false, message: "파일 처리에 실패했습니다. 파일 형식, API Key, DB 테이블 생성 여부를 확인하세요.", detail: safeError(error) }, { status: 400 });
  }
}
