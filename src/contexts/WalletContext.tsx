/**
 * =============================================================================
 * File: src/contexts/WalletContext.tsx
 * Purpose: Contexto global da Carteira (moedas e diamantes) do usuário logado.
 * =============================================================================
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  EMPTY_WALLET,
  fetchWalletBalances,
  purchaseCoins as purchaseCoinsService,
  requestWithdrawal as requestWithdrawalService,
  type PurchaseOptions,
  type PurchaseResult,
  type WalletBalances,
  type WithdrawalOptions,
  type WithdrawalResult,
} from "@/services/walletService";

// -----------------------------------------------------------------------------
// SECTION: Tipos
// -----------------------------------------------------------------------------

interface WalletContextType {
  balances: WalletBalances;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  purchaseCoins: (options: PurchaseOptions) => Promise<PurchaseResult>;
  requestWithdrawal: (options: WithdrawalOptions) => Promise<WithdrawalResult>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// -----------------------------------------------------------------------------
// SECTION: Provider
// -----------------------------------------------------------------------------

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<WalletBalances>(EMPTY_WALLET);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const next = await fetchWalletBalances();
      if (mountedRef.current) setBalances(next);
    } catch (err) {
      console.error("[WalletContext] refresh falhou:", err);
    }
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Carrega no login e quando a janela volta ao foco
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    refresh().finally(() => {
      if (mountedRef.current) setLoading(false);
    });

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user, refresh]);

  const purchaseCoins = useCallback(
    async (options: PurchaseOptions) => {
      setRefreshing(true);
      try {
        const result = await purchaseCoinsService(options);
        await refresh();
        return result;
      } finally {
        if (mountedRef.current) setRefreshing(false);
      }
    },
    [refresh]
  );

  const requestWithdrawal = useCallback(
    async (options: WithdrawalOptions) => {
      setRefreshing(true);
      try {
        const result = await requestWithdrawalService(options);
        await refresh();
        return result;
      } finally {
        if (mountedRef.current) setRefreshing(false);
      }
    },
    [refresh]
  );

  return (
    <WalletContext.Provider
      value={{
        balances,
        loading,
        refreshing,
        refresh,
        purchaseCoins,
        requestWithdrawal,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

// -----------------------------------------------------------------------------
// SECTION: Hook
// -----------------------------------------------------------------------------

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet deve ser usado dentro de um WalletProvider");
  }
  return context;
}