-- M34 : enregistre le plan souscrit dans public.subscriptions
--
-- La table ne stockait que tier et status. Impossible donc de répondre à
-- « qui est sur quel plan ? » sans ouvrir le dashboard Stripe — ce qui s'est
-- vu au moment de retirer l'offre annuelle : 3 abonnements actifs, aucun
-- moyen de savoir lesquels étaient annuels.
--
-- price_id est la source de vérité (l'identifiant Stripe du tarif).
-- plan est un libellé dérivé, pour que l'app n'ait pas à connaître les
-- identifiants Stripe : 'monthly', 'quarterly', 'annual'.
--
-- Volontairement SANS contrainte CHECK sur plan. Si un tarif d'une autre
-- cadence est créé un jour, une contrainte ferait échouer l'upsert du
-- webhook — et un webhook qui échoue, c'est un abonnement que l'app ne voit
-- pas. Mieux vaut une valeur inattendue en base qu'un paiement perdu.

alter table public.subscriptions
  add column if not exists price_id text,
  add column if not exists plan text;

comment on column public.subscriptions.price_id is
  'Identifiant du tarif Stripe (price_...). Source de vérité du plan souscrit.';
comment on column public.subscriptions.plan is
  'Libellé dérivé du tarif : monthly | quarterly | annual. Renseigné par stripe-webhook.';

-- Les lignes existantes restent à null jusqu'au prochain événement Stripe de
-- chaque abonnement (renouvellement ou modification), qui déclenche l'upsert.
--
-- Vérification après application :
--
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'subscriptions'
--     and column_name in ('price_id', 'plan');
