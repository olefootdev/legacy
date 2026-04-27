-- Função RPC para incrementar contador de uso de vocabulário
CREATE OR REPLACE FUNCTION public.increment_vocabulary_usage(p_phrase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.football_vocabulary
  SET
    confirm_count = confirm_count + 1,
    updated_at = now()
  WHERE id = p_phrase_id AND is_active = true;
END;
$$;
