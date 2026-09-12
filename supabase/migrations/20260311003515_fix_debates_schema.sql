-- 1. Adicionar colunas faltantes para fases e controle do debate
ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS current_phase text DEFAULT 'pre_debate',
  ADD COLUMN IF NOT EXISTS phase_ends_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ended_at timestamp with time zone;

-- 2. Garantir que a coluna current_phase não é um ENUM rígido mas sim texto (caso tenha rodado a migration anterior)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'debates' AND column_name = 'current_phase' AND data_type = 'USER-DEFINED'
    ) THEN
        ALTER TABLE public.debates ALTER COLUMN current_phase TYPE text USING current_phase::text;
    END IF;
END $$;
