-- YABOA - RECONSTRUCAO COMPLETA DO BANCO DE DADOS
--
-- ATENCAO: este arquivo remove todos os dados das tabelas do Yaboa em public
-- antes de criar a estrutura nova. Execute no SQL Editor do Supabase apenas
-- quando quiser iniciar o aplicativo do zero. A limpeza dos usuarios de
-- autenticacao e a criacao do convidado sao feitas pelo script Node separado,
-- pois o Supabase recomenda usar a API administrativa para contas com senha.

begin;

create extension if not exists pgcrypto;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists ao_criar_usuario on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.registrar_novo_usuario() cascade;

-- Estrutura antiga em ingles e tentativas anteriores de traducao.
drop table if exists public.notifications cascade;
drop table if exists public.venue_ratings cascade;
drop table if exists public.group_members cascade;
drop table if exists public.groups cascade;
drop table if exists public.chat_messages cascade;
drop table if exists public.follows cascade;
drop table if exists public.friendships cascade;
drop table if exists public.event_attendees cascade;
drop table if exists public.check_ins cascade;
drop table if exists public.venue_popularity cascade;
drop table if exists public.events cascade;
drop table if exists public.venues cascade;
drop table if exists public.profiles cascade;

drop table if exists public.notificacoes cascade;
drop table if exists public.avaliacoes_locais cascade;
drop table if exists public.membros_grupos cascade;
drop table if exists public.grupos cascade;
drop table if exists public.mensagens cascade;
drop table if exists public.seguidores cascade;
drop table if exists public.amizades cascade;
drop table if exists public.participantes_eventos cascade;
drop table if exists public.presencas cascade;
drop table if exists public.popularidade_locais cascade;
drop table if exists public.eventos cascade;
drop table if exists public.locais cascade;
drop table if exists public.usuarios cascade;

create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 80),
  nome_usuario text not null check (nome_usuario ~ '^[a-z0-9_]{3,24}$'),
  email text not null,
  url_avatar text,
  biografia text check (biografia is null or char_length(biografia) <= 160),
  endereco text,
  latitude double precision,
  longitude double precision,
  preferencias jsonb not null default '{"tipos":["festa","bar"],"etiquetas":["pop","samba"]}'::jsonb,
  tipo_acesso text not null default 'membro' check (tipo_acesso in ('membro', 'convidado', 'administrador')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (nome_usuario)
);

create unique index usuarios_email_unico_idx on public.usuarios (lower(email));

create table public.locais (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  tipo text not null check (tipo in ('bar', 'casa_noturna', 'show', 'festa', 'urbano')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  endereco text not null,
  descricao text,
  url_imagem text,
  etiquetas text[] not null default '{}',
  criado_por uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index locais_coordenadas_idx on public.locais (latitude, longitude);
create index locais_criado_por_idx on public.locais (criado_por);

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  local_id uuid references public.locais(id) on delete set null,
  criado_por uuid references public.usuarios(id) on delete set null,
  titulo text not null check (char_length(trim(titulo)) between 1 and 140),
  descricao text,
  url_imagem text,
  data_evento date not null,
  hora_evento time not null,
  faixa_preco text,
  categoria text,
  etiquetas text[] not null default '{}',
  maximo_participantes integer check (maximo_participantes is null or maximo_participantes > 0),
  promovido boolean not null default false,
  visibilidade text not null default 'publico' check (visibilidade in ('publico', 'amigos')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index eventos_data_idx on public.eventos (data_evento, hora_evento);
create index eventos_criado_por_idx on public.eventos (criado_por);
create index eventos_local_idx on public.eventos (local_id);

create table public.participantes_eventos (
  evento_id uuid not null references public.eventos(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (evento_id, usuario_id)
);

create index participantes_eventos_usuario_idx on public.participantes_eventos (usuario_id);

create table public.seguidores (
  seguidor_id uuid not null references public.usuarios(id) on delete cascade,
  seguindo_id uuid not null references public.usuarios(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (seguidor_id, seguindo_id),
  check (seguidor_id <> seguindo_id)
);

create index seguidores_seguindo_idx on public.seguidores (seguindo_id);

create table public.amizades (
  id uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null references public.usuarios(id) on delete cascade,
  destinatario_id uuid not null references public.usuarios(id) on delete cascade,
  situacao text not null default 'pendente' check (situacao in ('pendente', 'aceita', 'bloqueada')),
  criado_em timestamptz not null default now(),
  unique (solicitante_id, destinatario_id),
  check (solicitante_id <> destinatario_id)
);

create unique index amizades_par_unico_idx on public.amizades (least(solicitante_id, destinatario_id), greatest(solicitante_id, destinatario_id));

create table public.presencas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  local_id uuid not null references public.locais(id) on delete cascade,
  visibilidade text not null default 'publica' check (visibilidade in ('publica', 'privada')),
  situacao_local text not null default 'vale_a_pena' check (situacao_local in ('bombando', 'lotado', 'vale_a_pena', 'tranquilo')),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '4 hours'
);

create index presencas_local_ativa_idx on public.presencas (local_id, expira_em desc);
create index presencas_usuario_idx on public.presencas (usuario_id, criado_em desc);

create table public.popularidade_locais (
  local_id uuid primary key references public.locais(id) on delete cascade,
  presencas_ultima_hora integer not null default 0,
  presencas_ultimas_24_horas integer not null default 0,
  permanencia_media_minutos integer not null default 240,
  pontuacao_popularidade integer not null default 0,
  situacao text not null default 'tranquilo' check (situacao in ('bombando', 'lotado', 'vale_a_pena', 'tranquilo')),
  atualizado_em timestamptz not null default now()
);

create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  remetente_id uuid not null references public.usuarios(id) on delete cascade,
  destinatario_id uuid not null references public.usuarios(id) on delete cascade,
  conteudo text not null check (char_length(trim(conteudo)) between 1 and 1000),
  criado_em timestamptz not null default now(),
  check (remetente_id <> destinatario_id)
);

create index mensagens_conversa_idx on public.mensagens (remetente_id, destinatario_id, criado_em);

create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 1 and 100),
  descricao text,
  icone text,
  criado_por uuid references public.usuarios(id) on delete set null,
  proximo_plano jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.membros_grupos (
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('administrador', 'membro')),
  entrou_em timestamptz not null default now(),
  primary key (grupo_id, usuario_id)
);

create table public.avaliacoes_locais (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locais(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  nota_musica integer check (nota_musica between 1 and 5),
  nota_publico integer check (nota_publico between 1 and 5),
  nota_preco integer check (nota_preco between 1 and 5),
  nota_seguranca integer check (nota_seguranca between 1 and 5),
  comentario text,
  criado_em timestamptz not null default now(),
  unique (local_id, usuario_id)
);

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  mensagem text not null,
  dados jsonb not null default '{}'::jsonb,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

create index notificacoes_usuario_idx on public.notificacoes (usuario_id, lida, criado_em desc);

create or replace function public.atualizar_data_modificacao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger usuarios_atualizados_em
  before update on public.usuarios
  for each row execute procedure public.atualizar_data_modificacao();
create trigger locais_atualizados_em
  before update on public.locais
  for each row execute procedure public.atualizar_data_modificacao();
create trigger eventos_atualizados_em
  before update on public.eventos
  for each row execute procedure public.atualizar_data_modificacao();
create trigger grupos_atualizados_em
  before update on public.grupos
  for each row execute procedure public.atualizar_data_modificacao();

create or replace function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select tipo_acesso from public.usuarios where id = auth.uid()), 'anonimo');
$$;

create or replace function public.pode_alterar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() = 'authenticated' and public.papel_atual() <> 'convidado';
$$;

create or replace function public.seguem_se_mutuamente(p_outro_usuario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.seguidores eu
    join public.seguidores outro
      on outro.seguidor_id = p_outro_usuario_id and outro.seguindo_id = auth.uid()
    where eu.seguidor_id = auth.uid() and eu.seguindo_id = p_outro_usuario_id
  );
$$;

create or replace function public.pode_ver_evento(p_evento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.eventos evento
    where evento.id = p_evento_id
      and (
        evento.visibilidade = 'publico'
        or evento.criado_por = auth.uid()
        or (evento.criado_por is not null and public.seguem_se_mutuamente(evento.criado_por))
      )
  );
$$;

create or replace function public.registrar_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_base text;
  nome_usuario_base text;
begin
  nome_base := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, 'usuario'), '@', 1), 'Yaboa');
  nome_usuario_base := regexp_replace(
    lower(coalesce(new.raw_user_meta_data ->> 'nome_usuario', new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, 'usuario'), '@', 1))),
    '[^a-z0-9_]',
    '',
    'g'
  );

  if char_length(nome_usuario_base) < 3 then
    nome_usuario_base := 'usuario_' || left(new.id::text, 6);
  end if;

  if exists (select 1 from public.usuarios where nome_usuario = nome_usuario_base) then
    nome_usuario_base := left(nome_usuario_base, 17) || '_' || left(new.id::text, 6);
  end if;

  insert into public.usuarios (id, nome, nome_usuario, email, preferencias)
  values (
    new.id,
    left(nome_base, 80),
    left(nome_usuario_base, 24),
    coalesce(new.email, new.id::text || '@sem-email.local'),
    '{"tipos":["festa","bar"],"etiquetas":["pop","samba"]}'::jsonb
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute procedure public.registrar_novo_usuario();

alter table public.usuarios enable row level security;
alter table public.locais enable row level security;
alter table public.eventos enable row level security;
alter table public.participantes_eventos enable row level security;
alter table public.seguidores enable row level security;
alter table public.amizades enable row level security;
alter table public.presencas enable row level security;
alter table public.popularidade_locais enable row level security;
alter table public.mensagens enable row level security;
alter table public.grupos enable row level security;
alter table public.membros_grupos enable row level security;
alter table public.avaliacoes_locais enable row level security;
alter table public.notificacoes enable row level security;

create policy usuarios_leitura on public.usuarios for select to authenticated using (true);
create policy usuarios_insercao_propria on public.usuarios for insert to authenticated with check (auth.uid() = id and tipo_acesso = 'membro');
create policy usuarios_edicao_propria on public.usuarios for update to authenticated
  using (auth.uid() = id and public.pode_alterar())
  with check (auth.uid() = id and tipo_acesso = public.papel_atual());

create policy locais_leitura on public.locais for select to authenticated using (true);
create policy locais_criacao on public.locais for insert to authenticated with check (auth.uid() = criado_por and public.pode_alterar());
create policy locais_edicao on public.locais for update to authenticated using (auth.uid() = criado_por and public.pode_alterar()) with check (auth.uid() = criado_por and public.pode_alterar());
create policy locais_exclusao on public.locais for delete to authenticated using (auth.uid() = criado_por and public.pode_alterar());

create policy eventos_leitura on public.eventos for select to authenticated using (public.pode_ver_evento(id));
create policy eventos_criacao on public.eventos for insert to authenticated with check (auth.uid() = criado_por and public.pode_alterar());
create policy eventos_edicao on public.eventos for update to authenticated using (auth.uid() = criado_por and public.pode_alterar()) with check (auth.uid() = criado_por and public.pode_alterar());
create policy eventos_exclusao on public.eventos for delete to authenticated using (auth.uid() = criado_por and public.pode_alterar());

create policy participantes_leitura on public.participantes_eventos for select to authenticated using (public.pode_ver_evento(evento_id));
create policy participantes_confirmacao on public.participantes_eventos for insert to authenticated with check (auth.uid() = usuario_id and public.pode_alterar() and public.pode_ver_evento(evento_id));
create policy participantes_atualizacao on public.participantes_eventos for update to authenticated using (auth.uid() = usuario_id and public.pode_alterar()) with check (auth.uid() = usuario_id and public.pode_alterar());
create policy participantes_saida_ou_remocao on public.participantes_eventos for delete to authenticated using (
  public.pode_alterar() and (
    auth.uid() = usuario_id or exists (select 1 from public.eventos where id = evento_id and criado_por = auth.uid())
  )
);

create policy seguidores_leitura on public.seguidores for select to authenticated using (true);
create policy seguidores_criacao on public.seguidores for insert to authenticated with check (auth.uid() = seguidor_id and public.pode_alterar());
create policy seguidores_atualizacao on public.seguidores for update to authenticated using (auth.uid() = seguidor_id and public.pode_alterar()) with check (auth.uid() = seguidor_id and public.pode_alterar());
create policy seguidores_exclusao on public.seguidores for delete to authenticated using (auth.uid() = seguidor_id and public.pode_alterar());

create policy amizades_leitura on public.amizades for select to authenticated using (auth.uid() in (solicitante_id, destinatario_id));
create policy amizades_criacao on public.amizades for insert to authenticated with check (auth.uid() = solicitante_id and public.pode_alterar());
create policy amizades_edicao on public.amizades for update to authenticated using (auth.uid() in (solicitante_id, destinatario_id) and public.pode_alterar()) with check (auth.uid() in (solicitante_id, destinatario_id) and public.pode_alterar());
create policy amizades_exclusao on public.amizades for delete to authenticated using (auth.uid() in (solicitante_id, destinatario_id) and public.pode_alterar());

create policy presencas_leitura on public.presencas for select to authenticated using (
  visibilidade = 'publica' or auth.uid() = usuario_id or public.seguem_se_mutuamente(usuario_id)
);
create policy presencas_criacao on public.presencas for insert to authenticated with check (auth.uid() = usuario_id and public.pode_alterar());
create policy presencas_exclusao on public.presencas for delete to authenticated using (auth.uid() = usuario_id and public.pode_alterar());

create policy popularidade_locais_leitura on public.popularidade_locais for select to authenticated using (true);

create policy mensagens_leitura on public.mensagens for select to authenticated using (
  auth.uid() in (remetente_id, destinatario_id) and public.seguem_se_mutuamente(case when auth.uid() = remetente_id then destinatario_id else remetente_id end)
);
create policy mensagens_criacao on public.mensagens for insert to authenticated with check (
  auth.uid() = remetente_id and public.pode_alterar() and public.seguem_se_mutuamente(destinatario_id)
);

create policy grupos_leitura on public.grupos for select to authenticated using (true);
create policy grupos_criacao on public.grupos for insert to authenticated with check (auth.uid() = criado_por and public.pode_alterar());
create policy grupos_edicao on public.grupos for update to authenticated using (auth.uid() = criado_por and public.pode_alterar()) with check (auth.uid() = criado_por and public.pode_alterar());
create policy grupos_exclusao on public.grupos for delete to authenticated using (auth.uid() = criado_por and public.pode_alterar());

create policy membros_grupos_leitura on public.membros_grupos for select to authenticated using (true);
create policy membros_grupos_entrada on public.membros_grupos for insert to authenticated with check (auth.uid() = usuario_id and public.pode_alterar());
create policy membros_grupos_saida on public.membros_grupos for delete to authenticated using (auth.uid() = usuario_id and public.pode_alterar());

create policy avaliacoes_locais_leitura on public.avaliacoes_locais for select to authenticated using (true);
create policy avaliacoes_locais_criacao on public.avaliacoes_locais for insert to authenticated with check (auth.uid() = usuario_id and public.pode_alterar());
create policy avaliacoes_locais_edicao on public.avaliacoes_locais for update to authenticated using (auth.uid() = usuario_id and public.pode_alterar()) with check (auth.uid() = usuario_id and public.pode_alterar());
create policy avaliacoes_locais_exclusao on public.avaliacoes_locais for delete to authenticated using (auth.uid() = usuario_id and public.pode_alterar());

create policy notificacoes_leitura on public.notificacoes for select to authenticated using (auth.uid() = usuario_id);
create policy notificacoes_edicao on public.notificacoes for update to authenticated using (auth.uid() = usuario_id and public.pode_alterar()) with check (auth.uid() = usuario_id and public.pode_alterar());

revoke all on function public.papel_atual() from public;
revoke all on function public.pode_alterar() from public;
revoke all on function public.seguem_se_mutuamente(uuid) from public;
revoke all on function public.pode_ver_evento(uuid) from public;
grant execute on function public.papel_atual() to authenticated;
grant execute on function public.pode_alterar() to authenticated;
grant execute on function public.seguem_se_mutuamente(uuid) to authenticated;
grant execute on function public.pode_ver_evento(uuid) to authenticated;

-- A API administrativa usada para provisionar a conta convidada precisa
-- acessar o schema mesmo quando as permissoes padrao do projeto foram alteradas.
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
alter default privileges for role postgres in schema public grant all privileges on tables to service_role;
alter default privileges for role postgres in schema public grant all privileges on sequences to service_role;

commit;
