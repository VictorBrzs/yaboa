-- Script de estrutura do banco em português, compatível com o projeto Yaboa
-- Ajusta nomes de tabelas, colunas e chaves para o idioma português.
-- OBS.: Este script é para uso em Supabase/Postgres e usa a convenção do projeto atual.

create extension if not exists "pgcrypto";

create table if not exists public.usuarios (
  id uuid not null,
  name text not null,
  username text not null unique,
  avatar_url text,
  bio text,
  preferencias jsonb not null default '{"tags": [], "types": []}'::jsonb,
  created_at timestamptz not null default now(),
  address text,
  lat double precision,
  lng double precision,
  email text,
  tipo_perfil text not null default 'usuario' check (tipo_perfil in ('usuario', 'convidado')),
  constraint usuarios_pkey primary key (id),
  constraint usuarios_id_fkey foreign key (id) references auth.users(id)
);

create table if not exists public.locais (
  id uuid not null default gen_random_uuid(),
  name text not null,
  type text not null check (type = any (array['bar'::text, 'nightclub'::text, 'show'::text, 'party'::text, 'urban'::text])),
  lat double precision not null,
  lng double precision not null,
  address text not null,
  description text,
  image_url text,
  tags text[] not null default '{}'::text[],
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint locais_pkey primary key (id),
  constraint locais_created_by_fkey foreign key (created_by) references public.usuarios(id)
);

create table if not exists public.checkins (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  venue_id uuid not null,
  status text not null default 'public'::text check (status = any (array['public'::text, 'private'::text])),
  venue_status text not null default 'vale a pena'::text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + '04:00:00'::interval),
  constraint checkins_pkey primary key (id),
  constraint checkins_user_id_fkey foreign key (user_id) references public.usuarios(id),
  constraint checkins_venue_id_fkey foreign key (venue_id) references public.locais(id)
);

create table if not exists public.popularidade_locais (
  venue_id uuid not null,
  checkins_last_1h integer not null default 0,
  checkins_last_24h integer not null default 0,
  avg_stay_minutes integer not null default 240,
  popularity_score integer not null default 0,
  status text not null default 'tranquilo'::text,
  updated_at timestamptz not null default now(),
  constraint popularidade_locais_pkey primary key (venue_id),
  constraint popularidade_locais_venue_id_fkey foreign key (venue_id) references public.locais(id)
);

create table if not exists public.eventos (
  id uuid not null default gen_random_uuid(),
  venue_id uuid,
  created_by uuid,
  title text not null,
  description text,
  image_url text,
  event_date date not null,
  event_time time without time zone not null,
  price_range text,
  category text,
  tags text[] not null default '{}'::text[],
  max_attendees integer,
  promoted boolean not null default false,
  created_at timestamptz not null default now(),
  visibility text not null default 'public'::text check (visibility = any (array['public'::text, 'friends'::text])),
  constraint eventos_pkey primary key (id),
  constraint eventos_venue_id_fkey foreign key (venue_id) references public.locais(id),
  constraint eventos_created_by_fkey foreign key (created_by) references public.usuarios(id)
);

create table if not exists public.participantes_eventos (
  event_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint participantes_eventos_pkey primary key (event_id, user_id),
  constraint participantes_eventos_event_id_fkey foreign key (event_id) references public.eventos(id),
  constraint participantes_eventos_user_id_fkey foreign key (user_id) references public.usuarios(id)
);

create table if not exists public.amizades (
  id uuid not null default gen_random_uuid(),
  requester_id uuid not null,
  addressee_id uuid not null,
  status text not null default 'pending'::text check (status = any (array['pending'::text, 'accepted'::text, 'blocked'::text])),
  created_at timestamptz not null default now(),
  constraint amizades_pkey primary key (id),
  constraint amizades_requester_id_fkey foreign key (requester_id) references public.usuarios(id),
  constraint amizades_addressee_id_fkey foreign key (addressee_id) references public.usuarios(id)
);

create table if not exists public.groups (
  id uuid not null default gen_random_uuid(),
  name text not null,
  description text,
  avatar_emoji text,
  created_by uuid,
  next_plan jsonb,
  created_at timestamptz not null default now(),
  constraint groups_pkey primary key (id),
  constraint groups_created_by_fkey foreign key (created_by) references public.usuarios(id)
);

create table if not exists public.membros_grupos (
  group_id uuid not null,
  user_id uuid not null,
  role text not null default 'member'::text check (role = any (array['admin'::text, 'member'::text])),
  joined_at timestamptz not null default now(),
  constraint membros_grupos_pkey primary key (group_id, user_id),
  constraint membros_grupos_group_id_fkey foreign key (group_id) references public.groups(id),
  constraint membros_grupos_user_id_fkey foreign key (user_id) references public.usuarios(id)
);

create table if not exists public.avaliacoes_locais (
  id uuid not null default gen_random_uuid(),
  venue_id uuid not null,
  user_id uuid not null,
  music_rating integer check (music_rating >= 1 and music_rating <= 5),
  crowd_rating integer check (crowd_rating >= 1 and crowd_rating <= 5),
  price_rating integer check (price_rating >= 1 and price_rating <= 5),
  safety_rating integer check (safety_rating >= 1 and safety_rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint avaliacoes_locais_pkey primary key (id),
  constraint avaliacoes_locais_venue_id_fkey foreign key (venue_id) references public.locais(id),
  constraint avaliacoes_locais_user_id_fkey foreign key (user_id) references public.usuarios(id)
);

create table if not exists public.notificacoes (
  id uuid not null default gen_random_uuid(),
  usuario_id uuid not null,
  type text not null,
  titulo text not null,
  mensagem text not null,
  data jsonb not null default '{}'::jsonb,
  leitura boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notificacoes_pkey primary key (id),
  constraint notificacoes_usuario_id_fkey foreign key (usuario_id) references public.usuarios(id)
);

create table if not exists public.seguidores (
  seguidor_id uuid not null,
  seguindo_id uuid not null,
  created_at timestamptz not null default now(),
  constraint seguidores_pkey primary key (seguidor_id, seguindo_id),
  constraint seguidores_seguidor_id_fkey foreign key (seguidor_id) references public.usuarios(id),
  constraint seguidores_seguindo_id_fkey foreign key (seguindo_id) references public.usuarios(id)
);

create table if not exists public.chat_messages (
  id uuid not null default gen_random_uuid(),
  sender_id uuid not null,
  receiver_id uuid not null,
  body text not null check (char_length(trim(both from body)) >= 1 and char_length(trim(both from body)) <= 1000),
  created_at timestamptz not null default now(),
  constraint chat_messages_pkey primary key (id),
  constraint chat_messages_sender_id_fkey foreign key (sender_id) references public.usuarios(id),
  constraint chat_messages_receiver_id_fkey foreign key (receiver_id) references public.usuarios(id)
);

-- Trigger para sincronizar auth.users com public.usuarios
create or replace function public.sincronizar_usuario_novo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (
    id,
    name,
    username,
    email,
    avatar_url,
    bio,
    preferencias,
    address,
    lat,
    lng,
    tipo_perfil
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'Yaboa'),
    coalesce(
      nullif(regexp_replace(lower(new.raw_user_meta_data ->> 'username'), '[^a-z0-9_]', '', 'g'), ''),
      regexp_replace(split_part(lower(new.email), '@', 1), '[^a-z0-9_]', '_', 'g') || '_' || substr(new.id::text, 1, 6)
    ),
    new.email,
    null,
    null,
    '{"tags": ["pop", "samba"], "types": ["party", "bar"]}'::jsonb,
    new.raw_user_meta_data ->> 'address',
    nullif(new.raw_user_meta_data ->> 'lat', '')::double precision,
    nullif(new.raw_user_meta_data ->> 'lng', '')::double precision,
    coalesce(new.raw_user_meta_data ->> 'tipo_perfil', 'usuario')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trigger_sincronizar_usuario_novo on auth.users;
create trigger trigger_sincronizar_usuario_novo
  after insert on auth.users
  for each row execute procedure public.sincronizar_usuario_novo();

-- Políticas básicas de segurança
alter table public.usuarios enable row level security;
alter table public.locais enable row level security;
alter table public.checkins enable row level security;
alter table public.popularidade_locais enable row level security;
alter table public.eventos enable row level security;
alter table public.participantes_eventos enable row level security;
alter table public.amizades enable row level security;
alter table public.groups enable row level security;
alter table public.membros_grupos enable row level security;
alter table public.avaliacoes_locais enable row level security;
alter table public.notificacoes enable row level security;
alter table public.seguidores enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "usuarios_selecionar_todos" on public.usuarios;
create policy "usuarios_selecionar_todos" on public.usuarios for select using (true);
drop policy if exists "usuarios_inserir_proprio" on public.usuarios;
create policy "usuarios_inserir_proprio" on public.usuarios for insert with check (auth.uid() = id);
drop policy if exists "usuarios_editar_proprio" on public.usuarios;
create policy "usuarios_editar_proprio" on public.usuarios for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "locais_selecionar_todos" on public.locais;
create policy "locais_selecionar_todos" on public.locais for select using (true);
drop policy if exists "locais_inserir_usuarios" on public.locais;
create policy "locais_inserir_usuarios" on public.locais for insert with check (auth.uid() = created_by);
drop policy if exists "locais_editar_proprio" on public.locais;
create policy "locais_editar_proprio" on public.locais for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
drop policy if exists "locais_excluir_proprio" on public.locais;
create policy "locais_excluir_proprio" on public.locais for delete using (auth.uid() = created_by);

drop policy if exists "eventos_selecionar_todos" on public.eventos;
create policy "eventos_selecionar_todos" on public.eventos for select using (true);
drop policy if exists "eventos_inserir_usuarios" on public.eventos;
create policy "eventos_inserir_usuarios" on public.eventos for insert with check (auth.uid() = created_by);
drop policy if exists "eventos_editar_proprio" on public.eventos;
create policy "eventos_editar_proprio" on public.eventos for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
drop policy if exists "eventos_excluir_proprio" on public.eventos;
create policy "eventos_excluir_proprio" on public.eventos for delete using (auth.uid() = created_by);

drop policy if exists "participantes_eventos_selecionar_todos" on public.participantes_eventos;
create policy "participantes_eventos_selecionar_todos" on public.participantes_eventos for select using (true);
drop policy if exists "participantes_eventos_inserir_usuarios" on public.participantes_eventos;
create policy "participantes_eventos_inserir_usuarios" on public.participantes_eventos for insert with check (auth.uid() = user_id);

drop policy if exists "checkins_selecionar_publico_ou_proprio" on public.checkins;
create policy "checkins_selecionar_publico_ou_proprio" on public.checkins for select using (
  status = 'public'
  or auth.uid() = user_id
);
drop policy if exists "checkins_inserir_proprio" on public.checkins;
create policy "checkins_inserir_proprio" on public.checkins for insert with check (auth.uid() = user_id);
drop policy if exists "checkins_excluir_proprio" on public.checkins;
create policy "checkins_excluir_proprio" on public.checkins for delete using (auth.uid() = user_id);

drop policy if exists "seguidores_selecionar_todos" on public.seguidores;
create policy "seguidores_selecionar_todos" on public.seguidores for select using (true);
drop policy if exists "seguidores_inserir_proprio" on public.seguidores;
create policy "seguidores_inserir_proprio" on public.seguidores for insert with check (auth.uid() = seguidor_id);
drop policy if exists "seguidores_excluir_proprio" on public.seguidores;
create policy "seguidores_excluir_proprio" on public.seguidores for delete using (auth.uid() = seguidor_id);

drop policy if exists "chat_messages_selecionar_proprio" on public.chat_messages;
create policy "chat_messages_selecionar_proprio" on public.chat_messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
drop policy if exists "chat_messages_inserir_proprio" on public.chat_messages;
create policy "chat_messages_inserir_proprio" on public.chat_messages for insert with check (auth.uid() = sender_id);

drop policy if exists "notificacoes_selecionar_proprio" on public.notificacoes;
create policy "notificacoes_selecionar_proprio" on public.notificacoes for select using (auth.uid() = usuario_id);
drop policy if exists "notificacoes_inserir_proprio" on public.notificacoes;
create policy "notificacoes_inserir_proprio" on public.notificacoes for insert with check (auth.uid() = usuario_id);

-- Usuário de convidado (somente visualização local; o acesso real ao app é tratado no front-end)
-- O app deve receber o perfil com isGuest = true e bloquear ações de escrita.
-- Este perfil não deve ter permissões de alteração em nenhum dado do banco.
