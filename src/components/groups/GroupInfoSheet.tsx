import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { openDb } from "@/lib/openDb";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Crown,
  Shield,
  UserMinus,
  UserPlus,
  LogOut,
  Pencil,
  Check,
  X,
  Loader2,
  ImagePlus,
} from "lucide-react";
import { uploadFileToCloudinary } from "@/utils/cloudinaryUpload";
import { cn } from "@/lib/utils";

interface GroupMember {
  user_id: string;
  role: string | null;
  profiles: { username?: string | null; avatar_url?: string | null } | null;
}

interface GroupInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  currentUserId: string;
  onChanged: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Dono",
  admin: "Admin",
};

export function GroupInfoSheet({
  open,
  onOpenChange,
  conversationId,
  currentUserId,
  onChanged,
}: GroupInfoSheetProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const { data: group, refetch: refetchGroup } = useQuery({
    queryKey: ["group_conv_info", conversationId],
    enabled: open && !!conversationId,
    queryFn: async () => {
      const { data } = await openDb
        .from("conversations")
        .select("id, name, group_description, group_avatar")
        .eq("id", conversationId)
        .maybeSingle();
      return (data || null) as Record<string, unknown> | null;
    },
  });

  const { data: members, refetch: refetchMembers } = useQuery({
    queryKey: ["group_members_info", conversationId],
    enabled: open && !!conversationId,
    queryFn: async () => {
      const { data } = await openDb
        .from("conversation_participants")
        .select("user_id, role, created_at, profiles:user_id(username, avatar_url)")
        .eq("conversation_id", conversationId);
      return ((data || []) as unknown) as GroupMember[];
    },
  });

  const { data: friends } = useQuery({
    queryKey: ["friends-for-group-sheet", conversationId],
    enabled: showAddMember && open && !!conversationId,
    queryFn: async () => {
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
      return (profiles || []) as { id: string; username: string; avatar_url: string | null }[];
    },
  });

  const manageAllowed =
    !!members?.some(
      (m) => m.user_id === currentUserId && (m.role === "owner" || m.role === "admin")
    );

  useEffect(() => {
    if (!editing) return;
    setNameDraft(String(group?.name || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const memberIds = new Set((members || []).map((m) => m.user_id));
  const addableFriends = (friends || []).filter((f) => !memberIds.has(f.id));

  const addMember = async (userId: string) => {
    const { error } = await openDb.rpc("add_group_members", {
      p_conversation_id: conversationId,
      p_member_ids: [userId],
    });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível adicionar o membro.", variant: "destructive" });
      return;
    }
    toast({ title: "Membro adicionado", description: "A pessoa agora participa do grupo." });
    await refetchMembers();
    onChanged();
  };

  const removeMember = async (userId: string) => {
    const { error } = await openDb.rpc("remove_group_member", {
      p_conversation_id: conversationId,
      p_user_id: userId,
    });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível remover o membro.", variant: "destructive" });
      return;
    }
    toast({ title: "Membro removido" });
    await refetchMembers();
    onChanged();
  };

  const leaveGroup = async () => {
    const { error } = await openDb.rpc("leave_group", {
      p_conversation_id: conversationId,
    });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível sair do grupo.", variant: "destructive" });
      return;
    }
    onOpenChange(false);
    onChanged();
  };

  const saveEdits = async () => {
    if (!nameDraft.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    try {
      const { error } = await openDb.rpc("update_group_info", {
        p_conversation_id: conversationId,
        p_name: nameDraft.trim(),
        p_description: null,
        p_avatar: null,
      });
      if (error) throw error;
      toast({ title: "Grupo atualizado" });
      setEditing(false);
      await refetchGroup();
      onChanged();
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar as alterações.", variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAvatarFile = async (file: File | undefined | null) => {
    if (!file || uploadingAvatar) return;
    setUploadingAvatar(true);
    try {
      const result = await uploadFileToCloudinary(file, { folder: "chat/groups" });
      const { error } = await openDb.rpc("update_group_info", {
        p_conversation_id: conversationId,
        p_name: null,
        p_description: null,
        p_avatar: result.secureUrl,
      });
      if (error) throw error;
      toast({ title: "Avatar atualizado" });
      await refetchGroup();
      onChanged();
    } catch {
      toast({ title: "Erro no upload", description: "Não foi possível enviar a imagem.", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const groupName = String(group?.name || "Grupo");
  const description = group?.group_description ? String(group.group_description) : null;
  const avatar = group?.group_avatar ? String(group.group_avatar) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 pt-5 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2.5">
            <div className="relative">
              <Avatar className="h-11 w-11 border-2 border-primary/30">
                <AvatarImage src={avatar || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white">
                  {groupName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {manageAllowed && (
                <label
                  className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-md hover:opacity-90 transition-opacity"
                  title="Alterar avatar"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-2.5 w-2.5" />
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
              )}
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="h-8 text-sm"
                  maxLength={60}
                  autoFocus
                />
              ) : (
                <p className="font-semibold truncate">{groupName}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {(members || []).length} membro{(members || []).length === 1 ? "" : "s"}
              </p>
            </div>
            {manageAllowed &&
              (editing ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditing(false)}
                    title="Cancelar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-green-600"
                    onClick={() => void saveEdits()}
                    disabled={savingEdit}
                    title="Salvar"
                  >
                    {savingEdit ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => setEditing(true)}
                  title="Editar nome"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              ))}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {description || "Grupo de chat no Undoing"}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Membros
              </p>
              {manageAllowed && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowAddMember((v) => !v)}
                >
                  {showAddMember ? <X className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                  {showAddMember ? "Fechar" : "Adicionar"}
                </Button>
              )}
            </div>

            {showAddMember && (
              <div className="rounded-xl border border-border/50 p-2 space-y-1 bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-150">
                {addableFriends.length > 0 ? (
                  addableFriends.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => void addMember(f.id)}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={f.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {f.username[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium flex-1 truncate">@{f.username}</span>
                      <UserPlus className="h-3.5 w-3.5 text-primary" />
                    </div>
                  ))
                ) : (
                  <p className="text-center text-xs text-muted-foreground py-3">
                    Todos os seus amigos já estão no grupo.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              {(members || []).map((member) => {
                const isMe = member.user_id === currentUserId;
                const role = member.role || "member";
                return (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-xl border border-border/40 bg-background/50"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={member.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {member.profiles?.username?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {isMe ? "Você" : member.profiles?.username || "Membro"}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {role === "owner" && (
                          <Badge
                            className="h-4 px-1.5 text-[9px] gap-0.5 bg-amber-500/15 text-amber-600 border-amber-500/30"
                            variant="outline"
                          >
                            <Crown className="h-2.5 w-2.5" />
                            Dono
                          </Badge>
                        )}
                        {role === "admin" && (
                          <Badge
                            className="h-4 px-1.5 text-[9px] gap-0.5 bg-blue-500/15 text-blue-600 border-blue-500/30"
                            variant="outline"
                          >
                            <Shield className="h-2.5 w-2.5" />
                            Admin
                          </Badge>
                        )}
                        {role === "member" && (
                          <span className="text-[10px] text-muted-foreground">{ROLE_LABEL.member || "Membro"}</span>
                        )}
                      </div>
                    </div>
                    {manageAllowed && !isMe && member.user_id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => void removeMember(member.user_id)}
                        title="Remover do grupo"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <Button
            variant="outline"
            className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            onClick={() => void leaveGroup()}
          >
            <LogOut className="h-4 w-4" />
            Sair do grupo
          </Button>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Ao sair, você para de receber novas mensagens do grupo.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}