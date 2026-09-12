import React, { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, Reply, MoreVertical, Trash2 } from "lucide-react";
import { UserLink } from "@/components/UserLink";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { MentionText } from "@/components/MentionText";

export interface CommentType {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    post_id: string;
    parent_id?: string | null;
    profiles?: {
        username: string;
        avatar_url: string;
    };
    comment_likes?: { user_id: string }[];
    replies?: CommentType[];
}

interface CommentItemProps {
    comment: CommentType;
    currentUserId?: string;
    onReply: (commentId: string, username: string) => void;
    onDelete?: (commentId: string) => void;
    onLikeToggle?: (commentId: string, isLiked: boolean) => void;
    isNesting?: boolean;
}

export const CommentItem: React.FC<CommentItemProps> = ({
    comment,
    currentUserId,
    onReply,
    onDelete,
    onLikeToggle,
    isNesting = false,
}) => {
    const [isLiked, setIsLiked] = useState<boolean>(false);
    const [likesCount, setLikesCount] = useState<number>(0);
    const [isLoadingLike, setIsLoadingLike] = useState(false);

    useEffect(() => {
        if (comment.comment_likes) {
            setLikesCount(comment.comment_likes.length);
            setIsLiked(comment.comment_likes.some((l) => l.user_id === currentUserId));
        }
    }, [comment.comment_likes, currentUserId]);

    const handleLike = async () => {
        if (!currentUserId || isLoadingLike) return;
        setIsLoadingLike(true);

        try {
            if (isLiked) {
                // Dislike
                const { error } = await supabase
                    .from("comment_likes")
                    .delete()
                    .eq("comment_id", comment.id)
                    .eq("user_id", currentUserId);

                if (!error) {
                    setIsLiked(false);
                    setLikesCount((prev) => Math.max(0, prev - 1));
                    onLikeToggle?.(comment.id, false);
                }
            } else {
                // Like
                const { error } = await supabase
                    .from("comment_likes")
                    .insert({ comment_id: comment.id, user_id: currentUserId });

                if (!error) {
                    setIsLiked(true);
                    setLikesCount((prev) => prev + 1);
                    onLikeToggle?.(comment.id, true);
                }
            }
        } catch (err) {
            console.error("Erro ao curtir comentário", err);
        } finally {
            setIsLoadingLike(false);
        }
    };

    const isOwner = currentUserId === comment.user_id;

    return (
        <div className={`flex gap-3 ${isNesting ? "ml-8 mt-3" : "mt-4"}`}>
            <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={comment.profiles?.avatar_url} />
                <AvatarFallback>{comment.profiles?.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <UserLink
                            userId={comment.user_id}
                            username={comment.profiles?.username || "Usuario"}
                            className="text-sm font-bold hover:underline"
                        >
                            @{comment.profiles?.username || "usuario"}
                        </UserLink>
                        <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                    </div>

                    {isOwner && onDelete && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-red-500"
                            onClick={() => onDelete(comment.id)}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>

                <p className="text-sm text-foreground break-words">
                    <MentionText text={comment.content} />
                </p>

                <div className="flex items-center gap-4 pt-1">
                    <button
                        onClick={handleLike}
                        disabled={isLoadingLike}
                        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${isLiked ? "text-pink-500" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-current" : ""}`} />
                        {likesCount > 0 && <span>{likesCount}</span>}
                    </button>

                    <button
                        onClick={() => onReply(comment.id, comment.profiles?.username || "")}
                        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Reply className="h-3.5 w-3.5" />
                        Responder
                    </button>
                </div>

                {/* Renderiza Respostas Filhas de Forma Recursiva */}
                {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-2 space-y-3">
                        {comment.replies.map((reply) => (
                            <CommentItem
                                key={reply.id}
                                comment={reply}
                                currentUserId={currentUserId}
                                onReply={onReply}
                                onDelete={onDelete}
                                onLikeToggle={onLikeToggle}
                                isNesting={true}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
