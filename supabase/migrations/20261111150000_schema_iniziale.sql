-- Ai Insegnante: schema iniziale.
-- Ogni utente vede e modifica solo le proprie righe (RLS su tutte le tabelle).
-- Dal 30/10/2026 le nuove tabelle in public non sono esposte alla Data API
-- in automatico: i GRANT qui sotto le rendono accessibili, la RLS decide quali righe.

create type public.material_kind as enum ('pdf', 'docx', 'image', 'url', 'text');
create type public.material_status as enum ('reading', 'ready', 'error');
create type public.exam_mode as enum ('interrogazione', 'maturita', 'colloquio');
create type public.difficulty as enum ('base', 'medio', 'esigente');
create type public.examiner_voice as enum ('calma', 'severa');
create type public.session_status as enum ('in_corso', 'completata', 'interrotta');

-- Profili ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  default_voice public.examiner_voice not null default 'calma',
  default_difficulty public.difficulty not null default 'medio',
  default_duration smallint not null default 20 check (default_duration in (10, 20, 40)),
  created_at timestamptz not null default now()
);

-- Materiali di studio ------------------------------------------------------
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) <= 300),
  kind public.material_kind not null,
  status public.material_status not null default 'reading',
  source text,                -- percorso nello Storage o URL
  size_bytes integer,
  extracted_text text,        -- testo letto (PDF, DOCX, OCR, pagina web)
  error text,
  created_at timestamptz not null default now()
);
create index materials_user_created_idx on public.materials (user_id, created_at desc);

-- Sessioni (simulazioni) ---------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) <= 160),
  mode public.exam_mode not null,
  duration_min smallint not null check (duration_min in (10, 20, 40)),
  difficulty public.difficulty not null,
  voice public.examiner_voice not null,
  job_posting text check (char_length(job_posting) <= 20000),
  focus_topics text[] not null default '{}',
  status public.session_status not null default 'in_corso',
  score numeric(5, 1),
  score_max smallint not null default 10 check (score_max in (10, 100)),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index sessions_user_started_idx on public.sessions (user_id, started_at desc);

create table public.session_materials (
  session_id uuid not null references public.sessions (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (session_id, material_id)
);
create index session_materials_material_idx on public.session_materials (material_id);

-- Turni: domanda, risposta trascritta, risposta modello --------------------
create table public.turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  idx smallint not null,
  question text not null,
  topic text not null default '',
  is_follow_up boolean not null default false,
  answer text,
  model_answer text,
  feedback text,
  asked_at timestamptz not null default now(),
  unique (session_id, idx)
);

-- Report finale ------------------------------------------------------------
create table public.reports (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  score numeric(5, 1) not null,
  score_max smallint not null check (score_max in (10, 100)),
  summary text not null default '',
  strengths text[] not null default '{}',
  improvements text[] not null default '{}',
  weak_topics text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Accesso: Data API + RLS --------------------------------------------------
grant select, insert, update, delete on
  public.profiles, public.materials, public.sessions,
  public.session_materials, public.turns, public.reports
to authenticated;

alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.sessions enable row level security;
alter table public.session_materials enable row level security;
alter table public.turns enable row level security;
alter table public.reports enable row level security;

create policy "profilo: lettura propria" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profilo: inserimento proprio" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "profilo: modifica propria" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Stesse quattro regole per le tabelle con user_id.
do $$
declare t text;
begin
  foreach t in array array['materials', 'sessions', 'session_materials', 'turns', 'reports'] loop
    execute format('create policy "%1$s: lettura propria" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: inserimento proprio" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: modifica propria" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: eliminazione propria" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- Un collegamento sessione-materiale deve unire righe dello stesso utente.
create policy "session_materials: solo righe proprie" on public.session_materials as restrictive
  for insert to authenticated
  with check (
    exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.materials m where m.id = material_id and m.user_id = (select auth.uid()))
  );
create policy "turns: sessione propria" on public.turns as restrictive
  for insert to authenticated
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy "reports: sessione propria" on public.reports as restrictive
  for insert to authenticated
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select auth.uid())));

-- Profilo creato alla registrazione. La funzione sta in uno schema non esposto.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(split_part(new.raw_user_meta_data ->> 'full_name', ' ', 1), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Archivio file: bucket privato, ogni utente nella sua cartella <user_id>/ ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials', 'materials', false, 20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'text/markdown',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
  ]
)
on conflict (id) do nothing;

create policy "materials: lettura file propri" on storage.objects for select to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "materials: caricamento file propri" on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "materials: modifica file propri" on storage.objects for update to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "materials: eliminazione file propri" on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
