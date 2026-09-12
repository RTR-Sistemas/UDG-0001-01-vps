/**
 * =============================================================================
 * File: src/components/onboarding/LGPDConsentModal.tsx
 * Purpose: A4-COMPLIANCE — Modal simplificado de Termos & Privacidade (LGPD)
 *
 * Tela única com todo o texto e 1 checkbox para aceitar tudo.
 * Versão dos termos: 1.0.0
 * =============================================================================
 */

import { useState, useEffect } from "react";
import { Shield, CheckCircle2, Lock, Eye, Bell, MapPin, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const TERMS_VERSION = "1.0.0";
const PRIVACY_VERSION = "1.0.0";

export function LGPDConsentModal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    if (user.id.startsWith("demo-") || import.meta.env.VITE_SUPABASE_URL?.includes("dummy")) return;
    checkExistingConsent();
  }, [user?.id]);

  const checkExistingConsent = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("user_consents")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (
        data &&
        data.accepted_terms &&
        data.accepted_privacy &&
        data.terms_version === TERMS_VERSION &&
        data.privacy_version === PRIVACY_VERSION
      ) {
        setShow(false);
      } else {
        setShow(true);
      }
    } catch {
      setShow(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!accepted || saving) return;
    setSaving(true);

    try {
      const userAgent = navigator.userAgent;
      let ipAddress = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const ipRes = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
        clearTimeout(timeoutId);
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          ipAddress = ipData.ip;
        }
      } catch {}

      const { error } = await supabase
        .from("user_consents")
        .upsert(
          {
            user_id: user!.id,
            terms_version: TERMS_VERSION,
            privacy_version: PRIVACY_VERSION,
            accepted_terms: true,
            accepted_privacy: true,
            accepted_cookies: true,
            accepted_data_processing: true,
            accepted_location: true,
            accepted_push_notifications: true,
            ip_address: ipAddress,
            user_agent: userAgent,
            accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) throw error;

      await supabase
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          privacy_accepted_at: new Date().toISOString(),
        })
        .eq("id", user!.id);

      toast({
        title: "✅ Termos aceitos!",
        description: "Bem-vindo à plataforma UndoinG.",
      });

      setShow(false);
    } catch {
      toast({
        title: "Erro ao salvar consentimento",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!show || loading) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-xl bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh] animate-in zoom-in-95 duration-300">
        {/* Header compacto */}
        <div className="bg-gradient-to-r from-primary/20 to-secondary/20 border-b p-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Termos & Privacidade</h1>
              <p className="text-xs text-muted-foreground">UndoinG — v{TERMS_VERSION} • LGPD</p>
            </div>
          </div>
        </div>

        {/* Conteúdo único scrollável */}
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="p-5 space-y-5 text-sm text-muted-foreground leading-relaxed">
            <p>
              Ao usar a plataforma UndoinG, você concorda com estes Termos e com a Política de Privacidade,
              em conformidade com a <strong className="text-foreground">LGPD (Lei 13.709/2018)</strong>.
            </p>

            {/* O que coletamos */}
            <section>
              <h2 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-blue-500" /> O que coletamos
              </h2>
              <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                <li>Nome de usuário e e-mail (login)</li>
                <li>Foto de perfil (opcional)</li>
                <li>Mensagens, posts e mídia que você publica</li>
                <li>Localização (somente se você autorizar)</li>
                <li>IP e dados técnicos (segurança)</li>
              </ul>
            </section>

            {/* Como usamos */}
            <section>
              <h2 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-green-500" /> Como usamos
              </h2>
              <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                <li>Operar e personalizar sua experiência</li>
                <li>Garantir a segurança da sua conta</li>
                <li>Moderar conteúdo inapropriado</li>
                <li>Enviar notificações relevantes</li>
              </ul>
              <p className="mt-2 text-xs bg-green-500/10 text-green-700 dark:text-green-400 p-2 rounded-lg border border-green-500/20">
                ✅ Não vendemos seus dados a terceiros.
              </p>
            </section>

            {/* Notificações e localização */}
            <section className="grid sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted/20 border border-border/40">
                <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5 mb-1">
                  <Bell className="h-3.5 w-3.5 text-amber-500" /> Notificações
                </h3>
                <p className="text-xs">Mensagens, menções e atividades. Você pode desativar quando quiser.</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/20 border border-border/40">
                <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-red-500" /> Localização
                </h3>
                <p className="text-xs">Opcional e pontual. Só quando você escolher compartilhar.</p>
              </div>
            </section>

            {/* Regras de conduta */}
            <section>
              <h2 className="font-semibold text-foreground text-sm mb-2">Conduta na plataforma</h2>
              <p className="text-xs">É proibido publicar conteúdo ilegal, assediar usuários, spam, ou violar direitos de terceiros. Conteúdo violador pode ser removido e contas suspensas.</p>
            </section>

            {/* Mensagens */}
            <section>
              <h2 className="font-semibold text-foreground text-sm mb-2">Mensagens privadas</h2>
              <p className="text-xs">Armazenamento temporário (configurável), visíveis apenas aos participantes. Mensagens apagadas são removidas definitivamente.</p>
            </section>

            {/* Seus direitos */}
            <section>
              <h2 className="font-semibold text-foreground text-sm mb-2">Seus direitos (LGPD Art. 18)</h2>
              <p className="text-xs">Você pode acessar, corrigir, eliminar seus dados, portabilidade, revogar consentimento e opor-se ao tratamento. Contato: <strong className="text-foreground">contato@undoing.app</strong></p>
            </section>

            {/* Menores */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>Maiores de 18 anos.</strong> Menores precisam de autorização dos responsáveis.
              </p>
            </div>

            {/* Retenção */}
            <section>
              <h2 className="font-semibold text-foreground text-sm mb-2">Retenção de dados</h2>
              <ul className="list-disc list-inside space-y-0.5 ml-2 text-xs">
                <li>Mensagens temporárias: apagadas após visualização</li>
                <li>Posts: enquanto a conta estiver ativa</li>
                <li>Conta: 30 dias após exclusão</li>
              </ul>
            </section>

            {/* Segurança */}
            <section>
              <h2 className="font-semibold text-foreground text-sm mb-2">Segurança</h2>
              <p className="text-xs">Criptografia TLS/HTTPS, autenticação JWT, RLS no banco, rate limiting e hard delete de mensagens apagadas.</p>
            </section>

            <p className="text-[10px] text-muted-foreground border-t border-border/30 pt-3">
              Versão dos termos: {TERMS_VERSION} • Vigência: 24/05/2026 • Legislação: LGPD (13.709/18), Marco Civil (12.965/14), CDC (8.078/90)
            </p>
          </div>
        </div>

        {/* Checkbox único + Botão */}
        <div className="border-t p-4 bg-muted/5 flex-shrink-0 space-y-3">
          <button
            type="button"
            onClick={() => setAccepted(!accepted)}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-200 text-left ${
              accepted
                ? "border-primary/50 bg-primary/10"
                : "border-border/60 bg-muted/10 hover:border-border"
            }`}
          >
            <div
              className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                accepted ? "border-primary bg-primary" : "border-border bg-background"
              }`}
            >
              {accepted && <CheckCircle2 className="h-4 w-4 text-primary-foreground" />}
            </div>
            <span className="text-sm font-medium text-foreground leading-snug">
              Li e aceito os Termos de Uso e a Política de Privacidade
            </span>
          </button>

          <Button
            className={`w-full h-12 text-base font-semibold rounded-xl transition-all duration-300 ${
              accepted
                ? "bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg"
                : "opacity-40 cursor-not-allowed"
            }`}
            disabled={!accepted || saving}
            onClick={handleAccept}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Salvando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Aceitar e Continuar
              </span>
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Você pode revogar seu consentimento nas configurações de conta a qualquer momento.
          </p>
        </div>
      </div>
    </div>
  );
}
