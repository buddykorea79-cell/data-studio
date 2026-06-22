import { createWelfareChunks } from "./chunk";
import { embedTexts } from "./embedding";
import { normalizeWelfareRows } from "./normalizeWelfare";
import { parseFile } from "./parseFile";
import { toSqlVector, withPgClient } from "./db";

export async function previewFile(file: File) {
  const rows = await parseFile(file);
  const docs = normalizeWelfareRows(rows, file.name);
  const chunkCount = docs.reduce((sum, doc) => sum + createWelfareChunks(doc).length, 0);
  return { documentCount: docs.length, estimatedChunkCount: chunkCount, fields: Object.keys(rows[0] || {}).slice(0, 20) };
}

export async function ingestFile(databaseUrl: string, openaiApiKey: string, embeddingModel: string, file: File) {
  const rows = await parseFile(file);
  const docs = normalizeWelfareRows(rows, file.name);
  let chunkCount = 0;
  await withPgClient(databaseUrl, async (client) => {
    await client.query("begin");
    try {
      for (const doc of docs) {
        const inserted = await client.query(
          "insert into welfare_rag_documents (source_file_name,row_index,title,provider,target,criteria,benefit,apply_method,documents,contact,url,region,category,raw) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id",
          [doc.sourceFileName, doc.rowIndex, doc.title, doc.provider, doc.target, doc.criteria, doc.benefit, doc.applyMethod, doc.documents, doc.contact, doc.url, doc.region, doc.category, doc.raw],
        );
        const chunks = createWelfareChunks(doc);
        const embeddings = await embedTexts(openaiApiKey, embeddingModel || "text-embedding-3-small", chunks.map((chunk) => chunk.content));
        for (let index = 0; index < chunks.length; index += 1) {
          const chunk = chunks[index];
          await client.query("insert into welfare_rag_chunks (document_id,content,section,metadata,embedding) values ($1,$2,$3,$4,$5::vector)", [inserted.rows[0].id, chunk.content, chunk.section, chunk.metadata, toSqlVector(embeddings[index])]);
          chunkCount += 1;
        }
      }
      await client.query("commit");
    } catch (error) { await client.query("rollback"); throw error; }
  });
  return { documentCount: docs.length, chunkCount };
}
