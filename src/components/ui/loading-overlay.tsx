import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
    message?: string;
    className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    message = "Carregando conteúdo...",
    className
}) => {
    return (
        <div className={cn(
            "fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl animate-in fade-in duration-500",
            className
        )}>
            <div className="relative flex flex-col items-center">
                {/* Decorative background glow */}
                <div className="absolute -inset-24 bg-primary/20 blur-[100px] rounded-full animate-pulse" />

                <div className="relative bg-card p-8 rounded-3xl shadow-2xl border border-border flex flex-col items-center">
                    {/* Circular animated icons */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150 animate-pulse" />
                        <div className="relative flex items-center justify-center">
                            <Loader2 className="h-16 w-16 animate-spin text-primary" strokeWidth={1.5} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-purple-500 animate-pulse shadow-lg shadow-primary/50" />
                            </div>
                        </div>
                    </div>

                    <div className="text-center">
                        <h2 className="text-2xl font-black tracking-tighter mb-2">
                            World <span className="text-primary">Flow</span>
                        </h2>
                        <div className="flex items-center justify-center gap-2">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                            <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                            <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                        </div>
                        <p className="mt-4 text-sm font-medium text-muted-foreground tracking-wide uppercase">
                            {message}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
