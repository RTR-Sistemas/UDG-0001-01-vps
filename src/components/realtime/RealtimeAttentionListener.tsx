import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isDemoMode } from "@/lib/isDemoMode";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, AlertCircle, X } from "lucide-react";
import { runAttentionVibration, runShakeEffect, shouldRunAttentionEffect } from "@/lib/attentionEffects";

type AttentionCall = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string | null;
  viewed_at?: string | null;
  created_at: string;
};

type ProfileLite = {
  username: string | null;
  avatar_url: string | null;
};

export function RealtimeAttentionListener() {
  const { user } = useAuth();
  const seen = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const profileCache = useRef<Map<string, ProfileLite>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const unlockedRef = useRef(false);

  const [activeCall, setActiveCall] = useState<{ call: AttentionCall; profile: ProfileLite } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    audioRef.current = new Audio("/sounds/alertasom.mp3");
    audioRef.current.preload = "auto";

    const unlock = async () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }
        const buf = audioCtxRef.current.createBuffer(1, 1, 22050);
        const src = audioCtxRef.current.createBufferSource();
        src.buffer = buf;
        src.connect(audioCtxRef.current.destination);
        src.start(0);
        unlockedRef.current = true;
      } catch {}
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  const playBeepFallback = async () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.25);
    } catch {}
  };

  const playAlertSound = async () => {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
        return;
      }
    } catch {}
    await playBeepFallback();
  };

  const fetchSenderProfile = async (senderId: string): Promise<ProfileLite> => {
    const cached = profileCache.current.get(senderId);
    if (cached) return cached;
    const { data } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", senderId)
      .single();
    const profile: ProfileLite = {
      username: data?.username ?? "Usuário",
      avatar_url: data?.avatar_url ?? null,
    };
    profileCache.current.set(senderId, profile);
    return profile;
  };

  const notify = async (row: AttentionCall) => {
    if (seen.current.has(row.id)) return;
    const muteKey = `attention_muted_${row.sender_id}`;
    try {
      const mutedUntil = window.localStorage?.getItem(muteKey);
      if (mutedUntil && Date.now() < parseInt(mutedUntil)) return;
    } catch {}
    const lsKey = `attention_seen_${row.id}`;
    if (typeof window !== "undefined" && window.localStorage?.getItem(lsKey) === "1") {
      seen.current.add(row.id);
      return;
    }
    seen.current.add(row.id);
    try { window.localStorage?.setItem(lsKey, "1"); } catch {}

    supabase
      .from("attention_calls")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("receiver_id", user!.id)
      .then();

    const runEffect = shouldRunAttentionEffect();
    if (runEffect) {
      playAlertSound();
      runAttentionVibration();
      runShakeEffect(2000);
    }

    setActiveCall({ call: row, profile: { username: "Carregando...", avatar_url: null } });
    fetchSenderProfile(row.sender_id).then(sender => {
      setActiveCall(prev => prev && prev.call.id === row.id ? { ...prev, profile: sender } : prev);
    });
  };

  useEffect(() => {
    if (!user?.id) return;
    if (isDemoMode(user.id)) return;

    const channel = supabase
      .channel("attention_calls_for_me")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attention_calls", filter: `receiver_id=eq.${user.id}` },
        async (payload) => { await notify(payload.new as AttentionCall); }
      )
      .subscribe();

    let active = true;
    const runPolling = async () => {
      while (active) {
        try {
          const { data } = await supabase
            .from("attention_calls")
            .select("id, sender_id, receiver_id, message, created_at")
            .eq("receiver_id", user.id)
            .gte("created_at", new Date(Date.now() - 1000 * 60 * 10).toISOString())
            .order("created_at", { ascending: false })
            .limit(20);
          data?.forEach((row) => notify(row as AttentionCall));
        } catch {}
        await new Promise((r) => setTimeout(r, 3000));
      }
    };
    runPolling();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleReply = async (presetText?: string) => {
    const textToSend = presetText || replyText;
    if (!textToSend.trim() || !activeCall || !user) return;
    setIsSending(true);
    try {
      const friendId = activeCall.call.sender_id;
      let conversationId = null;
      const { data: myProfiles } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);
      if (myProfiles && myProfiles.length > 0) {
        const myConvIds = myProfiles.map((p) => p.conversation_id);
        const { data: shared } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .in('conversation_id', myConvIds)
          .eq('user_id', friendId);
        if (shared && shared.length > 0) {
          const { data: convs } = await supabase
            .from('conversations')
            .select('id, is_group')
            .in('id', shared.map(s => s.conversation_id))
            .eq('is_group', false);
          if (convs && convs.length > 0) conversationId = convs[0].id;
        }
      }
      if (!conversationId) {
        const { data: newConv } = await supabase.from("conversations").insert({ is_group: false }).select().single();
        if (newConv) {
          await supabase.from("conversation_participants").insert([
            { conversation_id: newConv.id, user_id: user.id },
            { conversation_id: newConv.id, user_id: friendId }
          ]);
          conversationId = newConv.id;
        }
      }
      if (conversationId) {
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          user_id: user.id,
          content: textToSend.trim(),
        });
        toast.success("Resposta enviada com sucesso!");
      }
    } catch {
      toast.error("Erro ao responder rapidamente.");
    } finally {
      setIsSending(false);
      handleClose();
    }
  };

  const handleMute = () => {
    if (!activeCall) return;
    try {
      window.localStorage?.setItem(`attention_muted_${activeCall.call.sender_id}`, (Date.now() + 2 * 3600 * 1000).toString());
      toast.success("Usuário silenciado por 2 horas.");
    } catch {}
    handleClose();
  };

  const handleClose = () => {
    setActiveCall(null);
    setReplyText("");
  };

  if (!activeCall) return null;

  const initial = (activeCall.profile.username ?? "U").slice(0, 1).toUpperCase();

  return (
    <>
      <style>{`
        @keyframes attnIn { from { opacity: 0; transform: scale(0.85) translateY(30px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes attnPulseRing { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.15); opacity: 0; } }
        @keyframes attnGlow { 0%, 100% { box-shadow: 0 0 20px rgba(249,115,22,0.3), 0 0 60px rgba(249,115,22,0.1); } 50% { box-shadow: 0 0 30px rgba(249,115,22,0.5), 0 0 80px rgba(249,115,22,0.2); } }
        @keyframes attnShimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
        @keyframes attnFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes attnBackdrop { from { opacity: 0; backdrop-filter: blur(0); } to { opacity: 1; backdrop-filter: blur(12px); } }
      `}</style>

      <div
        style={{
          position: "fixed", inset: 0, zIndex: 999999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.92) 100%)",
          animation: "attnBackdrop 0.3s ease-out forwards",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <div style={{
          position: "relative", width: "90vw", maxWidth: 340,
          background: "linear-gradient(165deg, #1a1008 0%, #0d0d0d 50%, #0a0510 100%)",
          border: "1px solid rgba(249,115,22,0.25)",
          borderRadius: 28, padding: "32px 24px 24px",
          animation: "attnIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          overflow: "hidden",
        }}>

          {/* Background glow */}
          <div style={{
            position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
            width: 200, height: 200, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          {/* Close */}
          <button
            onClick={handleClose}
            style={{
              position: "absolute", top: 12, right: 12, zIndex: 10,
              width: 28, height: 28, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "rgba(255,255,255,0.4)", transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
          >
            <X size={14} />
          </button>

          {/* Avatar with animated rings */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20, position: "relative" }}>
            <div style={{ position: "relative", animation: "attnFloat 3s ease-in-out infinite" }}>
              {/* Pulse rings */}
              <div style={{
                position: "absolute", inset: -8, borderRadius: "50%",
                border: "2px solid rgba(249,115,22,0.4)",
                animation: "attnPulseRing 2s ease-out infinite",
              }} />
              <div style={{
                position: "absolute", inset: -16, borderRadius: "50%",
                border: "1.5px solid rgba(249,115,22,0.2)",
                animation: "attnPulseRing 2s ease-out infinite 0.5s",
              }} />
              {/* Avatar */}
              <div style={{
                width: 80, height: 80, borderRadius: "50%", overflow: "hidden",
                border: "3px solid rgba(249,115,22,0.6)",
                animation: "attnGlow 2s ease-in-out infinite",
                position: "relative", zIndex: 1,
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {activeCall.profile.avatar_url ? (
                  <img
                    src={activeCall.profile.avatar_url}
                    alt={activeCall.profile.username ?? "Avatar"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ fontSize: 32, fontWeight: 800, color: "#fff" }}>{initial}</span>
                )}
              </div>
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: "center", marginBottom: 16, position: "relative" }}>
            <h2 style={{
              fontSize: 20, fontWeight: 800, color: "#fff", margin: 0,
              lineHeight: 1.3, letterSpacing: "-0.02em",
            }}>
              <span style={{ color: "#f97316" }}>{activeCall.profile.username ?? "Usuário"}</span>
              {" "}chamou sua
              <br />
              <span style={{
                background: "linear-gradient(90deg, #f97316, #fb923c, #f97316)",
                backgroundSize: "200% 100%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "attnShimmer 3s linear infinite",
              }}>atenção!</span>
            </h2>
            {activeCall.call.message && (
              <p style={{
                fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "8px 0 0",
                fontStyle: "italic", lineHeight: 1.5,
              }}>
                "{activeCall.call.message}"
              </p>
            )}
          </div>

          {/* Reply input */}
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Escreva uma resposta..."
            style={{
              width: "100%", height: 44, resize: "none", borderRadius: 14,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(249,115,22,0.2)",
              color: "#fff", fontSize: 13, padding: "10px 14px",
              outline: "none", transition: "border-color 0.2s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(249,115,22,0.5)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(249,115,22,0.2)"; }}
          />

          {/* Quick replies */}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {["Ja respondo...", "Ocupado...", "Tudo bem?"].map((label) => (
              <Button
                key={label}
                disabled={isSending}
                onClick={() => handleReply(label === "Ja respondo..." ? "Ja respondo." : label === "Ocupado..." ? "Estou ocupado..." : "Tudo bem?")}
                variant="secondary"
                style={{
                  flex: 1, height: 30, fontSize: 10, fontWeight: 600,
                  borderRadius: 10, padding: "0 4px",
                  background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  transition: "all 0.2s",
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* Main CTA */}
          <Button
            disabled={isSending || !replyText.trim()}
            onClick={() => handleReply()}
            style={{
              width: "100%", height: 46, marginTop: 12,
              background: "linear-gradient(135deg, #ea580c, #f97316, #fb923c)",
              backgroundSize: "200% 100%",
              color: "#fff", fontWeight: 800, fontSize: 14,
              borderRadius: 14, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 20px rgba(249,115,22,0.35)",
              transition: "all 0.2s",
              opacity: isSending || !replyText.trim() ? 0.5 : 1,
            }}
          >
            <MessageCircle size={18} />
            Responder Agora
          </Button>

          {/* Mute */}
          <button
            onClick={handleMute}
            style={{
              width: "100%", marginTop: 12, padding: "8px 0",
              background: "none", border: "none", cursor: "pointer",
              fontSize: 11, color: "rgba(255,255,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(239,68,68,0.8)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
          >
            <AlertCircle size={13} />
            Bloquear alertas de {activeCall.profile.username?.split(' ')[0]} por 2 horas
          </button>
        </div>
      </div>
    </>
  );
}
