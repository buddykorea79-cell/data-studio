import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { safeError, withPgClient } from "../../../../rag-service/lib/db";
import { setupRequestSchema } from "../../../../rag-service/lib/schema";

export async function POST(request: Request) {
  try {
    const body = setupRequestSchema.parse(await request.json());
    const sql = await readFile(join(process.cwd(), "rag-service/sql/schema.sql"), "utf8");
    await withPgClient(body.databaseUrl, (client) => client.query(sql).then(() => undefined));
    return Response.json({ ok: true, message: "테이블과 검색 함수가 생성되었습니다." });
  } catch (error) {
    return Response.json({ ok: false, message: "테이블 생성에 실패했습니다. Connection String과 Supabase pgvector 지원 여부를 확인하세요.", detail: safeError(error) }, { status: 400 });
  }
}
