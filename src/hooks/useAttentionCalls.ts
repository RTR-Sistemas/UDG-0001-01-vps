/**
 * =============================================================================
 * File: src/hooks/useAttentionCalls.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export function useAttentionCalls() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const callAttention = useCallback(async (receiverId: string, message?: string | null) => {
    if (!user?.id) throw new Error('Usuário não autenticado');
    const { data, error } = await supabase
      .from('attention_calls')
      .insert({ sender_id: user.id, receiver_id: receiverId, message: message ?? null })
      .select('id')
      .single();
    if (error) throw error;
    const id = data?.id as string;

    // Invalida a query na UI para atualizar instantaneamente
    queryClient.invalidateQueries({ queryKey: ["attention_calls_in_chat"] });

    // Nota: o webhook do Supabase (db-webhook.js) dispara o push automaticamente
    // ao detectar o INSERT na tabela attention_calls. Não chamar sendPushEvent aqui
    // para evitar notificações duplicadas.

    return id;
  }, [user?.id, queryClient]);

  const silenceNotifications = useCallback(async (senderId: string, until: Date) => {
    if (!user?.id) throw new Error('Usuário não autenticado');
    const { error } = await supabase
      .from('attention_silence_settings')
      .upsert({
        user_id: user.id,
        sender_id: senderId,
        silenced_until: until.toISOString(),
      }, { onConflict: 'user_id,sender_id' });
    if (error) throw error;
    return true;
  }, [user?.id]);

  return { callAttention, silenceNotifications };
}
