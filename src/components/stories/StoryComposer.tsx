import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadToCloudinary } from "@/integrations/cloudinary/upload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Image as ImageIcon, Film, Loader2, X, Globe, Users, EyeOff, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function StoryComposer({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [visibility, setVisibility] = useState<"global" | "friends">("global");
  const [hiddenUsers, setHiddenUsers] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  const [hideSearch, setHideSearch] = useState("");
  const [hideResults, setHideResults] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  const [showHidePanel, setShowHidePanel] = useState(false);

  const pickFile = (type: "image" | "video") => {
    setPreview(null);
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === "image" ? "image/*" : "video/*";
      fileInputRef.current.click();
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 60 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 60MB) para um story.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  useEffect(() => {
    if (!showHidePanel || !hideSearch.trim()) { setHideResults([]); return; }
    const q = hideSearch.trim();
    const tid = setTimeout(async () => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return;
      const { data: friendships } = await supabase.from("friendships").select("user_id, friend_id").or(`user_id.eq.${me.user.id},friend_id.eq.${me.user.id}`);
      const ids = [...new Set((friendships || []).map((f: any) => f.user_id === me.user!.id ? f.friend_id : f.user_id))];
      if (ids.length === 0) { setHideResults([]); return; }
      const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids).ilike("username", `%${q}%`).limit(8);
      setHideResults((profs || []).filter(p => !hiddenUsers.some(h => h.id === p.id)) as any);
    }, 300);
    return () => clearTimeout(tid);
  }, [hideSearch, showHidePanel, hiddenUsers]);

  const publish = async () => {
    if (!user) return;
    if (!file) {
      toast.error("Escolha uma foto ou vídeo para o story.");
      return;
    }
    setUploading(true);
    setProgress(5);
    try {
      const res = await uploadToCloudinary(file, {
        kind: "stories",
        userId: user.id,
        onProgress: (pct) => setProgress(pct),
      });
      setProgress(90);
      const mediaType: "image" | "video" = file.type.startsWith("video") ? "video" : "image";
      let storyId: string | null = null;
      const payload: any = { user_id: user.id, media_type: mediaType, media_url: res.url, caption: caption.trim() || null, visibility };
      let { data, error } = await supabase.from("stories").insert(payload).select("id").single();
      if (error && String(error.message).includes("visibility")) {
        const fallback: any = { user_id: user.id, media_type: mediaType, media_url: res.url, caption: caption.trim() || null };
        const r2 = await supabase.from("stories").insert(fallback).select("id").single();
        if (r2.error) throw r2.error;
        data = r2.data;
        toast.message("Story publicado como Global (privacidade em atualização).");
      } else if (error) throw error;
      storyId = data?.id || null;
      if (storyId && hiddenUsers.length > 0) {
        const rows = hiddenUsers.map(h => ({ story_id: storyId, hidden_user_id: h.id }));
        const { error: hErr } = await (supabase as any).from("story_hidden_users").insert(rows as any);
        if (hErr && !String(hErr.message).includes("does not exist")) throw hErr;
      }
      setProgress(100);
      toast.success(visibility === "friends" ? "Story para amigos publicado! 👥" : "Story global publicado! 🌍");
      setTimeout(() => {
        setFile(null);
        setPreview(null);
        setCaption("");
        setVisibility("global");
        setHiddenUsers([]);
        setHideSearch("");
        setShowHidePanel(false);
        onOpenChange(false);
        onSuccess?.();
      }, 400);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao publicar story.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!uploading) onOpenChange(o); }}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Novo Story (24h)
          </DialogTitle>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={onFileChange}
        />

        {!file && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => pickFile("image")}
              className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-border hover:border-primary/60 transition-colors"
            >
              <ImageIcon className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Foto</span>
            </button>
            <button
              type="button"
              onClick={() => pickFile("video")}
              className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-border hover:border-primary/60 transition-colors"
            >
              <Film className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Vídeo</span>
            </button>
          </div>
        )}

        {file && preview && (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-muted flex items-center justify-center aspect-video">
              {file.type.startsWith("video") ? (
                <video src={preview} className="max-h-72 w-full object-contain" controls muted />
              ) : (
                <img src={preview} alt="Preview" className="max-h-72 w-full object-contain" />
              )}
              <button
                type="button"
                onClick={() => { setFile(null); setPreview(null); }}
                disabled={uploading}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Escreva uma legenda para o story…"
              rows={2}
              maxLength={280}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setVisibility("global")} className={cn("flex-1 h-9 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all", visibility === "global" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-muted/40 text-muted-foreground border-border/30")}>
                <Globe className="h-3.5 w-3.5" /> Global
              </button>
              <button type="button" onClick={() => setVisibility("friends")} className={cn("flex-1 h-9 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all", visibility === "friends" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-muted/40 text-muted-foreground border-border/30")}>
                <Users className="h-3.5 w-3.5" /> Amigos
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">{visibility === "global" ? "Visível para todos os usuários." : "Visível apenas para seus amigos."}</p>

            <div className="rounded-xl border border-border/40 p-2.5 bg-muted/20">
              <button type="button" onClick={() => setShowHidePanel(v => !v)} className="w-full flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5"><EyeOff className="h-3.5 w-3.5" /> Ocultar de usuários específicos</span>
                <span className="text-muted-foreground">{hiddenUsers.length ? `${hiddenUsers.length} oculto(s)` : "Opcional"}</span>
              </button>
              {showHidePanel && (
                <div className="mt-2 space-y-2">
                  {hiddenUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {hiddenUsers.map(h => (
                        <span key={h.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full bg-destructive/10 border border-destructive/20 text-xs">
                          @{h.username} <button type="button" onClick={() => setHiddenUsers(prev => prev.filter(x => x.id !== h.id))} className="h-4 w-4 rounded-full hover:bg-destructive/20 flex items-center justify-center"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input value={hideSearch} onChange={e => setHideSearch(e.target.value)} placeholder="Buscar amigo para ocultar..." className="pl-8 h-8 text-sm" />
                  </div>
                  {hideResults.length > 0 && (
                    <div className="rounded-lg border bg-card max-h-28 overflow-y-auto">
                      {hideResults.map(r => (
                        <button key={r.id} type="button" onClick={() => { setHiddenUsers(prev => [...prev, r]); setHideSearch(""); setHideResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2">
                          <img src={r.avatar_url || ""} alt="" className="h-6 w-6 rounded-full bg-muted" /> @{r.username}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {uploading && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Enviando {progress}%</span>
              </div>
            )}
            <Button className="w-full" onClick={publish} disabled={uploading} size="lg">
              {uploading ? "Publicando…" : `Publicar ${visibility === "friends" ? "para Amigos" : "Global"}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}