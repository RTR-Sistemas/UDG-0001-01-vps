/**
 * =============================================================================
 * File: src/components/realtime/AttentionButton.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAttentionCalls } from '@/hooks/useAttentionCalls';

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type Props = {
  contactId: string;
  message?: string | null;
  className?: string;
  children?: React.ReactNode;
};

export default function AttentionButton({ contactId, message = null, className, children }: Props) {
  const { callAttention } = useAttentionCalls();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      title="Chamar atenção"
      onClick={async () => {
        try {
          await callAttention(contactId, message);
        } catch (e) {
          console.error(e);
        }
      }}
    >
      {children || <Bell className="h-5 w-5" />}
    </Button>
  );
}
