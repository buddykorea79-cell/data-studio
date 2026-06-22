import type { WelfareDocument } from "../types/rag";

const keys = {
  title: ["서비스명", "servNm", "serviceName", "welfSvcNm", "name", "title"],
  provider: ["소관부처명", "제공기관", "provider", "department", "jurMnofNm"],
  target: ["지원대상", "tgtrDtlCn", "supportTarget", "target"],
  criteria: ["선정기준", "slctCritCn", "selectionCriteria", "criteria"],
  benefit: ["지원내용", "alwServCn", "supportContent", "benefitContent"],
  applyMethod: ["신청방법", "aplyMtdCn", "applicationMethod", "applyMethod"],
  documents: ["제출서류", "필요서류", "sbmsnDocCn", "requiredDocuments"],
  contact: ["문의처", "inqNum", "contact", "tel"],
  url: ["서비스URL", "servDtlLink", "url", "serviceUrl"],
  region: ["지역", "시도", "시군구", "region", "ctpvNm", "sggNm"],
};

function pick(row: Record<string, unknown>, candidates: string[]): string {
  for (const key of candidates) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export function normalizeWelfareRows(rows: Record<string, unknown>[], sourceFileName: string): WelfareDocument[] {
  return rows.map((row, rowIndex) => ({
    title: pick(row, keys.title) || `복지서비스 ${rowIndex + 1}`,
    provider: pick(row, keys.provider), target: pick(row, keys.target), criteria: pick(row, keys.criteria), benefit: pick(row, keys.benefit), applyMethod: pick(row, keys.applyMethod), documents: pick(row, keys.documents), contact: pick(row, keys.contact), url: pick(row, keys.url), region: pick(row, keys.region), category: String(row.category || row.분야 || row.관심분야 || "복지"), sourceFileName, rowIndex, raw: row,
  }));
}
