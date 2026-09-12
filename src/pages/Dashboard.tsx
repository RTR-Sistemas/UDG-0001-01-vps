/**
 * =============================================================================
 * File: src/pages/Dashboard.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */


import { useEffect, useState } from 'react'
import { openDb } from "@/lib/openDb"
import { supabase } from "@/integrations/supabase/client"
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts'
import { format, parseISO } from 'date-fns'

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type Point = { date: string, value: number }

async function aggregateByDay(table: string, dateCol = 'created_at') {
  const { data, error } = await openDb.from(table).select(`${dateCol}`)
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const r of (data || [])) {
    const d = (r as any)[dateCol]
    if (!d) continue
    const day = format(parseISO(d), 'yyyy-MM-dd')
    counts[day] = (counts[day] || 0) + 1
  }
  return Object.entries(counts).sort(([a],[b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }))
}

async function topCommunitiesByPosts() {
  const { data, error } = await supabase
    .from('community_posts')
    .select('community_id')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const r of (data || [])) {
    const id = (r as any).community_id
    counts[id] = (counts[id] || 0) + 1
  }
  const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10)
  // try to resolve names
  const names: Record<string, string> = {}
  if (entries.length) {
    const ids = entries.map(([id]) => id)
    const { data: comms } = await supabase.from('communities').select('id,name').in('id', ids)
    comms?.forEach(c => { names[c.id] = c.name })
  }
  return entries.map(([id, v]) => ({ name: names[id] || id, value: v }))
}

export default function Dashboard() {
  const [profiles, setProfiles] = useState<Point[]>([])
  const [posts, setPosts] = useState<Point[]>([])
  const [messages, setMessages] = useState<Point[]>([])
  const [topComms, setTopComms] = useState<{name:string, value:number}[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        setProfiles(await aggregateByDay('profiles', 'created_at'))
        setPosts(await aggregateByDay('posts', 'created_at'))
        setMessages(await aggregateByDay('messages', 'created_at'))
        setTopComms(await topCommunitiesByPosts())
      } catch (e: any) {
        setErr(e.message)
      }
    })()
  }, [])

  return (
    <div style={{ display:'grid', gap: 24 }}>
      <h1>Overview</h1>
      {err && <div style={{ color:'crimson' }}>{err}</div>}
      <section style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 24 }}>
        <div>
          <h3>Crescimento de Perfis</h3>
          <LineChart width={600} height={300} data={profiles}>
            <Line type="monotone" dataKey="value" />
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
          </LineChart>
        </div>
        <div>
          <h3>Posts por dia</h3>
          <BarChart width={600} height={300} data={posts}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" />
          </BarChart>
        </div>
      </section>
      <section style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 24 }}>
        <div>
          <h3>Mensagens por dia</h3>
          <LineChart width={600} height={300} data={messages}>
            <Line type="monotone" dataKey="value" />
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
          </LineChart>
        </div>
        <div>
          <h3>Top Comunidades por Posts</h3>
          <PieChart width={600} height={300}>
            <Pie data={topComms} dataKey="value" nameKey="name" outerRadius={120} label />
            <Tooltip />
            <Legend />
          </PieChart>
        </div>
      </section>
    </div>
  )
}
