import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";
import {
  getAreaForPath,
  getAreaTutorial,
  isTutorialPending,
  markTutorialSeen,
} from "@/services/areaTutorials";
import { AreaTutorial } from "./AreaTutorial";

/**
 * Gerenciador global de tutoriais: observa a rota atual e, na primeira visita
 * do usuário a uma área com tutorial cadastrado, abre o guia automaticamente.
 * Integrado uma única vez no AppLayout.
 */
export function AreaTutorialHost() {
  const { user } = useAuth();
  const location = useLocation();
  const [openAreaId, setOpenAreaId] = useState<string | null>(null);
  const openRef = useRef<string | null>(null);

  useEffect(() => {
    // Já existe um tutorial aberto: não empilha novos
    if (openRef.current || !user) return;

    const areaId = getAreaForPath(location.pathname);
    if (areaId && isTutorialPending(areaId, user.id)) {
      openRef.current = areaId;
      setOpenAreaId(areaId);
    }
  }, [location.pathname, user]);

  const handleClose = useCallback(() => {
    if (openRef.current && user) {
      markTutorialSeen(openRef.current, user.id);
    }
    openRef.current = null;
    setOpenAreaId(null);
  }, [user]);

  const tutorial = openAreaId ? getAreaTutorial(openAreaId) : undefined;
  if (!tutorial) return null;

  return <AreaTutorial tutorial={tutorial} onClose={handleClose} />;
}