import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { getPermissionStatus, type PermissionStatus, type PermissionType } from "@/lib/permissions";
import { PermissionRequestModal } from "@/components/permissions/PermissionRequestModal";

interface PendingRequest {
  type: PermissionType;
  contextMessage: string;
  resolve: (granted: boolean) => void;
}

interface PermissionContextValue {
  requestPermission: (type: PermissionType, contextMessage?: string) => Promise<boolean>;
  getStatus: (type: PermissionType) => PermissionStatus;
  refreshStatus: (type: PermissionType) => Promise<PermissionStatus>;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [statuses, setStatuses] = useState<Partial<Record<PermissionType, PermissionStatus>>>({});
  const pendingRef = useRef<PendingRequest | null>(null);
  pendingRef.current = pending;

  const refreshStatus = useCallback(async (type: PermissionType): Promise<PermissionStatus> => {
    const status = await getPermissionStatus(type);
    setStatuses((prev) => ({ ...prev, [type]: status }));
    return status;
  }, []);

  const getStatus = useCallback(
    (type: PermissionType): PermissionStatus => statuses[type] ?? "prompt",
    [statuses]
  );

  const requestPermission = useCallback(
    async (type: PermissionType, contextMessage = ""): Promise<boolean> => {
      const status = await refreshStatus(type);
      if (status === "granted") return true;
      if (pendingRef.current) return false;

      return new Promise<boolean>((resolve) => {
        setPending({ type, contextMessage, resolve });
      });
    },
    [refreshStatus]
  );

  const resolvePending = useCallback((granted: boolean) => {
    setPending((current) => {
      if (current) current.resolve(granted);
      return null;
    });
  }, []);

  return (
    <PermissionContext.Provider value={{ requestPermission, getStatus, refreshStatus }}>
      {children}
      {pending ? (
        <PermissionRequestModal
          type={pending.type}
          contextMessage={pending.contextMessage}
          onDone={resolvePending}
        />
      ) : null}
    </PermissionContext.Provider>
  );
}

export function usePermissions(): PermissionContextValue {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error("usePermissions deve ser usado dentro de <PermissionProvider>");
  }
  return ctx;
}
