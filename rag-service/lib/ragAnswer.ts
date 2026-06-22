import OpenAI from "openai";
import type { RetrievedChunk, WelfareConditions } from "../types/rag";

export function buildConditionQuery(question = "", conditions: WelfareConditions = {}) {
  return [question, conditions.region, conditions.age && `${conditions.age}세`, conditions.householdType, conditions.incomeRange, conditions.interest, conditions.disability, conditions.pregnancyOrBirth, conditions.currentSituation].filter(Boolean).join(" ");
}

export async function generateRagAnswer(apiKey: string, chunks: RetrievedChunk[], question: string) {
  if (chunks.length < 1) return "검색된 근거가 부족합니다. 공식 복지 포털 또는 담당 기관에서 조건을 다시 확인해 주세요.";
  const client = new OpenAI({ apiKey });
  const context = chunks.map((chunk, i) => `[${i + 1}] ${chunk.title} / ${chunk.section}\n${chunk.content}`).join("\n\n");
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "검색 근거만 사용해 한국어로 답하세요. 신청 가능 확정 표현은 금지하고 신청 가능성이 있습니다/확인이 필요합니다로 표현하세요. 추천 혜택, 추천 근거, 추가 확인 조건, 신청 방법, 필요서류, 쉬운 말 안내, 검색 근거, 공식 확인 안내 섹션을 포함하세요. 개인정보 입력을 요구하지 마세요." },
      { role: "user", content: `질문: ${question}\n\n검색 근거:\n${context}` },
    ],
    temperature: 0.2,
  });
  return response.choices[0]?.message.content || "검색된 근거가 부족합니다.";
}
