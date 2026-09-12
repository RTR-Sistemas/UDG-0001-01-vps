import React, { useEffect } from "react";

export const SecurityOverlay: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Bloquear apenas Right Click e Drag (comportamento original)
    const blockContext = (e: Event) => e.preventDefault();

    window.addEventListener("contextmenu", blockContext);
    window.addEventListener("dragstart", blockContext);

    return () => {
      window.removeEventListener("contextmenu", blockContext);
      window.removeEventListener("dragstart", blockContext);
    };
  }, []);

  return <>{children}</>;
};
