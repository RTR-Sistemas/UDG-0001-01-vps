import { supabase } from "@/integrations/supabase/client";

export type PushEventType = 'message' | 'mention' | 'attention_call' | 'friend_request' | 'comment' | 'post' | 'test' | 'community_post' | 'community_member_join' | 'reply';

export type SendPushEventPayload =
  | { eventType: 'message'; messageId: string }
  | { eventType: 'mention'; mentionId: string }
  | { eventType: 'attention_call'; attentionCallId: string }
  | { eventType: 'friend_request'; friendRequestId: string }
  | { eventType: 'comment'; commentId: string }
  | { eventType: 'post'; postId: string }
  | { eventType: 'community_post'; communityId: string, authorId: string }
  | { eventType: 'community_member_join'; communityId: string, userId: string }
  | { eventType: 'reply'; replyMessageId: string, originalMessageId: string, authorId: string, targetUserId?: string }
  | { eventType: 'test' };

export type SendPushEventResult = {
  ok: boolean;
  eventType?: PushEventType;
  receiverIds?: string[];
  result?: {
    ok?: boolean;
    skipped?: boolean;
    reason?: string;
    sent?: number;
    failed?: number;
    total?: number;
  };
  error?: string;
};

/**
 * Envia o evento para nosso backend via Netlify Function.
 * Retorna o corpo parseado para que o caller saiba se a entrega de teste realmente ocorreu.
 */
export async function sendPushEvent(payload: SendPushEventPayload): Promise<SendPushEventResult | void> {
  try {
    let { data: { session } } = await supabase.auth.getSession();
    let token = session?.access_token;

    if (!token) {
      const refreshed = await supabase.auth.refreshSession();
      token = refreshed.data.session?.access_token ?? null;
    }

    if (!token) {
      console.warn('[Push] sendPushEvent: sem token de sessão, push não será enviado.');
      return;
    }

    const execute = async (bearerToken: string) => fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(payload),
    });

    let res = await execute(token);
    if (res.status === 401) {
      const refreshed = await supabase.auth.refreshSession();
      const refreshedToken = refreshed.data.session?.access_token ?? null;
      if (refreshedToken && refreshedToken !== token) {
        res = await execute(refreshedToken);
      }
    }

    const text = await res.text();
    let parsed: SendPushEventResult | undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }

    if (!res.ok) {
      console.warn('[Push] Erro enviando push notification payload:', parsed?.error || text || res.statusText);
      return parsed;
    }

    return parsed;
  } catch (e) {
    console.error('[Push] Network erro ao chamar /api/send-push', e);
  }
}

export async function deleteAttentionCall(callId: string) {
  try {
    const { error } = await supabase
      .from('attention_calls')
      .delete()
      .eq('id', callId);
    if (error) throw error;
  } catch (err) {
    console.error('[Push] Erro ao deletar attention_call:', err);
  }
}

export async function markAttentionCallViewed(callId: string) {
  try {
    const { error } = await supabase
      .from('attention_calls')
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', callId);
    if (error) throw error;
  } catch (err) {
    console.error('[Push] Erro ao marcar attention_call como visualizada:', err);
  }
}
