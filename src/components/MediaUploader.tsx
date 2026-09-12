/**
 * =============================================================================
 * File: src/components/MediaUploader.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Images, Video, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


interface MediaUploaderProps {
  onMediaReady: (files: File[]) => void;
}

export default function MediaUploader({ onMediaReady }: MediaUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file types and sizes
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB max

      if (!isImage && !isVideo) {
        toast({
          title: "Arquivo inválido",
          description: `${file.name} não é uma imagem ou vídeo`,
          variant: "destructive",
        });
        return false;
      }

      if (!isValidSize) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede 50MB`,
          variant: "destructive",
        });
        return false;
      }

      return true;
    });

    if (validFiles.length === 0) return;

    // Create previews
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
    setPreviews(prev => [...prev, ...newPreviews]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    if (selectedFiles.length > 0) {
      onMediaReady(selectedFiles);
      // Clean up
      previews.forEach(URL.revokeObjectURL);
      setSelectedFiles([]);
      setPreviews([]);
    }
  };

  if (selectedFiles.length > 0) {
    return (
      <div className="p-3 rounded-lg bg-muted space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {selectedFiles.map((file, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-black/5">
                {file.type.startsWith('image/') ? (
                  <img
                    src={previews[index]}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    src={previews[index]}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeFile(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedFiles.length} arquivo(s) selecionado(s)
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Adicionar mais
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              className="bg-gradient-to-r from-primary to-secondary"
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button
        variant="ghost"
        className="h-auto flex flex-col items-center gap-2 py-3 px-2 rounded-xl hover:bg-transparent"
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg transform transition-transform hover:scale-105">
          <Images className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <span className="text-[10px] font-medium text-foreground">Galeria</span>
      </Button>
    </>
  );
}
