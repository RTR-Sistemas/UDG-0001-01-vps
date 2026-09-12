/**
 * =============================================================================
 * File: src/pages/Auth.tsx
 * Purpose: Login, cadastro (fase teste — 100 vagas) e recuperação de conta
 *          via Chave de Segurança (UDG).
 * =============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Mail,
  Lock,
  User,
  Calendar,
  CreditCard,
  ArrowLeft,
  Copy,
  Download,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Medal,
  CheckCircle2,
  Eye,
  EyeOff,
  Gift,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { GoldSeal } from "@/components/GoldSeal";

const isValidCPF = (cpf: string) => {
  cpf = cpf.replace(/[^\d]+/g, "");
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  let split = cpf.split("").map(Number);
  let rest = (split.slice(0, 9).reduce((acc, curr, i) => acc + curr * (10 - i), 0) * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== split[9]) return false;
  rest = (split.slice(0, 10).reduce((acc, curr, i) => acc + curr * (11 - i), 0) * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === split[10];
};

const formatCPF = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2")
    .replace(/(-\d{2})\d+?$/, "$1");
};

const calculateAge = (birthDateString: string) => {
  const [year, month, day] = birthDateString.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const m = (today.getMonth() + 1) - month;
  if (m < 0 || (m === 0 && today.getDate() < day)) {
    age--;
  }
  return age;
};

const TOTAL_SLOTS = 100;

type AuthMode = "login" | "register" | "recover";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthDatePublic, setBirthDatePublic] = useState(false);
  const [cpf, setCpf] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [slotsLeft, setSlotsLeft] = useState<number | null>(null);

  // ── Convite (referral) ─────────────────────────────────────────────────────
  const [inviteCode, setInviteCode] = useState("");

  // ── Pós-cadastro: selo + chave ──────────────────────────────────────────────
  const [newUser, setNewUser] = useState<{
    email: string;
    registrationNumber: number | null;
    securityKey: string;
  } | null>(null);

  // ── Recuperação de conta ───────────────────────────────────────────────────
  const [recoverKey, setRecoverKey] = useState("");
  const [recoverEmail, setRecoverEmail] = useState<string | null>(null);
  const [recoverUsername, setRecoverUsername] = useState<string | null>(null);
  const [recoverNumber, setRecoverNumber] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [recoverDone, setRecoverDone] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  // Aplica código de convite pendente (login após cadastro com email não confirmado)
  useEffect(() => {
    const pending = localStorage.getItem("udg_invite_pending");
    if (!pending) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase.rpc("apply_invite_code", { p_code: pending }).then(({ error }) => {
        if (!error) localStorage.removeItem("udg_invite_pending");
      });
    });
  }, []);

  useEffect(() => {
    if (import.meta.env.VITE_SUPABASE_URL?.includes("dummy")) {
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate]);

  const loadSlots = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("registration_slots_left");
      if (!error && typeof data === "number") {
        setSlotsLeft(Math.max(0, Math.min(TOTAL_SLOTS, data)));
      }
    } catch {
      setSlotsLeft(null);
    }
  }, []);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const usedSlots = slotsLeft === null ? null : TOTAL_SLOTS - slotsLeft;
  const pctUsed = slotsLeft === null ? 0 : ((TOTAL_SLOTS - slotsLeft) / TOTAL_SLOTS) * 100;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Informe seu email e senha." });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast({ title: "Login realizado!", description: "Bem-vindo de volta." });
      navigate("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Não foi possível entrar",
        description: error?.message || "Verifique suas credenciais e tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !username || !fullName || !birthDate || !cpf) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Preencha todos os campos." });
      return;
    }
    if (!isValidCPF(cpf)) {
      toast({ variant: "destructive", title: "CPF Inválido", description: "O CPF informado não é válido." });
      return;
    }
    if (calculateAge(birthDate) < 18) {
      toast({ variant: "destructive", title: "Acesso Negado", description: "UndoinG é apenas para maiores de 18 anos." });
      return;
    }
    if (!termsAccepted || !privacyAccepted) {
      toast({ variant: "destructive", title: "Aceite obrigatório", description: "Você deve concordar com os Termos e a Privacidade." });
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", title: "Senha muito curta", description: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }
    if (slotsLeft !== null && slotsLeft <= 0) {
      toast({ variant: "destructive", title: "Vagas esgotadas", description: "As 100 vagas da fase de teste já foram preenchidas." });
      return;
    }
    setLoading(true);
    try {
      const formattedBirthDate = birthDate ? new Date(birthDate).toISOString().split("T")[0] : null;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim(),
            full_name: fullName.trim(),
            birth_date: formattedBirthDate,
            birth_date_public: birthDatePublic,
            cpf: cpf.replace(/\D/g, ""),
          },
        },
      });
      if (error) throw error;
      const userId = data?.user?.id;
      if (!userId) throw new Error("Não foi possível obter o usuário criado.");

      // Convite: aplica o código imediatamente; se não houver sessão ainda
      // (ex.: confirmação por email), guarda pendente para aplicar no próximo login
      if (inviteCode.trim()) {
        const { error: inviteError } = await supabase.rpc("apply_invite_code", {
          p_code: inviteCode.trim(),
        });
        if (inviteError) {
          localStorage.setItem("udg_invite_pending", inviteCode.trim());
        }
      }

      // Busca o número do selo e a chave de segurança gerada pelo banco
      let regNumber: number | null = null;
      let securityKey: string | null = null;

      const tryFetchOwn = async () => {
        const [profRes, keyRes] = await Promise.all([
          supabase.from("profiles").select("registration_number").eq("id", userId).maybeSingle(),
          supabase.from("account_security_keys").select("security_key").eq("user_id", userId).maybeSingle(),
        ]);
        regNumber = profRes.data?.registration_number ?? null;
        securityKey = keyRes.data?.security_key ?? null;
        return securityKey !== null;
      };

      let ok = await tryFetchOwn();
      if (!ok) {
        // Sem sessão ativa (ex.: confirmação de email) — tenta logar para ler a chave
        const signIn = await supabase.auth.signInWithPassword({ email, password });
        if (!signIn.error) {
          ok = await tryFetchOwn();
        }
      }

      if (!securityKey) {
        setMode("login");
        toast({
          title: "Conta criada!",
          description: "Confirme seu email e entre para visualizar sua Chave de Segurança.",
        });
        return;
      }

      setNewUser({ email, registrationNumber: regNumber, securityKey });
      setMode("login");
    } catch (error: any) {
      const msg = String(error?.message || error || "");
      if (msg.includes("VAGAS_ESGOTADAS") || msg.toLowerCase().includes("esgotada")) {
        toast({ variant: "destructive", title: "Vagas esgotadas", description: "As 100 vagas da fase de teste já foram preenchidas." });
        loadSlots();
      } else {
        toast({
          variant: "destructive",
          title: "Não foi possível criar a conta",
          description: error?.message || "Tente novamente em instantes.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const saveKeyToFile = () => {
    if (!newUser) return;
    const content = [
      "════════════════════════════════════════",
      "  UNDOING · CHAVE DE SEGURANÇA",
      "════════════════════════════════════════",
      "",
      `Email da conta: ${newUser.email}`,
      `Cadastro (selo): #${newUser.registrationNumber ?? "—"}`,
      "",
      `Chave de Segurança:`,
      `${newUser.securityKey}`,
      "",
      "GUARDE ESTA CHAVE EM LOCAL SEGURO.",
      "Com ela você recupera sua conta caso",
      "esqueça a senha ou o email.",
      "════════════════════════════════════════",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `undoing-chave-${newUser.email.replace(/[^a-z0-9]/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyKey = async () => {
    if (!newUser) return;
    try {
      await navigator.clipboard.writeText(newUser.securityKey);
      toast({ title: "Chave copiada!", description: "Cole em um local seguro para guardar." });
    } catch {
      toast({ variant: "destructive", title: "Não foi possível copiar", description: "Use o botão de download para salvar." });
    }
  };

  const handleRecoverLookup = async () => {
    if (!recoverKey.trim()) {
      toast({ variant: "destructive", title: "Informe a chave", description: "Digite sua Chave de Segurança." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth-recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup", securityKey: recoverKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Chave inválida.");
      setRecoverEmail(data.email);
      setRecoverUsername(data.username || null);
      setRecoverNumber(data.registrationNumber ?? null);
      toast({ title: "Conta encontrada!", description: `Email: ${data.email}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chave inválida", description: error?.message || "Não foi possível validar a chave." });
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ variant: "destructive", title: "Senha fraca", description: "A nova senha deve ter pelo menos 6 caracteres." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth-recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", securityKey: recoverKey.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Não foi possível redefinir a senha.");
      setRecoverDone(true);
      toast({ title: "Senha redefinida!", description: "Use sua nova senha para entrar." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao redefinir", description: error?.message || "Tente novamente." });
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    setMode("login");
    setNewUser(null);
    setRecoverEmail(null);
    setRecoverDone(false);
    setRecoverKey("");
  };

  // ── UI ─────────────────────────────────────────────────────────────────────

  const renderSlotsBanner = () => {
    if (slotsLeft === null) return null;
    const soldOut = slotsLeft <= 0;
    return (
      <div className="w-full rounded-2xl border border-amber-300/40 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
            <Sparkles className="h-3.5 w-3.5" />
            Fase de Teste · 100 Vagas
          </span>
          <span
            className={
              soldOut
                ? "text-[11px] font-black text-red-500"
                : "text-[11px] font-black text-amber-600 dark:text-amber-400"
            }
          >
            {soldOut ? "Esgotado" : `${slotsLeft} restante${slotsLeft === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all duration-700"
            style={{ width: `${pctUsed}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {soldOut
            ? "Os 100 cadastros da fase de teste foram preenchidos."
            : `Vaga de membro fundador com selo dourado vitalício (cadastro #${(usedSlots ?? 0) + 1}).`}
        </p>
      </div>
    );
  };

  const fieldClass = "bg-white/60 dark:bg-white/5 border-border/60 focus-visible:ring-primary/60";

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4 sm:p-6 relative overflow-hidden">
      {/* Fundo decorativo */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-background to-secondary/15" />
      <div className="absolute -top-32 -left-32 -z-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-pulse" />
      <div className="absolute -bottom-40 -right-32 -z-10 h-[28rem] w-[28rem] rounded-full bg-secondary/20 blur-3xl animate-pulse [animation-delay:1.5s]" />
      <div className="absolute top-1/3 right-1/4 -z-10 h-40 w-40 rounded-full bg-amber-400/10 blur-2xl" />

      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-10 items-center">
        {/* ── Branding ── */}
        <div className="hidden lg:flex flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <img src={logo} alt="UndoinG" className="h-40 w-40 object-contain drop-shadow-[0_0_25px_rgba(124,58,237,0.45)]" />
            <p className="text-lg text-muted-foreground font-medium">A rede que desbloqueia o mundo.</p>
          </div>

          <div className="space-y-3 max-w-md text-left">
            <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-card/60 backdrop-blur p-4">
              <Medal className="h-8 w-8 text-amber-500 shrink-0" />
              <p className="text-sm text-muted-foreground leading-snug">
                <strong className="text-foreground">Selo dourado vitalício</strong> para os 100 primeiros membros da
                fase de teste — exibido ao lado do seu nome na rede.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-card/60 backdrop-blur p-4">
              <KeyRound className="h-8 w-8 text-primary shrink-0" />
              <p className="text-sm text-muted-foreground leading-snug">
                <strong className="text-foreground">Chave de Segurança única</strong> para recuperar sua conta caso
                esqueça senha ou email.
              </p>
            </div>
          </div>

          {renderSlotsBanner()}
        </div>

        {/* ── Form ── */}
        <div className="w-full rounded-3xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/10 p-6 sm:p-8">
          <div className="flex lg:hidden justify-center mb-4">
            <img src={logo} alt="UndoinG" className="h-20 w-20 object-contain" />
          </div>

          {mode !== "recover" && <div className="lg:hidden mb-5">{renderSlotsBanner()}</div>}

          {newUser ? (
            /* ───────── PÓS-CADASTRO: SELO + CHAVE ───────── */
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 ring-4 ring-amber-200/40 shadow-lg shadow-amber-500/30 mb-2">
                  <Medal className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-2xl font-black tracking-tight text-foreground">Conta criada com sucesso!</h2>
                <p className="text-sm text-muted-foreground">
                  Você faz parte dos <strong className="text-amber-500">100 primeiros membros</strong> — selo dourado
                  vitalício garantido.
                </p>
              </div>

              {newUser.registrationNumber && (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-amber-300/50 bg-gradient-to-r from-amber-500/15 to-yellow-500/10 px-4 py-3">
                  <GoldSeal registrationNumber={newUser.registrationNumber} size="md" />
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    Membro Fundador · Cadastro #{newUser.registrationNumber}
                  </span>
                </div>
              )}

              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <p className="text-sm font-bold text-foreground">Sua Chave de Segurança</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Com esta chave você recupera sua conta caso esqueça a <strong>senha</strong> ou o{" "}
                  <strong>email</strong>. Ela é exibida apenas uma vez — <strong>salve agora</strong>.
                </p>
                <div className="rounded-xl bg-black/90 dark:bg-black/80 border border-primary/30 px-4 py-3 text-center">
                  <code className="text-base sm:text-lg font-mono font-bold tracking-[0.15em] text-amber-300 break-all">
                    {newUser.securityKey}
                  </code>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" onClick={copyKey} className="gap-2">
                    <Copy className="h-4 w-4" /> Copiar
                  </Button>
                  <Button type="button" variant="outline" onClick={saveKeyToFile} className="gap-2">
                    <Download className="h-4 w-4" /> Salvar arquivo
                  </Button>
                </div>
              </div>

              <Button type="button" className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 gap-2" onClick={goToLogin}>
                <CheckCircle2 className="h-4 w-4" /> Já salvei minha chave — fazer login
              </Button>
            </div>
          ) : recoverDone ? (
            /* ───────── RECUPERAÇÃO CONCLUÍDA ───────── */
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-500/15 border border-emerald-400/40 mx-auto">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight">Senha redefinida!</h2>
                <p className="text-sm text-muted-foreground">
                  Use seu email <strong className="text-foreground">{recoverEmail}</strong> e a nova senha para entrar.
                </p>
              </div>
              <Button className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90" onClick={goToLogin}>
                Ir para o login
              </Button>
            </div>
          ) : mode === "recover" ? (
            /* ───────── RECUPERAÇÃO VIA CHAVE ───────── */
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button type="button" onClick={goToLogin} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
              </button>

              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-foreground">Recuperar conta</h2>
                <p className="text-sm text-muted-foreground">
                  Esqueceu a senha ou o email? Recupere sua conta com a{" "}
                  <strong className="text-foreground">Chave de Segurança</strong>.
                </p>
              </div>

              {!recoverEmail ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="recoverKey">Chave de Segurança</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="recoverKey"
                        type="text"
                        autoComplete="off"
                        placeholder="Ex.: aB3dE9fGh2iJkLmN"
                        className={fieldClass + " pl-9 font-mono tracking-wider"}
                        value={recoverKey}
                        onChange={(e) => setRecoverKey(e.target.value)}
                        disabled={loading}
                        onKeyDown={(e) => e.key === "Enter" && handleRecoverLookup()}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      A chave tem letras e números, maiúsculas e minúsculas.
                    </p>
                  </div>
                  <Button className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90" onClick={handleRecoverLookup} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Validar chave
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                      Conta encontrada
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground break-all">{recoverEmail}</span>
                      {recoverNumber ? <GoldSeal registrationNumber={recoverNumber} /> : null}
                    </div>
                    {recoverUsername && (
                      <p className="text-xs text-muted-foreground">
                        Usuário: <strong className="text-foreground">{recoverUsername}</strong>
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="newPassword"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        className={fieldClass + " pl-9"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <Button className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90" onClick={handleRecoverReset} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Redefinir senha
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* ───────── LOGIN / CADASTRO ───────── */
            <div className="space-y-5">
              <div className="space-y-1 text-center">
                {mode === "register" && (
                  <>
                    <h2 className="text-3xl font-black tracking-tighter text-foreground">
                      Crie sua <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">conta</span>
                    </h2>
                    <p className="text-sm text-muted-foreground">Garanta sua vaga entre os 100 membros fundadores.</p>
                  </>
                )}
              </div>

              <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
                {mode === "register" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="username">Usuário</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="username" type="text" placeholder="seu_usuario" className={fieldClass + " pl-9"} value={username} onChange={(e) => setUsername(e.target.value)} disabled={loading} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Nome</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="fullName" type="text" placeholder="Seu nome" className={fieldClass + " pl-9"} value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="birthDate">Data de nascimento</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="birthDate" type="date" className={fieldClass + " pl-9"} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} disabled={loading} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cpf">CPF</Label>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="cpf" type="text" placeholder="000.000.000-00" className={fieldClass + " pl-9"} value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} maxLength={14} disabled={loading} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="invite">Código de convite (opcional)</Label>
                      <div className="relative">
                        <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="invite" type="text" placeholder="Ex.: UDG-1234567" className={fieldClass + " pl-9 uppercase"} value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} disabled={loading} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">Foi convidado? Insira o código do seu amigo e ganhem os dois bônus de boas-vindas.</p>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-white/40 dark:bg-white/5 p-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">Data de nascimento pública</p>
                        <p className="text-[11px] text-muted-foreground">Se desativado, só você vê no seu perfil.</p>
                      </div>
                      <Switch checked={birthDatePublic} onCheckedChange={setBirthDatePublic} disabled={loading} />
                    </div>

                    <div className="space-y-3 rounded-xl border border-border/60 bg-white/40 dark:bg-white/5 p-3">
                      <div className="flex items-start space-x-2">
                        <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(c) => setTermsAccepted(c as boolean)} disabled={loading} className="mt-1" />
                        <Label htmlFor="terms" className="text-xs font-normal leading-snug">
                          Li e concordo com os <a href="/TERMOS_DE_USO.md" target="_blank" className="text-primary font-medium hover:underline">Termos de Uso</a>
                        </Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Checkbox id="privacy" checked={privacyAccepted} onCheckedChange={(c) => setPrivacyAccepted(c as boolean)} disabled={loading} className="mt-1" />
                        <Label htmlFor="privacy" className="text-xs font-normal leading-snug">
                          Concordo com a <a href="/POLITICA_DE_PRIVACIDADE.md" target="_blank" className="text-primary font-medium hover:underline">Política de Privacidade</a>
                        </Label>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="seu@email.com" className={fieldClass + " pl-9"} value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className={fieldClass + " pl-9 pr-10"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 h-11 text-base" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === "login" ? "Entrar" : "Criar Conta"}
                </Button>
              </form>

              <div className="space-y-2 pt-1">
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("recover");
                      setRecoverEmail(null);
                    }}
                    className="w-full text-center text-xs font-bold uppercase tracking-widest text-primary hover:underline"
                  >
                    Recuperar conta
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "login" ? "register" : "login");
                    setNewUser(null);
                  }}
                  className="w-full text-center text-sm font-semibold text-foreground hover:text-primary transition-colors"
                >
                  {mode === "login" ? (
                    <>Não tem conta? <span className="text-primary">Criar uma</span></>
                  ) : (
                    <>Já tem conta? <span className="text-primary">Fazer login</span></>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Faixa de confiança: a criptografia é um diferencial e precisa
            aparecer antes mesmo do cadastro. */}
        <div className="flex justify-center pt-5 lg:col-span-2">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-snug">
              Mensagens com criptografia{" "}
              <strong className="text-foreground font-semibold">pós-quântica</strong> de ponta a
              ponta · ML-KEM-768 + ML-DSA-65 (NIST)
            </p>
          </div>
        </div>

        <div className="hidden lg:flex justify-center pt-6 pb-2 lg:col-span-2">
          <nav className="flex items-center gap-5 text-[11px] text-muted-foreground">
            <a href="/sobre" className="hover:text-foreground transition-colors">Sobre</a>
            <a href="/selo-dourado" className="hover:text-foreground transition-colors">Selo Dourado</a>
            <a href="/chave-seguranca" className="hover:text-foreground transition-colors">Chave de Segurança</a>
            <a href="/recursos" className="hover:text-foreground transition-colors">Recursos</a>
          </nav>
        </div>
      </div>
    </div>
  );
}
