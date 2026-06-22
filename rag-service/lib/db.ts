import pg from "pg";

const { Client } = pg;

export async function withPgClient<T>(databaseUrl: string, action: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl, ssl: databaseUrl.includes("supabase") ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  try { return await action(client); } finally { await client.end(); }
}

export function toSqlVector(values: number[]): string {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

export function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-database-url]").replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-openai-key]");
  return "알 수 없는 오류가 발생했습니다.";
}
