-- Statut d'abonnement par utilisateur. Écrit uniquement par le rôle service
-- (webhook du prestataire de paiement, ou SQL admin) — jamais par le client :
-- pas de policy insert/update/delete, l'utilisateur ne peut que lire le sien.
-- Absence de ligne = offre gratuite.
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'premium')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users read their own subscription"
  on public.subscriptions for select
  using (user_id = auth.uid());

-- Pour accorder Premium manuellement à un utilisateur (SQL Editor, rôle service) :
--   insert into public.subscriptions (user_id, tier, status)
--   values ('<uuid>', 'premium', 'active')
--   on conflict (user_id) do update set tier = 'premium', status = 'active';
