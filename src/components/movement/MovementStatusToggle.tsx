/**
 * =============================================================================
 * File: src/components/movement/MovementStatusToggle.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { Activity } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useMovementStatus } from "@/contexts/MovementStatusContext";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export const MovementStatusToggle: React.FC = () => {
  const { enabled, status, speedKmh, setEnabled } = useMovementStatus();

  // NOTE: Switch (Radix) provides the current `checked` state.
  const handleCheckedChange = (checked: boolean) => {
    setEnabled(checked);
  };

  let statusLabel = "Desligado";

  if (enabled) {
    if (status === "stopped") statusLabel = "Ligado • Parado";
    else if (status === "moving") statusLabel = "Ligado • Em movimento";
    else if (status === "traveling") statusLabel = "Ligado • Viajando";
    else statusLabel = "Ligado";
  }

  return (
    <div className="mt-4 flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <div>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          <span className="font-medium text-sm">Status de Movimento</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Quando ativado, seus amigos podem ver se você está parado, em
          movimento ou viajando.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Atual: <span className="font-medium">{statusLabel}</span>
          {enabled && speedKmh != null && (
            <span className="ml-1">({speedKmh.toFixed(1)} km/h)</span>
          )}
        </p>
      </div>

      {/*
        Replaced the old "Ligar/Desligar" button with an interruptor (Switch)
        to match the UI requested by the user.
      */}
      <Switch checked={enabled} onCheckedChange={handleCheckedChange} />
    </div>
  );
};
