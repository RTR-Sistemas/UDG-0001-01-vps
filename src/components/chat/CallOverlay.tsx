import React, { useEffect, useState, useRef } from "react";
import { useCalls } from "@/hooks/useCalls";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Shield, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import AgoraRTC from "agora-rtc-sdk-ng";

export const CallOverlay: React.FC = () => {
  const {
    activeCall,
    callStatus,
    isIncoming,
    isOutgoing,
    peerProfile,
    micMuted,
    camMuted,
    localVideoTrack,
    remoteVideoTrack,
    acceptCall,
    declineCall,
    endCall,
    toggleMic,
    toggleCam,
    localVideoRef,
    remoteVideoRef,
  } = useCalls();

  const [callDuration, setCallDuration] = useState(0);
  const [isNearEar, setIsNearEar] = useState(false);
  const wakeLockRef = useRef<any>(null);

  // Request Wake Lock during active call
  useEffect(() => {
    if (callStatus === "accepted") {
      const requestWakeLock = async () => {
        try {
          if ('wakeLock' in navigator) {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            console.log('Wake Lock is active');
          }
        } catch (err) {
          console.warn(`Wake Lock error: ${err}`);
        }
      };
      
      requestWakeLock();
      
      const handleVisibilityChange = () => {
        if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
          requestWakeLock();
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (wakeLockRef.current !== null) {
          wakeLockRef.current.release().then(() => {
            wakeLockRef.current = null;
            console.log('Wake Lock released');
          });
        }
      };
    }
  }, [callStatus]);

  // Proximity Ear Sensor trigger for voice calls on mobile devices
  useEffect(() => {
    if (callStatus !== "accepted" || activeCall?.type !== "voice") {
      setIsNearEar(false);
      return;
    }

    let sensor: any = null;

    // 1. Native Proximity Sensor if supported
    if ("ProximitySensor" in window) {
      try {
        sensor = new (window as any).ProximitySensor();
        sensor.addEventListener("reading", () => {
          setIsNearEar(sensor.near);
        });
        sensor.start();
      } catch (e) {
        console.warn("ProximitySensor init failed:", e);
      }
    }

    // 2. Fallback: Device Orientation tilt detection
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const { beta, gamma } = event;
      if (beta !== null) {
        const isVertical = Math.abs(beta) > 70 && Math.abs(beta) < 110;
        const isSideTilt = Math.abs(gamma || 0) < 30;
        setIsNearEar(isVertical && isSideTilt);
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);

    return () => {
      if (sensor) {
        try { sensor.stop(); } catch (_) {}
      }
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [callStatus, activeCall]);

  // Audio output routing based on proximity (Speakerphone vs Handset/Earpiece)
  useEffect(() => {
    if (callStatus !== "accepted" || !remoteVideoTrack?.audioTrack) return;

    const routeAudio = async () => {
      try {
        const devices = await AgoraRTC.getPlaybackDevices();
        console.log("🔊 Available output playback devices:", devices);

        const earpiece = devices.find(d => 
          d.label.toLowerCase().includes("earpiece") || 
          d.label.toLowerCase().includes("receiver") || 
          d.label.toLowerCase().includes("auricular") ||
          d.label.toLowerCase().includes("fone de ouvido") ||
          d.label.toLowerCase().includes("handset") ||
          d.label.toLowerCase().includes("headset")
        );

        const speaker = devices.find(d => 
          d.label.toLowerCase().includes("speaker") || 
          d.label.toLowerCase().includes("alto-falante") || 
          d.label.toLowerCase().includes("viva-voz")
        );

        const targetDevice = isNearEar 
          ? (earpiece || devices[0]) 
          : (speaker || devices[0]);

        const audioTrack = remoteVideoTrack.audioTrack;
        if (targetDevice && typeof (audioTrack as any).setPlaybackDevice === "function") {
          await (audioTrack as any).setPlaybackDevice(targetDevice.deviceId);
          console.log(`🔊 Audio output routed to: ${targetDevice.label} (near ear: ${isNearEar})`);
        }
      } catch (err) {
        console.warn("Audio routing error:", err);
      }
    };

    void routeAudio();
  }, [isNearEar, remoteVideoTrack, callStatus]);

  // Call timer when active
  useEffect(() => {
    let timer: any;
    if (callStatus === "accepted") {
      setCallDuration(0);
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callStatus]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (callStatus === "idle" || !activeCall) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-zinc-950/95 text-white backdrop-blur-md select-none overflow-hidden animate-in fade-in duration-300">
      
      {/* ── Ringing / Calling Screens ────────────────────────────────────────── */}
      {(callStatus === "ringing") && (
        <div className="relative flex flex-col items-center justify-between w-full max-w-md h-full py-20 px-6 z-10">
          
          {/* Status info */}
          <div className="text-center space-y-4">
            <span className="text-xs font-bold tracking-widest text-primary uppercase bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-full animate-pulse">
              {isIncoming ? "Chamada Recebida" : "Chamando..."}
            </span>
            <h2 className="text-3xl font-black tracking-tight text-white mt-4">
              {peerProfile?.username || "Usuário"}
            </h2>
            <p className="text-zinc-500 text-sm">
              {activeCall.type === "video" ? "Chamada de vídeo..." : "Chamada de voz..."}
            </p>
          </div>

          {/* Caller Avatar with pulsing rings */}
          <div className="relative flex items-center justify-center my-12">
            <div className="absolute inset-0 w-48 h-48 rounded-full bg-primary/10 border border-primary/30 animate-ping opacity-40" />
            <div className="absolute inset-0 w-36 h-36 rounded-full bg-primary/20 border border-primary/40 animate-pulse opacity-60" />
            <Avatar className="h-28 w-28 border-4 border-zinc-900 shadow-2xl relative z-10">
              <AvatarImage src={peerProfile?.avatar_url} />
              <AvatarFallback className="bg-zinc-800 text-zinc-400 text-2xl font-black">
                {peerProfile?.username?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Signaling Actions */}
          <div className="flex flex-col items-center gap-6 w-full mt-auto">
            {isIncoming ? (
              <div className="flex items-center justify-center gap-8 w-full">
                {/* Accept Button */}
                <Button
                  onClick={acceptCall}
                  className="rounded-full w-16 h-16 bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 text-white flex items-center justify-center animate-bounce transition-transform"
                >
                  <Phone className="w-6 h-6 fill-white" />
                </Button>
                
                {/* Reject Button */}
                <Button
                  onClick={declineCall}
                  className="rounded-full w-16 h-16 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 text-white flex items-center justify-center transition-transform"
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
              </div>
            ) : (
              // Cancel calling
              <Button
                onClick={endCall}
                className="rounded-full w-16 h-16 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 text-white flex items-center justify-center transition-transform"
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
            )}
            <p className="text-zinc-500 text-xs text-center flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-primary" /> Transmissão segura ponta a ponta
            </p>
          </div>
        </div>
      )}

      {/* ── Connection States (Declined / Busy / Ended) ───────────────────────── */}
      {(callStatus === "declined" || callStatus === "busy" || callStatus === "ended") && (
        <div className="flex flex-col items-center gap-4 py-8 px-6 animate-in zoom-in-95 duration-200">
          <AlertCircle className="w-16 h-16 text-red-500 animate-pulse" />
          <h3 className="text-2xl font-black text-white">
            {callStatus === "declined" ? "Chamada Recusada" : callStatus === "busy" ? "Linha Ocupada" : "Ligação Encerrada"}
          </h3>
          <p className="text-zinc-500 text-sm">
            {peerProfile?.username || "O usuário"} {callStatus === "declined" ? "recusou a chamada." : callStatus === "busy" ? "está em outra ligação." : "desconectou."}
          </p>
        </div>
      )}

      {/* ── Active Call (Accepted / In progress) ─────────────────────────────── */}
      {callStatus === "accepted" && (
        <div className="relative w-full h-full flex flex-col">

          {/* Header Info overlays */}
          <div className="absolute top-6 left-6 z-30 flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5 shadow-2xl">
            <Avatar className="h-8 w-8 border border-white/15">
              <AvatarImage src={peerProfile?.avatar_url} />
              <AvatarFallback className="bg-zinc-800 text-zinc-500 text-xs font-bold">
                {peerProfile?.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-xs font-black text-white">{peerProfile?.username}</span>
              <span className="text-[10px] text-zinc-400 font-bold tracking-widest uppercase font-mono">
                {formatDuration(callDuration)}
              </span>
            </div>
          </div>

          {/* Secure Badge */}
          <div className="absolute top-6 right-6 z-30 bg-primary/20 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-primary/30 flex items-center gap-1.5 text-[10px] font-black text-primary tracking-widest uppercase">
            <Shield className="w-3.5 h-3.5" /> AGORA SECURE
          </div>

          {/* ── Video Stream Containers ── */}
          {activeCall.type === "video" ? (
            <div className="relative w-full h-full bg-zinc-950 flex items-center justify-center">
              
              {/* Remote Stream (Main Background) */}
              <div className="w-full h-full absolute inset-0 bg-zinc-900 flex items-center justify-center">
                {/* Dedicated empty playback container to prevent React DOM child removal crash */}
                <div ref={remoteVideoRef} className="w-full h-full absolute inset-0" />
                
                {!remoteVideoTrack && (
                  <div className="flex flex-col items-center gap-4 text-center p-6 z-10 pointer-events-none">
                    <Avatar className="h-24 w-24 border border-white/10 animate-pulse">
                      <AvatarImage src={peerProfile?.avatar_url} />
                      <AvatarFallback className="bg-zinc-800 text-zinc-500 text-xl font-bold">
                        {peerProfile?.username?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-zinc-500 text-xs tracking-widest uppercase animate-pulse">
                      Conectando vídeo remoto...
                    </p>
                  </div>
                )}
              </div>

              {/* Local Camera Preview (Picture in Picture) */}
              <div className="absolute bottom-28 right-6 z-20 w-32 md:w-40 aspect-[3/4] bg-zinc-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl transition-all duration-300">
                <div ref={localVideoRef} className="w-full h-full object-cover bg-black" />
                {camMuted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/90 z-10">
                    <VideoOff className="w-5 h-5 text-zinc-600" />
                  </div>
                )}
              </div>

            </div>
          ) : (
            
            // ── Voice Call Layout (No Video) ──
            <div className="flex-1 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,rgba(159,122,234,0.1)_0%,rgba(9,9,11,0)_100%)]">
              <div className="relative flex items-center justify-center mb-12">
                <div className="absolute inset-0 w-52 h-52 rounded-full bg-primary/5 border border-primary/20 animate-pulse" />
                <div className="absolute inset-0 w-40 h-40 rounded-full bg-primary/10 border border-primary/30 animate-pulse" />
                <Avatar className="h-28 w-28 border-4 border-zinc-900 shadow-2xl relative z-10">
                  <AvatarImage src={peerProfile?.avatar_url} />
                  <AvatarFallback className="bg-zinc-800 text-zinc-400 text-2xl font-black">
                    {peerProfile?.username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <h4 className="text-2xl font-black text-white mb-2">{peerProfile?.username}</h4>
              <p className="text-zinc-500 text-sm">Ligação de voz ativa</p>
            </div>
          )}

          {/* ── Call Action Control Panel ── */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-4 flex items-center gap-6 shadow-2xl">
            {/* Mic Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMic}
              className={cn(
                "rounded-full w-12 h-12 flex items-center justify-center border transition-all duration-200",
                micMuted
                  ? "bg-red-500/20 text-red-500 border-red-500/30 hover:bg-red-500/30"
                  : "bg-white/5 border-white/5 hover:bg-white/10 text-zinc-300"
              )}
            >
              {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            {/* Camera Toggle (Only for video calls) */}
            {activeCall.type === "video" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCam}
                className={cn(
                  "rounded-full w-12 h-12 flex items-center justify-center border transition-all duration-200",
                  camMuted
                    ? "bg-red-500/20 text-red-500 border-red-500/30 hover:bg-red-500/30"
                    : "bg-white/5 border-white/5 hover:bg-white/10 text-zinc-300"
                )}
              >
                {camMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </Button>
            )}

            {/* End Call Button */}
            <Button
              onClick={endCall}
              className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700 hover:scale-105 active:scale-95 text-white flex items-center justify-center transition-all shadow-lg shadow-red-600/30 border border-red-500/30"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>

        </div>
      )}
      {/* Black screen overlay when near ear */}
      {isNearEar && (
        <div className="fixed inset-0 bg-black z-[100000] flex items-center justify-center animate-in fade-in duration-200 pointer-events-auto">
          <div className="absolute inset-0 z-10" onTouchStart={(e) => e.stopPropagation()} />
          <p className="text-zinc-800 text-[10px] uppercase font-mono tracking-widest select-none relative z-20">
            Tela Desativada (Sensor de Proximidade)
          </p>
        </div>
      )}
    </div>
  );
};
