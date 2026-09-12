-- =============================================================================
-- Migration: 20_mesh_routing_and_translation.sql
-- Purpose: Support for Translation Cache, Audio Dubbing status, and Mesh DTN queue
-- =============================================================================

-- 1. Table for caching text translations
CREATE TABLE IF NOT EXISTS public.translation_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_lang VARCHAR(10) NOT NULL DEFAULT 'auto',
  target_lang VARCHAR(10) NOT NULL,
  source_text_hash TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_translation_hash_lang 
  ON public.translation_cache(source_text_hash, target_lang);

-- 2. Table for storing message translation & dubbing state
CREATE TABLE IF NOT EXISTS public.message_translations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  original_text TEXT,
  original_language VARCHAR(10) DEFAULT 'auto',
  translated_text TEXT,
  target_language VARCHAR(10),
  original_audio_url TEXT,
  translated_audio_url TEXT,
  translation_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, error
  dubbing_method VARCHAR(30), -- cloned, synthesized, google, fallback
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_translations_msg 
  ON public.message_translations(message_id);

-- 3. Table for Offline Mesh DTN Message Queue (Store & Forward)
CREATE TABLE IF NOT EXISTS public.mesh_message_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  content TEXT,
  media_urls TEXT[],
  route_taken JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'queued', -- queued, forwarding, delivered, expired
  ttl INTEGER DEFAULT 100,
  priority VARCHAR(10) DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  delivered_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_mesh_queue_receiver 
  ON public.mesh_message_queue(receiver_id, status);

-- RLS Policies
ALTER TABLE public.translation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesh_message_queue ENABLE ROW LEVEL SECURITY;

-- Allow public read access to translation cache for performance
DROP POLICY IF EXISTS "Allow public read translation cache" ON public.translation_cache;
CREATE POLICY "Allow public read translation cache" ON public.translation_cache
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert translation cache" ON public.translation_cache;
CREATE POLICY "Allow authenticated insert translation cache" ON public.translation_cache
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies for message_translations
DROP POLICY IF EXISTS "Allow users to view message translations" ON public.message_translations;
CREATE POLICY "Allow users to view message translations" ON public.message_translations
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow users to manage message translations" ON public.message_translations;
CREATE POLICY "Allow users to manage message translations" ON public.message_translations
  FOR ALL USING (auth.role() = 'authenticated');

-- Policies for mesh queue
DROP POLICY IF EXISTS "Allow sender or receiver to read mesh queue" ON public.mesh_message_queue;
CREATE POLICY "Allow sender or receiver to read mesh queue" ON public.mesh_message_queue
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Allow authenticated to insert into mesh queue" ON public.mesh_message_queue;
CREATE POLICY "Allow authenticated to insert into mesh queue" ON public.mesh_message_queue
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Allow authenticated to update mesh queue" ON public.mesh_message_queue;
CREATE POLICY "Allow authenticated to update mesh queue" ON public.mesh_message_queue
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
