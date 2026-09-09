create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  username text unique not null,
  email text unique,
  avatar_url text,
  bio text,
  address text,
  lat double precision,
  lng double precision,
  preferences jsonb not null default '{"types":[],"tags":[]}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision;

create unique index if not exists profiles_email_unique_idx on public.profiles (lower(email)) where email is not null;

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('bar', 'nightclub', 'show', 'party', 'urban')),
  lat double precision not null,
  lng double precision not null,
  address text not null,
  description text,
  image_url text,
  tags text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  status text not null default 'public' check (status in ('public', 'private')),
  venue_status text not null default 'vale a pena',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '4 hours'
);

create table if not exists public.venue_popularity (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  checkins_last_1h int not null default 0,
  checkins_last_24h int not null default 0,
  avg_stay_minutes int not null default 240,
  popularity_score int not null default 0,
  status text not null default 'tranquilo',
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  image_url text,
  event_date date not null,
  event_time time not null,
  price_range text,
  category text,
  tags text[] not null default '{}',
  max_attendees int,
  promoted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.event_attendees (
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists follows_following_idx on public.follows (following_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create index if not exists chat_messages_pair_idx on public.chat_messages (sender_id, receiver_id, created_at);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  avatar_emoji text,
  created_by uuid references public.profiles(id) on delete set null,
  next_plan jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.venue_ratings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  music_rating int check (music_rating between 1 and 5),
  crowd_rating int check (crowd_rating between 1 and 5),
  price_rating int check (price_rating between 1 and 5),
  safety_rating int check (safety_rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, username, email, avatar_url, address, lat, lng, preferences)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'Yaboa'),
    coalesce(nullif(regexp_replace(lower(new.raw_user_meta_data ->> 'username'), '[^a-z0-9_]', '', 'g'), ''), regexp_replace(split_part(lower(new.email), '@', 1), '[^a-z0-9_]', '_', 'g') || '_' || substr(new.id::text, 1, 6)),
    new.email,
    null,
    new.raw_user_meta_data ->> 'address',
    nullif(new.raw_user_meta_data ->> 'lat', '')::double precision,
    nullif(new.raw_user_meta_data ->> 'lng', '')::double precision,
    '{"types":["party","bar"],"tags":["pop","samba"]}'::jsonb
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.check_ins enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.friendships enable row level security;
alter table public.follows enable row level security;
alter table public.chat_messages enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.venue_ratings enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "venues_select_all" on public.venues;
drop policy if exists "venues_insert_auth" on public.venues;
drop policy if exists "venues_update_owner" on public.venues;
drop policy if exists "venues_delete_owner" on public.venues;
create policy "venues_select_all" on public.venues for select using (true);
create policy "venues_insert_auth" on public.venues for insert with check (auth.uid() = created_by);
create policy "venues_update_owner" on public.venues for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy "venues_delete_owner" on public.venues for delete using (auth.uid() = created_by);

drop policy if exists "check_ins_select_public_or_own" on public.check_ins;
drop policy if exists "check_ins_insert_own" on public.check_ins;
drop policy if exists "check_ins_delete_own" on public.check_ins;
create policy "check_ins_select_public_or_own" on public.check_ins for select using (status = 'public' or auth.uid() = user_id);
create policy "check_ins_insert_own" on public.check_ins for insert with check (auth.uid() = user_id);
create policy "check_ins_delete_own" on public.check_ins for delete using (auth.uid() = user_id);

drop policy if exists "venue_popularity_select_all" on public.venue_popularity;
create policy "venue_popularity_select_all" on public.venue_popularity for select using (true);

drop policy if exists "events_select_all" on public.events;
drop policy if exists "events_insert_auth" on public.events;
drop policy if exists "events_update_owner" on public.events;
drop policy if exists "events_delete_owner" on public.events;
create policy "events_select_all" on public.events for select using (true);
create policy "events_insert_auth" on public.events for insert with check (auth.uid() = created_by);
create policy "events_update_owner" on public.events for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy "events_delete_owner" on public.events for delete using (auth.uid() = created_by);

drop policy if exists "event_attendees_select_all" on public.event_attendees;
drop policy if exists "event_attendees_insert_own" on public.event_attendees;
drop policy if exists "event_attendees_delete_own" on public.event_attendees;
drop policy if exists "event_attendees_delete_own_or_event_owner" on public.event_attendees;
create policy "event_attendees_select_all" on public.event_attendees for select using (true);
create policy "event_attendees_insert_own" on public.event_attendees for insert with check (auth.uid() = user_id);
create policy "event_attendees_delete_own_or_event_owner" on public.event_attendees for delete using (
  auth.uid() = user_id
  or exists (
    select 1 from public.events e
    where e.id = event_attendees.event_id and e.created_by = auth.uid()
  )
);

drop policy if exists "friendships_select_participants" on public.friendships;
drop policy if exists "friendships_insert_requester" on public.friendships;
drop policy if exists "friendships_update_participants" on public.friendships;
drop policy if exists "friendships_delete_participants" on public.friendships;
create policy "friendships_select_participants" on public.friendships for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "friendships_insert_requester" on public.friendships for insert with check (auth.uid() = requester_id);
create policy "friendships_update_participants" on public.friendships for update using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "friendships_delete_participants" on public.friendships for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "follows_select_all" on public.follows;
drop policy if exists "follows_insert_own" on public.follows;
drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_select_all" on public.follows for select using (true);
create policy "follows_insert_own" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete_own" on public.follows for delete using (auth.uid() = follower_id);

drop policy if exists "chat_messages_select_mutual" on public.chat_messages;
drop policy if exists "chat_messages_insert_mutual" on public.chat_messages;
create policy "chat_messages_select_mutual" on public.chat_messages for select using (
  auth.uid() in (sender_id, receiver_id)
  and exists (
    select 1 from public.follows mine
    join public.follows theirs
      on theirs.follower_id = case when auth.uid() = sender_id then receiver_id else sender_id end
      and theirs.following_id = auth.uid()
    where mine.follower_id = auth.uid()
      and mine.following_id = case when auth.uid() = sender_id then receiver_id else sender_id end
  )
);
create policy "chat_messages_insert_mutual" on public.chat_messages for insert with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.follows mine
    join public.follows theirs
      on theirs.follower_id = receiver_id and theirs.following_id = auth.uid()
    where mine.follower_id = auth.uid() and mine.following_id = receiver_id
  )
);

drop policy if exists "groups_select_all" on public.groups;
drop policy if exists "groups_insert_auth" on public.groups;
drop policy if exists "groups_update_owner" on public.groups;
drop policy if exists "groups_delete_owner" on public.groups;
create policy "groups_select_all" on public.groups for select using (true);
create policy "groups_insert_auth" on public.groups for insert with check (auth.uid() = created_by);
create policy "groups_update_owner" on public.groups for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy "groups_delete_owner" on public.groups for delete using (auth.uid() = created_by);

drop policy if exists "group_members_select_all" on public.group_members;
drop policy if exists "group_members_insert_own" on public.group_members;
drop policy if exists "group_members_delete_own" on public.group_members;
create policy "group_members_select_all" on public.group_members for select using (true);
create policy "group_members_insert_own" on public.group_members for insert with check (auth.uid() = user_id);
create policy "group_members_delete_own" on public.group_members for delete using (auth.uid() = user_id);

drop policy if exists "venue_ratings_select_all" on public.venue_ratings;
drop policy if exists "venue_ratings_insert_own" on public.venue_ratings;
drop policy if exists "venue_ratings_update_own" on public.venue_ratings;
drop policy if exists "venue_ratings_delete_own" on public.venue_ratings;
create policy "venue_ratings_select_all" on public.venue_ratings for select using (true);
create policy "venue_ratings_insert_own" on public.venue_ratings for insert with check (auth.uid() = user_id);
create policy "venue_ratings_update_own" on public.venue_ratings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "venue_ratings_delete_own" on public.venue_ratings for delete using (auth.uid() = user_id);

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_insert_auth" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_insert_auth" on public.notifications for insert with check (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications_delete_own" on public.notifications for delete using (auth.uid() = user_id);
