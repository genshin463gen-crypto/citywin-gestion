-- Tabla única de documentos (cada fila = un documento JSON del panel)
create table if not exists public.docs (
  coll text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (coll, id)
);
alter table public.docs enable row level security;
drop policy if exists "panel lee y escribe" on public.docs;
create policy "panel lee y escribe" on public.docs for all to anon, authenticated using (true) with check (true);
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
