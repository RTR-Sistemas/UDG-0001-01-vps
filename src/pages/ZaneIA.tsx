import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Send, Bot, User, MessageSquare, Trash2, Plus, X, Loader2, Copy, Check, CopyCheck, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


type ChatSession = {
  id: string;
  title: string;
  created_at: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  image?: string;
  created_at: string;
};

export default function ZaneIA() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  
  // Custom States
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) loadSessions();
  }, [user]);

  useEffect(() => {
    if (activeSession) {
      loadMessages(activeSession);
    } else {
      setMessages([]);
    }
  }, [activeSession]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const loadSessions = async () => {
    const { data, error } = await supabase
      .from('zane_ai_chats')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) {
      setSessions(data || []);
      if (data && data.length > 0 && !activeSession) setActiveSession(data[0].id);
    }
  };

  const loadMessages = async (chatId: string) => {
    const { data, error } = await supabase
      .from('zane_ai_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    
    if (!error) setMessages((data || []).map((m) => ({ ...m, role: m.role as ChatMessage["role"] })));
  };

  const handleCreateSession = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('zane_ai_chats')
      .insert({ user_id: user.id, title: "Nova Conversa" })
      .select()
      .single();
    if (!error) {
      setSessions([data, ...sessions]);
      setActiveSession(data.id);
      setSidebarOpen(false);
    }
  };

  const handleDeleteSession = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('zane_ai_chats').delete().eq('id', chatId);
    setSessions(sessions.filter(s => s.id !== chatId));
    if (activeSession === chatId) setActiveSession(null);
    toast.success("Histórico removido.");
  };

  const handleClearAllSessions = async () => {
    if (!user) return;
    if (window.confirm("Tem certeza que deseja apagar todo o histórico de conversas?")) {
      const { error } = await supabase
        .from('zane_ai_chats')
        .delete()
        .eq('user_id', user.id);
      
      if (!error) {
        setSessions([]);
        setActiveSession(null);
        setMessages([]);
        toast.success("Todo o histórico foi apagado.");
      } else {
        toast.error("Erro ao apagar histórico.");
      }
    }
  };

  const handleSendSuggestion = async (suggestionText: string) => {
    if (!user || isLoading) return;

    let currentSessionId = activeSession;
    
    if (!currentSessionId) {
      const sessionTitle = suggestionText.substring(0, 30) + '...';
      const { data, error } = await supabase
        .from('zane_ai_chats')
        .insert({ user_id: user.id, title: sessionTitle })
        .select()
        .single();
        
      if (!error && data) {
        currentSessionId = data.id;
        setSessions([data, ...sessions]);
        setActiveSession(currentSessionId);
      } else return;
    }

    setIsLoading(true);

    const { data: umData } = await supabase
      .from('zane_ai_messages')
      .insert({ 
        chat_id: currentSessionId, 
        role: 'user', 
        content: suggestionText
      })
      .select()
      .single();

    if (umData) setMessages(prev => [...prev, { ...umData, role: umData.role as ChatMessage["role"] }]);

    try {
      const apiMessages = [...messages, umData || { role: 'user', content: suggestionText }].map(m => ({
        role: m.role, content: m.content
      }));

      const response = await fetch('/api/zane-ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Erro de API");

      const { data: amData } = await supabase
        .from('zane_ai_messages')
        .insert({ chat_id: currentSessionId, role: 'assistant', content: result.reply })
        .select()
        .single();

      if (amData) setMessages(prev => [...prev, { ...amData, role: amData.role as ChatMessage["role"] }]);
      
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro de conexão API.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim() || !user || isLoading) return;

    let currentSessionId = activeSession;
    
    if (!currentSessionId) {
      const sessionTitle = inputMessage ? inputMessage.substring(0, 30) + '...' : "Nova Conversa";
      const { data, error } = await supabase
        .from('zane_ai_chats')
        .insert({ user_id: user.id, title: sessionTitle })
        .select()
        .single();
        
      if (!error && data) {
        currentSessionId = data.id;
        setSessions([data, ...sessions]);
        setActiveSession(currentSessionId);
      } else return;
    }

    const userMessageContent = inputMessage;
    
    setInputMessage("");
    setIsLoading(true);

    const { data: umData } = await supabase
      .from('zane_ai_messages')
      .insert({ 
        chat_id: currentSessionId, 
        role: 'user', 
        content: userMessageContent
      })
      .select()
      .single();

    if (umData) setMessages(prev => [...prev, { ...umData, role: umData.role as ChatMessage["role"] }]);

    try {
      const apiMessages = [...messages, umData || { role: 'user', content: userMessageContent }].map(m => ({
        role: m.role, content: m.content
      }));

      const response = await fetch('/api/zane-ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Erro de API");

      const { data: amData } = await supabase
        .from('zane_ai_messages')
        .insert({ chat_id: currentSessionId, role: 'assistant', content: result.reply })
        .select()
        .single();

      if (amData) setMessages(prev => [...prev, { ...amData, role: amData.role as ChatMessage["role"] }]);
      
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro de conexão API.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copiado para a área de transferência.");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative">
      
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed md:static inset-y-0 left-0 z-50 w-72 bg-card border-r flex flex-col transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="w-5 h-5" />
            <h2 className="font-semibold text-lg">Zane IA Brain</h2>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5 opacity-70" />
          </Button>
        </div>
        
        <div className="p-4">
          <Button onClick={handleCreateSession} className="w-full gap-2 shadow-md bg-gradient-to-r from-primary/90 to-primary text-primary-foreground hover:brightness-110 transition-all">
            <Plus className="w-4 h-4" /> Nova Consultoria
          </Button>
        </div>

        <div className="px-5 py-2 flex-1 overflow-auto space-y-1">
          <h3 className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider mb-3 mt-2">Histórico Cognitivo</h3>
          {sessions.map((session) => (
            <div 
              key={session.id}
              onClick={() => { setActiveSession(session.id); setSidebarOpen(false); }}
              className={cn(
                "group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border",
                activeSession === session.id ? "bg-primary/10 border-primary/30 text-primary font-medium" : "bg-transparent border-transparent text-muted-foreground hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                <span className="text-sm truncate">{session.title}</span>
              </div>
              <Button 
                variant="ghost" size="icon" 
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive/50 hover:text-destructive shrink-0"
                onClick={(e) => handleDeleteSession(session.id, e)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {sessions.length === 0 && <p className="text-xs text-muted-foreground p-2 opacity-60">Sua mente está vazia no momento.</p>}
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative w-full h-full bg-background">
        <header className="flex items-center justify-between p-4 border-b border-border/40 bg-background/60 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-2 text-primary font-bold">
            <Sparkles className="w-5 h-5 text-primary shadow-[0_0_10px_rgba(168,85,247,0.3)] animate-pulse" />
            <span className="bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent font-extrabold">Zane IA</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateSession}
              className="h-8 gap-1 rounded-lg border-primary/20 hover:border-primary/50 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nova Consultoria</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 gap-1 rounded-lg border-border/40 text-xs font-semibold"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Histórico</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg border-border/40 text-foreground hover:bg-muted"
                  title="Mais Opções"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border text-foreground">
                {activeSession && (
                  <DropdownMenuItem
                    onClick={(e) => handleDeleteSession(activeSession, e)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Apagar Conversa Atual</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleClearAllSessions}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer flex items-center gap-2 font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Limpar Todo o Histórico</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8 md:p-8 space-y-8 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto opacity-90 pb-20">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent flex items-center justify-center mb-8 border border-primary/10 shadow-2xl shadow-primary/5">
                <Bot className="w-12 h-12 text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
              </div>
              <h2 className="text-3xl font-black bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-3 text-center">
                Qual será nossa próxima solução?
              </h2>
              <p className="text-muted-foreground/80 text-center max-w-lg mb-10 text-sm md:text-base">
                Análise avançada e conselhos precisos através da rede Llama 3.3 Turbo.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                {[
                  "Revise a segurança do meu código em busca de vulnerabilidades.",
                  "Me explique a Teoria da Relatividade para uma criança de 10 anos.",
                  "Crie um planejamento alimentar detalhado de segunda a sexta.",
                  "Resuma os principais acontecimentos geopolíticos em tópicos."
                ].map((sug, i) => (
                  <button 
                    key={i} 
                    onClick={() => handleSendSuggestion(sug)}
                    className="p-4 text-left rounded-xl border border-border/40 bg-card/20 hover:bg-card/60 hover:border-primary/30 transition-all text-sm text-foreground/80 hover:text-white"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8">
              {messages.map((msg, index) => (
                <div key={msg.id || index} className={cn("flex gap-4 md:gap-5", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                  
                  <div className={cn(
                    "shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shadow-lg border",
                    msg.role === 'user' ? "bg-card border-border text-foreground" : "bg-primary border-primary text-primary-foreground"
                  )}>
                    {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5 shadow-[0_0_10px_rgba(0,0,0,0.5)]" />}
                  </div>
                  
                  <div className={cn(
                    "flex flex-col gap-2 max-w-[85%] md:max-w-[80%]",
                    msg.role === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "px-5 py-4 rounded-3xl shadow-sm text-sm md:text-base leading-relaxed tracking-wide",
                      msg.role === 'user' 
                        ? "bg-primary/10 text-foreground rounded-tr-sm border border-primary/20" 
                        : "bg-card text-foreground border border-border/50 rounded-tl-sm w-full shadow-sm"
                    )}>
                      
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="w-full break-words prose prose-invert max-w-none">
                          <ReactMarkdown
                            components={{
                              code({node, inline, className, children, ...props}: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <div className="relative group text-sm my-4 rounded-xl overflow-hidden border border-[#303038] bg-[#0d0d12]">
                                    <div className="flex items-center justify-between px-4 py-1.5 bg-[#1a1a24] border-b border-[#303038]">
                                      <span className="text-xs font-mono text-gray-400 capitalize">{match[1]}</span>
                                      <button 
                                        onClick={() => copyToClipboard(String(children).replace(/\n$/, ''), msg.id)}
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>
                                    </div>
                                    <SyntaxHighlighter
                                      style={vscDarkPlus as any}
                                      language={match[1]}
                                      PreTag="div"
                                      customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
                                      {...props}
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                  </div>
                                ) : (
                                  <code className="bg-[#1a1a24] text-pink-300 px-1.5 py-0.5 rounded-md text-sm font-mono border border-[#303038]" {...props}>
                                    {children}
                                  </code>
                                )
                              }
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {msg.role === 'assistant' && (
                      <div className="flex px-1 gap-2 opacity-50">
                        <button onClick={() => copyToClipboard(msg.content, msg.id)} className="hover:opacity-100 transition-opacity flex items-center gap-1 text-xs">
                          {copiedId === msg.id ? <CopyCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedId === msg.id ? "Copiado" : "Copiar"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-4 md:gap-5">
                  <div className="shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg border border-primary animate-pulse">
                    <Bot className="w-5 h-5 shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
                  </div>
                  <div className="px-5 py-4 rounded-3xl bg-card border border-border/40 rounded-tl-sm flex items-center gap-3 w-fit shadow-md">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    <span className="text-sm font-medium text-muted-foreground animate-pulse">Zane IA está processando em rede neural...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Bar Inteligente */}
        <div className="p-3 bg-card/40 backdrop-blur-xl border-t border-border/20 z-10 w-full relative">
          <div className="max-w-4xl mx-auto flex flex-col gap-2">
            
            <form onSubmit={handleSendMessage} className={cn(
              "relative flex items-end gap-2 bg-[#121216]/20 dark:bg-card/60 p-2 md:p-3 rounded-2xl border border-border/30 transition-all",
              "focus-within:border-primary/50 focus-within:shadow-[0_0_20px_rgba(var(--primary),0.1)] focus-within:bg-background"
            )}>
              <textarea
                className="flex-1 max-h-[200px] min-h-[48px] bg-transparent border-0 focus:ring-0 resize-none px-2 py-3 text-sm md:text-base font-medium placeholder:text-muted-foreground/60 leading-relaxed overflow-y-auto"
                placeholder="Comande a Zane IA..."
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  e.target.style.height = '48px';
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />

              <Button 
                type="submit" 
                disabled={isLoading || !inputMessage.trim()} 
                size="icon"
                className={cn(
                  "rounded-xl h-12 w-12 shrink-0 transition-all duration-300 active:scale-90",
                  inputMessage.trim() ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.5)]" : "bg-muted text-muted-foreground"
                )}
              >
                <Send className={cn("w-5 h-5", inputMessage.trim() ? "ml-1" : "")} />
              </Button>
            </form>
          </div>
          <div className="text-center mt-3 pb-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Llama 3.3 Turbo • UndoinG Tech</span>
          </div>
        </div>
      </main>
    </div>
  );
}
