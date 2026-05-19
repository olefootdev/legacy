-- Remove atividades de mercado geradas por NPCs (manager_id IS NULL).
-- A partir de agora, apenas transações reais de managers aparecem no feed.
DELETE FROM public.market_activities WHERE manager_id IS NULL;
