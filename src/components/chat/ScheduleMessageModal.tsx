import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Clock, Trash2, Send, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ScheduledMessage {
  id: string;
  content: string;
  scheduled_at: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  created_at: string;
}

interface ScheduleMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  currentUserId: string;
}

export function ScheduleMessageModal({
  isOpen,
  onClose,
  conversationId,
  currentUserId,
}: ScheduleMessageModalProps) {
  const [content, setContent] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Buscar mensagens agendadas pendentes
  const fetchScheduledMessages = async () => {
    if (!conversationId) return;
    setIsLoadingList(true);
    try {
      const { data, error } = await supabase
        .from("scheduled_messages")
        .select("id, content, scheduled_at, status, created_at")
        .eq("conversation_id", conversationId)
        .eq("sender_id", currentUserId)
        .eq("status", "pending")
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      setScheduledMessages((data || []) as ScheduledMessage[]);
    } catch (error: any) {
      console.error("Erro ao carregar mensagens agendadas:", error);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen && conversationId) {
      fetchScheduledMessages();
      // Set default date to today and time to 1 hour from now
      const now = new Date();
      const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
      
      const year = inOneHour.getFullYear();
      const month = String(inOneHour.getMonth() + 1).padStart(2, '0');
      const day = String(inOneHour.getDate()).padStart(2, '0');
      setScheduleDate(`${year}-${month}-${day}`);
      
      const hours = String(inOneHour.getHours()).padStart(2, '0');
      const minutes = String(inOneHour.getMinutes()).padStart(2, '0');
      setScheduleTime(`${hours}:${minutes}`);
    }
  }, [isOpen, conversationId]);

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast({
        title: "Mensagem vazia",
        description: "Por favor, digite o conteúdo da mensagem.",
        variant: "destructive",
      });
      return;
    }

    if (!scheduleDate || !scheduleTime) {
      toast({
        title: "Data ou hora ausente",
        description: "Defina uma data e hora válidas para o agendamento.",
        variant: "destructive",
      });
      return;
    }

    const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledDateTime.getTime() <= Date.now()) {
      toast({
        title: "Horário inválido",
        description: "O horário de agendamento deve ser no futuro.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("scheduled_messages")
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: content.trim(),
          scheduled_at: scheduledDateTime.toISOString(),
          status: "pending",
        });

      if (error) throw error;

      toast({
        title: "Agendado com sucesso!",
        description: `Mensagem agendada para ${scheduledDateTime.toLocaleString()}`,
      });

      setContent("");
      fetchScheduledMessages();
    } catch (error: any) {
      console.error("Erro ao agendar mensagem:", error);
      toast({
        title: "Erro ao agendar",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from("scheduled_messages")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Agendamento cancelado",
        description: "A mensagem agendada foi cancelada com sucesso.",
      });

      fetchScheduledMessages();
    } catch (error: any) {
      console.error("Erro ao cancelar agendamento:", error);
      toast({
        title: "Erro ao cancelar",
        description: "Não foi possível cancelar a mensagem.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full p-6 rounded-2xl border bg-background/95 backdrop-blur-md shadow-2xl animate-in zoom-in-95 duration-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            <Clock className="h-5 w-5 text-primary" />
            Agendar Mensagem Automática
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Agende mensagens para serem enviadas automaticamente mesmo que você esteja offline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleScheduleSubmit} className="space-y-4 mt-2">
          {/* Campo de Texto */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sua Mensagem</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Digite a mensagem que deseja agendar..."
              className="min-h-[90px] max-h-[160px] resize-none rounded-xl border-border bg-card/50 focus:ring-primary/30"
              maxLength={1000}
              disabled={isSubmitting}
            />
          </div>

          {/* Seletores de Data e Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <CalendarIcon className="h-3 w-3 text-primary" /> Data
              </label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-input bg-card/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer dark:color-scheme-dark"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Clock className="h-3 w-3 text-primary" /> Hora
              </label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-input bg-card/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer dark:color-scheme-dark"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-primary-foreground font-semibold rounded-xl h-10 shadow-lg shadow-primary/10 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Agendando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Agendar Mensagem
              </>
            )}
          </Button>
        </form>

        <div className="border-t border-border/80 my-4" />

        {/* Lista de Pendentes */}
        <div className="space-y-2 max-h-[180px] flex flex-col">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Mensagens Agendadas ({scheduledMessages.length})
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            {isLoadingList ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : scheduledMessages.length === 0 ? (
              <div className="text-center py-4 px-2 border border-dashed rounded-xl bg-muted/10">
                <p className="text-xs text-muted-foreground">Nenhuma mensagem agendada pendente.</p>
              </div>
            ) : (
              scheduledMessages.map((msg) => (
                <div 
                  key={msg.id} 
                  className="flex items-start gap-3 p-3 rounded-xl border bg-card/40 hover:bg-card/75 transition-all text-xs group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground break-words line-clamp-2">{msg.content}</p>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground font-medium">
                      <Clock className="h-3 w-3 text-primary" />
                      <span>{new Date(msg.scheduled_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelMessage(msg.id)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all flex-shrink-0"
                    title="Cancelar agendamento"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
