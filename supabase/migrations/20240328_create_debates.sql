-- 1. Create Debate Status Enum (only if not exists)
DO $$ BEGIN
    CREATE TYPE debate_status AS ENUM ('pending', 'accepted', 'live', 'ended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Debates Table
CREATE TABLE IF NOT EXISTS public.debates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status debate_status NOT NULL DEFAULT 'pending',
    agora_channel_name TEXT,
    video_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- 3. Create Debate Chat Table
CREATE TABLE IF NOT EXISTS public.debate_chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debate_id UUID NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Debate Votes Table
CREATE TABLE IF NOT EXISTS public.debate_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debate_id UUID REFERENCES public.debates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    vote_for_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(debate_id, user_id)
);

-- 5. Enable RLS
ALTER TABLE public.debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_votes ENABLE ROW LEVEL SECURITY;

-- 6. Policies for debates
DO $$ BEGIN
    CREATE POLICY "Users can view debates they are part of or that are live" 
    ON public.debates FOR SELECT 
    USING (auth.uid() = host_id OR auth.uid() = guest_id OR status = 'live');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Hosts can create debates" 
    ON public.debates FOR INSERT 
    WITH CHECK (auth.uid() = host_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Participants can update debates" 
    ON public.debates FOR UPDATE 
    USING (auth.uid() = host_id OR auth.uid() = guest_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 7. Policies for debate_chat
DO $$ BEGIN
    CREATE POLICY "Users can view chat for debates they can see" 
    ON public.debate_chat FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.debates 
        WHERE public.debates.id = debate_chat.debate_id 
        AND (public.debates.host_id = auth.uid() OR public.debates.guest_id = auth.uid() OR public.debates.status = 'live')
    ));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Participants can send messages" 
    ON public.debate_chat FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 8. Policies for debate_votes
DO $$ BEGIN
    CREATE POLICY "Anyone can view votes"
        ON public.debate_votes FOR SELECT
        USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated users can vote"
        ON public.debate_votes FOR INSERT
        WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 9. Add to Realtime (Handle errors if already in publication)
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.debates;
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.debate_chat;
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.debate_votes;
EXCEPTION WHEN others THEN null; END $$;
