/**
 * =============================================================================
 * File: src/hooks/usePresence.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */


import { useEffect, useRef, useState } from 'react'
import { supabase } from "@/integrations/supabase/client"

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export function usePresence(channelName: string, payload: Record<string, any>) {
  const [state, setState] = useState<any>({})

  // O payload mudava a cada render e o efeito so dependia de channelName, entao
  // o valor rastreado ficava congelado no primeiro render. O ref mantem o
  // payload atual sem reinscrever o canal a cada render.
  const payloadRef = useRef(payload)
  useEffect(() => { payloadRef.current = payload })

  useEffect(() => {
    // A chave de presenca identifica ESTE cliente. Usar a string fixa
    // 'presence' fazia todos os usuarios colidirem na mesma chave, e o
    // presenceState() so mostrava um participante.
    const presenceKey = String(payload?.user_id || payload?.id || `anon-${Math.random().toString(36).slice(2)}`)
    const channel = supabase.channel(channelName, { config: { presence: { key: presenceKey } } })
    channel.on('presence', { event: 'sync' }, () => {
      setState(channel.presenceState())
    })
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') channel.track(payloadRef.current)
    })
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, payload?.user_id, payload?.id])

  return state
}
