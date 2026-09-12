-- =============================================================================
-- UndoinG - Funções PL/pgSQL faltantes (recuperadas de src/sql e legacy_pending)
-- 1) hard_delete_message  + trigger trg_hard_delete_message
-- 2) mark_daily_question_used + pool de perguntas do dia (seed seguro)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) hard_delete_message
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hard_delete_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.messages WHERE id = NEW.id;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hard_delete_message ON public.messages;
CREATE TRIGGER trg_hard_delete_message
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.hard_delete_message();

-- ---------------------------------------------------------------------------
-- 2) mark_daily_question_used + pool
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_questions_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  last_used_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_questions_pool ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_questions_pool_select_all ON public.daily_questions_pool;
CREATE POLICY daily_questions_pool_select_all ON public.daily_questions_pool
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.mark_daily_question_used(p_pool_id uuid, p_used_date date)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.daily_questions_pool
  SET last_used_date = p_used_date
  WHERE id = p_pool_id AND (last_used_date IS NULL OR last_used_date < p_used_date);
$$;

REVOKE ALL ON FUNCTION public.mark_daily_question_used FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_daily_question_used TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed do pool (à prova de repetição: sem depender de constraint)
-- ---------------------------------------------------------------------------
INSERT INTO public.daily_questions_pool (question)
SELECT q
FROM (VALUES
  ('Qual foi a melhor parte do seu dia hoje?'),
  ('O que você gostaria de mudar no mundo hoje?'),
  ('Qual conselho você daria para a versão mais jovem de você?'),
  ('Se pudesse viajar para qualquer lugar agora, para onde iria?'),
  ('Qual música define seu momento atual?'),
  ('O que te faz sorrir de verdade?'),
  ('Qual foi a última coisa que te fez rir muito?'),
  ('Se tivesse um superpoder, qual seria?'),
  ('Qual lugar do mundo você mais quer conhecer?'),
  ('O que você não consegue viver sem?'),
  ('Qual foi a melhor decisão que você já tomou?'),
  ('O que você está mais ansioso(a) para no futuro?'),
  ('Qual é o seu maior sonho?'),
  ('O que você aprendeu com a última dificuldade?'),
  ('Qual filme ou série você assistiria de novo?'),
  ('Se pudesse jantar com alguém famoso, quem seria?'),
  ('O que você faria se ganhasse na loteria?'),
  ('Qual hábito você quer criar?'),
  ('O que você gostaria de dizer para alguém hoje?'),
  ('Qual é a sua comida favorita?'),
  ('O que te motiva a acordar de manhã?'),
  ('Qual foi a última vez que você ajudou alguém?'),
  ('O que significa felicidade para você?'),
  ('Se pudesse mudar uma coisa no passado, o que seria?'),
  ('Qual é a sua maior conquista até hoje?'),
  ('O que você faria com um dia livre?'),
  ('Qual é a coisa mais importante que aprendeu na vida?'),
  ('Se pudesse aprender qualquer habilidade instantaneamente, qual seria?'),
  ('O que você acha que as pessoas mais subestimam em você?'),
  ('Qual foi o melhor presente que você já recebeu?'),
  ('O que você gostaria de fazer mais vezes?'),
  ('Se pudesse viver em outra época, qual seria?'),
  ('Qual é a melhor lembrança da sua infância?'),
  ('O que te deixa nervoso(a)?'),
  ('Qual é o seu lugar favorito na cidade?'),
  ('O que você gostaria que as pessoas soubessem sobre você?'),
  ('Se só pudesse comer uma comida para sempre, qual seria?'),
  ('Qual é a sua frase favorita?'),
  ('O que você quer conquistar neste ano?'),
  ('Quem é a pessoa que mais te inspira?'),
  ('Qual foi a última coisa que você comprou que valeu a pena?'),
  ('O que você faria se tivesse mais coragem?'),
  ('Qual é a sua forma favorita de relaxar?'),
  ('Que conselho você gostaria de ter recebido?'),
  ('O que você está grato(a) hoje?'),
  ('Se pudesse mandar uma mensagem para todos do mundo, o que diria?'),
  ('Qual é a coisa mais estranha que você já comeu?'),
  ('O que você gostaria de fazer antes de morrer?'),
  ('Qual foi a melhor viagem que você já fez?'),
  ('O que te faz sentir vivo(a)?')
) AS v(q)
WHERE NOT EXISTS (SELECT 1 FROM public.daily_questions_pool p WHERE p.question = v.q);