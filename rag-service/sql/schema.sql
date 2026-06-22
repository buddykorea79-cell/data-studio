create extension if not exists vector;

create table if not exists welfare_rag_documents (
  id uuid primary key default gen_random_uuid(),
  source_file_name text not null,
  row_index integer not null,
  title text not null,
  provider text,
  target text,
  criteria text,
  benefit text,
  apply_method text,
  documents text,
  contact text,
  url text,
  region text,
  category text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists welfare_rag_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references welfare_rag_documents(id) on delete cascade,
  content text not null,
  section text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists welfare_rag_chunks_metadata_gin_idx on welfare_rag_chunks using gin (metadata);
create index if not exists welfare_rag_chunks_embedding_hnsw_idx on welfare_rag_chunks using hnsw (embedding vector_cosine_ops);

create or replace function match_welfare_rag_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.15,
  match_count int default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  section text,
  title text,
  provider text,
  region text,
  url text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    c.id as chunk_id,
    c.document_id,
    c.content,
    c.section,
    d.title,
    d.provider,
    d.region,
    d.url,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from welfare_rag_chunks c
  join welfare_rag_documents d on d.id = c.document_id
  where 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
