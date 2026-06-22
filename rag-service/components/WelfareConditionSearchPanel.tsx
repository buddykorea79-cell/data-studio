import type { WelfareConditions } from "../types/rag";
export default function WelfareConditionSearchPanel({ value, onChange, onAnswer }: { value: WelfareConditions; onChange: (value: WelfareConditions) => void; onAnswer: () => void }) {
  const fields: [keyof WelfareConditions, string][] = [["region", "지역"], ["age", "나이"], ["householdType", "가구유형"], ["incomeRange", "소득구간"], ["interest", "관심분야"], ["disability", "장애 여부"], ["pregnancyOrBirth", "임신/출산 여부"], ["currentSituation", "현재 상황"]];
  return <section className="rag-card"><h2>6단계 복지 조건 검색</h2>{fields.map(([key, label]) => <label key={key}>{label}<input value={value[key] || ""} onChange={(e) => onChange({ ...value, [key]: e.target.value })} /></label>)}<button type="button" onClick={onAnswer}>조건 기반 추천</button></section>;
}
