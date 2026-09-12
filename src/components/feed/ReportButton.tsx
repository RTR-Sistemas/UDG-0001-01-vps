import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flag, ShieldAlert } from "lucide-react";
import { moderatePost } from "@/services/contentModeration";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export const REASONS = [
    { value: "nudez", label: "🔞 Nudez ou conteúdo sexual" },
    { value: "pedofilia", label: "🚫 Conteúdo envolvendo menores" },
    { value: "racismo", label: "⚠️ Racismo ou discriminação" },
    { value: "violencia", label: "💢 Violência extrema" },
    { value: "assedio", label: "😠 Assédio ou bullying" },
    { value: "spam", label: "📢 Spam ou conteúdo falso" },
    { value: "outro", label: "❓ Outro motivo" },
];

interface ReportButtonProps {
    postId: string;
    reporterId?: string;
    variant?: "icon" | "full";
    className?: string;
}

export function ReportButton({ postId, reporterId, variant = "icon", className }: ReportButtonProps) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [description, setDescription] = useState("");
    const { toast } = useToast();
    const qc = useQueryClient();

    const reportMutation = useMutation({
        mutationFn: async () => {
            if (!reporterId) throw new Error("Não autenticado");
            if (!reason) throw new Error("Selecione um motivo");

            // 1. Criar a denúncia no banco
            const { error: insertError } = await (supabase as any).from("reports").insert({
                reporter_id: reporterId,
                post_id: postId,
                reason,
                description: description.trim() || null,
                status: "pending",
            });
            if (insertError) throw insertError;

            // 2. Buscar dados o post para análise AI e backup
            const { data: postData } = await (supabase as any)
                .from("posts")
                .select("content, media_urls, user_id")
                .eq("id", postId)
                .single();

            if (!postData) return;

            // 3. Análise Automática via AI (HuggingFace)
            const aiResult = await moderatePost({
                content: postData.content,
                mediaUrls: postData.media_urls || [],
                userId: postData.user_id
            });

            // Auto-moderação: Bloquear o post para motivos graves OU se a AI detectar conteúdo proibido
            const isSevereReason = ["pedofilia", "nudez", "racismo", "violencia"].includes(reason);
            const isAiFlagged = !aiResult.allowed;

            if (isSevereReason || isAiFlagged) {
                const originalBackup = JSON.stringify({
                    content: postData.content,
                    media_urls: postData.media_urls || []
                });

                // Gravar o original na nota de admin da denúncia
                await (supabase as any)
                    .from("reports")
                    .update({
                        admin_note: `BACKUP_POST: ${originalBackup}${isAiFlagged ? " (FLAGGED_BY_AI)" : ""}`
                    })
                    .eq("post_id", postId)
                    .eq("status", "pending");

                // Marcar postagem como bloqueada - manter conteúdo original para permitir o "borrado" no UI
                await (supabase as any)
                    .from("posts")
                    .update({
                        is_blocked: true,
                        blocked_reason: isAiFlagged ? (aiResult.reason || "ai_flagged") : reason,
                        updated_at: new Date().toISOString()
                    } as any)
                    .eq("id", postId);

                // Log no content_moderation_log para auditoria
                await (supabase as any)
                    .from("content_moderation_log")
                    .insert({
                        user_id: reporterId,
                        post_id: postId,
                        content_type: "text",
                        text_content: postData.content,
                        media_url: postData.media_urls?.[0],
                        severity: "critical",
                        action_taken: "blocked",
                        auto_blocked: true,
                        is_published: false,
                    });
            }
        },
        onSuccess: () => {
            toast({ title: "Denúncia enviada", description: "Nossa equipe irá analisar em breve." });
            setOpen(false);
            setReason("");
            setDescription("");
            qc.invalidateQueries({ queryKey: ["posts-infinite"] });
        },
        onError: (e: any) => {
            toast({ variant: "destructive", title: "Erro ao denunciar", description: e.message });
        },
    });

    if (!reporterId) return null;

    return (
        <>
            <Button
                variant="ghost"
                size={variant === "icon" ? "icon" : "sm"}
                className={`text-muted-foreground hover:text-orange-500 transition-colors ${variant === "icon" ? "h-7 w-7" : "h-7 gap-1.5 text-xs"} ${className}`}
                onClick={() => setOpen(true)}
                title="Denunciar post"
            >
                <Flag className="h-3.5 w-3.5" />
                {variant === "full" && <span>Denunciar</span>}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <Flag className="h-4 w-4 text-orange-500" />
                            Denunciar Postagem
                        </DialogTitle>
                        <div className="hidden">
                            <DialogDescription>Formulário para denúncia de conteúdo impróprio ou ofensivo.</DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                            Selecione o motivo da denúncia. Nossa equipe analisará o conteúdo.
                        </p>

                        <div className="space-y-2">
                            {REASONS.map(r => (
                                <button
                                    key={r.value}
                                    type="button"
                                    onClick={() => setReason(r.value)}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors border ${reason === r.value
                                        ? "border-orange-500 bg-orange-500/10 text-orange-600 font-semibold"
                                        : "border-border hover:bg-muted"
                                        }`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        {reason && (
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">
                                    Detalhes adicionais (opcional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={2}
                                    maxLength={300}
                                    placeholder="Descreva o problema..."
                                    className="w-full text-sm border rounded-lg px-3 py-2 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => setOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                                disabled={!reason || reportMutation.isPending}
                                onClick={() => reportMutation.mutate()}
                            >
                                {reportMutation.isPending ? "Enviando..." : "Enviar Denúncia"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
