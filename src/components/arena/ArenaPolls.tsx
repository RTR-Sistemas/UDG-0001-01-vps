import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { openDb } from "@/lib/openDb";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Globe, Users, EyeOff, Clock, BarChart3, Plus, Trash2, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Scope = "global" | "friends";

export function ArenaPolls() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [scope, setScope] = useState<Scope>("global");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: polls, isLoading, error: pollError } = useQuery({
    queryKey: ["arena_polls", scope],
    queryFn: async () => {
      const { data, error } = await (openDb.from("arena_polls") as any)
        .select("*, profiles:creator_id(username, avatar_url)")
        .eq("scope", scope)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
    retry: false,
  });

  const { data: votes } = useQuery({
    queryKey: ["arena_poll_votes", scope],
    queryFn: async () => {
      if (!polls || polls.length === 0) return [];
      const ids = polls.map((p: any) => p.id);
      const { data, error } = await (openDb.from("arena_poll_votes") as any)
        .select("poll_id, option_idx, user_id")
        .in("poll_id", ids);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!polls && polls.length > 0,
  });

  const voteMut = useMutation({
    mutationFn: async ({ pollId, option_idx }: { pollId: string; option_idx: number }) => {
      const { data, error } = await (supabase as any).from("arena_poll_votes").upsert(
        { poll_id: pollId, user_id: user!.id, option_idx },
        { onConflict: "poll_id,user_id" }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["arena_poll_votes"] });
    },
    onError: (e: any) => toast({ title: "Erro ao votar", description: e.message, variant: "destructive" }),
  });

  const myVoteMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of votes || []) if (v.user_id === user?.id) m.set(v.poll_id, v.option_idx);
    return m;
  }, [votes, user]);

  if (pollError && String((pollError as any).message).includes("does not exist")) {
    return (
      <Card className="p-6 text-center border-dashed">
        <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">Enquetes ainda não disponíveis</p>
        <p className="text-xs text-muted-foreground mt-1">Rode <code className="bg-muted px-1 rounded">DEPLOY/stories_arena_migration.sql</code> no Supabase Dashboard → SQL Editor.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Enquetes da Arena</h3>
            <p className="text-[11px] text-muted-foreground">{scope === "global" ? "Todos podem votar" : "Apenas amigos do criador"}</p>
          </div>
        </div>
        <Button size="sm" className="rounded-full h-8" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Criar Enquete
        </Button>
      </div>

      <div className="flex gap-2 p-1 bg-muted/60 rounded-full w-fit">
        <button onClick={() => setScope("global")} className={cn("px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all", scope === "global" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}>
          <Globe className="h-3.5 w-3.5" /> Global
        </button>
        <button onClick={() => setScope("friends")} className={cn("px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all", scope === "friends" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}>
          <Users className="h-3.5 w-3.5" /> Amigos
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !polls || polls.length === 0 ? (
        <Card className="p-8 text-center border-dashed bg-muted/20">
          <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma enquete {scope === "global" ? "global" : "de amigos"} ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Seja o primeiro a criar!</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {polls.map((poll: any) => {
            const opts: string[] = Array.isArray(poll.options) ? poll.options : JSON.parse(poll.options || "[]");
            const totalVotes = (votes || []).filter((v: any) => v.poll_id === poll.id).length;
            const myIdx = myVoteMap.get(poll.id);
            const expired = poll.expires_at && new Date(poll.expires_at).getTime() < Date.now();
            return (
              <Card key={poll.id} className="p-4 space-y-3 border-border/40 hover:border-primary/20 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={poll.profiles?.avatar_url} />
                      <AvatarFallback>{(poll.profiles?.username || "?")[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-semibold">@{poll.profiles?.username || "?"}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(poll.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] h-5">{poll.scope === "global" ? <><Globe className="h-3 w-3 mr-1" />Global</> : <><Users className="h-3 w-3 mr-1" />Amigos</>}</Badge>
                    {poll.expires_at && <Badge variant="secondary" className="text-[10px] h-5"><Clock className="h-3 w-3 mr-1" />{expired ? "Encerrada" : new Date(poll.expires_at).toLocaleDateString()}</Badge>}
                  </div>
                </div>
                <p className="font-medium text-sm">{poll.question}</p>
                <div className="space-y-1.5">
                  {opts.map((opt: string, idx: number) => {
                    const count = (votes || []).filter((v: any) => v.poll_id === poll.id && v.option_idx === idx).length;
                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    const selected = myIdx === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={expired || voteMut.isPending}
                        onClick={() => voteMut.mutate({ pollId: poll.id, option_idx: idx })}
                        className={cn("w-full text-left p-2.5 rounded-xl border text-sm flex items-center justify-between transition-all", selected ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 hover:bg-muted/50 border-border/30")}
                      >
                        <span className="flex items-center gap-2">{selected && <Check className="h-3.5 w-3.5" />} {opt}</span>
                        <span className="text-xs font-mono">{count} • {pct}%</span>
                        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                          <div className="h-full bg-primary/10" style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">{totalVotes} voto(s) {poll.is_anonymous ? "• anônimo" : ""}</p>
              </Card>
            );
          })}
        </div>
      )}

      <CreateArenaPollDialog open={createOpen} onOpenChange={setCreateOpen} defaultScope={scope} />
    </div>
  );
}

function CreateArenaPollDialog({ open, onOpenChange, defaultScope }: { open: boolean; onOpenChange: (v: boolean) => void; defaultScope: Scope }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setScope(defaultScope); }, [defaultScope]);

  const canSubmit = question.trim().length >= 3 && options.filter(o => o.trim()).length >= 2;

  const submit = async () => {
    if (!canSubmit || !user) return;
    const cleanOpts = options.map(o => o.trim()).filter(Boolean).slice(0, 6);
    setSubmitting(true);
    try {
      const { error } = await (openDb.from("arena_polls") as any).insert({
        creator_id: user.id,
        question: question.trim(),
        options: cleanOpts,
        scope,
        is_anonymous: isAnonymous,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      if (error) throw error;
      toast({ title: scope === "friends" ? "Enquete para amigos criada! 👥" : "Enquete global criada! 🌍" });
      setQuestion(""); setOptions(["", ""]); setExpiresAt(""); setIsAnonymous(false);
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["arena_polls"] });
    } catch (e: any) {
      toast({ title: "Erro ao criar enquete", description: e?.message || "Rode a migração se a tabela não existir.", variant: "destructive" } as any);
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Nova Enquete na Arena</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2 p-1 bg-muted/60 rounded-full w-fit">
            <button type="button" onClick={() => setScope("global")} className={cn("px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5", scope === "global" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}><Globe className="h-3.5 w-3.5" /> Global</button>
            <button type="button" onClick={() => setScope("friends")} className={cn("px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5", scope === "friends" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}><Users className="h-3.5 w-3.5" /> Amigos</button>
          </div>
          <p className="text-[11px] text-muted-foreground">{scope === "global" ? "Todos os usuários poderão ver e votar." : "Apenas seus amigos poderão ver e votar."}</p>
          <div>
            <Label className="text-xs">Pergunta</Label>
            <Input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ex: Qual seu time favorito?" maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Opções (2 a 6)</Label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex gap-2">
                <Input value={opt} onChange={e => setOptions(prev => prev.map((v, i) => i === idx ? e.target.value : v))} placeholder={`Opção ${idx + 1}`} />
                {options.length > 2 && <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setOptions(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ))}
            {options.length < 6 && <Button type="button" variant="outline" size="sm" onClick={() => setOptions(prev => [...prev, ""])}><Plus className="h-4 w-4 mr-1" /> Adicionar opção</Button>}
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-muted/30">
            <Label className="text-xs flex items-center gap-2">Voto anônimo</Label>
            <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
          </div>
          <div>
            <Label className="text-xs">Expira em (opcional)</Label>
            <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </div>
          <Button className="w-full rounded-full" onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Criando...</> : "Publicar Enquete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


