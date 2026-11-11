-- Cartelle create dall'utente accanto alle tre fisse (Verifiche, Maturità, Colloqui).
-- Il tipo (mode) dice come interroga l'AI; i progetti dentro hanno lo stesso tipo.
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode public.exam_mode not null,
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create index folders_user_idx on public.folders (user_id);

-- Eliminando una cartella i progetti tornano nella cartella del loro tipo.
alter table public.projects
  add column folder_id uuid references public.folders (id) on delete set null;
create index projects_folder_idx on public.projects (folder_id);

grant select, insert, update, delete on public.folders to authenticated;
alter table public.folders enable row level security;

create policy "folders: lettura propria" on public.folders for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "folders: inserimento proprio" on public.folders for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "folders: modifica propria" on public.folders for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "folders: eliminazione propria" on public.folders for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Un progetto può stare solo in una cartella dello stesso utente e dello stesso tipo.
create policy "projects: cartella propria" on public.projects as restrictive
  for all to authenticated
  using (true)
  with check (
    folder_id is null
    or exists (
      select 1 from public.folders f
      where f.id = folder_id and f.user_id = (select auth.uid()) and f.mode = projects.mode
    )
  );
