import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { MessageCircle, UserPlus, MoreVertical, User, ShieldX, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  username: string;
  avatar_url: string | null;
  friend_code: string;
}

interface ContactsListProps {
  onStartChat: (friendId: string) => void;
  onlineUserIds?: Set<string>;
  onBlockUser?: (id: string, name: string, avatar: string | null) => void;
}

export default function ContactsList({ onStartChat, onlineUserIds, onBlockUser }: ContactsListProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [openMenuContactId, setOpenMenuContactId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: allFriendships, error } = await supabase
        .from("friendships")
        .select("user_id, friend_id")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (error) {
        console.error("Error fetching friendships:", error);
        return [];
      }

      if (!allFriendships || allFriendships.length === 0) return [];

      const friendIds = allFriendships.map(friendship =>
        friendship.user_id === user.id ? friendship.friend_id : friendship.user_id
      );

      const uniqueFriendIds = [...new Set(friendIds)];
      if (uniqueFriendIds.length === 0) return [];

      const { data: friends, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, friend_code")
        .in("id", uniqueFriendIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        return [];
      }

      return friends as Contact[];
    },
    refetchInterval: 5000,
  });

  const sortedContacts = useMemo(() => {
    if (!contacts) return [];
    return [...contacts].sort((a, b) => {
      const aOnline = onlineUserIds?.has(a.id) ? 1 : 0;
      const bOnline = onlineUserIds?.has(b.id) ? 1 : 0;
      if (aOnline !== bOnline) return bOnline - aOnline;
      return a.username.localeCompare(b.username);
    });
  }, [contacts, onlineUserIds]);

  const handleCopyCode = (e: React.MouseEvent, contact: Contact) => {
    e.stopPropagation();
    navigator.clipboard.writeText(contact.friend_code);
    setCopiedCodeId(contact.id);
    toast({
      title: "Código copiado!",
      description: `Código de @${contact.username} copiado para a área de transferência.`,
    });
    setTimeout(() => setCopiedCodeId(null), 2000);
    setOpenMenuContactId(null);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-xs">Carregando contatos...</p>
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="bg-muted/50 rounded-full p-6 mb-4">
          <MessageCircle className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Nenhum contato ainda</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          Adicione amigos usando o código UDG para poder iniciar conversas
        </p>
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
          <UserPlus className="h-4 w-4 mr-2" />
          Atualizar Lista
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2" onClick={() => openMenuContactId && setOpenMenuContactId(null)}>
      <div className="flex items-center justify-between px-1 mb-1">
        <h3 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
          Contatos ({contacts.length})
        </h3>
        {onlineUserIds && (
          <span className="text-[10px] text-green-600 font-medium">
            {contacts.filter(c => onlineUserIds.has(c.id)).length} online
          </span>
        )}
      </div>

      {sortedContacts.map((contact) => {
        const isOnline = onlineUserIds?.has(contact.id);
        const isMenuOpen = openMenuContactId === contact.id;

        return (
          <Card
            key={contact.id}
            className="p-3 rounded-2xl border border-border/40 bg-card hover:bg-accent/40 hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer group relative"
            onClick={() => onStartChat(contact.id)}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className={cn(
                  "h-10 w-10 border transition-all",
                  isOnline ? "ring-2 ring-green-500/70 border-green-500/30" : "border-border/40"
                )}>
                  <AvatarImage src={contact.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-bold text-sm">
                    {contact.username?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                {isOnline && (
                  <span className="absolute bottom-0 right-0 block w-3 h-3 rounded-full border-2 border-card bg-green-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                    {contact.username}
                  </p>
                  {isOnline && (
                    <span className="text-[10px] text-green-600 font-medium hidden sm:inline-block">
                      • Online
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-full bg-muted text-[10px] font-mono text-muted-foreground">
                    {contact.friend_code}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <div className="h-8 w-8 rounded-full bg-primary/10 group-hover:bg-primary flex items-center justify-center transition-colors flex-shrink-0">
                  <MessageCircle className="h-4 w-4 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>

                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuContactId(isMenuOpen ? null : contact.id);
                    }}
                    title="Mais opções do contato"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>

                  {isMenuOpen && (
                    <div className="absolute right-0 top-9 z-50 w-44 rounded-xl border border-border/50 bg-popover shadow-xl p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150 text-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuContactId(null);
                          onStartChat(contact.id);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-left w-full text-foreground"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-primary" />
                        <span>Conversar</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuContactId(null);
                          navigate(`/profile/${contact.id}`);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-left w-full text-foreground"
                      >
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Ver Perfil</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleCopyCode(e, contact)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-left w-full text-foreground"
                      >
                        {copiedCodeId === contact.id ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span>Copiar Código</span>
                      </button>

                      {onBlockUser && (
                        <>
                          <div className="h-px bg-border/40 my-0.5" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuContactId(null);
                              onBlockUser(contact.id, contact.username, contact.avatar_url);
                            }}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-destructive/10 text-destructive text-left w-full"
                          >
                            <ShieldX className="h-3.5 w-3.5" />
                            <span>Bloquear</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
