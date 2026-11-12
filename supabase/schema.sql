
-- OPIUM WEALTH BOT: TITAN EDITION
-- Run this entire file in Supabase Dashboard > SQL Editor.
-- IMPORTANT: After creating your account, promote the owner by running the owner UPDATE below.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null default 'Member' check (char_length(nickname) between 1 and 24),
 role text not null default 'member' check (role in ('member','admin','owner')),
 rank text not null default 'Rookie' check (rank in ('Rookie','Knight','Captain','Lieutenant','Commander','General','Monarch','Emperor')),
 created_at timestamptz not null default now()
);

create table if not exists public.posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check (kind in ('idea','bulletin')),
 title text not null check (char_length(title) between 1 and 140),
 symbol text,
 body text not null check (char_length(body) between 1 and 8000),
 source text,
 created_at timestamptz not null default now()
);

create table if not exists public.public_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 1500),
 created_at timestamptz not null default now()
);

create table if not exists public.private_messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 1500),
 created_at timestamptz not null default now(),
 check (sender_id <> recipient_id)
);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.public_messages enable row level security;
alter table public.private_messages enable row level security;

-- PROFILES
drop policy if exists "profiles visible to authenticated" on public.profiles;
create policy "profiles visible to authenticated" on public.profiles
for select to authenticated using (true);

drop policy if exists "user inserts own profile" on public.profiles;
create policy "user inserts own profile" on public.profiles
for insert to authenticated with check (auth.uid() = id and role = 'member');

drop policy if exists "user updates own nickname" on public.profiles;
create policy "user updates own nickname" on public.profiles
for update to authenticated using (auth.uid() = id)
with check (
 auth.uid() = id
 and role = (select p.role from public.profiles p where p.id = auth.uid())
 and rank = (select p.rank from public.profiles p where p.id = auth.uid())
);

-- POSTS
drop policy if exists "posts readable by members" on public.posts;
create policy "posts readable by members" on public.posts
for select to authenticated using (true);

drop policy if exists "admins publish posts" on public.posts;
create policy "admins publish posts" on public.posts
for insert to authenticated with check (
 author_id = auth.uid()
 and exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.role in ('owner','admin')
 )
);

-- PUBLIC CHAT
drop policy if exists "members read public chat" on public.public_messages;
create policy "members read public chat" on public.public_messages
for select to authenticated using (true);

drop policy if exists "members post public chat" on public.public_messages;
create policy "members post public chat" on public.public_messages
for insert to authenticated with check (user_id = auth.uid());

-- PRIVATE MESSAGES
drop policy if exists "participants read private messages" on public.private_messages;
create policy "participants read private messages" on public.private_messages
for select to authenticated using (
 auth.uid() = sender_id or auth.uid() = recipient_id
);

drop policy if exists "sender inserts private message" on public.private_messages;
create policy "sender inserts private message" on public.private_messages
for insert to authenticated with check (
 sender_id = auth.uid()
 and exists (
  select 1 from public.profiles p
  where p.id = recipient_id and p.role in ('owner','admin')
 )
);

-- AUTOMATIC PROFILE CREATION
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
 insert into public.profiles(id,nickname)
 values(
  new.id,
  coalesce(nullif(new.raw_user_meta_data->>'nickname',''), split_part(new.email,'@',1))
 );
 return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- REALTIME CHAT
do $$ begin
 alter publication supabase_realtime add table public.public_messages;
exception when duplicate_object then null; when others then null;
end $$;

do $$ begin
 alter publication supabase_realtime add table public.private_messages;
exception when duplicate_object then null; when others then null;
end $$;

-- OWNER SETUP
-- Register in the app using the owner email configured in config.js.
-- Confirm your email if Supabase requires it.
-- Then run:

update public.profiles p set role='owner'
from auth.users u
where p.id=u.id
and lower(u.email)=lower('smoketheghost38@gmail.com');

-- SECURITY NOTES
-- Never expose the Supabase service_role key in config.js or browser code.
-- Do not let users self-edit role/rank.

