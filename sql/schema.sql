-- KhataPK — Supabase schema
-- Run in Supabase SQL editor

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default 'Mera Karobar',
  owner_name text,
  phone text,
  city text,
  pin_hash text,
  locale text default 'en',
  plan text default 'starter',
  paddle_customer_id text,
  created_at timestamptz default now()
);

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'customer' check (kind in ('customer','supplier')),
  name text not null,
  phone text,
  address text,
  notes text,
  due_date date,
  reminder_enabled boolean default true,
  reminder_interval_days int default 7,
  created_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  party_id uuid not null references public.parties(id) on delete cascade,
  type text not null check (type in ('credit','payment','adjustment','purchase','paid')),
  amount numeric(14,2) not null,
  description text,
  txn_date date not null default current_date,
  created_at timestamptz default now()
);

create table if not exists public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  amount numeric(14,2) not null,
  category text,
  note text,
  entry_date date not null default current_date,
  created_at timestamptz default now()
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.parties enable row level security;
alter table public.transactions enable row level security;
alter table public.cash_entries enable row level security;
alter table public.activity_log enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own parties" on public.parties for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own txns" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own cash" on public.cash_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own activity" on public.activity_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Staff: owner invites by email; role owner|manager|munshi
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid references auth.users(id) on delete set null,
  email text not null,
  role text not null default 'munshi' check (role in ('owner','manager','munshi')),
  can_edit boolean default true,
  can_delete boolean default false,
  can_view_reports boolean default true,
  invited_at timestamptz default now()
);
alter table public.staff enable row level security;

create or replace function public.is_shop_member(shop uuid)
returns boolean language sql stable as $$
  select auth.uid() = shop
      or exists (
        select 1 from public.staff s
        where s.shop_id = shop and s.member_id = auth.uid()
      );
$$;

drop policy if exists "own parties" on public.parties;
create policy "shop parties" on public.parties for all
  using (public.is_shop_member(user_id))
  with check (public.is_shop_member(user_id));

drop policy if exists "own txns" on public.transactions;
create policy "shop txns" on public.transactions for all
  using (public.is_shop_member(user_id))
  with check (public.is_shop_member(user_id));

drop policy if exists "own cash" on public.cash_entries;
create policy "shop cash" on public.cash_entries for all
  using (public.is_shop_member(user_id))
  with check (public.is_shop_member(user_id));

drop policy if exists "own activity" on public.activity_log;
create policy "shop activity" on public.activity_log for all
  using (public.is_shop_member(user_id))
  with check (public.is_shop_member(user_id));

create policy "staff of shop" on public.staff for all
  using (public.is_shop_member(shop_id))
  with check (auth.uid() = shop_id or member_id = auth.uid());

alter table public.profiles add column if not exists jazzcash text;
alter table public.profiles add column if not exists easypaisa text;
alter table public.profiles add column if not exists raast text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, owner_name, business_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name','Owner'), coalesce(new.raw_user_meta_data->>'business','Mera Karobar'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
