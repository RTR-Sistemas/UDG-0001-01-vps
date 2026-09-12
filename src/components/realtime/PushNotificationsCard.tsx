import { Bell, BellOff, Loader2, Smartphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useNativePush } from '@/hooks/useNativePush';

export function PushNotificationsCard({ userId }: { userId?: string }) {
  const {
    support,
    permission,
    isBusy,
    isLoading,
    isEffectivelyEnabled,
    hasLocalSubscription,
    serverStatus,
    enablePush,
    disablePush,
  } = useNativePush(userId);

  if (!userId) return null;

  const handleToggle = async (checked: boolean) => {
    try {
      if (checked) {
        await enablePush({ sendTestPush: true });
        toast({
          title: 'Notificações ligadas',
          description: 'Este dispositivo já pode receber mensagens, comentários e alertas.',
        });
        return;
      }

      await disablePush();
      toast({
        title: 'Notificações desligadas',
        description: 'As notificações push foram desativadas neste perfil.',
      });
    } catch (error: any) {
      toast({
        title: 'Não foi possível atualizar o push',
        description: error?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    }
  };

  const renderStatusText = () => {
    if (!support.supported || !support.isSecureContext) {
      return 'Este navegador ou ambiente atual não suporta notificações push nativas.';
    }

    if (support.isIos && !support.isStandalone) {
      return 'No iPhone/iPad, instale este app na Tela de Início para liberar o push nativo.';
    }

    if (permission === 'denied') {
      return 'As notificações estão bloqueadas no navegador. Libere a permissão nas configurações do navegador e tente novamente.';
    }

    if (isEffectivelyEnabled) {
      return 'Ligado neste dispositivo. Você receberá alertas de mensagens, comentários e chamadas de atenção.';
    }

    if (serverStatus.pushEnabled === false) {
      return 'Desligado. Ative para voltar a receber notificações push.';
    }

    if (hasLocalSubscription) {
      return 'Este dispositivo já possui uma inscrição local, mas o recebimento ainda não está ativo para o seu perfil.';
    }

    return 'Ative para receber notificações push de interações importantes no sistema.';
  };

  const canToggle = support.supported && support.isSecureContext && !(support.isIos && !support.isStandalone);

  return (
    <Card className="bg-card/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">
              {isEffectivelyEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              Notificações Push
            </div>
            <div className="text-sm text-muted-foreground">
              {renderStatusText()}
            </div>
          </div>
          <Switch
            checked={isEffectivelyEnabled}
            onCheckedChange={handleToggle}
            disabled={isLoading || isBusy || !canToggle}
          />
        </div>

        <div className="text-xs text-muted-foreground">
          Dispositivos registrados no servidor: <b>{serverStatus.subscriptionCount}</b>
        </div>

        {(isLoading || isBusy) ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Atualizando notificações...
          </div>
        ) : null}

        {support.isIos && !support.isStandalone ? (
          <div className="rounded-md border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Smartphone className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              Abra o menu de compartilhamento do Safari e use <b>Adicionar à Tela de Início</b>. Depois reabra o app instalado para ativar o push.
            </div>
          </div>
        ) : null}

        {permission === 'denied' ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => toast({
              title: 'Permissão bloqueada no navegador',
              description: 'Abra as configurações do navegador deste site, permita notificações e depois volte para ligar novamente.',
            })}
          >
            Ver instrução para desbloquear
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
