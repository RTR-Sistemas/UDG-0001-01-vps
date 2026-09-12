/**
 * =============================================================================
 * File: src/components/UserLink.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


interface UserLinkProps {
  userId: string;
  username: string;
  className?: string;
  children?: React.ReactNode;
}

export function UserLink({ userId, username, className, children }: UserLinkProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/profile/${userId}`);
  };

  return (
    <span
      onClick={handleClick}
      className={cn(
        "font-semibold hover:underline cursor-pointer text-foreground",
        className
      )}
    >
      {children || `@${username}`}
    </span>
  );
}
