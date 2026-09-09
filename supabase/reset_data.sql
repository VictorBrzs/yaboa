-- Execute este arquivo no painel SQL para preparar a estrutura e limpar todos os dados do app.
-- Ele apaga tambem os usuarios de auth.users para permitir recadastro completo.

alter table public.profiles
  add column if not exists email text,
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision;

truncate table
  public.notifications,
  public.venue_ratings,
  public.group_members,
  public.groups,
  public.chat_messages,
  public.follows,
  public.friendships,
  public.event_attendees,
  public.check_ins,
  public.venue_popularity,
  public.events,
  public.venues,
  public.profiles
restart identity cascade;

delete from auth.users;
