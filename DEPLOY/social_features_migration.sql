-- =============================================================================
-- Migração: Social Features Completas (Block, Friend Request com mensagem, Delete All, Emojis)
-- Idempotente, compatível com schema existente
-- =============================================================================

-- 1. USER BLOCKS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocks" ON public.user_blocks
    FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others" ON public.user_blocks
    FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock" ON public.user_blocks
    FOR DELETE USING (auth.uid() = blocker_id);

-- Função para verificar se usuário está bloqueado (usada em RLS de messages, etc)
CREATE OR REPLACE FUNCTION public.is_user_blocked(check_user_id UUID, target_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_blocks
        WHERE blocker_id = check_user_id AND blocked_id = target_user_id
    );
$$;

-- 2. FRIEND REQUESTS ENHANCED ────────────────────────────────────────────────
-- Adicionar coluna message na tabela existente (se não existir)
DO $$ BEGIN
    ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS message TEXT;
    ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS message_read BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS source VARCHAR(32) DEFAULT 'code'; -- 'code', 'search', 'profile', 'mutual'
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Índice para buscar requests com mensagem não lida
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_unread 
    ON public.friend_requests(receiver_id, message_read) 
    WHERE status = 'pending' AND message IS NOT NULL;

-- 3. DELETED MESSAGES ARCHIVE (para "apagar para todos" com recuperação) ───────
CREATE TABLE IF NOT EXISTS public.deleted_messages_archive (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_message_id UUID NOT NULL,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT,
    media_urls TEXT[],
    message_type VARCHAR(32),
    deleted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deleted_at TIMESTAMPTZ DEFAULT now(),
    delete_scope VARCHAR(16) NOT NULL CHECK (delete_scope IN ('me', 'everyone')),
    original_created_at TIMESTAMPTZ
);

ALTER TABLE public.deleted_messages_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deleted messages" ON public.deleted_messages_archive
    FOR SELECT USING (
        deleted_by = auth.uid() OR 
        sender_id = auth.uid() OR 
        conversation_id IN (
            SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System can archive deleted messages" ON public.deleted_messages_archive
    FOR INSERT WITH CHECK (true); -- via RPC

CREATE INDEX IF NOT EXISTS idx_deleted_messages_archive_conversation 
    ON public.deleted_messages_archive(conversation_id, deleted_at DESC);

-- 4. EMOJI PACKS & CUSTOM STICKERS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emoji_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL,
    slug VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    icon_emoji VARCHAR(16),
    is_animated BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.emoji_pack_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID NOT NULL REFERENCES public.emoji_packs(id) ON DELETE CASCADE,
    emoji VARCHAR(16) NOT NULL,
    name VARCHAR(64),
    keywords TEXT[],
    animation_url TEXT, -- para emojis animados (Lottie/WebP)
    sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.user_emoji_packs (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pack_id UUID NOT NULL REFERENCES public.emoji_packs(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, pack_id)
);

ALTER TABLE public.emoji_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emoji_pack_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_emoji_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packs" ON public.emoji_packs FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Anyone can view pack items" ON public.emoji_pack_items FOR SELECT USING (pack_id IN (SELECT id FROM public.emoji_packs WHERE is_active = TRUE));
CREATE POLICY "Users can view their packs" ON public.user_emoji_packs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can unlock packs" ON public.user_emoji_packs FOR INSERT WITH CHECK (user_id = auth.uid());

-- 5. MESSAGE REACTIONS EXTENDED (já existe message_reactions, adicionar tipos) ──
DO $$ BEGIN
    ALTER TABLE public.message_reactions ADD COLUMN IF NOT EXISTS reaction_type VARCHAR(16) DEFAULT 'emoji'; -- 'emoji', 'sticker', 'custom'
    ALTER TABLE public.message_reactions ADD COLUMN IF NOT EXISTS sticker_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 6. PWA INSTALL TRACKING ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pwa_install_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    platform VARCHAR(32), -- 'android', 'ios', 'desktop', 'unknown'
    browser VARCHAR(64),
    install_source VARCHAR(32), -- 'banner', 'menu', 'prompt', 'auto'
    installed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pwa_install_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their installs" ON public.pwa_install_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can log installs" ON public.pwa_install_events FOR INSERT WITH CHECK (true);

-- 7. RPC FUNCTIONS ────────────────────────────────────────────────────────────

-- Block user
CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_blocker_id UUID := auth.uid();
    v_result JSONB;
BEGIN
    IF v_blocker_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_AUTHENTICATED');
    END IF;
    IF v_blocker_id = p_blocked_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'CANNOT_BLOCK_SELF');
    END IF;
    
    INSERT INTO public.user_blocks (blocker_id, blocked_id, reason)
    VALUES (v_blocker_id, p_blocked_id, p_reason)
    ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET reason = EXCLUDED.reason;
    
    -- Limpar amizade se existir
    DELETE FROM public.friendships 
    WHERE (user_id = v_blocker_id AND friend_id = p_blocked_id)
       OR (user_id = p_blocked_id AND friend_id = v_blocker_id);
    
    -- Cancelar friend requests pendentes entre eles
    UPDATE public.friend_requests SET status = 'cancelled'
    WHERE (sender_id = v_blocker_id AND receiver_id = p_blocked_id)
       OR (sender_id = p_blocked_id AND receiver_id = v_blocker_id)
       AND status = 'pending';
    
    -- Apagar mensagens privadas entre eles (opcional: marcar como deleted)
    UPDATE public.messages SET is_deleted = TRUE, deleted_at = now()
    WHERE conversation_id IN (
        SELECT id FROM public.conversations c
        JOIN public.conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = v_blocker_id
        JOIN public.conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = p_blocked_id
        WHERE c.is_group = FALSE
    ) AND is_deleted = FALSE;
    
    RETURN jsonb_build_object('success', TRUE, 'message', 'Usuário bloqueado');
END $$;

-- Unblock user
CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_blocker_id UUID := auth.uid();
BEGIN
    IF v_blocker_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_AUTHENTICATED');
    END IF;
    DELETE FROM public.user_blocks WHERE blocker_id = v_blocker_id AND blocked_id = p_blocked_id;
    RETURN jsonb_build_object('success', TRUE, 'message', 'Usuário desbloqueado');
END $$;

-- Send friend request with optional message
CREATE OR REPLACE FUNCTION public.send_friend_request(p_receiver_id UUID, p_message TEXT DEFAULT NULL, p_source VARCHAR(32) DEFAULT 'search')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_sender_id UUID := auth.uid();
    v_existing RECORD;
BEGIN
    IF v_sender_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_AUTHENTICATED');
    END IF;
    IF v_sender_id = p_receiver_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'CANNOT_ADD_SELF');
    END IF;
    
    -- Check if blocked either way
    IF public.is_user_blocked(v_sender_id, p_receiver_id) OR public.is_user_blocked(p_receiver_id, v_sender_id) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'USER_BLOCKED');
    END IF;
    
    -- Check existing friendship
    SELECT 1 INTO v_existing FROM public.friendships
    WHERE (user_id = v_sender_id AND friend_id = p_receiver_id)
       OR (user_id = p_receiver_id AND friend_id = v_sender_id);
    IF FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'ALREADY_FRIENDS');
    END IF;
    
    -- Check existing request
    SELECT * INTO v_existing FROM public.friend_requests
    WHERE status = 'pending' 
      AND ((sender_id = v_sender_id AND receiver_id = p_receiver_id) 
           OR (sender_id = p_receiver_id AND receiver_id = v_sender_id));
    IF FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'REQUEST_PENDING', 'request_id', v_existing.id);
    END IF;
    
    INSERT INTO public.friend_requests (sender_id, receiver_id, message, source)
    VALUES (v_sender_id, p_receiver_id, p_message, p_source)
    RETURNING id INTO v_existing;
    
    RETURN jsonb_build_object('success', TRUE, 'request_id', v_existing.id, 'message', 'Solicitação enviada');
END $$;

-- Accept friend request
CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_request RECORD;
BEGIN
    IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_AUTHENTICATED'); END IF;
    
    SELECT * INTO v_request FROM public.friend_requests WHERE id = p_request_id AND receiver_id = v_user_id AND status = 'pending';
    IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'REQUEST_NOT_FOUND'); END IF;
    
    INSERT INTO public.friendships (user_id, friend_id) VALUES (v_request.sender_id, v_request.receiver_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.friendships (user_id, friend_id) VALUES (v_request.receiver_id, v_request.sender_id) ON CONFLICT DO NOTHING;
    UPDATE public.friend_requests SET status = 'accepted' WHERE id = p_request_id;
    
    RETURN jsonb_build_object('success', TRUE, 'message', 'Agora são amigos!');
END $$;

-- Reject friend request
CREATE OR REPLACE FUNCTION public.reject_friend_request(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.friend_requests SET status = 'rejected' WHERE id = p_request_id AND receiver_id = auth.uid() AND status = 'pending';
    RETURN jsonb_build_object('success', TRUE, 'message', 'Solicitação recusada');
END $$;

-- Delete all messages in conversation (for current user or everyone)
CREATE OR REPLACE FUNCTION public.delete_conversation_messages(p_conversation_id UUID, p_scope VARCHAR(16) DEFAULT 'me', p_message_ids UUID[] DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_deleted_count INT := 0;
    v_archive_ids UUID[];
BEGIN
    IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_AUTHENTICATED'); END IF;
    
    -- Verify participant
    IF NOT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = p_conversation_id AND user_id = v_user_id) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_PARTICIPANT');
    END IF;
    
    IF p_scope = 'everyone' THEN
        -- Delete for everyone: archive + mark deleted
        IF p_message_ids IS NOT NULL AND array_length(p_message_ids, 1) > 0 THEN
            INSERT INTO public.deleted_messages_archive (original_message_id, conversation_id, sender_id, content, media_urls, message_type, deleted_by, delete_scope, original_created_at)
            SELECT m.id, m.conversation_id, m.user_id, m.content, m.media_urls, 
                   CASE WHEN m.content LIKE '__sticker%' THEN 'sticker' WHEN m.media_urls IS NOT NULL THEN 'media' WHEN m.content LIKE '__poll__' THEN 'poll' ELSE 'text' END,
                   v_user_id, 'everyone', m.created_at
            FROM public.messages m
            WHERE m.id = ANY(p_message_ids) AND m.conversation_id = p_conversation_id
            RETURNING id INTO v_archive_ids;
            
            UPDATE public.messages SET is_deleted = TRUE, deleted_at = now(), deleted_by = v_user_id, delete_scope = 'everyone' WHERE id = ANY(p_message_ids);
            GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        END IF;
    ELSE
        -- Delete for me only (soft delete via user-specific flag would be ideal, here we mark deleted for user)
        -- Using a simpler approach: mark as deleted for this user via a user_deleted_messages table would be better
        -- For now, we'll use the existing deleted_at mechanism but scope='me' doesn't exist in messages table
        -- We'll implement user-specific deletion via a separate table or JSONB column
        IF p_message_ids IS NOT NULL AND array_length(p_message_ids, 1) > 0 THEN
            INSERT INTO public.deleted_messages_archive (original_message_id, conversation_id, sender_id, content, media_urls, message_type, deleted_by, delete_scope, original_created_at)
            SELECT m.id, m.conversation_id, m.user_id, m.content, m.media_urls,
                   CASE WHEN m.content LIKE '__sticker%' THEN 'sticker' WHEN m.media_urls IS NOT NULL THEN 'media' WHEN m.content LIKE '__poll__' THEN 'poll' ELSE 'text' END,
                   v_user_id, 'me', m.created_at
            FROM public.messages m
            WHERE m.id = ANY(p_message_ids) AND m.conversation_id = p_conversation_id
            RETURNING id INTO v_archive_ids;
            GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        END IF;
    END IF;
    
    RETURN jsonb_build_object('success', TRUE, 'deleted_count', v_deleted_count, 'archived_ids', v_archive_ids);
END $$;

-- Delete entire conversation (all messages)
CREATE OR REPLACE FUNCTION public.delete_entire_conversation(p_conversation_id UUID, p_scope VARCHAR(16) DEFAULT 'me')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_msg_ids UUID[];
BEGIN
    IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_AUTHENTICATED'); END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = p_conversation_id AND user_id = v_user_id) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_PARTICIPANT');
    END IF;
    
    SELECT ARRAY_AGG(id) INTO v_msg_ids FROM public.messages WHERE conversation_id = p_conversation_id AND is_deleted = FALSE;
    IF v_msg_ids IS NULL THEN RETURN jsonb_build_object('success', TRUE, 'deleted_count', 0); END IF;
    
    RETURN public.delete_conversation_messages(p_conversation_id, p_scope, v_msg_ids);
END $$;

-- Get blocked users list
CREATE OR REPLACE FUNCTION public.get_blocked_users()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_AUTHENTICATED'); END IF;
    
    SELECT jsonb_agg(jsonb_build_object(
        'id', ub.id,
        'blocked_user', jsonb_build_object('id', p.id, 'username', p.username, 'full_name', p.full_name, 'avatar_url', p.avatar_url),
        'reason', ub.reason,
        'created_at', ub.created_at
    )) INTO v_result
    FROM public.user_blocks ub
    JOIN public.profiles p ON p.id = ub.blocked_id
    WHERE ub.blocker_id = v_user_id
    ORDER BY ub.created_at DESC;
    
    RETURN jsonb_build_object('success', TRUE, 'blocks', COALESCE(v_result, '[]'::JSONB));
END $$;

-- Unlock emoji pack
CREATE OR REPLACE FUNCTION public.unlock_emoji_pack(p_pack_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_pack RECORD;
BEGIN
    IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_AUTHENTICATED'); END IF;
    
    SELECT * INTO v_pack FROM public.emoji_packs WHERE id = p_pack_id AND is_active = TRUE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'PACK_NOT_FOUND'); END IF;
    
    IF v_pack.is_premium THEN
        -- TODO: verificar se usuário tem premium/coins
        RETURN jsonb_build_object('success', FALSE, 'error', 'PREMIUM_REQUIRED');
    END IF;
    
    INSERT INTO public.user_emoji_packs (user_id, pack_id) VALUES (v_user_id, p_pack_id) ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('success', TRUE, 'message', 'Pack desbloqueado!');
END $$;

-- Log PWA install
CREATE OR REPLACE FUNCTION public.log_pwa_install(p_platform VARCHAR(32), p_browser VARCHAR(64), p_source VARCHAR(32), p_installed BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.pwa_install_events (user_id, platform, browser, install_source, installed)
    VALUES (auth.uid(), p_platform, p_browser, p_source, p_installed);
    RETURN jsonb_build_object('success', TRUE);
END $$;

-- Get available emoji packs for user
CREATE OR REPLACE FUNCTION public.get_user_emoji_packs()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_AUTHENTICATED'); END IF;
    
    SELECT jsonb_agg(jsonb_build_object(
        'id', ep.id,
        'name', ep.name,
        'slug', ep.slug,
        'description', ep.description,
        'icon_emoji', ep.icon_emoji,
        'is_animated', ep.is_animated,
        'is_premium', ep.is_premium,
        'unlocked', uep.user_id IS NOT NULL,
        'items', (
            SELECT jsonb_agg(jsonb_build_object('emoji', epi.emoji, 'name', epi.name, 'animation_url', epi.animation_url))
            FROM public.emoji_pack_items epi WHERE epi.pack_id = ep.id ORDER BY epi.sort_order
        )
    )) INTO v_result
    FROM public.emoji_packs ep
    LEFT JOIN public.user_emoji_packs uep ON uep.pack_id = ep.id AND uep.user_id = v_user_id
    WHERE ep.is_active = TRUE
    ORDER BY ep.sort_order;
    
    RETURN jsonb_build_object('success', TRUE, 'packs', COALESCE(v_result, '[]'::JSONB));
END $$;

-- 8. GRANTS ───────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT SELECT, INSERT ON public.deleted_messages_archive TO authenticated;
GRANT SELECT ON public.emoji_packs TO authenticated;
GRANT SELECT ON public.emoji_pack_items TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_emoji_packs TO authenticated;
GRANT SELECT, INSERT ON public.pwa_install_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_conversation_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_entire_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_blocked_users TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_emoji_pack TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_pwa_install TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_emoji_packs TO authenticated;

-- 9. SEED DEFAULT EMOJI PACKS ────────────────────────────────────────────────
INSERT INTO public.emoji_packs (name, slug, description, icon_emoji, is_animated, is_premium, sort_order) VALUES
('Clássicos', 'classic', 'Emojis padrão do sistema', '😊', FALSE, FALSE, 1),
('Animados', 'animated', 'Emojis animados divertidos', '✨', TRUE, FALSE, 2),
('Reações', 'reactions', 'Para reagir rápido nas mensagens', '👍', FALSE, FALSE, 3),
('Memes', 'memes', 'Emojis de meme populares', '😂', FALSE, TRUE, 4),
('Animais', 'animals', 'Bichinhos fofos e engraçados', '🐱', FALSE, FALSE, 5),
('Comida', 'food', 'Comidas e bebidas', '🍕', FALSE, FALSE, 6),
('Esportes', 'sports', 'Atividades e esportes', '⚽', FALSE, FALSE, 7),
('Viagens', 'travel', 'Lugares e transporte', '✈️', FALSE, FALSE, 8)
ON CONFLICT (slug) DO NOTHING;

-- Itens do pack Clássicos
INSERT INTO public.emoji_pack_items (pack_id, emoji, name, keywords, sort_order)
SELECT id, e.emoji, e.name, e.keywords, e.sort_order
FROM public.emoji_packs ep
CROSS JOIN LATERAL (VALUES
    ('😊', 'Sorrindo', ARRAY['feliz', 'sorriso', 'alegria'], 1),
    ('😂', 'Rindo muito', ARRAY['rindo', 'haha', 'engraçado'], 2),
    ('🥰', 'Apaixonado', ARRAY['amor', 'coração', 'fofo'], 3),
    ('😍', 'Olhos de coração', ARRAY['amor', 'apaixonado', 'lindo'], 4),
    ('🤔', 'Pensando', ARRAY['pensando', 'hmm', 'dúvida'], 5),
    ('😭', 'Chorando', ARRAY['triste', 'choro', 'chorando'], 6),
    ('😡', 'Bravo', ARRAY['raiva', 'bravo', 'furioso'], 7),
    ('👍', 'Curtir', ARRAY['like', 'ok', 'bom', 'aprovado'], 8),
    ('👎', 'Não curti', ARRAY['dislike', 'não', 'ruim'], 9),
    ('🎉', 'Festa', ARRAY['comemoração', 'parabéns', 'festa'], 10),
    ('🔥', 'Fogo', ARRAY['top', 'incrível', 'fogo'], 11),
    ('💯', 'Cem por cento', ARRAY['perfeito', '100', 'exato'], 12),
    ('🤝', 'Aperto de mão', ARRAY['acordo', 'parceria', 'combinado'], 13),
    ('🙏', 'Obrigado/Prece', ARRAY['gratidão', 'obrigado', 'por favor'], 14),
    ('✨', 'Brilho', ARRAY['novo', 'brilho', 'mágico'], 15)
) e(emoji, name, keywords, sort_order)
WHERE ep.slug = 'classic'
ON CONFLICT DO NOTHING;

-- Itens do pack Animados (placeholders - URLs de animação Lottie/WebP seriam configuradas no admin)
INSERT INTO public.emoji_pack_items (pack_id, emoji, name, keywords, sort_order, animation_url)
SELECT id, e.emoji, e.name, e.keywords, e.sort_order, e.anim_url
FROM public.emoji_packs ep
CROSS JOIN LATERAL (VALUES
    ('😂', 'Rindo animado', ARRAY['rindo', 'animado'], 1, 'https://cdn.udg.app/animations/laugh.json'),
    ('😍', 'Coração batendo', ARRAY['amor', 'coração', 'batendo'], 2, 'https://cdn.udg.app/animations/heart.json'),
    ('🎉', 'Confete', ARRAY['festa', 'confete', 'comemoração'], 3, 'https://cdn.udg.app/animations/confetti.json'),
    ('🔥', 'Fogo animado', ARRAY['fogo', 'chama', 'top'], 4, 'https://cdn.udg.app/animations/fire.json'),
    ('✨', 'Brilho mágico', ARRAY['mágico', 'brilho', 'estrela'], 5, 'https://cdn.udg.app/animations/sparkle.json'),
    ('💯', '100 pulsando', ARRAY['perfeito', 'pulsando'], 6, 'https://cdn.udg.app/animations/100.json'),
    ('😭', 'Choro dramático', ARRAY['triste', 'drama', 'chorando'], 7, 'https://cdn.udg.app/animations/cry.json'),
    ('🤩', 'Estrelas nos olhos', ARRAY['uau', 'incrível', 'estrelas'], 8, 'https://cdn.udg.app/animations/stars.json')
) e(emoji, name, keywords, sort_order, anim_url)
WHERE ep.slug = 'animated'
ON CONFLICT DO NOTHING;

-- Itens do pack Reações (para message reactions)
INSERT INTO public.emoji_pack_items (pack_id, emoji, name, keywords, sort_order)
SELECT id, e.emoji, e.name, e.keywords, e.sort_order
FROM public.emoji_packs ep
CROSS JOIN LATERAL (VALUES
    ('👍', 'Like', ARRAY['like', 'curtir', 'bom'], 1),
    ('❤️', 'Love', ARRAY['amor', 'love', 'coração'], 2),
    ('😂', 'Haha', ARRAY['rindo', 'engraçado', 'haha'], 3),
    ('😮', 'Uau', ARRAY['surpresa', 'uau', 'wow'], 4),
    ('😢', 'Triste', ARRAY['triste', 'pena', 'choro'], 5),
    ('😡', 'Raiva', ARRAY['raiva', 'bravo', 'furioso'], 6),
    ('🤯', 'Mind blown', ARRAY['incrível', 'uau', 'explodiu'], 7),
    ('🙌', 'Aleluia', ARRAY['graças', 'vitória', 'consegui'], 8)
) e(emoji, name, keywords, sort_order)
WHERE ep.slug = 'reactions'
ON CONFLICT DO NOTHING;