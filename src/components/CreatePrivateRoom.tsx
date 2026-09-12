/**
 * =============================================================================
 * File: src/components/CreatePrivateRoom.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MessageSquarePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


interface Contact {
  id: string;
  username: string;
  avatar_url: string | null;
}

export default function CreatePrivateRoom() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [isTemporary, setIsTemporary] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  const { data: contacts } = useQuery({
    queryKey: ["contacts-for-room"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: myFriendships } = await supabase
        .from("friendships")
        .select("friend_id")
        .eq("user_id", user.id);

      const { data: friendsOfMe } = await supabase
        .from("friendships")
        .select("user_id")
        .eq("friend_id", user.id);

      const friendIds = [
        ...(myFriendships?.map(f => f.friend_id) || []),
        ...(friendsOfMe?.map(f => f.user_id) || [])
      ];

      if (friendIds.length === 0) return [];

      const { data: friends } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", friendIds);

      return friends as Contact[];
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (selectedContacts.length === 0) {
        throw new Error("Selecione pelo menos um contato");
      }

      if (selectedContacts.length + 1 > maxParticipants) {
        throw new Error(`Número máximo de participantes: ${maxParticipants}`);
      }

      // Criar a conversa
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          name: roomName || "Sala Privada",
          is_group: true,
          is_temporary: isTemporary,
          max_participants: maxParticipants,
          auto_translate: autoTranslate,
          expires_at: isTemporary ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Adicionar o criador como participante
      const participants = [
        { conversation_id: conversation.id, user_id: user.id },
        ...selectedContacts.map(contactId => ({
          conversation_id: conversation.id,
          user_id: contactId,
        })),
      ];

      const { error: partError } = await supabase
        .from("conversation_participants")
        .insert(participants);

      if (partError) throw partError;

      return conversation;
    },
    onSuccess: () => {
      toast({
        title: "Sala criada!",
        description: "Sua sala privada foi criada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setOpen(false);
      setRoomName("");
      setSelectedContacts([]);
      setMaxParticipants(2);
      setIsTemporary(false);
      setAutoTranslate(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar sala",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleContact = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          Nova Sala
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Sala Privada</DialogTitle>
          <DialogDescription>
            Configure sua sala e convide amigos para participar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="roomName">Nome da Sala</Label>
            <Input
              id="roomName"
              placeholder="Digite o nome da sala"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="maxParticipants">Número de Participantes</Label>
            <Input
              id="maxParticipants"
              type="number"
              min={2}
              max={15}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 2)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Máximo: 15 participantes
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="temporary">Chat Temporário</Label>
              <p className="text-xs text-muted-foreground">
                A sala expira em 24h
              </p>
            </div>
            <Switch
              id="temporary"
              checked={isTemporary}
              onCheckedChange={setIsTemporary}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="translate">Tradução Automática</Label>
              <p className="text-xs text-muted-foreground">
                Traduz mensagens automaticamente
              </p>
            </div>
            <Switch
              id="translate"
              checked={autoTranslate}
              onCheckedChange={setAutoTranslate}
            />
          </div>

          <div>
            <Label>Convidar Contatos ({selectedContacts.length}/{maxParticipants - 1})</Label>
            <ScrollArea className="h-48 border rounded-md p-2 mt-2">
              {contacts && contacts.length > 0 ? (
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                      onClick={() => toggleContact(contact.id)}
                    >
                      <Checkbox
                        checked={selectedContacts.includes(contact.id)}
                        disabled={
                          !selectedContacts.includes(contact.id) &&
                          selectedContacts.length >= maxParticipants - 1
                        }
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={contact.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {contact.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{contact.username}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Nenhum contato disponível
                </p>
              )}
            </ScrollArea>
          </div>

          <Button
            onClick={() => createRoomMutation.mutate()}
            disabled={createRoomMutation.isPending}
            className="w-full"
          >
            {createRoomMutation.isPending ? "Criando..." : "Criar Sala"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
