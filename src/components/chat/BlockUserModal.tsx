import { useState } from "react";
import { X, ShieldX, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBlockUser, useUnblockUser, useIsBlocked } from "@/hooks/useUserBlocks";
import { useToast } from "@/hooks/use-toast";

interface BlockUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserName: string;
  targetUserAvatar?: string | null;
  onBlocked?: () => void;
}

export function BlockUserModal({
  open,
  onOpenChange,
  targetUserId,
  targetUserName,
  targetUserAvatar,
  onBlocked,
}: BlockUserModalProps) {
  const [reason, setReason] = useState("");
  const [confirmDeleteMsgs, setConfirmDeleteMsgs] = useState(true);
  const [hideMyPosts, setHideMyPosts] = useState(true);
  const { toast } = useToast();
  const { mutate: blockUser, isPending: isBlocking } = useBlockUser();
  const { mutate: unblockUser, isPending: isUnblocking } = useUnblockUser();
  const { data: blockedStatus } = useIsBlocked(targetUserId);
  const isBlocked = blockedStatus?.blockedByMe || false;

  const handleSubmit = () => {
    if (isBlocked) {
      unblockUser(targetUserId, {
        onSuccess: () => {
          onOpenChange(false);
          onBlocked?.();
        },
      });
    } else {
      blockUser({ blocked_id: targetUserId, reason: reason || undefined, hide_my_posts: hideMyPosts }, {
        onSuccess: () => {
          onOpenChange(false);
          onBlocked?.();
        },
      });
    }
  };

  if (!open) return null;

  const blockedContent = (
    <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
        <p className="text-sm font-medium text-green-700 dark:text-green-300">Usuário bloqueado</p>
      </div>
      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
        Ele não pode te contactar. Desbloquear permitirá novas interações.
      </p>
    </div>
  );

  const unblockedContent = (
    <div>
      <div>
        <label className="block text-sm font-medium mb-2">Motivo (opcional)</label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex: spam, assédio, conteúdo impróprio..."
          rows={3}
          className="resize-none"
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-accent/50 cursor-pointer">
          <input type="checkbox" checked={confirmDeleteMsgs} onChange={(e) => setConfirmDeleteMsgs(e.target.checked)} className="h-4 w-4 rounded border-primary" />
          <div className="flex-1">
            <p className="font-medium">Apagar mensagens trocadas</p>
            <p className="text-xs text-muted-foreground">Remove o histórico de conversa para ambos</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 cursor-pointer">
          <input type="checkbox" checked={hideMyPosts} onChange={(e) => setHideMyPosts(e.target.checked)} className="h-4 w-4 rounded border-primary" />
          <div className="flex-1">
            <p className="font-medium">Bloquear para todas minhas novidades</p>
            <p className="text-xs text-muted-foreground">Ele não verá seus posts, stories e novidades do Feed</p>
          </div>
        </label>

        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive mr-2" />
          <p className="text-sm text-destructive/90">
            <strong>O usuário bloqueado não poderá:</strong> enviar mensagens, ver seu status online, 
            enviar solicitações de amizade, ver seu perfil, ou reagir às suas mensagens.
          </p>
        </div>
      </div>
    </div>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}>
    
    <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-md animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className={cn("h-12 w-12 rounded-full flex items-center justify-center", 
            isBlocked ? "bg-green-100 dark:bg-green-900/30" : "bg-destructive/10")}>
            {isBlocked ? (
              <ShieldCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
            ) : (
              <ShieldX className="h-6 w-6 text-destructive" />
            )}
          </div>
          <div>
            <p className="font-semibold">{isBlocked ? "Desbloquear" : "Bloquear"} usuário</p>
            <p className="text-sm text-muted-foreground">@{targetUserName}</p>
          </div>
        </div>
        <button onClick={() => onOpenChange(false)} className="h-8 w-8 rounded-full hover:bg-accent flex items-center justify-center">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Avatar & Info */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
            {targetUserAvatar ? (
              <img src={targetUserAvatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-primary">{targetUserName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{targetUserName}</p>
            <p className="text-sm text-muted-foreground">
              {isBlocked ? "Este usuário está bloqueado" : "O usuário não poderá te contactar"}
            </p>
          </div>
        </div>

        {isBlocked ? blockedContent : unblockedContent}

      </div>

      {/* Footer */}
      <div className="flex gap-2 p-4 border-t">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => onOpenChange(false)}
          disabled={isBlocking || isUnblocking}
        >
          Cancelar
        </Button>
        <Button
          variant={isBlocked ? "default" : "destructive"}
          className="flex-1"
          onClick={handleSubmit}
          disabled={isBlocking || isUnblocking}
        >
          {(isBlocking || isUnblocking) ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {isBlocked ? "Desbloqueando..." : "Bloqueando..."}
            </>
          ) : (
            isBlocked ? "Desbloquear" : "Bloquear usuário"
          )}
        </Button>
      </div>
    </div>
  </div>
);
}

export default BlockUserModal;