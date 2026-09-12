import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Settings as SettingsIcon, Bell, Smile, Activity, Type, LogOut, Moon, Shield, Globe, MessageSquare, UserPlus, FileText, Volume2, BadgeCheck, Check, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import BackButton from "@/components/BackButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { MOOD_DETAILS, MoodType } from "@/components/mood/MoodStatusBadge";
import { usePermissions } from "@/contexts/PermissionContext";
import { PERMISSION_META, type PermissionType } from "@/lib/permissions";
import MoodAnalysisModal from "@/components/mood/MoodAnalysisModal";
import { PqSecurityCard } from "@/components/security/PqSecurityCard";


// Categorized structure to organize the 40+ moods in the settings grid
const MOOD_CATEGORIES: Record<string, { title: string; list: MoodType[] }> = {
  felicidade: { title: "Felicidade", list: ["ecstatic", "very_happy", "happy", "content", "grateful", "joyful"] },
  tristeza: { title: "Tristeza", list: ["devastated", "very_sad", "sad", "melancholic", "nostalgic", "heartbroken"] },
  raiva: { title: "Raiva", list: ["furious", "angry", "irritated", "frustrated", "indignant"] },
  medo: { title: "Medo / Ansiedade", list: ["terrified", "anxious", "worried", "nervous", "panicked"] },
  surpresa: { title: "Surpresa", list: ["shocked", "amazed", "surprised", "curious"] },
  energia: { title: "Energia / Foco", list: ["energetic", "motivated", "focused", "creative", "inspired"] },
  calma: { title: "Calma", list: ["peaceful", "relaxed", "neutral", "sleepy", "serene"] },
  amor: { title: "Amor", list: ["in_love", "romantic", "caring", "passionate"] },
  social: { title: "Social", list: ["sociable", "lonely", "shy", "confident"] },
};

type ThemePreference = "light" | "dark" | "system";

const DEFAULT_NOTIF_PREFS = {
  messages: true,
  attention_calls: true,
  mentions: true,
  friend_requests: true,
  comments: true,
  comment_replies: true,
  posts: true,
  relationships: true,
  communities: true,
  system_alerts: true,
  sound_enabled: true,
  badge_enabled: true,
};

type NotifKey = keyof typeof DEFAULT_NOTIF_PREFS;

const NOTIF_GROUPS: { title: string; icon: React.ComponentType<{ className?: string }>; items: { key: NotifKey; label: string; desc: string }[] }[] = [
  {
    title: "Interações",
    icon: MessageSquare,
    items: [
      { key: "mentions", label: "Menções", desc: "Quando alguém menciona você" },
      { key: "comments", label: "Comentários", desc: "Quando comentam em suas publicações" },
      { key: "comment_replies", label: "Respostas a comentários", desc: "Quando respondem seus comentários" },
    ],
  },
  {
    title: "Amigos e Relações",
    icon: UserPlus,
    items: [
      { key: "friend_requests", label: "Solicitações de amizade", desc: "Novas solicitações recebidas" },
      { key: "attention_calls", label: "Chamadas de atenção", desc: "Quando alguém chama sua atenção" },
      { key: "relationships", label: "Relacionamentos", desc: "Atualizações de relacionamento" },
    ],
  },
  {
    title: "Conteúdo",
    icon: FileText,
    items: [
      { key: "posts", label: "Novos posts", desc: "Posts dos seus amigos" },
      { key: "communities", label: "Comunidades", desc: "Atividade nas comunidades" },
      { key: "system_alerts", label: "Alertas do sistema", desc: "Avisos importantes da plataforma" },
    ],
  },
  {
    title: "Preferências de App",
    icon: Bell,
    items: [
      { key: "sound_enabled", label: "Sons de notificação", desc: "Reproduzir som ao receber notificação" },
      { key: "badge_enabled", label: "Badge de contagem", desc: "Exibir número de notificações no ícone" },
    ],
  },
];

const applyTheme = (value: ThemePreference) => {
  const resolved = value === "system" ? (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light") : value;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  localStorage.setItem("udg_theme", value);
};

export default function Settings() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { requestPermission, getStatus, refreshStatus } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // States
  const [pushEnabled, setPushEnabled] = useState(true);
  const [notifPrefs, setNotifPrefs] = useState<typeof DEFAULT_NOTIF_PREFS>(DEFAULT_NOTIF_PREFS);
  const [moodEnabled, setMoodEnabled] = useState(false);
  const [currentMood, setCurrentMood] = useState<MoodType>(null);
  const [moodPublic, setMoodPublic] = useState(true);
  const [movementEnabled, setMovementEnabled] = useState(false);
  const [movementStatus, setMovementStatus] = useState("stopped");
  const [fontSize, setFontSize] = useState("1"); // 0.85 = P, 1 = M, 1.15 = G
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const [profileVisitsEnabled, setProfileVisitsEnabled] = useState(true);
  const [preferredLanguage, setPreferredLanguage] = useState("pt-BR");
  const [debateAvailable, setDebateAvailable] = useState(true);
  const [isMoodModalOpen, setIsMoodModalOpen] = useState(false);
  const [currentMoodEmoji, setCurrentMoodEmoji] = useState<string>("");

  useEffect(() => {
    if (user) {
      loadSettings();
      const scale = localStorage.getItem("font_scale") || "1";
      setFontSize(scale);
      const storedTheme = (localStorage.getItem("udg_theme") || "dark") as ThemePreference;
      setTheme(storedTheme);
      applyTheme(storedTheme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    (["notifications", "microphone", "camera", "location"] as PermissionType[]).forEach((type) => {
      void refreshStatus(type);
    });
  }, [refreshStatus]);

  const loadSettings = async () => {
    try {
      // Fetch profile settings
      const { data: profile } = await supabase
        .from("profiles")
        .select("mood_status_enabled, current_mood, movement_status_enabled, movement_status, mood_public, profile_visits_enabled, preferred_language, debate_available, friend_code")
        .eq("id", user!.id)
        .single();

      if (profile) {
        setMoodEnabled(profile.mood_status_enabled || false);
        setCurrentMood(profile.current_mood as MoodType || null);
        setMovementEnabled(profile.movement_status_enabled || false);
        setMovementStatus(profile.movement_status || "stopped");
        setMoodPublic(profile.mood_public ?? true);
        setProfileVisitsEnabled(profile.profile_visits_enabled ?? true);
        setPreferredLanguage(profile.preferred_language || "pt-BR");
        setDebateAvailable(profile.debate_available ?? true);
        setFriendCode(profile.friend_code || "");
      }

      // Fetch notification preferences
      const { data: notif } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      
      if (notif) {
        setPushEnabled(notif.push_enabled);
        setNotifPrefs((prev) => {
          const merged = { ...DEFAULT_NOTIF_PREFS, ...prev };
          for (const key of Object.keys(DEFAULT_NOTIF_PREFS) as NotifKey[]) {
            if (typeof (notif as any)[key] === "boolean") {
              merged[key] = (notif as any)[key];
            }
          }
          return merged;
        });
      }
    } catch (error) {
      console.error("Error loading settings", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const emoji = currentMood ? MOOD_DETAILS[currentMood]?.emoji || null : null;
      
      // Update profiles
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          mood_status_enabled: moodEnabled,
          current_mood: currentMood || null,
          current_mood_emoji: emoji,
          movement_status_enabled: movementEnabled,
          movement_status: movementStatus,
          mood_public: moodPublic,
          profile_visits_enabled: profileVisitsEnabled,
          preferred_language: preferredLanguage,
          debate_available: debateAvailable,
        })
        .eq("id", user!.id);

      if (profileErr) throw profileErr;

      // Update Notification Prefs (Upsert)
      const { error: notifErr } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user!.id,
          push_enabled: pushEnabled,
          messages: notifPrefs.messages,
          attention_calls: notifPrefs.attention_calls,
          mentions: notifPrefs.mentions,
          friend_requests: notifPrefs.friend_requests,
          comments: notifPrefs.comments,
          comment_replies: notifPrefs.comment_replies,
          posts: notifPrefs.posts,
          relationships: notifPrefs.relationships,
          communities: notifPrefs.communities,
          system_alerts: notifPrefs.system_alerts,
          sound_enabled: notifPrefs.sound_enabled,
          badge_enabled: notifPrefs.badge_enabled,
          updated_at: new Date().toISOString()
        });

      if (notifErr) throw notifErr;

      // Save and log mood entry in history if mood changed and is enabled
      if (moodEnabled && currentMood) {
        await supabase.rpc("record_mood", {
          p_mood: currentMood,
          p_emoji: emoji || "😐",
          p_details: { source: "settings" }
        });
      }

      // Update Font Size
      localStorage.setItem("font_scale", fontSize);
      document.documentElement.style.setProperty("--font-scale", fontSize);

      // Persist theme
      applyTheme(theme);

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao salvar configurações.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFontChange = (value: string) => {
    setFontSize(value);
    document.documentElement.style.setProperty("--font-scale", value);
  };

  const handleThemeChange = (value: ThemePreference) => {
    setTheme(value);
    applyTheme(value);
  };

  const setNotifValue = (key: NotifKey, value: boolean) => {
    setNotifPrefs((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-8">
        <BackButton />
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground text-sm">Personalize sua experiência na plataforma</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Aparência */}
        <section className="bg-card border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Moon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Aparência</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Tema</p>
                <p className="text-sm text-muted-foreground">Escolha entre claro, escuro ou seguir o sistema</p>
              </div>
              <Select value={theme} onValueChange={(v) => handleThemeChange(v as ThemePreference)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">☀️ Claro</SelectItem>
                  <SelectItem value="dark">🌙 Escuro</SelectItem>
                  <SelectItem value="system">🖥️ Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Acessibilidade */}
        <section className="bg-card border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Type className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Acessibilidade</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Tamanho do Texto</p>
                <p className="text-sm text-muted-foreground">Ajuste o tamanho de toda a interface</p>
              </div>
              <Select value={fontSize} onValueChange={handleFontChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.85">Pequeno</SelectItem>
                  <SelectItem value="1">Médio (Padrão)</SelectItem>
                  <SelectItem value="1.15">Grande</SelectItem>
                  <SelectItem value="1.3">Extra Grande</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Notificações */}
        <section className="bg-card border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Notificações</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Notificações Push</p>
                <p className="text-sm text-muted-foreground">Receba alertas mesmo com o app fechado</p>
              </div>
              <Switch
                checked={pushEnabled}
                onCheckedChange={(v) => {
                  setPushEnabled(v);
                  if (v) {
                    void requestPermission(
                      'notifications',
                      'Para receber alertas mesmo com o app fechado, o navegador precisa liberar as notificações.'
                    );
                  }
                }}
              />
            </div>

            <div className="pt-4 border-t space-y-5">
              {NOTIF_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-3 flex items-center gap-1.5">
                    <group.icon className="h-3.5 w-3.5" />
                    {group.title}
                  </h3>
                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <div key={item.key} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <Switch checked={notifPrefs[item.key]} onCheckedChange={(v) => setNotifValue(item.key, v)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Permissões do dispositivo */}
        <section className="bg-card border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Permissões do dispositivo</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            As permissões são pedidas automaticamente quando você usa cada função. Você também pode conferir e ajustar aqui.
          </p>

          <div className="space-y-3">
            {(Object.keys(PERMISSION_META) as PermissionType[]).map((type) => {
              const meta = PERMISSION_META[type];
              const status = getStatus(type);
              const Icon = meta.icon;
              const statusLabel =
                status === "granted"
                  ? "Permitida"
                  : status === "denied"
                    ? "Bloqueada no navegador"
                    : status === "unsupported"
                      ? "Não suportado neste dispositivo"
                      : "Ainda não permitida";

              return (
                <div
                  key={type}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/40 p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{meta.shortTitle}</p>
                      <p className="text-xs text-muted-foreground truncate">{statusLabel}</p>
                    </div>
                  </div>
                  {status === "granted" ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 shrink-0">
                      <Check className="h-4 w-4" />
                      Ativa
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() =>
                        void requestPermission(type, meta.description)
                      }
                    >
                      {status === "denied" ? "Como ativar" : "Permitir"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Criptografia pós-quântica */}
        <section className="bg-card border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Segurança das mensagens</h2>
          </div>
          <PqSecurityCard />
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full text-xs"
            onClick={() => navigate("/seguranca")}
          >
            Entenda a criptografia pós-quântica
          </Button>
        </section>

        {/* Privacidade */}
        <section className="bg-card border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Privacidade</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Exibir meu humor publicamente</p>
                <p className="text-sm text-muted-foreground">Deixe seu humor visível para outros usuários</p>
              </div>
              <Switch checked={moodPublic} onCheckedChange={setMoodPublic} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Registrar visitas ao meu perfil</p>
                <p className="text-sm text-muted-foreground">Permitir que visitas ao seu perfil sejam contadas</p>
              </div>
              <Switch checked={profileVisitsEnabled} onCheckedChange={setProfileVisitsEnabled} />
            </div>
          </div>
        </section>

        {/* Humor */}
        <section className="bg-card border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Smile className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Status de Humor</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Exibir meu humor</p>
                <p className="text-sm text-muted-foreground">Mostre aos seus amigos como você está se sentindo</p>
              </div>
              <Switch checked={moodEnabled} onCheckedChange={setMoodEnabled} />
            </div>

            {moodEnabled && (
              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Selecione seu humor atual:</p>
                  <Button
                    onClick={() => setIsMoodModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Escanear Rosto
                  </Button>
                </div>
                
                <div className="space-y-5 max-h-[400px] overflow-y-auto pr-1">
                  {Object.entries(MOOD_CATEGORIES).map(([catKey, cat]) => (
                    <div key={catKey} className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{cat.title}</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {cat.list.map((m) => {
                          const details = MOOD_DETAILS[m || "unknown"];
                          if (!details) return null;
                          const selected = currentMood === m;
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setCurrentMood(m)}
                              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                                selected 
                                  ? 'bg-primary/15 border-primary text-primary font-bold shadow-sm' 
                                  : 'bg-background hover:bg-accent hover:border-border border-border/40'
                              }`}
                            >
                              <span className="text-base select-none">{details.emoji}</span>
                              <span className="truncate">{details.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Movimento */}
        <section className="bg-card border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Status de Movimento</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Exibir meu status de movimento</p>
                <p className="text-sm text-muted-foreground">O sistema detecta automaticamente</p>
              </div>
              <Switch checked={movementEnabled} onCheckedChange={setMovementEnabled} />
            </div>

            {movementEnabled && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium mb-3">Seu estado atual:</p>
                <Select value={movementStatus} onValueChange={setMovementStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o estado..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stopped">Parado 📍</SelectItem>
                    <SelectItem value="moving">Em Movimento 🏃</SelectItem>
                    <SelectItem value="traveling">Viajando ✈️</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </section>

        {/* Preferências */}
        <section className="bg-card border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Preferências</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Idioma preferido</p>
                <p className="text-sm text-muted-foreground">Defina seu idioma para a plataforma</p>
              </div>
              <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                  <SelectItem value="en">Inglês</SelectItem>
                  <SelectItem value="es">Espanhol</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Conta */}
        <section className="bg-card border rounded-2xl p-5 shadow-sm border-destructive/20">
          <div className="flex items-center gap-3 mb-4">
            <LogOut className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold">Conta</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sair da conta</p>
                <p className="text-sm text-muted-foreground">Encerrar sessão e voltar para a tela de login</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={async () => {
                  await signOut();
                  navigate("/auth");
                  toast({ title: "Você saiu", description: "Sessão encerrada com sucesso." });
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </Button>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg" className="w-full sm:w-auto shadow-md">
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>

      <MoodAnalysisModal
        isOpen={isMoodModalOpen}
        onClose={() => setIsMoodModalOpen(false)}
        userId={user?.id || ""}
        onSuccess={(mood, emoji) => {
          setCurrentMood(mood);
          setCurrentMoodEmoji(emoji);
          setMoodEnabled(true);
        }}
      />
    </div>
  );
}
