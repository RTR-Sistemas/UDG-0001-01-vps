/**
 * =============================================================================
 * File: src/hooks/useBattleLive.ts
 * Purpose: Integração Agora RTC (modo live) para Batalhas ao Vivo.
 *          Participantes publicam áudio/vídeo; espectadores assistem em tempo
 *          real (role audience) sem pedir permissões de câmera/microfone.
 * =============================================================================
 */

import { useCallback, useEffect, useRef, useState } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser,
} from "agora-rtc-sdk-ng";

const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID || "cfade1e1afb944da9fbcd7c3ae83d97d";

export function userIdToSmallUid(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 10000) + 1;
}

async function fetchAgoraTokenServer(
  channelName: string,
  uid: number,
  role: "publisher" | "subscriber"
): Promise<string | null> {
  const endpoints = [
    "/.netlify/functions/agora-token",
    "https://udgservidor.online/.netlify/functions/agora-token",
  ];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelName, uid, role }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.token) return data.token;
    } catch { /* tenta próximo */ }
  }
  return null;
}

export interface UseBattleLiveOptions {
  battleId: string;
  isHost: boolean;
  isGuest: boolean;
  hostUid: number;
  guestUid: number;
  enabled: boolean;
}

export interface UseBattleLiveResult {
  localVideoRef: React.RefObject<HTMLDivElement | null>;
  hostVideoRef: React.RefObject<HTMLDivElement | null>;
  guestVideoRef: React.RefObject<HTMLDivElement | null>;
  joined: boolean;
  joining: boolean;
  error: string | null;
  micOn: boolean;
  videoOn: boolean;
  setMicOn: (v: boolean) => void;
  setVideoOn: (v: boolean) => void;
  leave: () => Promise<void>;
  remoteUsers: IAgoraRTCRemoteUser[];
}

export function useBattleLive({
  battleId,
  isHost,
  isGuest,
  hostUid,
  guestUid,
  enabled,
}: UseBattleLiveOptions): UseBattleLiveResult {
  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const hostVideoRef = useRef<HTMLDivElement | null>(null);
  const guestVideoRef = useRef<HTMLDivElement | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localMicRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localCamRef = useRef<ICameraVideoTrack | null>(null);
  const panelByUidRef = useRef<Map<number, "host" | "guest">>(new Map());
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOnState] = useState(true);
  const [videoOn, setVideoOnState] = useState(true);

  const leave = useCallback(async () => {
    try {
      localMicRef.current?.stop();
      localMicRef.current?.close();
    } catch { /* ignore */ }
    try {
      localCamRef.current?.stop();
      localCamRef.current?.close();
    } catch { /* ignore */ }
    localMicRef.current = null;
    localCamRef.current = null;
    try {
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }
    } catch { /* ignore */ }
    panelByUidRef.current.clear();
    setRemoteUsers([]);
    setJoined(false);
    setError(null);
  }, []);

  // uid do espectador precisa ser estável por sessão (não Date.now() a cada render)
  const spectatorUidRef = useRef<number | null>(null);
  if (spectatorUidRef.current === null) {
    spectatorUidRef.current = userIdToSmallUid(`spectator-${battleId}-${Math.random().toString(36).slice(2, 7)}`);
  }

  useEffect(() => {
    if (!enabled || !battleId) return;
    let cancelled = false;
    const isParticipant = isHost || isGuest;
    const uid = isParticipant ? (isHost ? hostUid : guestUid) : spectatorUidRef.current!;
    const channelName = `udg_battle_${battleId}`;

    const join = async () => {
      setJoining(true);
      setError(null);
      try {
        try { (AgoraRTC as any).setParameter("ENABLE_DATACHANNEL", false); } catch { /* ignore */ }

        const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        clientRef.current = client;

        client.on("user-published", async (remoteUser: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
          if (cancelled) return;
          try {
            await client.subscribe(remoteUser, mediaType);
            if (mediaType === "video" && remoteUser.videoTrack) {
              const panel = panelByUidRef.current.get(Number(remoteUser.uid)) ?? "host";
              const container = panel === "guest" ? guestVideoRef.current : hostVideoRef.current;
              if (container) {
                container.innerHTML = "";
                remoteUser.videoTrack.play(container);
              }
            }
            if (mediaType === "audio" && remoteUser.audioTrack) {
              remoteUser.audioTrack.play();
            }
          } catch (e) {
            console.error("[BattleLive] subscribe error:", e);
          }
        });

        client.on("user-unpublished", (_: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
          if (mediaType === "video" && !cancelled) {
            setRemoteUsers([...client.remoteUsers]);
          }
        });

        client.on("user-joined", (remoteUser: IAgoraRTCRemoteUser) => {
          if (cancelled) return;
          const panel: "host" | "guest" =
            remoteUser.uid === hostUid ? "host"
            : remoteUser.uid === guestUid ? "guest"
            : panelByUidRef.current.has(Number(remoteUser.uid)) ? panelByUidRef.current.get(Number(remoteUser.uid))!
            : "host";
          panelByUidRef.current.set(Number(remoteUser.uid), panel);
          setRemoteUsers([...client.remoteUsers]);
        });

        client.on("user-left", (remoteUser: IAgoraRTCRemoteUser) => {
          if (cancelled) return;
          panelByUidRef.current.delete(Number(remoteUser.uid));
          setRemoteUsers([...client.remoteUsers]);
        });

        // Role antes do join (modo live: host publica, audience assiste)
        await client.setClientRole(isParticipant ? "host" : "audience");

        const role = isParticipant ? "publisher" : "subscriber";
        let token: string | null = null;
        try {
          token = await fetchAgoraTokenServer(channelName, uid, role);
        } catch { /* fallback abaixo */ }

        await client.join(AGORA_APP_ID, channelName, token ?? null, uid);
        if (cancelled) return;

        if (isParticipant) {
          const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
          const camTrack = await AgoraRTC.createCameraVideoTrack();
          localMicRef.current = micTrack;
          localCamRef.current = camTrack;
          if (localVideoRef.current) {
            localVideoRef.current.innerHTML = "";
            camTrack.play(localVideoRef.current);
          }
          await client.publish([micTrack, camTrack]);
        }

        if (!cancelled) setJoined(true);
      } catch (e: any) {
        console.error("[BattleLive] join error:", e?.message || e);
        if (!cancelled) {
          setError(e?.message || "Falha ao conectar ao vídeo ao vivo");
        }
      } finally {
        if (!cancelled) setJoining(false);
      }
    };

    join();

    return () => {
      cancelled = true;
      void leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, battleId, isHost, isGuest, hostUid, guestUid]);

  useEffect(() => {
    localMicRef.current?.setEnabled(micOn).catch(() => undefined);
  }, [micOn]);

  useEffect(() => {
    localCamRef.current?.setEnabled(videoOn).catch(() => undefined);
  }, [videoOn]);

  return {
    localVideoRef,
    hostVideoRef,
    guestVideoRef,
    joined,
    joining,
    error,
    micOn,
    videoOn,
    setMicOn: setMicOnState,
    setVideoOn: setVideoOnState,
    leave,
    remoteUsers,
  };
}