/**
 * =============================================================================
 * File: src/components/DataTable.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */


import { useEffect, useMemo, useState } from 'react'
import { openDb } from "@/lib/openDb"

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type Props = {
  table: string
}

export default function DataTable({ table }: Props) {
  const [rows, setRows] = useState<any[]>([])
  const [cols, setCols] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<any | null>(null)
  const [filter, setFilter] = useState('')
  const [limit, setLimit] = useState(50)

  const load = async () => {
    setLoading(true); setError(null)
    let q = openDb.from(table).select('*').limit(limit)
    if (filter) {
      // naive filter: try to match content/username/text fields
      // You can replace by pg_trgm or rpc as you wish
      q = q.like('content', `%${filter}%`).order('created_at', { ascending: false })
    }
    const { data, error } = await q
    if (error) setError(error.message)
    else {
      setRows(data ?? [])
      if (data && data[0]) setCols(Object.keys(data[0]))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [table])

  const del = async (id: any) => {
    if (!confirm('Apagar registro?')) return
    const { error } = await openDb.from(table).delete().eq('id', id)
    if (error) alert(error.message); else load()
  }

  const save = async (record: any) => {
    if (record.id) {
      const { error } = await openDb.from(table).update(record).eq('id', record.id)
      if (error) alert(error.message); else load()
    } else {
      const { error } = await openDb.from(table).insert(record)
      if (error) alert(error.message); else load()
    }
    setEditing(null)
  }

  return (
    <div>
      <div style={{ display:'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input placeholder="filtro (conteúdo)" value={filter} onChange={e=>setFilter(e.target.value)} />
        <button onClick={load}>Recarregar</button>
        <button onClick={()=>setEditing({})}>Novo</button>
        <span style={{marginLeft:'auto'}}>Limite:
          <input style={{width:60, marginLeft: 6}} type="number" value={limit} onChange={e=>setLimit(parseInt(e.target.value||'50'))} />
        </span>
      </div>
      {loading && <div>Carregando...</div>}
      {error && <div style={{ color:'crimson' }}>{error}</div>}
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr>
            {cols.map(c => <th key={c} style={{ textAlign:'left', borderBottom:'1px solid #eee', padding:6 }}>{c}</th>)}
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              {cols.map(c => <td key={c} style={{ borderBottom:'1px solid #f3f3f3', padding:6 }}>{String(r[c])}</td>)}
              <td>
                <button onClick={()=>setEditing(r)}>Editar</button>
                <button onClick={()=>del(r.id)}>Apagar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing !== null && (
        <div style={{ marginTop: 12, padding: 12, border:'1px solid #eee', borderRadius: 8 }}>
          <RecordForm value={editing} onCancel={()=>setEditing(null)} onSave={save} />
        </div>
      )}
    </div>
  )
}

function RecordForm({ value, onCancel, onSave }: any) {
  const [state, setState] = useState<any>(value || {})
  const keys = useMemo(()=> Array.from(new Set([...(value ? Object.keys(value) : []), 'id'])), [value])

  const set = (k: string, v: any) => setState((s:any)=>({ ...s, [k]: v }))

  return (
    <form onSubmit={e=>{e.preventDefault(); onSave(state)}} style={{ display:'grid', gap: 8 }}>
      {keys.map(k => (
        <label key={k} style={{ display:'grid', gap: 6 }}>
          <span>{k}</span>
          <input value={state[k] ?? ''} onChange={e=>set(k, e.target.value)} placeholder={k} />
        </label>
      ))}
      <div style={{ display:'flex', gap: 8 }}>
        <button type="submit">Salvar</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}
