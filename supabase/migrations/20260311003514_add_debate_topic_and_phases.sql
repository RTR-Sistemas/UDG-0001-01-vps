-- 1. Create Debate Phase Enum
DO $$ BEGIN
    CREATE TYPE debate_phase AS ENUM (
        'pre_debate',
        'opening',
        'argumentation',
        'rebuttal', -- réplica
        'surrebuttal', -- tréplica
        'qa', -- perguntas da audiência
        'closing'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add columns to debates table
ALTER TABLE public.debates 
ADD COLUMN IF NOT EXISTS topic TEXT,
ADD COLUMN IF NOT EXISTS current_phase debate_phase DEFAULT 'pre_debate',
ADD COLUMN IF NOT EXISTS phase_ends_at TIMESTAMP WITH TIME ZONE;

-- 3. Create Continuous Votes Table (Voto de Momento)
CREATE TABLE IF NOT EXISTS public.debate_live_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debate_id UUID NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vote_for_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- We don't enforce a UNIQUE constraint on (debate_id, user_id) here 
-- because this is a continuous vote. Users can change their vote over time.
-- Real-time charts will use the latest vote or count them over a time window.

-- 4. Enable RLS for new table
ALTER TABLE public.debate_live_votes ENABLE ROW LEVEL SECURITY;

-- 5. Policies for debate_live_votes
DO $$ BEGIN
    CREATE POLICY "Anyone can view live votes"
        ON public.debate_live_votes FOR SELECT
        USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated users can cast live votes"
        ON public.debate_live_votes FOR INSERT
        WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 6. Add to Realtime
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.debate_live_votes;
EXCEPTION WHEN others THEN null; END $$;