-- =============================================================================
-- REMOÇÃO DE DEBATES — substituídos pelas Batalhas ao Vivo (vídeo + plateia)
-- =============================================================================
DROP TABLE IF EXISTS public.debate_recordings;
DROP TABLE IF EXISTS public.debate_live_votes;
DROP TABLE IF EXISTS public.debate_votes;
DROP TABLE IF EXISTS public.debate_chat;
DROP TABLE IF EXISTS public.debates;

DROP TYPE IF EXISTS public.debate_phase;
DROP TYPE IF EXISTS public.debate_status;