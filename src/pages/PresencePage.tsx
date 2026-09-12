/**
 * =============================================================================
 * File: src/pages/PresencePage.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */


import { useEffect, useState } from 'react'
import { supabase } from "@/integrations/supabase/client"

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type PresenceMeta = { username?: string|null, full_name?: string|null, last_seen: string }

export default function PresencePage() {
  const [peers, setPeers] = useState<Record<string, PresenceMeta>>({})
  const [selfState, setSelfState] = useState<any>(null)

  useEffect(() => {
    let channel = supabase.channel('presence_dashboard', { config: { presence: { key: 'presence' } } })

    const track = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      // Fetch username/full_name from profiles (best effort)
      let meta: PresenceMeta = { last_seen: new Date().toISOString() }
      if (user?.id) {
        const { data } = await supabase.from('profiles').select('username, full_name').eq('id', user.id).maybeSingle()
        meta.username = data?.username ?? user.email ?? null
        meta.full_name = data?.full_name ?? null
      }
      setSelfState(meta)
      channel.track(meta)
    }

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as any
        const online: Record<string, PresenceMeta> = {}
        Object.values(state).forEach((arr: any) => {
          arr.forEach((entry: any) => {
            const k = JSON.stringify(entry)
          })
        })
        // presenceState is keyed by arbitrary keys; use user IDs from auth context
        // Reconstruct a flat list:
        Object.entries(state).forEach(([key, arr]: any) => {
          if (Array.isArray(arr) && arr[0]) {
            online[key] = arr[0].metas?.[0] ?? arr[0]
          }
        })
        setPeers(online)
      })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await track()
    })

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div>
      <h1>Quem está online</h1>
      <p>Você: {JSON.stringify(selfState)}</p>
      <ul>
        {Object.entries(peers).map(([k, v]) => (
          <li key={k}>
            <strong>{v.full_name || v.username || k}</strong> — last_seen: {v.last_seen}
          </li>
        ))}
      </ul>
    </div>
  )
}
