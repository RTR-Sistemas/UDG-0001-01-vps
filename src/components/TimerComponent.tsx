/**
 * =============================================================================
 * File: src/components/TimerComponent.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import * as React from "react";
import { Clock } from "lucide-react";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


interface TimerProps {
  expiresAt: Date;
}

const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function TimerComponent({ expiresAt }: TimerProps) {
  const [timeLeft, setTimeLeft] = React.useState(120);

  React.useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const timeDifference = expiresAt.getTime() - now.getTime();
      const remainingSeconds = Math.max(0, Math.floor(timeDifference / 1000));
      
      setTimeLeft(remainingSeconds);
      
      if (remainingSeconds <= 0) {
        clearInterval(interval);
      }
    };

    const interval = setInterval(updateTimer, 500);
    updateTimer(); 

    return () => clearInterval(interval);
  }, [expiresAt]);

  const timerClass = timeLeft <= 10 
    ? "text-red-500 font-bold animate-pulse"
    : "text-gray-500 dark:text-gray-400";

  return (
    <div className={`flex items-center gap-1 text-xs ${timerClass}`}>
      <Clock className="w-3 h-3" />
      {formatTime(timeLeft)}
    </div>
  );
}