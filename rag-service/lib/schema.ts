import { z } from "zod";

export const databaseUrlSchema = z.string().trim().min(10).refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), "Postgres connection string 형식이어야 합니다.");
export const openaiApiKeySchema = z.string().trim().min(20, "OpenAI API Key를 입력하세요.");
export const embeddingModelSchema = z.string().trim().min(1).default("text-embedding-3-small");
export const tablePrefixSchema = z.string().trim().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "테이블 prefix는 영문, 숫자, 밑줄만 사용할 수 있습니다.").default("welfare_rag");

export const setupRequestSchema = z.object({ databaseUrl: databaseUrlSchema, tablePrefix: tablePrefixSchema.optional() });
export const searchRequestSchema = z.object({ databaseUrl: databaseUrlSchema, openaiApiKey: openaiApiKeySchema, embeddingModel: embeddingModelSchema.optional(), query: z.string().trim().min(2).max(2000) });
export const welfareConditionsSchema = z.object({ region: z.string().optional(), age: z.string().optional(), householdType: z.string().optional(), incomeRange: z.string().optional(), interest: z.string().optional(), disability: z.string().optional(), pregnancyOrBirth: z.string().optional(), currentSituation: z.string().optional() });
export const answerRequestSchema = z.object({ databaseUrl: databaseUrlSchema, openaiApiKey: openaiApiKeySchema, embeddingModel: embeddingModelSchema.optional(), question: z.string().trim().max(2000).optional(), welfareConditions: welfareConditionsSchema.optional() });
