import OpenAI from "openai";

export async function embedTexts(apiKey: string, model: string, texts: string[]): Promise<number[][]> {
  const client = new OpenAI({ apiKey });
  const response = await client.embeddings.create({ model: model || "text-embedding-3-small", input: texts });
  return response.data.map((item) => item.embedding);
}
