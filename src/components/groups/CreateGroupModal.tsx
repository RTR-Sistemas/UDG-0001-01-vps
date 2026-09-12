import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { openDb } from "@/lib/openDb";
import { X, Loader2, ImagePlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { uploadFileToCloudinary } from "@/utils/cloudinaryUpload";
import { cn } from "@/lib/utils";

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onCreated: (conversationId: string) => void;
}

export function CreateGroupModal({ open, onOpenChange, currentUserId, onCreated }: CreateGroupModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  const { data: friends, isLoading: isLoadingFriends } = useQuery({
    queryKey: ["friends-for-group"],
    queryFn: async (): Promise<Friend[]> => {
      const { data: mine } = await supabase
        .from("friendships")
        .select("friend_id")
        .eq("user_id", currentUserId);
      const { data: theirs } = await supabase
        .from("friendships")
        .select("user_id")
        .eq("friend_id", currentUserId);

      const ids = Array.from(
        new Set([
          ...(mine || []).map((f) => f.friend_id),
          ...(theirs || []).map((f) => f.user_id),
        ])
      );
      if (ids.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", ids);
      return (profiles || []) as Friend[];
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      const { data: convId, error: convError } = await openDb.rpc("create_group", {
        p_name: name.trim(),
        p_description: description.trim() || null,
        p_member_ids: selectedFriends,
      });
      if (convError) throw convError;

      if (avatarUrl && convId) {
        const { error: avatarError } = await openDb.rpc("update_group_info", {
          p_conversation_id: convId,
          p_name: null,
          p_description: null,
          p_avatar: avatarUrl,
        });
        if (avatarError) throw avatarError;
      }

      return String(convId);
    },
    onSuccess: (conversationId) => {
      toast({ title: "Grupo criado!", description: "Seu novo grupo de chat está pronto." });
      setName("");
      setDescription("");
      setAvatarUrl(null);
      setSelectedFriends([]);
      onOpenChange(false);
      onCreated(conversationId);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar grupo",
        description: error.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  const handleAvatarFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (isUploadingAvatar) return;
    setIsUploadingAvatar(true);
    try {
      const result = await uploadFileToCloudinary(file, { folder: "chat/groups" });
      setAvatarUrl(result.secureUrl);
      toast({ title: "Avatar atualizado", description: "A imagem foi enviada com sucesso." });
    } catch {
      toast({ title: "Erro no upload", description: "Não foi possível enviar a imagem.", variant: "destructive" });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const toggleFriend = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const canSubmit =
    name.trim().length > 0 &&
    selectedFriends.length > 0 &&
    !createGroupMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Grupo</DialogTitle>
          <DialogDescription>
            Dê um nome, escolha um avatar opcional e adicione amigos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="relative flex-shrink-0">
              <Avatar className="h-16 w-16 border-2 border-primary/30">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xl">
                  {name ? name[0].toUpperCase() : "G"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 flex items-center gap-1">
                <label
                  className={cn(
                    "h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-md hover:opacity-90 transition-opacity",
                    isUploadingAvatar && "pointer-events-none opacity-60"
                  )}
                  title="Enviar avatar"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3 w-3" />
                  )}
                  <input
                    type="file"
                    accept="image/png,image/webp,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      void handleAvatarFile(e.target.files?.[0]);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center shadow-md hover:opacity-90 transition-opacity"
                    title="Remover avatar"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div>
                <Label htmlFor="group-name">Nome do grupo</Label>
                <Input
                  id="group-name"
                  placeholder="Ex.: Amigos do futebol"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5"
                  maxLength={60}
                />
              </div>
              <div>
                <Label htmlFor="group-desc">Descrição (opcional)</Label>
                <Textarea
                  id="group-desc"
                  placeholder="Para que serve esse grupo?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1.5 min-h-[56px] resize-none"
                  maxLength={200}
                />
              </div>
            </div>
          </div>

          <div>
            <Label>
              Adicionar amigos ({selectedFriends.length})
            </Label>
            <ScrollArea className="h-44 border rounded-md p-2 mt-2">
              {isLoadingFriends ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Carregando...
                </div>
              ) : friends && friends.length > 0 ? (
                <div className="space-y-1">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className={cn(
                        "flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent cursor-pointer transition-colors",
                        selectedFriends.includes(friend.id) && "bg-primary/5"
                      )}
                      onClick={() => toggleFriend(friend.id)}
                    >
                      <Checkbox
                        checked={selectedFriends.includes(friend.id)}
                        onCheckedChange={() => {}}
                        className="pointer-events-none"
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={friend.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {friend.username[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">@{friend.username}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Você não tem amigos adicionados ainda.
                </p>
              )}
            </ScrollArea>
          </div>

          <Button
            className="w-full"
            onClick={() => createGroupMutation.mutate()}
            disabled={!canSubmit}
          >
            {createGroupMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Criando...
              </>
            ) : (
              "Criar Grupo"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}