import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { usePermissions } from "@/contexts/PermissionContext";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser,
} from "agora-rtc-sdk-ng";

export type CallType = "voice" | "video";
export type CallStatus = "ringing" | "accepted" | "declined" | "ended" | "busy" | "idle";

export interface Call {
  id: string;
  caller_id: string;
  receiver_id: string;
  type: CallType;
  status: CallStatus;
  agora_channel_name: string;
  created_at: string;
}

interface CallContextType {
  activeCall: Call | null;
  callStatus: CallStatus;
  isIncoming: boolean;
  isOutgoing: boolean;
  peerProfile: any | null;
  micMuted: boolean;
  camMuted: boolean;
  localVideoTrack: ICameraVideoTrack | null;
  remoteVideoTrack: IAgoraRTCRemoteUser | null;
  makeCall: (receiverId: string, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMic: () => void;
  toggleCam: () => void;
  localVideoRef: React.RefObject<HTMLDivElement>;
  remoteVideoRef: React.RefObject<HTMLDivElement>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

// Helper to map UUID to Agora Uid
function userIdToSmallUid(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 10000) + 1;
}

// Global sound manager using Web Audio API for call rings
class SoundManager {
  private ctx: AudioContext | null = null;
  private interval: any = null;

  startRinging() {
    this.stop();
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playRing = () => {
      if (!this.ctx) return;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(440, this.ctx.currentTime); // Standard A note
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(480, this.ctx.currentTime); // Intersecting frequency

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start();
      osc2.start();

      osc1.stop(this.ctx.currentTime + 2.0);
      osc2.stop(this.ctx.currentTime + 2.0);
    };

    playRing();
    this.interval = setInterval(playRing, 2500);
  }

  startCallingBeep() {
    this.stop();
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playBeep = () => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(425, this.ctx.currentTime); // Standard dial tone freq

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 1.5);
    };

    playBeep();
    this.interval = setInterval(playBeep, 2000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

const sounds = new SoundManager();

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { requestPermission } = usePermissions();
  const callTimeoutRef = useRef<any>(null);

  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [peerProfile, setPeerProfile] = useState<any | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camMuted, setCamMuted] = useState(false);

  // Agora states
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<IAgoraRTCRemoteUser | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localMicTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localCamTrackRef = useRef<ICameraVideoTrack | null>(null);
  const mountedRef = useRef(true);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  const isIncoming = activeCall !== null && activeCall.receiver_id === user?.id && callStatus === "ringing";
  const isOutgoing = activeCall !== null && activeCall.caller_id === user?.id && callStatus === "ringing";

  // Clean up Agora tracks & client
  const cleanupAgora = useCallback(async () => {
    console.log("📞 Clean up Agora WebRTC tracks and connection...");
    
    // Stop local video display
    try { localCamTrackRef.current?.stop(); } catch (e) {}
    try { localCamTrackRef.current?.close(); } catch (e) {}
    localCamTrackRef.current = null;
    if (mountedRef.current) setLocalVideoTrack(null);

    // Stop local mic
    try { localMicTrackRef.current?.stop(); } catch (e) {}
    try { localMicTrackRef.current?.close(); } catch (e) {}
    localMicTrackRef.current = null;

    // Leave channel
    if (clientRef.current) {
      try {
        await clientRef.current.leave();
      } catch (err) {
        console.error("Agora leave error:", err);
      }
      clientRef.current = null;
    }

    if (mountedRef.current) setRemoteVideoTrack(null);
  }, []);

  // Fully release Agora resources when the provider unmounts
  // (prevents React from removing DOM nodes that the Agora SDK still manages)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sounds.stop();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      void cleanupAgora();
    };
  }, [cleanupAgora]);

  // Sync state transitions & cleanups (skip initial mount to avoid pointless cleanup on startup)
  const callStatusHandledRef = useRef(false);
  useEffect(() => {
    if (!callStatusHandledRef.current) {
      callStatusHandledRef.current = true;
      return;
    }
    if (callStatus === "idle" || callStatus === "ended" || callStatus === "declined" || callStatus === "busy") {
      sounds.stop();
      cleanupAgora();
    }
  }, [callStatus, cleanupAgora]);

  // Load Peer Profile Info
  const fetchPeerProfile = useCallback(async (peerId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", peerId)
        .single();
      if (!error && data) {
        setPeerProfile(data);
      }
    } catch (err) {
      console.error("Error fetching peer profile:", err);
    }
  }, []);

  // Fetch / Generate Agora Token from Netlify function
  const fetchAgoraToken = async (channelName: string, uid: number, role: "publisher" | "subscriber") => {
    const res = await fetch("/api/agora-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelName, uid, role }),
    });
    if (!res.ok) {
      throw new Error(`Failed to generate Agora token: ${res.statusText}`);
    }
    const data = await res.json();
    return data.token;
  };

  // Direct cleanup when remote user leaves (avoids circular endCall reference)
  const handleRemoteUserLeft = useCallback(async (callId: string) => {
    console.log("📞 Remote user left, cleaning up...");
    sounds.stop();
    if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }

    try {
      await supabase
        .from("calls")
        .update({ status: "ended" })
        .eq("id", callId);
    } catch (e) {
      console.error("Failed to update call status:", e);
    }

    await cleanupAgora();
    setActiveCall(null);
    setCallStatus("idle");
    setPeerProfile(null);
  }, [cleanupAgora]);

  // Join Agora Session
  const joinAgoraCall = useCallback(async (callData: Call) => {
    try {
      console.log("📞 Joining Agora RTC Channel:", callData.agora_channel_name);
      
      // Disable data channel to prevent INVALID_PARAMS errors
      try { (AgoraRTC as any).setParameter("ENABLE_DATACHANNEL", false); } catch (_) {}

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      // Subscribe to remote media events
      client.on("user-published", async (remoteUser: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
        console.log(`📥 Subscribing to remote user ${remoteUser.uid} ${mediaType} track`);
        try {
          await client.subscribe(remoteUser, mediaType);
        } catch (e) {
          console.error("Agora subscribe error:", e);
          return;
        }

        if (!mountedRef.current) return;

        if (mediaType === "video") {
          setRemoteVideoTrack(remoteUser);
          if (remoteUser.videoTrack && remoteVideoRef.current) {
            try {
              remoteVideoRef.current.innerHTML = "";
              remoteUser.videoTrack.play(remoteVideoRef.current);
            } catch (e) {
              console.error("Failed to play remote video:", e);
            }
          }
        }
        if (mediaType === "audio") {
          try {
            remoteUser.audioTrack?.play();
          } catch (e) {
            console.error("Failed to play remote audio:", e);
          }
        }
      });

      client.on("user-unpublished", (remoteUser: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
        if (mediaType === "video") {
          setRemoteVideoTrack(null);
        }
      });

      client.on("user-left", () => {
        setRemoteVideoTrack(null);
        toast({ title: "Ligação encerrada", description: "O outro participante saiu da chamada." });
        void handleRemoteUserLeft(callData.id);
      });

      const uid = userIdToSmallUid(user!.id);
      const token = await fetchAgoraToken(callData.agora_channel_name, uid, "publisher");

      // Join Agora
      await client.join(
        import.meta.env.VITE_AGORA_APP_ID || "cfade1e1afb944da9fbcd7c3ae83d97d",
        callData.agora_channel_name,
        token,
        uid
      );

      // Create tracks
      const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
      if (!mountedRef.current) {
        try { micTrack.close(); } catch (e) {}
        return;
      }
      localMicTrackRef.current = micTrack;

      let tracksToPublish: any[] = [micTrack];

      if (callData.type === "video") {
        try {
          const camTrack = await AgoraRTC.createCameraVideoTrack();
          if (!mountedRef.current) {
            try { camTrack.close(); } catch (e) {}
            return;
          }
          localCamTrackRef.current = camTrack;
          setLocalVideoTrack(camTrack);
          tracksToPublish.push(camTrack);

          // Play local camera view
          if (localVideoRef.current) {
            try {
              localVideoRef.current.innerHTML = "";
              camTrack.play(localVideoRef.current);
            } catch (e) {
              console.error("Failed to play local camera:", e);
            }
          }
        } catch (camErr) {
          console.error("Camera access failed, falling back to voice only:", camErr);
        }
      }

      await client.publish(tracksToPublish);
      console.log("✅ Successfully joined & published Agora tracks!");
    } catch (error: any) {
      console.error("Failed to connect to Agora RTC room:", error);
      if (!mountedRef.current) return;
      toast({ title: "Erro na chamada", description: error.message, variant: "destructive" });
      // Direct cleanup instead of calling endCall to avoid circular ref
      await cleanupAgora();
      setActiveCall(null);
      setCallStatus("idle");
      setPeerProfile(null);
    }
  }, [user, toast, handleRemoteUserLeft, cleanupAgora]);

  // Subscribe to Call Signalling Table
  useEffect(() => {
    if (!user) return;

    console.log("📞 CallProvider: subscription de chamadas ativo");

    // Listen to call inserts and updates involving current user
    const channel = supabase
      .channel("call_signalling")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        async (payload) => {
          const row = payload.new as Call;
          
          if (!row || (row.caller_id !== user.id && row.receiver_id !== user.id)) return;

          // Ignora chamadas órfãs/antigas entregues por realtime (ex.: registros
          // abandonados de testes) que causavam overlay de chamada fantasma no boot.
          const ageMs = Date.now() - new Date(row.created_at || 0).getTime();
          if (ageMs > 3 * 60 * 1000) {
            console.warn("📞 Chamada órfã ignorada (antiga):", row.id, row.status, new Date(row.created_at).toISOString());
            return;
          }

          console.log("🔔 Call signaling event received:", payload.eventType, row);

          if (payload.eventType === "INSERT") {
            if (row.receiver_id === user.id && row.status === "ringing") {
              // Incoming Call
              setActiveCall(row);
              setCallStatus("ringing");
              await fetchPeerProfile(row.caller_id);
              sounds.startRinging();
            }
          } else if (payload.eventType === "UPDATE") {
            setActiveCall(row);
            setCallStatus(row.status);

            if (row.status === "accepted") {
              sounds.stop();
              // Connect Agora
              await joinAgoraCall(row);
            } else if (row.status === "declined" || row.status === "busy" || row.status === "ended") {
              setCallStatus(row.status);
              sounds.stop();
              await cleanupAgora();
              setTimeout(() => {
                setActiveCall(null);
                setCallStatus("idle");
                setPeerProfile(null);
              }, 1500);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchPeerProfile, joinAgoraCall, cleanupAgora]);

  // Auto-timeout for unanswered calls (60 seconds)
  useEffect(() => {
    if (callStatus === "ringing" && activeCall) {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(async () => {
        console.log("📞 Call timeout — no answer after 60s");
        sounds.stop();
        if (activeCall) {
          try {
            await supabase
              .from("calls")
              .update({ status: activeCall.caller_id === user?.id ? "busy" : "declined" })
              .eq("id", activeCall.id);
          } catch (e) {
            console.error("Failed to update timed-out call:", e);
          }
        }
        await cleanupAgora();
        setActiveCall(null);
        setCallStatus("idle");
        setPeerProfile(null);
        toast({ title: "Sem resposta", description: "A chamada não foi atendida." });
      }, 60000);
    } else {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    }

    return () => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    };
  }, [callStatus, activeCall, user?.id, cleanupAgora, toast]);

  // Make Call
  const makeCall = async (receiverId: string, type: CallType) => {
    if (!user) return;
    const micOk = await requestPermission(
      'microphone',
      'Para falar na chamada com voz e áudio de alta qualidade, o app precisa acessar o microfone.'
    );
    if (!micOk) return;
    if (type === 'video') {
      const camOk = await requestPermission(
        'camera',
        'Para enviar seu vídeo na chamada, o app precisa acessar a câmera.'
      );
      if (!camOk) return;
    }
    try {
      console.log(`📞 Initiating ${type} call to peer: ${receiverId}`);
      setCallStatus("ringing");
      await fetchPeerProfile(receiverId);
      sounds.startCallingBeep();

      const channelName = `call_${user.id.substring(0, 8)}_${receiverId.substring(0, 8)}_${Date.now()}`;
      
      const { data, error } = await supabase
        .from("calls")
        .insert({
          caller_id: user.id,
          receiver_id: receiverId,
          type,
          status: "ringing",
          agora_channel_name: channelName,
        })
        .select()
        .single();

      if (error) throw error;
      setActiveCall(data as Call);
    } catch (err: any) {
      console.error("Failed to start call:", err);
      toast({ title: "Erro ao realizar chamada", description: err.message, variant: "destructive" });
      setCallStatus("idle");
      sounds.stop();
    }
  };

  // Accept Call
  const acceptCall = async () => {
    if (!activeCall) return;
    try {
      console.log("📞 Accepting call...");
      sounds.stop();

      const { error } = await supabase
        .from("calls")
        .update({ status: "accepted" })
        .eq("id", activeCall.id);

      if (error) throw error;
    } catch (err: any) {
      console.error("Failed to accept call:", err);
      toast({ title: "Erro ao aceitar chamada", description: err.message, variant: "destructive" });
      void declineCall();
    }
  };

  // Decline Call
  const declineCall = async () => {
    if (!activeCall) return;
    try {
      console.log("📞 Declining call...");
      sounds.stop();
      
      const { error } = await supabase
        .from("calls")
        .update({ status: "declined" })
        .eq("id", activeCall.id);

      if (error) throw error;
      
      setActiveCall(null);
      setCallStatus("idle");
      setPeerProfile(null);
    } catch (err: any) {
      console.error("Failed to decline call:", err);
    }
  };

  // End Call
  const endCall = async () => {
    if (!activeCall) return;
    try {
      console.log("📞 Ending call...");
      sounds.stop();

      await supabase
        .from("calls")
        .update({ status: "ended" })
        .eq("id", activeCall.id);

      await cleanupAgora();
      setActiveCall(null);
      setCallStatus("idle");
      setPeerProfile(null);
    } catch (err: any) {
      console.error("Failed to end call:", err);
    }
  };

  // Toggles
  const toggleMic = () => {
    if (localMicTrackRef.current) {
      const next = !micMuted;
      localMicTrackRef.current.setEnabled(!next);
      setMicMuted(next);
    }
  };

  const toggleCam = () => {
    if (localCamTrackRef.current) {
      const next = !camMuted;
      localCamTrackRef.current.setEnabled(!next);
      setCamMuted(next);
      // Clean display div if camera is muted
      if (next && localVideoRef.current) {
        try { localVideoRef.current.innerHTML = ""; } catch (e) {}
      } else if (!next && localCamTrackRef.current && localVideoRef.current) {
        try { localCamTrackRef.current.play(localVideoRef.current); } catch (e) {}
      }
    }
  };

  // Automatically play track when div ref mounts and tracks are active
  useEffect(() => {
    if (!mountedRef.current) return;
    if (localVideoTrack && localVideoRef.current && !camMuted) {
      try {
        localVideoRef.current.innerHTML = "";
        localVideoTrack.play(localVideoRef.current);
      } catch (e) {
        console.error("Failed to play local video:", e);
      }
    }
  }, [localVideoTrack, camMuted]);

  useEffect(() => {
    if (!mountedRef.current) return;
    if (remoteVideoTrack?.videoTrack && remoteVideoRef.current) {
      try {
        remoteVideoRef.current.innerHTML = "";
        remoteVideoTrack.videoTrack.play(remoteVideoRef.current);
      } catch (e) {
        console.error("Failed to play remote video:", e);
      }
    }
  }, [remoteVideoTrack]);

  return (
    <CallContext.Provider
      value={{
        activeCall,
        callStatus,
        isIncoming,
        isOutgoing,
        peerProfile,
        micMuted,
        camMuted,
        localVideoTrack,
        remoteVideoTrack,
        makeCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMic,
        toggleCam,
        localVideoRef,
        remoteVideoRef,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCalls = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error("useCalls must be used within a CallProvider");
  }
  return context;
};
