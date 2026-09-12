import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserLink } from "@/components/UserLink";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageCircleQuestion, Send, Users, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DailyAnswerRow {
  id: string;
  question_id: string;
  user_id: string;
  answer: string;
  created_at: string;
  author?: { username?: string; avatar_url?: string | null } | null;
}

interface DailyQuestionRow {
  id: string;
  question: string;
  question_date: string;
  created_at: string;
}

const FALLBACK_QUESTIONS = [
  "Qual foi a melhor parte do seu dia hoje?",
  "O que você gostaria de mudar no mundo hoje?",
  "Qual conselho você daria para a versão mais jovem de você?",
];

export function DailyQuestionCard({ className }: { className?: string }) {
  const { user } = useAuth();
  const [question, setQuestion] = useState<DailyQuestionRow | null>(null);
  const [answers, setAnswers] = useState<DailyAnswerRow[]>([]);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);

    let qid: string | undefined;

    const { data: existing } = await supabase
      .from("daily_questions")
      .select("id, question, question_date, created_at")
      .eq("question_date", iso)
      .maybeSingle();
    if (!existing) {
      let text: string | undefined;
      let poolId: string | undefined;
      try {
        const { data: pool } = await supabase
          .from("daily_questions_pool")
          .select("id, question")
          .eq("enabled", true)
          .order("last_used_date", { ascending: true, nullsFirst: true })
          .limit(1)
          .maybeSingle();
        if (pool) {
          text = pool.question as string;
          poolId = pool.id as string;
        }
      } catch {}
      if (!text) {
        text = FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)];
      }
      const { data: created } = await supabase
        .from("daily_questions")
        .insert({ question: text, question_date: iso, created_by: user?.id || null })
        .select("id, question, question_date, created_at")
        .maybeSingle();
      if (created) {
        setQuestion(created);
        qid = created.id;
        if (poolId) {
          supabase.rpc("mark_daily_question_used", { p_pool_id: poolId, p_used_date: iso }).then(() => {});
        }
      } else {
        setQuestion(null);
      }
    } else {
      setQuestion(existing);
      qid = existing.id;
    }

    if (qid) {
      const { data } = await supabase
        .from("daily_answers")
        .select("*, author:user_id(username, avatar_url)")
        .eq("question_id", qid)
        .order("created_at", { ascending: false })
        .limit(100);
      setAnswers((data as DailyAnswerRow[]) || []);
    }
    setLoading(false);
  };

  const myAnswer = useMemo(
    () => answers.find((a) => a.user_id === user?.id),
    [answers, user]
  );

  const submit = async () => {
    if (!user || !question || !draft.trim()) return;
    setSubmitting(true);
    try {
      if (myAnswer) {
        const { error } = await supabase
          .from("daily_answers")
          .update({ answer: draft.trim() })
          .eq("id", myAnswer.id);
        if (error) throw error;
        setAnswers((prev) =>
          prev.map((a) => (a.id === myAnswer.id ? { ...a, answer: draft.trim() } : a))
        );
        toast.success("Resposta atualizada!");
      } else {
        const { data, error } = await supabase
          .from("daily_answers")
          .insert({ question_id: question.id, user_id: user.id, answer: draft.trim() })
          .select("*, author:profiles(username, avatar_url)")
          .maybeSingle();
        if (error) throw error;
        if (data) setAnswers((prev) => [data as DailyAnswerRow, ...prev]);
        toast.success("Resposta registrada!");
      }
      setDraft("");
      setEditing(false);
    } catch {
      toast.error(myAnswer ? "Erro ao atualizar resposta." : "Erro ao enviar resposta.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = () => {
    if (myAnswer) {
      setDraft(myAnswer.answer);
      setEditing(true);
    }
  };

  const cancelEdit = () => {
    setDraft("");
    setEditing(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (loading) return null;

  return (
    <>
      <Card className={cn("border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-sm", className)}>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <MessageCircleQuestion className="h-5 w-5" />
            <h3 className="font-bold text-sm uppercase tracking-wide">Pergunta do Dia</h3>
          </div>
          <p className="text-lg font-semibold leading-snug">
            {question ? question.question : "A pergunta do dia ainda não foi definida."}
          </p>

          {question && (
            <>
              {editing ? (
                <div className="space-y-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Edite sua resposta…"
                    rows={3}
                    maxLength={500}
                    className="resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={submitting}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={submit} disabled={submitting || !draft.trim()} className="gap-1.5">
                      {submitting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : myAnswer ? (
                <div className="rounded-xl bg-card/70 border border-border/50 p-3 text-sm">
                  <span className="text-xs text-muted-foreground block mb-1">Sua resposta:</span>
                  {myAnswer.answer}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Responda a pergunta do dia…"
                    rows={2}
                    maxLength={500}
                    className="resize-none"
                  />
                  <Button
                    size="icon"
                    onClick={submit}
                    disabled={submitting || !draft.trim()}
                    className="h-auto shrink-0"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={() => setModalOpen(true)} className="gap-1.5 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Ver mural ({answers.length})
                </Button>
                {myAnswer && !editing && (
                  <Button variant="ghost" size="sm" onClick={startEdit} className="gap-1.5 text-xs text-primary">
                    <Pencil className="h-3 w-3" />
                    Editar resposta
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* MURAL DE RESPOSTAS */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircleQuestion className="h-5 w-5 text-primary" />
              Respostas de hoje
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1 space-y-3">
            {answers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">
                Ninguém respondeu ainda. Seja o primeiro!
              </p>
            )}
            {answers.map((a) => (
              <div key={a.id} className="rounded-xl border border-border/40 bg-card p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={a.author?.avatar_url || ""} />
                    <AvatarFallback className="text-[10px]">
                      {(a.author?.username || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <UserLink userId={a.user_id} username={a.author?.username || ""} className="text-xs font-semibold hover:underline">
                    @{a.author?.username || "?"}
                  </UserLink>
                  {a.user_id === user?.id && (
                    <>
                      <span className="text-[10px] text-primary ml-auto">você</span>
                      <button
                        onClick={() => { startEdit(); setModalOpen(false); }}
                        className="text-[10px] text-muted-foreground hover:text-primary p-1"
                        title="Editar minha resposta"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
                <p className="text-sm">{a.answer}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  {' • '}
                  {new Date(a.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
