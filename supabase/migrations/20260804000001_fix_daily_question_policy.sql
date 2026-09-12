-- Permite que qualquer usuário autenticado crie a pergunta do dia
-- apenas se ainda não existir uma para hoje (fallback ao abrir o app).
DROP POLICY IF EXISTS "daily_questions_insert_admin" ON public.daily_questions;

CREATE POLICY "daily_questions_insert_if_missing_today" ON public.daily_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    question_date = CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM public.daily_questions dq WHERE dq.question_date = CURRENT_DATE
    )
  );