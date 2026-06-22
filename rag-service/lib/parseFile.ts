import Papa from "papaparse";
import { XMLParser } from "fast-xml-parser";

function flatten(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) return input.flatMap(flatten);
  if (input && typeof input === "object") {
    const values = Object.values(input as Record<string, unknown>);
    const arrayValue = values.find(Array.isArray);
    if (arrayValue) return flatten(arrayValue);
    return [input as Record<string, unknown>];
  }
  return [];
}

export async function parseFile(file: File): Promise<Record<string, unknown>[]> {
  const text = await file.text();
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
    if (parsed.errors.length) throw new Error(`CSV 파싱 오류: ${parsed.errors[0].message}`);
    return parsed.data;
  }
  if (name.endsWith(".jsonl")) return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
  if (name.endsWith(".json")) return flatten(JSON.parse(text));
  if (name.endsWith(".xml")) return flatten(new XMLParser({ ignoreAttributes: false }).parse(text));
  if (name.endsWith(".txt")) return text.split(/\n\s*\n/).map((paragraph, index) => ({ title: `텍스트 문서 ${index + 1}`, 지원내용: paragraph.trim() })).filter((row) => row.지원내용);
  throw new Error("지원하지 않는 파일 형식입니다. CSV, JSON, JSONL, XML, TXT 파일을 사용하세요.");
}
