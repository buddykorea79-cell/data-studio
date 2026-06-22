export type ConnectionInfo = {
  databaseUrl: string;
  openaiApiKey: string;
  embeddingModel: string;
  tablePrefix: string;
};

export type WelfareDocument = {
  id?: string;
  title: string;
  provider: string;
  target: string;
  criteria: string;
  benefit: string;
  applyMethod: string;
  documents: string;
  contact: string;
  url: string;
  region: string;
  category: string;
  sourceFileName: string;
  rowIndex: number;
  raw: Record<string, unknown>;
};

export type WelfareChunk = {
  documentId?: string;
  content: string;
  section: string;
  metadata: Record<string, unknown>;
};

export type WelfareConditions = {
  region?: string;
  age?: string;
  householdType?: string;
  incomeRange?: string;
  interest?: string;
  disability?: string;
  pregnancyOrBirth?: string;
  currentSituation?: string;
};

export type RetrievedChunk = {
  id: string;
  documentId: string;
  content: string;
  section: string;
  title: string;
  provider: string;
  region: string;
  url: string;
  similarity: number;
  metadata: Record<string, unknown>;
};
