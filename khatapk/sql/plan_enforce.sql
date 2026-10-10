-- Run this in Supabase SQL editor (safe to re-run)
-- Locks plan so users cannot set themselves to Growth/Business from the client.

create or replace function public.my_plan()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select plan from public.profiles where id = auth.uid()),
    'starter'
  );
$$;

create or replace function public.protect_plan_columns()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if auth.role() = 'authenticated' then
      new.plan := old.plan;
      new.paddle_customer_id := old.paddle_customer_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_plan on public.profiles;
create trigger trg_protect_plan
  before update on public.profiles
  for each row execute function public.protect_plan_columns();

create or replace function public.has_plan_at_least(min_plan text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.my_plan()
    when 'business' then true
    when 'growth' then min_plan in ('starter', 'growth')
    else min_plan = 'starter'
  end;
$$;
