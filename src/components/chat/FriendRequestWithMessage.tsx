import { useState } from "react";
import { X, Check, MessageSquare, Loader2, Send, ShieldCheck, ShieldX, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSendFriendRequest, useAcceptFriendRequest, useRejectFriendRequest, useMarkFriendRequestRead } from "@/hooks/useFriendRequests";
import { useToast } from "@/hooks/use-toast";

interface FriendRequestWithMessageProps {
  request: {
    id: string;
    sender: {
      id: string;
      username: string;
      full_name: string | null;
      avatar_url: string | null;
    };
    message: string | null;
    message_read: boolean;
    created_at: string;
  };
  onUpdate: () => void;
}

export function FriendRequestWithMessage({ request, onUpdate }: FriendRequestWithMessageProps) {
  const [showMessage, setShowMessage] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const { toast } = useToast();
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const rejectRequest = useRejectFriendRequest();
  const markRead = useMarkFriendRequestRead();

  const handleAccept = async () => {
    await acceptRequest.mutateAsync(request.id);
    onUpdate();
  };

  const handleReject = async () => {
    await rejectRequest.mutateAsync(request.id);
    onUpdate();
  };

  const handleSendWithMessage = async () => {
    if (!customMessage.trim()) return;
    await sendRequest.mutateAsync({
      receiver_id: request.sender.id,
      message: customMessage,
      source: "message",
    });
    onUpdate();
    setShowMessage(false);
    setCustomMessage("");
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString("pt-BR");
  };

  if (request.message && !request.message_read) {
    markRead.mutate(request.id);
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
            {request.sender.avatar_url ? (
              <img src={request.sender.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-primary">{request.sender.username.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">{request.sender.username}</p>
              <span className="text-xs text-muted-foreground">{formatTime(request.created_at)}</span>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {request.message ? `"${request.message}"` : "Quer ser seu amigo"}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowMessage(!showMessage)}
          className={cn("p-2 rounded-lg hover:bg-accent transition-colors flex-shrink-0",
            showMessage && "bg-accent"
          )}
          aria-label={showMessage ? "Fechar mensagem" : "Ver mensagem"}
        >
          <MessageSquare className={cn("h-5 w-5", request.message ? "text-primary" : "text-muted-foreground")} />
        </button>

        <button
          onClick={() => setShowMessage(false)}
          className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors flex-shrink-0"
          aria-label="Ignorar solicitação"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Message preview / input */}
      {request.message && (
        <div className="mt-3 p-3 rounded-xl bg-muted/50 border border-border/50 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-primary">Mensagem:</span>
            {!request.message_read && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">Nova</span>
            )}
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap">{request.message}</p>
        </div>
      )}

      {showMessage && !request.message && (
        <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
          <Textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Adicione uma mensagem pessoal (opcional)..."
            rows={3}
            className="resize-none mb-2"
            maxLength={300}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowMessage(false); setCustomMessage(""); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSendWithMessage} disabled={sendRequest.isPending}>
              <Send className="h-4 w-4 mr-1" />
              Enviar com mensagem
            </Button>
          </div>
        </div>
      )}

      {!showMessage && !request.message && (
        <div className="mt-3 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleReject} disabled={rejectRequest.isPending}>
            <ShieldX className="h-4 w-4 mr-1" />
            Ignorar
          </Button>
          <Button className="flex-1" onClick={handleAccept} disabled={acceptRequest.isPending}>
            <UserPlus className="h-4 w-4 mr-1" />
            Aceitar
          </Button>
        </div>
      )}

      {(acceptRequest.isPending || rejectRequest.isPending || sendRequest.isPending) && (
        <div className="absolute inset-0 bg-card/80 flex items-center justify-center rounded-2xl z-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

export function FriendRequestList({ requests, onUpdate }: { requests: any[]; onUpdate: () => void }) {
  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <UserPlus className="h-12 w-12 opacity-20 mb-3" />
        <p className="text-center">Nenhuma solicitação de amizade</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <FriendRequestWithMessage key={req.id} request={req} onUpdate={onUpdate} />
      ))}
    </div>
  );
}