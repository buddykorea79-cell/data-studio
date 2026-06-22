import type { WelfareChunk, WelfareDocument } from "../types/rag";

const compact = (parts: string[]) => parts.filter(Boolean).join("\n");

export function createWelfareChunks(doc: WelfareDocument): WelfareChunk[] {
  const base = { sourceFileName: doc.sourceFileName, rowIndex: doc.rowIndex, title: doc.title, provider: doc.provider, region: doc.region, category: doc.category, url: doc.url };
  const sections = [
    ["요약", compact([`서비스명: ${doc.title}`, `제공기관: ${doc.provider}`, `지역: ${doc.region}`, `분야: ${doc.category}`])],
    ["지원대상", doc.target], ["선정기준", doc.criteria], ["지원내용", doc.benefit],
    ["신청방법/제출서류/문의처", compact([`신청방법: ${doc.applyMethod}`, `필요서류: ${doc.documents}`, `문의처: ${doc.contact}`, `URL: ${doc.url}`])],
  ];
  return sections.filter(([, content]) => content.trim()).map(([section, content]) => ({ content: `${doc.title}\n[${section}]\n${content}`, section, metadata: { ...base, section } }));
}
