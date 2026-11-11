-- Progetti: cartelle per materia (verifiche, maturità) o per azienda (colloqui).
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode public.exam_mode not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create index projects_user_mode_idx on public.projects (user_id, mode);

-- Eliminando un progetto le prove restano, senza progetto.
alter table public.sessions
  add column project_id uuid references public.projects (id) on delete set null;
create index sessions_project_idx on public.sessions (project_id);

grant select, insert, update, delete on public.projects to authenticated;
alter table public.projects enable row level security;

create policy "projects: lettura propria" on public.projects for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "projects: inserimento proprio" on public.projects for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "projects: modifica propria" on public.projects for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "projects: eliminazione propria" on public.projects for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Una prova può stare solo in un progetto dello stesso utente e dello stesso tipo.
create policy "sessions: progetto proprio" on public.sessions as restrictive
  for all to authenticated
  using (true)
  with check (
    project_id is null
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid()) and p.mode = sessions.mode
    )
  );
