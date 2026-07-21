-- M1 : table profiles + trigger de création automatique + RLS
-- À exécuter dans Supabase → SQL Editor.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  birth_date date,
  sex text check (sex in ('female', 'male', 'other')),
  height_cm numeric,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (user_id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update
  using (user_id = auth.uid());

-- Le insert se fait uniquement via le trigger ci-dessous (security definer),
-- jamais directement depuis le client : pas de policy insert pour les users.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
