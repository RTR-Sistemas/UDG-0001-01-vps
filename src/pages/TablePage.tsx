/**
 * =============================================================================
 * File: src/pages/TablePage.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */


import { useParams } from 'react-router-dom'
import DataTable from '../components/DataTable'

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export default function TablePage() {
  const { table } = useParams()
  if (!table) return <div>Tabela não informada</div>
  return (
    <div>
      <h1>{table}</h1>
      <DataTable table={table} />
    </div>
  )
}
