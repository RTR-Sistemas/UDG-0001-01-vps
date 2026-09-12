/**
 * =============================================================================
 * File: src/pages/Communities.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, Plus, Search, MessageCircle, TrendingUp, 
  Lock, Camera, MoreHorizontal, ArrowLeft, Shield, 
  Settings, UserPlus, LogOut, Trash2, Crown, 
  UserMinus, ShieldCheck, Image as ImageIcon, MapPin, 
  Globe, LayoutGrid, CheckCircle2, Share2, X, Sparkles,
  Edit3, Check, AlertTriangle, Link, Loader2, Video,
  Heart, Bookmark, Send, Image, Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { saveMentions } from "@/utils/mentionsHelper";
import { uploadToCloudinary } from "@/integrations/cloudinary/upload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MentionText } from "@/components/MentionText";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------

  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// --- CONSTANTES DE CAPAS (PRESETS) ---
// Removida a primeira capa e adicionadas 6 novas, totalizando 15
const PRESET_COVERS = [
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=2670&auto=format&fit=crop", // Nature
  "https://images.unsplash.com/photo-1533134486753-c833f0ed4866?q=80&w=2670&auto=format&fit=crop", // Abstract Dark
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop", // Cyberpunk
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop", // Space
  "https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5?q=80&w=2574&auto=format&fit=crop", // City
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=2583&auto=format&fit=crop", // Cars
  "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2629&auto=format&fit=crop", // Gradients
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2674&auto=format&fit=crop", // Travel
  "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=2670&auto=format&fit=crop", // Code
  // Novas capas adicionadas
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2670&auto=format&fit=crop", // Mountains
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2670&auto=format&fit=crop", // Northern Lights
  "https://images.unsplash.com/photo-1518834103326-7d3d4b42235b?q=80&w=2670&auto=format&fit=crop", // Beach Sunset
  "https://images.unsplash.com/photo-1519791883288-dc8bd696e667?q=80&w=2670&auto=format&fit=crop", // Abstract Color
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2670&auto=format&fit=crop", // Lake Reflection
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2671&auto=format&fit=crop", // Forest
];

// --- CONSTANTES DE CORES DE FUNDO ---
const PRESET_COLORS = [
  "#1e293b", // Slate 800
  "#1e40af", // Blue 800
  "#0f766e", // Teal 700
  "#7c3aed", // Purple 600
  "#be185d", // Pink 700
  "#dc2626", // Red 600
  "#ea580c", // Orange 600
  "#ca8a04", // Yellow 700
  "#16a34a", // Green 600
  "#0891b2", // Cyan 600
  "#4f46e5", // Indigo 600
  "#db2777", // Pink 600
  "#f59e0b", // Amber 500
  "#10b981", // Emerald 500
  "#8b5cf6", // Violet 500
];

// --- TIPOS ---

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  full_name: string | null;
}

interface CommunityMember {
  id: string;
  user_id: string;
  role: 'member' | 'moderator' | 'admin';
  joined_at: string;
  profiles: Profile;
}

interface Community {
  id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  cover_url: string | null;
  created_at: string;
  created_by: string;
  is_private: boolean;
  password_hash: string | null;
  member_count?: number; 
  post_count?: number;   
  community_members: { id: string }[];
  community_posts: { id: string }[];
  custom_background?: string; // Nova propriedade para cor de fundo
}

interface CommunityPost {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  media_urls: string[] | null;
  profiles: Profile;
  community?: Community;
}

// --- UTILITÁRIOS VISUAIS ---

const GRADIENTS = [
  "from-blue-600 to-purple-600",
  "from-pink-600 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-red-600",
  "from-indigo-600 to-blue-500",
];

const getGradient = (id: string) => GRADIENTS[id.charCodeAt(0) % GRADIENTS.length];

// --- COMPONENTE MODAL DE COMPARTILHAMENTO ---
interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: any;
  user: any;
  community: Community | null;
  onShareComplete: (platform: string) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ open, onOpenChange, post, user, community, onShareComplete }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [sharing, setSharing] = useState(false);

  // Verifica se a comunidade é privada
  const isPrivateCommunity = community?.is_private;

  const handleShareToArena = async () => {
    if (isPrivateCommunity) {
      toast({
        title: "Comunidade Privada",
        description: "Posts de comunidades privadas não podem ser compartilhados na Arena.",
        variant: "destructive"
      });
      return;
    }

    setSharing(true);
    try {
      // Obter o perfil do usuário para obter o username
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user?.id)
        .single();

      const username = profile?.username || user?.email?.split('@')[0] || "usuário";
      
      // Criar um post na tabela posts com o conteúdo do post da comunidade
      const { data, error } = await supabase.from("posts").insert({
        user_id: user?.id,
        content: `Compartilhado por @${username} da comunidade "${community?.name}"\n\n🔁 ${post.content?.substring(0, 200)}${post.content?.length > 200 ? '...' : ''}`,
        media_urls: post.media_urls,
        post_type: 'standard',
        voting_period_active: true,
        voting_ends_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        is_community_approved: false
      }).select().single();

      if (error) throw error;

      toast({ 
        title: "🎯 Post enviado para a Arena!",
        description: "Seu post tem 60 minutos para receber votos!",
        duration: 5000 
      });
      
      onShareComplete('arena');
      onOpenChange(false);
      
      queryClient.invalidateQueries({ queryKey: ["arena-posts"] });
      
      setTimeout(() => {
        navigate('/arena');
      }, 1000);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao compartilhar na Arena", description: error.message });
    } finally {
      setSharing(false);
    }
  };

  const handleShareExternal = async () => {
    try {
      const shareUrl = window.location.origin;
      const shareText = `Confira este post da comunidade ${community?.name}: ${post.content?.substring(0, 100)}...`;
      
      if (navigator.share) {
        await navigator.share({
          title: 'World Flow - Compartilhamento',
          text: shareText,
          url: shareUrl,
        });
        onShareComplete('external');
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Link copiado para a área de transferência!" });
        onShareComplete('copy');
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md p-0 overflow-hidden">
        <div className="sticky top-0 z-10 bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold">Compartilhar Post</DialogTitle>
              <DialogDescription className="text-gray-400 text-sm">
                {isPrivateCommunity 
                  ? "Posts de comunidades privadas não podem ser compartilhados."
                  : "Compartilhe este post na Arena ou externamente."}
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid gap-4">
            <Button 
              onClick={handleShareToArena} 
              disabled={sharing || isPrivateCommunity} 
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 h-12 rounded-lg"
            >
              {sharing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isPrivateCommunity ? "Compartilhamento Bloqueado" : "Compartilhar na Arena"}
            </Button>
            <Button 
              onClick={handleShareExternal} 
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-12 rounded-lg"
            >
              Compartilhar Externamente
            </Button>
          </div>
          {isPrivateCommunity && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
              <p className="text-sm text-red-300 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Comunidades privadas não permitem compartilhamento na Arena
              </p>
            </div>
          )}
          {community && !isPrivateCommunity && (
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
              <p className="text-sm text-blue-300">
                Este post será compartilhado como: <br />
                <span className="font-bold">"Compartilhado por @{user?.user_metadata?.username || user?.email?.split('@')[0]} da comunidade "{community.name}""</span>
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function Communities() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // --- ESTADOS ---
  const [viewMode, setViewMode] = useState<'explore' | 'detail'>('explore');
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  
  // Busca e Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'public' | 'private'>('all');
  
  // Tabs Internas
  const [activeTab, setActiveTab] = useState("feed");
  
  // Modais
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState<string | null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  
  // Formulário Criação
  const [newCommunity, setNewCommunity] = useState({
    name: "",
    description: "",
    isPrivate: false,
    password: "",
    avatarUrl: "",
    coverUrl: "",
    backgroundColor: PRESET_COLORS[0], // Cor de fundo padrão
  });

  // Formulário Edição
  const [editCommunityForm, setEditCommunityForm] = useState({
    name: "",
    description: "",
    avatarUrl: "",
    coverUrl: "",
    backgroundColor: PRESET_COLORS[0],
  });

  const [newPost, setNewPost] = useState("");
  const [newPostMedia, setNewPostMedia] = useState<File | null>(null);
  const [newPostUrl, setNewPostUrl] = useState("");
  const [sharePost, setSharePost] = useState<any>(null);
  
  // Estado para controlar carregamento (Create, Update, Delete, Upload)
  const [isSubmitting, setIsSubmitting] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const postMediaInputRef = useRef<HTMLInputElement>(null);
  
  // Ref separada para edição
  const editAvatarInputRef = useRef<HTMLInputElement>(null);
  const editCoverInputRef = useRef<HTMLInputElement>(null);

  // --- QUERIES ---

  const { data: allCommunities, isLoading: loadingAll } = useQuery({
    queryKey: ["all-communities", searchQuery, filterType],
    queryFn: async () => {
      let query = supabase
        .from("communities")
        .select(`
          *,
          community_members(id),
          community_posts(id)
        `)
        .order("created_at", { ascending: false });

      if (searchQuery) query = query.ilike("name", `%${searchQuery}%`);
      if (filterType === 'public') query = query.eq("is_private", false);
      if (filterType === 'private') query = query.eq("is_private", true);

      const { data, error } = await query;
      if (error) throw error;
      
      return data.map((c: any) => ({
        ...c,
        member_count: c.community_members.length,
        post_count: c.community_posts.length
      })) as Community[];
    },
  });

  const { data: myCommunities } = useQuery({
    queryKey: ["my-communities", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_members")
        .select(`community_id, communities (*)`)
        .eq("user_id", user?.id);
      
      if (error) throw error;
      return data.map((item: any) => item.communities) as Community[];
    },
  });

  const { data: communityPosts, refetch: refetchPosts } = useQuery({
    queryKey: ["community-posts", selectedCommunityId],
    enabled: !!selectedCommunityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select(`*, profiles:user_id (id, username, avatar_url, full_name)`)
        .eq("community_id", selectedCommunityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CommunityPost[];
    },
  });

  const { data: members, refetch: refetchMembers } = useQuery({
    queryKey: ["community-members", selectedCommunityId],
    enabled: !!selectedCommunityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_members")
        .select(`*, profiles:user_id (id, username, avatar_url, full_name)`)
        .eq("community_id", selectedCommunityId)
        .order("role", { ascending: true });
      if (error) throw error;
      return data as CommunityMember[];
    },
  });

  // --- ACTIONS ---

  const handleSelectCommunity = (id: string) => {
    setSelectedCommunityId(id);
    setViewMode('detail');
    setActiveTab('feed');
  };

  const handleBackToExplore = () => {
    setSelectedCommunityId(null);
    setViewMode('explore');
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    type: 'avatar' | 'cover',
    mode: 'create' | 'edit' = 'create'
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsSubmitting(true);
    try {
      // Folder relativo (a pasta BASE fica no backend)
      const folder = `communities/${type}/${user.id}`;
      const { url: publicUrl } = await uploadToCloudinary(file, {
        kind: "communities",
        userId: user.id,
        folder,
      });
      
      if (mode === 'create') {
        setNewCommunity(prev => ({
          ...prev,
          [type === 'avatar' ? 'avatarUrl' : 'coverUrl']: publicUrl
        }));
      } else {
        setEditCommunityForm(prev => ({
          ...prev,
          [type === 'avatar' ? 'avatarUrl' : 'coverUrl']: publicUrl
        }));
      }

      toast({ title: "Imagem carregada com sucesso!" });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao fazer upload", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCommunity = async () => {
    // Validação básica
    if (!newCommunity.name.trim()) return toast({ title: "Nome obrigatório", variant: "destructive" });
    
    // Evita duplo clique / dupla criação
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const { data: comm, error } = await supabase.from("communities").insert({
        name: newCommunity.name,
        description: newCommunity.description,
        created_by: user?.id,
        is_private: newCommunity.isPrivate,
        password_hash: newCommunity.isPrivate ? btoa(newCommunity.password) : null,
        avatar_url: newCommunity.avatarUrl || null,
        cover_url: newCommunity.coverUrl || null,
        custom_background: newCommunity.backgroundColor,
      }).select().single();

      if (error) throw error;

      // Adiciona o criador como admin
      await supabase.from("community_members").insert({
        community_id: comm.id,
        user_id: user?.id,
        role: 'admin'
      });

      toast({ title: "Comunidade criada!", description: "Você é o administrador." });
      setShowCreateDialog(false);
      setNewCommunity({ 
        name: "", 
        description: "", 
        isPrivate: false, 
        password: "", 
        avatarUrl: "", 
        coverUrl: "",
        backgroundColor: PRESET_COLORS[0]
      });
      
      // Invalida queries para atualizar listas
      await queryClient.invalidateQueries({ queryKey: ["all-communities"] });
      await queryClient.invalidateQueries({ queryKey: ["my-communities"] });
      
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCommunity = async () => {
    if (!selectedCommunityId || !editCommunityForm.name.trim()) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("communities").update({
        name: editCommunityForm.name,
        description: editCommunityForm.description,
        avatar_url: editCommunityForm.avatarUrl,
        cover_url: editCommunityForm.coverUrl,
        custom_background: editCommunityForm.backgroundColor
      }).eq('id', selectedCommunityId);

      if (error) throw error;

      toast({ title: "Comunidade atualizada!" });
      setShowEditDialog(false);
      queryClient.invalidateQueries({ queryKey: ["all-communities"] });
      queryClient.invalidateQueries({ queryKey: ["my-communities"] });
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCommunity = async () => {
    if (!selectedCommunityId) return;
    
    const confirmDelete = window.confirm("ATENÇÃO: Tem certeza que deseja excluir esta comunidade permanentemente? Esta ação não pode ser desfeita e removerá todos os posts e membros.");
    
    if (!confirmDelete) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("communities")
        .delete()
        .eq("id", selectedCommunityId);

      if (error) throw error;

      toast({ title: "Comunidade excluída com sucesso." });
      setShowEditDialog(false);
      handleBackToExplore();
      
      // Atualiza listas
      queryClient.invalidateQueries({ queryKey: ["all-communities"] });
      queryClient.invalidateQueries({ queryKey: ["my-communities"] });
      
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao excluir", description: "Verifique se você tem permissão ou tente novamente.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async (community: Community, passwordInput?: string) => {
    if (myCommunities?.some(c => c.id === community.id)) {
      handleSelectCommunity(community.id);
      return;
    }

    if (community.is_private) {
      if (!passwordInput) {
        setShowPasswordDialog(community.id);
        return;
      }
      if (btoa(passwordInput) !== community.password_hash) {
        toast({ title: "Senha incorreta", variant: "destructive" });
        return;
      }
    }

    const { error } = await supabase.from("community_members").insert({
      community_id: community.id,
      user_id: user?.id,
      role: 'member'
    });

    if (error) {
      toast({ title: "Erro ao entrar", variant: "destructive" });
    } else {
      toast({ title: `Bem-vindo à ${community.name}!` });
      setShowPasswordDialog(null);
      setJoinPassword("");
      queryClient.invalidateQueries({ queryKey: ["my-communities"] });
      queryClient.invalidateQueries({ queryKey: ["all-communities"] });
      // CORRECAO: sem isto, a query ["community-members", id] — de onde saem
      // isMember/isAdmin/isMod — nao era atualizada. O usuario entrava, mas a
      // tela seguia mostrando o botao "Participar" e sem a caixa de publicar
      // ate recarregar a pagina.
      queryClient.invalidateQueries({ queryKey: ["community-members"] });
    }
  };

  const handlePost = async () => {
    if (!newPost.trim() && !newPostMedia && !newPostUrl) return;
    
    setIsSubmitting(true);
    
    try {
      const mediaUrls: string[] = [];
      
      if (newPostMedia) {
        // Folder relativo (a pasta BASE fica no backend)
        const folder = `communities/posts/${selectedCommunityId}`;
        const { url } = await uploadToCloudinary(newPostMedia, {
          kind: "communities",
          userId: user?.id,
          folder,
        });
        mediaUrls.push(url);
      }
      
      // Se houver URL, adicionar ao conteúdo
      let content = newPost;
      if (newPostUrl) {
        content += `\n\n🔗 ${newPostUrl}`;
      }
      
      const { data, error } = await supabase.from("community_posts").insert({
        community_id: selectedCommunityId,
        user_id: user?.id,
        content: content,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null
      }).select().single();
      
      // CORRECAO: o supabase-js devolve { error } sem lancar. Antes, quando dava
      // erro, este if simplesmente nao entrava: nenhum toast, nenhum log, o
      // texto ficava na caixa e o usuario nao sabia que o post nao foi salvo.
      if (error) throw error;
      if (data) {
        await saveMentions(data.id, 'community_post', content, user?.id || '');
        setNewPost("");
        setNewPostMedia(null);
        setNewPostUrl("");
        refetchPosts();
        toast({ title: "Publicado!" });
      }
    } catch (error: any) {
      toast({ title: "Erro ao publicar", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openSettings = () => {
    const current = allCommunities?.find(c => c.id === selectedCommunityId);
    if (current) {
      setEditCommunityForm({
        name: current.name,
        description: current.description || "",
        avatarUrl: current.avatar_url || "",
        coverUrl: current.cover_url || "",
        backgroundColor: current.custom_background || PRESET_COLORS[0]
      });
      setShowEditDialog(true);
    }
  };

  // --- PERMISSÕES & UTILS ---
  // CORRECAO: `allCommunities` e filtrada por busca/filtro. Clicando num grupo
  // da barra "Meus Grupos" que nao batesse com o filtro ativo, isto virava
  // undefined e a area de detalhe ficava em branco, sem nem botao de voltar.
  const selectedCommunity =
    allCommunities?.find(c => c.id === selectedCommunityId) ??
    myCommunities?.find(c => c.id === selectedCommunityId);
  const myMemberInfo = members?.find(m => m.user_id === user?.id);
  const isMember = !!myMemberInfo;
  const isAdmin = myMemberInfo?.role === 'admin';
  const isMod = myMemberInfo?.role === 'moderator' || isAdmin;
  const isOwner = selectedCommunity?.created_by === user?.id;

  // --- RENDERIZAÇÃO ---

  return (
    <div className="h-[100dvh] bg-background text-foreground flex flex-col md:flex-row font-sans overflow-hidden">
      
      {/* SIDEBAR DE NAVEGAÇÃO RÁPIDA (Desktop) */}
      <aside className="w-full md:w-72 border-r border-border bg-card backdrop-blur-xl hidden md:flex flex-col h-[100dvh] sticky top-0">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-lg">
              <Users className="h-5 w-5 text-white" />
            </div>
            <h2 className="font-bold text-lg text-foreground">Comunidades</h2>
          </div>
          <p className="text-xs text-gray-400 md:text-gray-600 mt-1">Seus grupos e tribos.</p>
        </div>

        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">Acesso Rápido</h3>
              <nav className="space-y-1">
                <Button 
                  variant="ghost"
                  className={cn("w-full justify-start text-sm hover:bg-white/5 hover:text-white md:hover:bg-gray-100 md:hover:text-black", viewMode === 'explore' ? "bg-white/10 text-white md:bg-gray-200 text-foreground" : "text-gray-400 md:text-gray-600")} 
                  onClick={handleBackToExplore}
                >
                  <LayoutGrid className="mr-3 h-4 w-4" /> Explorar Todos
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm text-gray-400 md:text-gray-600 hover:bg-white/5 hover:text-white md:hover:bg-gray-100 md:hover:text-black" 
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="mr-3 h-4 w-4" /> Criar Novo
                </Button>
              </nav>
            </div>

            {myCommunities && myCommunities.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">Meus Grupos</h3>
                <div className="space-y-1">
                  {myCommunities.map(comm => (
                    <button
                      key={comm.id}
                      onClick={() => handleSelectCommunity(comm.id)}
                      className={`flex items-center gap-3 w-full p-2 rounded-lg text-left transition-all group ${
                        selectedCommunityId === comm.id 
                          ? "bg-gradient-to-r from-blue-900/40 to-purple-900/40 md:bg-gradient-to-r md:from-blue-100 md:to-purple-100 border border-blue-500/30 md:border-blue-300 text-foreground" 
                          : "hover:bg-white/5 md:hover:bg-gray-100 text-gray-400 md:text-gray-700 hover:text-white md:hover:text-black"
                      }`}
                    >
                      <Avatar className="h-8 w-8 ring-1 ring-white/10 md:ring-gray-300">
                        <AvatarImage src={comm.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px] bg-gray-800 md:bg-gray-200 text-gray-300 md:text-gray-700">{comm.name.substring(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">{comm.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-background relative overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>

        {/* VIEW: EXPLORE */}
        {viewMode === 'explore' && (
          <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-6 md:space-y-8 animate-in fade-in duration-500">

            {/* Header de Busca e Título Comunidades */}
            <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 items-center justify-between bg-card/60 p-4 sm:p-5 md:p-6 rounded-2xl border border-white/5 md:border-gray-200 backdrop-blur-sm w-full max-w-full overflow-hidden">
              <div className="text-center lg:text-left w-full lg:w-auto min-w-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold flex items-center justify-center lg:justify-start gap-2 sm:gap-3 mb-1 sm:mb-2">
                  <Globe className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-blue-500 shrink-0" />
                  <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Comunidades
                  </span>
                </h1>
                <p className="text-gray-400 md:text-gray-600 text-xs sm:text-sm md:text-base max-w-2xl mx-auto lg:mx-0">
                  Mergulhe em micro-universos e conecte-se com quem compartilha das mesmas paixões.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full lg:w-auto shrink-0 min-w-0">
                <div className="relative w-full sm:w-56 md:w-72 lg:w-80 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Buscar comunidades..."
                    className="pl-10 h-10 bg-white dark:bg-black/50 border-gray-800 md:border-gray-300 text-foreground placeholder:text-muted-foreground focus:ring-blue-500 focus:border-blue-500"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                {/* Filtros */}
                <div className="flex bg-black/50 md:bg-gray-200 rounded-lg p-1 border border-gray-800 md:border-gray-300 w-full sm:w-auto shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setFilterType('all')} className={cn("rounded-md px-2 sm:px-3 h-8 text-[11px] sm:text-xs flex-1 sm:flex-initial whitespace-nowrap", filterType === 'all' ? "bg-gray-800 text-white" : "text-gray-500")}>Todas</Button>
                  <Button variant="ghost" size="sm" onClick={() => setFilterType('public')} className={cn("rounded-md px-2 sm:px-3 h-8 text-[11px] sm:text-xs flex-1 sm:flex-initial whitespace-nowrap", filterType === 'public' ? "bg-gray-800 text-white" : "text-gray-500")}>Públicas</Button>
                  <Button variant="ghost" size="sm" onClick={() => setFilterType('private')} className={cn("rounded-md px-2 sm:px-3 h-8 text-[11px] sm:text-xs flex-1 sm:flex-initial whitespace-nowrap", filterType === 'private' ? "bg-gray-800 text-white" : "text-gray-500")}>Privadas</Button>
                </div>
              </div>
            </div>

            {/* --- MOBILE: ACTIONS BAR (SEÇÃO EXCLUSIVA PARA CELULAR) --- */}
            <div className="md:hidden space-y-4">
              {/* Botão de Criar Grande */}
              <Button 
                onClick={() => setShowCreateDialog(true)}
                className="w-full py-6 text-base font-bold bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl"
              >
                <Plus className="h-5 w-5 mr-2" /> Criar Nova Comunidade
              </Button>

              {/* Lista Horizontal de Meus Grupos */}
              {myCommunities && myCommunities.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 mb-2 px-1">MEUS GRUPOS</h3>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {myCommunities.map(comm => (
                      <button
                        key={comm.id}
                        onClick={() => handleSelectCommunity(comm.id)}
                        className="flex flex-col items-center gap-2 min-w-[70px]"
                      >
                         <Avatar className="h-14 w-14 ring-2 ring-gray-800">
                            <AvatarImage src={comm.avatar_url || undefined} />
                            <AvatarFallback className="bg-gray-800 text-gray-300 font-bold">{comm.name.substring(0,2).toUpperCase()}</AvatarFallback>
                         </Avatar>
                         <span className="text-[10px] text-gray-300 truncate w-full text-center">{comm.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Grid de Resultados */}
            {loadingAll ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-56 sm:h-64 w-full rounded-2xl bg-gray-900 md:bg-gray-200" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                {allCommunities?.map((comm) => (
                  <Card key={comm.id} className="group overflow-hidden border-border bg-gray-900/40 md:bg-white hover:bg-gray-900 md:hover:bg-gray-50 hover:border-gray-700 md:hover:border-gray-300 hover:shadow-2xl hover:shadow-purple-900/10 transition-all duration-300 flex flex-col h-full">
                    <div className="h-28 sm:h-32 relative bg-gray-800">
                      {comm.cover_url ? (
                        <img 
                          src={comm.cover_url} 
                          alt="Cover" 
                          className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-700"
                        />
                      ) : (
                        <div 
                          className={`w-full h-full`}
                          style={{ backgroundColor: comm.custom_background || '#1e40af' }}
                        ></div>
                      )}
                      <div className="absolute top-3 right-3">
                        {comm.is_private ? (
                          <Badge className="bg-black/60 md:bg-gray-800 text-white backdrop-blur-md border-none gap-1">
                            <Lock className="h-3 w-3" /> Privado
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/20 md:bg-emerald-100 text-emerald-300 md:text-emerald-700 backdrop-blur-md border border-emerald-500/30 gap-1">
                            <Globe className="h-3 w-3" /> Público
                          </Badge>
                        )}
                      </div>
                    </div>

                    <CardContent className="pt-0 flex-1 flex flex-col relative px-4 sm:px-5 md:px-6">
                      <div className="-mt-8 sm:-mt-10 mb-3 sm:mb-4 flex justify-between items-end">
                        <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-4 border-gray-900 md:border-white shadow-sm rounded-2xl bg-gray-800 md:bg-gray-200">
                          <AvatarImage src={comm.avatar_url || undefined} className="object-cover"/>
                          <AvatarFallback className="text-lg sm:text-xl font-bold bg-gray-800 md:bg-gray-300 text-gray-400 md:text-gray-700">{comm.name[0]}</AvatarFallback>
                        </Avatar>

                        {myCommunities?.some(c => c.id === comm.id) ? (
                           <Badge variant="outline" className="border-blue-500/50 text-blue-400 md:text-blue-600 gap-1 py-1 px-2 sm:px-3 bg-blue-500/10 md:bg-blue-100 text-[10px] sm:text-xs">
                             <CheckCircle2 className="h-3 w-3" /> Membro
                           </Badge>
                        ) : (
                           <div className="text-[10px] sm:text-xs text-gray-500 md:text-gray-600 font-medium mb-1 flex items-center gap-1">
                             <Users className="h-3 w-3" /> {comm.member_count} membros
                           </div>
                        )}
                      </div>

                      <div className="mb-3 sm:mb-4">
                        <h3 className="font-bold text-base sm:text-lg md:text-xl text-foreground group-hover:text-blue-400 md:group-hover:text-blue-600 transition-colors truncate">
                          {comm.name}
                        </h3>
                        <p className="text-gray-400 md:text-gray-600 text-xs sm:text-sm mt-1.5 sm:mt-2 line-clamp-2 min-h-[32px] sm:min-h-[40px]">
                          {comm.description || "Sem descrição disponível."}
                        </p>
                      </div>

                      <div className="mt-auto pt-3 sm:pt-4 border-t border-border flex items-center justify-between">
                         <Button
                           size="sm"
                           onClick={() => handleJoin(comm)}
                           className={cn(
                             "w-full rounded-full font-medium transition-all h-9 text-sm",
                             myCommunities?.some(c => c.id === comm.id)
                              ? "bg-gray-800 md:bg-gray-300 text-foreground"
                              : "bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none"
                           )}
                         >
                           {myCommunities?.some(c => c.id === comm.id) ? "Entrar" : "Participar"}
                         </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: DETAIL */}
        {viewMode === 'detail' && selectedCommunity && (
          <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
            
            {/* HERO HEADER */}
            <div className="relative h-44 sm:h-56 md:h-72 lg:h-80 w-full shrink-0">
               <div className="absolute inset-0">
                  {selectedCommunity.cover_url && (
                    <img src={selectedCommunity.cover_url} className="w-full h-full object-cover" />
                  )}
                  {!selectedCommunity.cover_url && (
                    <div 
                      className={`w-full h-full`}
                      style={{ backgroundColor: selectedCommunity.custom_background || '#1e40af' }}
                    ></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
               </div>
               
               {/* Botão Voltar agora na DIREITA */}
               <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
                 <Button size="sm" onClick={handleBackToExplore} className="bg-black/40 text-white hover:bg-black/60 border border-white/10 backdrop-blur-md rounded-full h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4">
                   <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" /> <span className="hidden sm:inline">Voltar</span>
                 </Button>
               </div>

               <div className="absolute bottom-0 left-0 w-full p-3 sm:p-5 md:p-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
                  <div className="flex items-end gap-3 sm:gap-5 md:gap-6 min-w-0">
                    <Avatar className="h-16 w-16 sm:h-20 sm:w-20 md:h-28 md:w-28 lg:h-32 lg:w-32 border-4 border-black rounded-xl sm:rounded-2xl shadow-2xl -mb-3 sm:-mb-4 md:-mb-6 bg-gray-900 shrink-0">
                      <AvatarImage src={selectedCommunity.avatar_url || undefined} className="object-cover"/>
                      <AvatarFallback className="text-2xl sm:text-3xl md:text-4xl bg-gray-900 text-gray-300">{selectedCommunity.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="mb-1 sm:mb-2 md:mb-4 text-white drop-shadow-lg min-w-0">
                      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-5xl font-black tracking-tight truncate">{selectedCommunity.name}</h1>
                      <div className="flex items-center gap-2 sm:gap-4 mt-1 sm:mt-2 text-[11px] sm:text-sm md:text-base opacity-90 font-medium text-gray-200 flex-wrap">
                        <span className="flex items-center gap-1">
                           {selectedCommunity.is_private ? <Lock className="h-3 w-3 sm:h-4 sm:w-4" /> : <Globe className="h-3 w-3 sm:h-4 sm:w-4" />}
                           {selectedCommunity.is_private ? "Privado" : "Público"}
                        </span>
                        <span>•</span>
                        <span>{members?.length || 0} Membros</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:mb-4 md:mb-6 shrink-0 self-end sm:self-auto">
                    {isMember && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 bg-white/10 text-white hover:bg-white/20 border border-white/5 backdrop-blur-sm">
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border text-foreground md:bg-white md:border-gray-200 text-foreground">
                          <DropdownMenuItem onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            toast({ title: "Link copiado!" });
                          }}>
                            <Share2 className="h-4 w-4 mr-2" /> Compartilhar
                          </DropdownMenuItem>
                          
                          {isAdmin && (
                            <DropdownMenuItem onClick={openSettings}>
                              <Settings className="h-4 w-4 mr-2" /> Configurações
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator className="bg-gray-800 md:bg-gray-200"/>
                          <DropdownMenuItem className="text-red-400" onClick={() => {
                            // Lógica para sair da comunidade
                          }}>
                            <LogOut className="h-4 w-4 mr-2" /> Sair do Grupo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {!isMember && (
                      <Button onClick={() => handleJoin(selectedCommunity)} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none rounded-full px-4 sm:px-6 h-9 sm:h-10 text-xs sm:text-sm font-bold">
                        Participar
                      </Button>
                    )}
                  </div>
               </div>
            </div>

            {/* CONTEÚDO TABS */}
            {/* Aplicando a cor de fundo personalizada na área de postagens */}
            <div className="flex-1 overflow-hidden flex flex-col"
                 style={{ 
                   backgroundColor: selectedCommunity.custom_background || '#1e293b',
                   backgroundImage: selectedCommunity.custom_background 
                     ? `linear-gradient(to bottom, ${selectedCommunity.custom_background}99, ${selectedCommunity.custom_background}99), radial-gradient(circle at top left, ${selectedCommunity.custom_background}40, transparent 50%)`
                     : undefined
                 }}>
               <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
                  <div className="px-3 sm:px-5 md:px-10 border-b border-border sticky top-0 bg-background/80 backdrop-blur z-10">
                    <TabsList className="bg-transparent h-10 sm:h-12 w-full justify-start gap-4 sm:gap-8 p-0">
                      <TabsTrigger value="feed" className="data-[state=active]:border-b-2 data-[state=active]:border-purple-500 data-[state=active]:text-purple-400 text-gray-400 md:text-gray-600 rounded-none px-0 pb-2 sm:pb-3 bg-transparent text-xs sm:text-sm">Feed</TabsTrigger>
                      <TabsTrigger value="members" className="data-[state=active]:border-b-2 data-[state=active]:border-purple-500 data-[state=active]:text-purple-400 text-gray-400 md:text-gray-600 rounded-none px-0 pb-2 sm:pb-3 bg-transparent text-xs sm:text-sm">Membros</TabsTrigger>
                      <TabsTrigger value="about" className="data-[state=active]:border-b-2 data-[state=active]:border-purple-500 data-[state=active]:text-purple-400 text-gray-400 md:text-gray-600 rounded-none px-0 pb-2 sm:pb-3 bg-transparent text-xs sm:text-sm">Sobre</TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8">
                    <div className="max-w-4xl mx-auto">
                      
                      <TabsContent value="feed" className="mt-0 space-y-6">
                        {isMember && (
                          <Card className="border-border bg-card p-3 sm:p-4 flex gap-2.5 sm:gap-4 animate-in fade-in slide-in-from-bottom-4">
                             <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                               <AvatarImage src={user?.user_metadata?.avatar_url} />
                               <AvatarFallback className="bg-gray-800 md:bg-gray-300 text-gray-400 md:text-gray-700 text-xs sm:text-sm">{user?.email?.[0]}</AvatarFallback>
                             </Avatar>
                             <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                               <Textarea
                                 placeholder={`O que você está pensando?`}
                                 className="border-none bg-black/40 md:bg-white/90 resize-none min-h-[64px] sm:min-h-[80px] text-sm sm:text-base focus-visible:ring-0 text-foreground placeholder:text-gray-600 rounded-xl p-2.5 sm:p-3 backdrop-blur-sm"
                                 value={newPost}
                                 onChange={e => setNewPost(e.target.value)}
                               />
                               
                               {newPostUrl && (
                                 <div className="bg-black/40 p-3 rounded-lg border border-gray-700 backdrop-blur-sm">
                                   <div className="flex items-center justify-between">
                                     <div className="flex items-center gap-2">
                                       <Link className="h-4 w-4 text-blue-400" />
                                       <span className="text-sm text-gray-300 truncate">{newPostUrl}</span>
                                     </div>
                                     <Button
                                       variant="ghost"
                                       size="icon"
                                       className="h-6 w-6 text-gray-400 hover:text-red-400"
                                       onClick={() => setNewPostUrl("")}
                                     >
                                       <X className="h-3 w-3" />
                                     </Button>
                                   </div>
                                 </div>
                               )}
                               
                               {newPostMedia && (
                                 <div className="relative rounded-lg overflow-hidden border border-gray-700 backdrop-blur-sm">
                                   {newPostMedia.type.startsWith('image/') ? (
                                     <img 
                                       src={URL.createObjectURL(newPostMedia)} 
                                       alt="Preview" 
                                       className="w-full h-48 object-cover"
                                     />
                                   ) : (
                                     <video 
                                       src={URL.createObjectURL(newPostMedia)} 
                                       controls
                                       className="w-full h-48 object-cover"
                                     />
                                   )}
                                   <Button
                                     variant="destructive"
                                     size="icon"
                                     className="absolute top-2 right-2 h-8 w-8 rounded-full bg-red-600/80 hover:bg-red-700/80 backdrop-blur-sm"
                                     onClick={() => setNewPostMedia(null)}
                                   >
                                     <X className="h-4 w-4" />
                                   </Button>
                                 </div>
                               )}
                               
                               <div className="flex justify-between items-center">
                                 <div className="flex gap-2">
                                   <input
                                     type="file"
                                     accept="image/*,video/*"
                                     className="hidden"
                                     id="post-media-upload"
                                     ref={postMediaInputRef}
                                     onChange={(e) => {
                                       const file = e.target.files?.[0];
                                       if (file) setNewPostMedia(file);
                                     }}
                                   />
                                   <TooltipProvider>
                                     <Tooltip>
                                       <TooltipTrigger asChild>
                                         <Button 
                                           variant="ghost" 
                                           size="icon" 
                                           className="text-gray-400 backdrop-blur-sm"
                                           onClick={() => postMediaInputRef.current?.click()}
                                         >
                                           <Image className="h-5 w-5" />
                                         </Button>
                                       </TooltipTrigger>
                                       <TooltipContent>
                                         <p>Adicionar foto/vídeo</p>
                                       </TooltipContent>
                                     </Tooltip>
                                   </TooltipProvider>
                                   
                                   <TooltipProvider>
                                     <Tooltip>
                                       <TooltipTrigger asChild>
                                         <Button 
                                           variant="ghost" 
                                           size="icon" 
                                           className="text-gray-400 backdrop-blur-sm"
                                           onClick={() => {
                                             const url = prompt("Cole a URL do site:");
                                             if (url) setNewPostUrl(url);
                                           }}
                                         >
                                           <Link className="h-5 w-5" />
                                         </Button>
                                       </TooltipTrigger>
                                       <TooltipContent>
                                         <p>Adicionar link</p>
                                       </TooltipContent>
                                     </Tooltip>
                                   </TooltipProvider>
                                 </div>
                                 <Button 
                                   onClick={handlePost} 
                                   disabled={(!newPost.trim() && !newPostMedia && !newPostUrl) || isSubmitting} 
                                   className="rounded-full px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none backdrop-blur-sm"
                                 >
                                   {isSubmitting ? "Publicando..." : "Publicar"}
                                 </Button>
                               </div>
                             </div>
                          </Card>
                        )}
                        
                        {/* Feed Posts */}
                        <div className="space-y-4">
                          {communityPosts?.map((post) => {
                            const isVideo = post.media_urls?.[0]?.startsWith('video::');
                            const mediaUrl = post.media_urls?.[0]?.replace(/^(image::|video::)/, '');
                            
                            return (
                               <Card key={post.id} className="border-border bg-card overflow-hidden">
                                  <CardHeader className="flex flex-row items-start gap-2.5 sm:gap-4 pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
                                     <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                                       <AvatarImage src={post.profiles.avatar_url || undefined} />
                                       <AvatarFallback className="text-xs sm:text-sm">{post.profiles.username[0]}</AvatarFallback>
                                     </Avatar>
                                     <div className="flex-1 min-w-0">
                                       <div className="flex items-center justify-between gap-2">
                                         <span className="font-semibold text-xs sm:text-sm text-foreground truncate">{post.profiles.full_name || post.profiles.username}</span>
                                         <span className="text-[10px] sm:text-xs text-gray-500 shrink-0">{new Date(post.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                       </div>
                                       <span className="text-[10px] sm:text-xs text-gray-500">@{post.profiles.username}</span>
                                     </div>
                                  </CardHeader>
                                  <CardContent className="px-3 sm:px-4 pb-2">
                                    <MentionText text={post.content} className="text-[13px] sm:text-sm leading-relaxed text-gray-200 md:text-gray-800 mb-2 sm:mb-3" />

                                    {mediaUrl && (
                                      <div className="mt-2 sm:mt-3 rounded-lg overflow-hidden">
                                        {isVideo ? (
                                          <video
                                            src={mediaUrl}
                                            controls
                                            className="w-full h-auto max-h-64 sm:max-h-96 object-cover rounded-lg"
                                          />
                                        ) : (
                                          <img
                                            src={mediaUrl}
                                            alt="Post media"
                                            className="w-full h-auto max-h-64 sm:max-h-96 object-cover rounded-lg"
                                          />
                                        )}
                                      </div>
                                    )}
                                  </CardContent>
                                  {/* MOSTRAR APENAS SE A COMUNIDADE FOR PÚBLICA */}
                                  {!selectedCommunity.is_private && (
                                    <CardFooter className="flex justify-end px-3 sm:px-4 pb-3 sm:pb-4">
                                     <TooltipProvider>
                                       <Tooltip>
                                         <TooltipTrigger asChild>
                                           <Button 
                                             variant="ghost" 
                                             size="sm" 
                                             onClick={() => setSharePost({...post, community: selectedCommunity})}
                                             className="text-muted-foreground hover:text-foreground backdrop-blur-sm"
                                           >
                                             <Share2 className="h-4 w-4 mr-2" />
                                             Compartilhar
                                           </Button>
                                         </TooltipTrigger>
                                         <TooltipContent>
                                           <p>Compartilhar este post</p>
                                         </TooltipContent>
                                       </Tooltip>
                                     </TooltipProvider>
                                   </CardFooter>
                                 )}
                               </Card>
                            );
                          })}
                        </div>
                      </TabsContent>

                      {/* --- MEMBROS --- */}
                      <TabsContent value="members" className="mt-0">
                        <Card className="border-border bg-card border-border">
                           <CardContent className="grid gap-2 p-4">
                              {members?.map(member => (
                                <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:bg-white/10 md:hover:bg-gray-200/90 backdrop-blur-sm">
                                   <div className="flex items-center gap-3">
                                      <Avatar>
                                        <AvatarImage src={member.profiles.avatar_url || undefined} />
                                        <AvatarFallback>{member.profiles.username[0]}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <div className="flex items-center gap-2">
                                           <span className="font-medium text-foreground">{member.profiles.full_name || member.profiles.username}</span>
                                           {member.role === 'admin' && <Badge variant="default" className="text-[10px] h-5 bg-amber-500/30 text-amber-300 backdrop-blur-sm">Admin</Badge>}
                                           {member.role === 'moderator' && <Badge variant="default" className="text-[10px] h-5 bg-blue-500/30 text-blue-300 backdrop-blur-sm">Mod</Badge>}
                                        </div>
                                        <span className="text-xs text-gray-500">@{member.profiles.username}</span>
                                      </div>
                                   </div>
                                   <div className="text-xs text-gray-500">
                                     {new Date(member.joined_at).toLocaleDateString()}
                                   </div>
                                </div>
                              ))}
                           </CardContent>
                        </Card>
                      </TabsContent>
                      
                      {/* --- SOBRE --- */}
                      <TabsContent value="about" className="mt-0">
                         <Card className="border-border bg-card border-border p-6">
                            <h3 className="font-bold text-lg mb-2 text-foreground">Descrição</h3>
                            <p className="text-gray-300 md:text-gray-700 mb-6">{selectedCommunity.description || "Esta comunidade não possui descrição."}</p>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-gray-400 md:text-gray-500">Informações</h4>
                                <div className="flex items-center gap-2">
                                  {selectedCommunity.is_private ? (
                                    <Badge className="bg-red-500/30 text-red-300 border-red-500/30 backdrop-blur-sm">
                                      <Lock className="h-3 w-3 mr-1" /> Privado
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-emerald-500/30 text-emerald-300 border-emerald-500/30 backdrop-blur-sm">
                                      <Globe className="h-3 w-3 mr-1" /> Público
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-gray-400 md:text-gray-500">Estatísticas</h4>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-400">Membros</span>
                                    <span className="text-foreground font-medium">{members?.length || 0}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-400">Posts</span>
                                    <span className="text-foreground font-medium">{communityPosts?.length || 0}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-400">Criada em</span>
                                    <span className="text-foreground font-medium">{new Date(selectedCommunity.created_at).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                         </Card>
                      </TabsContent>
                    </div>
                  </div>
               </Tabs>
            </div>
          </div>
        )}
      </main>

      {/* --- DIALOG CRIAR NOVA COMUNIDADE --- */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-gray-950 md:bg-white border-border text-foreground p-0 rounded-2xl">
          <DialogHeader className="p-6 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
               <Sparkles className="h-5 w-5 text-purple-500" /> 
               Criar Nova Comunidade
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 p-6">
             {/* Upload de Capa */}
             <div 
               className="h-36 w-full bg-gray-900/50 md:bg-gray-100 rounded-xl flex items-center justify-center cursor-pointer relative overflow-hidden group border-2 border-dashed border-gray-800 md:border-gray-300 hover:border-purple-500 transition-all"
               onClick={() => coverInputRef.current?.click()}
             >
                {newCommunity.coverUrl ? (
                  <img src={newCommunity.coverUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-gray-500">
                    <ImageIcon className="h-8 w-8 mb-2" />
                    <span className="text-xs font-medium">Adicionar Capa (Upload)</span>
                  </div>
                )}
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'cover', 'create')} />
             </div>

             {/* Presets de Capa - Ajustado para responsividade */}
             <div>
                <Label className="text-xs text-gray-500 mb-2 block">Ou escolha uma capa pronta:</Label>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                   {PRESET_COVERS.map((url, idx) => (
                      <button 
                        key={idx}
                        type="button"
                        onClick={() => setNewCommunity({...newCommunity, coverUrl: url})}
                        className={cn(
                          "h-16 md:h-12 w-full rounded-md overflow-hidden relative border-2 transition-all",
                          newCommunity.coverUrl === url ? "border-purple-500 ring-2 ring-purple-500/30" : "border-transparent opacity-70 hover:opacity-100"
                        )}
                      >
                         <img src={url} className="w-full h-full object-cover" />
                         {newCommunity.coverUrl === url && <div className="absolute inset-0 bg-purple-500/40 flex items-center justify-center"><Check className="h-4 w-4 text-white"/></div>}
                      </button>
                   ))}
                </div>
             </div>

             {/* Upload de Avatar */}
             <div className="flex items-center gap-4">
                <div 
                   className="h-16 w-16 rounded-full bg-gray-800 md:bg-gray-200 flex items-center justify-center cursor-pointer relative overflow-hidden border border-gray-700 md:border-gray-300"
                   onClick={() => avatarInputRef.current?.click()}
                >
                   {newCommunity.avatarUrl ? (
                     <img src={newCommunity.avatarUrl} className="w-full h-full object-cover" />
                   ) : (
                     <Camera className="h-6 w-6 text-gray-500" />
                   )}
                   <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'avatar', 'create')} />
                </div>
                <div className="flex-1">
                   <Label>Avatar do Grupo</Label>
                   <p className="text-xs text-gray-500">Clique para adicionar uma imagem.</p>
                </div>
             </div>

             {/* Seção de Cor de Fundo da Área de Postagens */}
             <div>
                <Label className="text-xs text-gray-500 mb-2 block flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Cor de fundo da área de postagens
                </Label>
                <div className="grid grid-cols-5 md:grid-cols-5 gap-2">
                   {PRESET_COLORS.map((color, idx) => (
                      <button 
                        key={idx}
                        type="button"
                        onClick={() => setNewCommunity({...newCommunity, backgroundColor: color})}
                        className={cn(
                          "h-10 w-full rounded-md relative border-2 transition-all",
                          newCommunity.backgroundColor === color ? "border-white ring-2 ring-white/30" : "border-transparent opacity-70 hover:opacity-100"
                        )}
                        style={{ backgroundColor: color }}
                      >
                         {newCommunity.backgroundColor === color && <div className="absolute inset-0 bg-white/40 flex items-center justify-center"><Check className="h-4 w-4 text-white"/></div>}
                      </button>
                   ))}
                </div>
             </div>

             <div className="grid gap-4">
               <div className="grid gap-2">
                 <Label>Nome</Label>
                 <Input 
                   value={newCommunity.name} 
                   onChange={e => setNewCommunity({...newCommunity, name: e.target.value})} 
                   placeholder="Ex: Fotografia Urbana" 
                   className="bg-gray-900 md:bg-gray-100 border-gray-800 md:border-gray-300"
                 />
               </div>
               <div className="grid gap-2">
                 <Label>Descrição</Label>
                 <Textarea 
                   value={newCommunity.description} 
                   onChange={e => setNewCommunity({...newCommunity, description: e.target.value})} 
                   className="bg-gray-900 md:bg-gray-100 border-gray-800 md:border-gray-300"
                 />
               </div>
               
               <div className="flex items-center justify-between p-4 border border-gray-800 md:border-gray-300 rounded-xl bg-gray-900/50 md:bg-gray-100">
                 <div className="space-y-0.5">
                   <Label>Privado</Label>
                   <p className="text-xs text-gray-500">Requer senha para entrar.</p>
                 </div>
                 <Switch 
                   checked={newCommunity.isPrivate} 
                   onCheckedChange={checked => setNewCommunity({...newCommunity, isPrivate: checked})} 
                 />
               </div>

               {newCommunity.isPrivate && (
                 <div className="grid gap-2">
                   <Label>Senha</Label>
                   <Input 
                     type="password" 
                     value={newCommunity.password} 
                     onChange={e => setNewCommunity({...newCommunity, password: e.target.value})} 
                     className="bg-gray-900 md:bg-gray-100"
                   />
                 </div>
               )}
             </div>
          </div>

          <DialogFooter className="p-6 border-t border-border">
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button 
              onClick={handleCreateCommunity} 
              disabled={isSubmitting} 
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              {isSubmitting ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG CONFIGURAÇÕES (EDITAR & EXCLUIR) --- */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-gray-950 md:bg-white border-border text-foreground p-0 rounded-2xl">
          <DialogHeader className="p-6 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
               <Settings className="h-5 w-5 text-blue-500" /> 
               Configurações da Comunidade
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 p-6">
             <div className="space-y-2">
               <Label>Capa da Comunidade</Label>
               
               {/* Preview e Upload */}
               <div 
                 className="h-36 w-full bg-gray-900/50 md:bg-gray-100 rounded-xl flex items-center justify-center cursor-pointer relative overflow-hidden group border-2 border-dashed border-gray-800 md:border-gray-300 hover:border-blue-500 transition-all"
                 onClick={() => editCoverInputRef.current?.click()}
               >
                  {editCommunityForm.coverUrl ? (
                    <img src={editCommunityForm.coverUrl} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-500">
                      <ImageIcon className="h-8 w-8 mb-2" />
                      <span className="text-xs font-medium">Trocar Capa (Upload)</span>
                    </div>
                  )}
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <Edit3 className="text-white h-8 w-8" />
                  </div>
                  <input ref={editCoverInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'cover', 'edit')} />
               </div>

               {/* Galeria de Presets na Edição - Ajustado para responsividade */}
               <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">Ou selecione uma da galeria:</p>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                     {PRESET_COVERS.map((url, idx) => (
                        <button 
                          key={idx}
                          type="button"
                          onClick={() => setEditCommunityForm({...editCommunityForm, coverUrl: url})}
                          className={cn(
                            "h-16 md:h-12 rounded-md overflow-hidden relative border-2 transition-all",
                            editCommunityForm.coverUrl === url ? "border-blue-500 ring-2 ring-blue-500/30" : "border-transparent opacity-60 hover:opacity-100"
                          )}
                        >
                           <img src={url} className="w-full h-full object-cover" />
                           {editCommunityForm.coverUrl === url && <div className="absolute inset-0 bg-blue-500/40 flex items-center justify-center"><Check className="h-5 w-5 text-white"/></div>}
                        </button>
                     ))}
                  </div>
               </div>
             </div>

             <Separator className="bg-gray-800" />

             {/* Seção de Cor de Fundo na Edição */}
             <div>
                <Label className="text-xs text-gray-500 mb-2 block flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Cor de fundo da área de postagens
                </Label>
                <div className="grid grid-cols-5 md:grid-cols-5 gap-2">
                   {PRESET_COLORS.map((color, idx) => (
                      <button 
                        key={idx}
                        type="button"
                        onClick={() => setEditCommunityForm({...editCommunityForm, backgroundColor: color})}
                        className={cn(
                          "h-10 w-full rounded-md relative border-2 transition-all",
                          editCommunityForm.backgroundColor === color ? "border-white ring-2 ring-white/30" : "border-transparent opacity-70 hover:opacity-100"
                        )}
                        style={{ backgroundColor: color }}
                      >
                         {editCommunityForm.backgroundColor === color && <div className="absolute inset-0 bg-white/40 flex items-center justify-center"><Check className="h-4 w-4 text-white"/></div>}
                      </button>
                   ))}
                </div>
             </div>

             <Separator className="bg-gray-800" />

             <div className="grid gap-4">
               <div className="flex items-center gap-4">
                  <div 
                     className="h-16 w-16 rounded-full bg-gray-800 md:bg-gray-200 flex items-center justify-center cursor-pointer relative overflow-hidden border border-gray-700 md:border-gray-300"
                     onClick={() => editAvatarInputRef.current?.click()}
                  >
                     {editCommunityForm.avatarUrl ? (
                       <img src={editCommunityForm.avatarUrl} className="w-full h-full object-cover" />
                     ) : (
                       <Camera className="h-6 w-6 text-gray-500" />
                     )}
                     <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Edit3 className="h-4 w-4 text-white"/>
                     </div>
                     <input ref={editAvatarInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'avatar', 'edit')} />
                  </div>
                  <div>
                     <Label>Avatar</Label>
                     <p className="text-xs text-gray-500">Toque na imagem para alterar.</p>
                  </div>
               </div>

               <div className="grid gap-2">
                 <Label>Nome da Comunidade</Label>
                 <Input 
                   value={editCommunityForm.name} 
                   onChange={e => setEditCommunityForm({...editCommunityForm, name: e.target.value})} 
                   className="bg-gray-900 md:bg-gray-100 border-gray-800 md:border-gray-300"
                 />
               </div>
               <div className="grid gap-2">
                 <Label>Descrição</Label>
                 <Textarea 
                   value={editCommunityForm.description} 
                   onChange={e => setEditCommunityForm({...editCommunityForm, description: e.target.value})} 
                   className="bg-gray-900 md:bg-gray-100 border-gray-800 md:border-gray-300"
                 />
               </div>
             </div>

             {/* ZONA DE PERIGO (APENAS CRIADOR) */}
             {isOwner && (
               <>
                 <Separator className="bg-gray-800" />
                 <div className="rounded-xl border border-red-900/50 bg-red-950/10 p-4">
                    <h4 className="flex items-center gap-2 text-red-500 font-bold text-sm mb-2">
                      <AlertTriangle className="h-4 w-4" /> Zona de Perigo
                    </h4>
                    <p className="text-xs text-gray-400 mb-4">
                      Excluir a comunidade apagará permanentemente todos os posts e dados de membros. Esta ação não pode ser desfeita.
                    </p>
                    <Button 
                      variant="destructive" 
                      onClick={handleDeleteCommunity}
                      disabled={isSubmitting}
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                    >
                      {isSubmitting ? "Excluindo..." : "Excluir Comunidade"}
                    </Button>
                 </div>
               </>
             )}
          </div>

          <DialogFooter className="p-6 border-t border-border">
            <Button variant="ghost" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleUpdateCommunity} disabled={isSubmitting} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
              {isSubmitting ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG SENHA --- */}
      <Dialog open={!!showPasswordDialog} onOpenChange={() => setShowPasswordDialog(null)}>
        <DialogContent className="bg-gray-900 md:bg-white border-gray-800 md:border-gray-300 text-foreground">
           <DialogHeader><DialogTitle>Senha Necessária</DialogTitle></DialogHeader>
           <Input 
             type="password" 
             placeholder="Digite a senha..." 
             value={joinPassword} 
             onChange={e => setJoinPassword(e.target.value)} 
             className="bg-black/50 md:bg-gray-100 border-gray-700 md:border-gray-300"
           />
           <Button 
             onClick={() => showPasswordDialog && allCommunities && handleJoin(allCommunities.find(c => c.id === showPasswordDialog)!, joinPassword)}
             className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
           >
             Entrar
           </Button>
        </DialogContent>
      </Dialog>

      {/* --- MODAL DE COMPARTILHAMENTO --- */}
      {sharePost && (
        <ShareModal
          open={!!sharePost}
          onOpenChange={(open) => !open && setSharePost(null)}
          post={sharePost}
          user={user}
          community={sharePost.community}
          onShareComplete={(platform: string) => {
            toast({ 
              title: "Compartilhado com sucesso!", 
              description: platform === 'arena' ? "Post enviado para a Arena!" : "Link copiado para compartilhamento!"
            });
            setSharePost(null);
          }}
        />
      )}
    </div>
  );
}