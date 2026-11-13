-- Durata da 5 minuti per le simulazioni brevi.
alter table public.profiles drop constraint if exists profiles_default_duration_check;
alter table public.profiles
  add constraint profiles_default_duration_check check (default_duration in (5, 10, 20, 40));

alter table public.sessions drop constraint if exists sessions_duration_min_check;
alter table public.sessions
  add constraint sessions_duration_min_check check (duration_min in (5, 10, 20, 40));
