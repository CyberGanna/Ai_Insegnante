-- Prova scritta e materiali audio/video.

-- Audio e video vengono trascritti e usati come appunti.
alter type public.material_kind add value if not exists 'audio';
alter type public.material_kind add value if not exists 'video';

-- A voce (una domanda alla volta) o per iscritto (un compito intero da consegnare).
create type public.exam_format as enum ('orale', 'scritto');
alter table public.sessions add column format public.exam_format not null default 'orale';

-- Tipo di domanda della prova scritta e opzioni delle domande a crocette.
create type public.question_kind as enum ('aperta', 'multipla', 'traccia');
alter table public.turns
  add column kind public.question_kind not null default 'aperta',
  add column options text[] check (options is null or cardinality(options) between 2 and 6);

-- L'archivio accetta anche audio e video, fino a 25 MB (limite del servizio di trascrizione).
update storage.buckets
set
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'text/markdown',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac',
    'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/flac',
    'video/mp4', 'video/webm'
  ]
where id = 'materials';
