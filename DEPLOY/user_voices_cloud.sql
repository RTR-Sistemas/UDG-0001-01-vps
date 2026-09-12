-- Undoing App - migracao CLOUD (ipmldkprqdhybedhpgmt)
-- Execute este bloco inteiro no Dashboard -> SQL Editor do projeto "novo" (cloud).
-- Espelha exatamente o schema que ja existe na instancia local do VPS.

CREATE TABLE IF NOT EXISTS public.user_voices (
    user_id uuid NOT NULL,
    voice_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    provider text DEFAULT 'elevenlabs'::text NOT NULL,
    sample_audio_url text,
    CONSTRAINT user_voices_pkey PRIMARY KEY (user_id),
    CONSTRAINT user_voices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.user_voices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_voices_select_own ON public.user_voices;
CREATE POLICY user_voices_select_own ON public.user_voices FOR SELECT USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.user_voices TO anon;
GRANT ALL ON TABLE public.user_voices TO authenticated;
GRANT ALL ON TABLE public.user_voices TO service_role;