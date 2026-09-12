import React, { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AreaTutorialDef } from "@/services/areaTutorials";

interface AreaTutorialProps {
  tutorial: AreaTutorialDef;
  onClose: () => void;
}

/**
 * Tutorial de área: overlay moderno (bottom sheet no mobile, centralizado no
 * desktop) com passos ancorados em gradiente temático da área.
 */
export function AreaTutorial({ tutorial, onClose }: AreaTutorialProps) {
  const [step, setStep] = useState(0);
  const isLast = step === tutorial.steps.length - 1;
  const current = tutorial.steps[step];
  const StepIcon = current.icon;

  // Trava o scroll da página durante o tutorial
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Fecha com a tecla Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const next = () => (isLast ? onClose() : setStep((s) => s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Tutorial de ${tutorial.label}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[3px] animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative w-full max-w-md mx-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 md:px-6 md:py-6 animate-in slide-in-from-bottom-10 fade-in duration-500 ease-out md:slide-in-from-bottom-2">
        <div
          className={cn(
            "relative overflow-hidden rounded-[28px] bg-gradient-to-br text-white shadow-2xl shadow-black/50 border border-white/10 p-6",
            tutorial.gradient
          )}
        >
          {/* Blobs decorativos */}
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 w-48 h-48 rounded-full bg-black/20 blur-3xl pointer-events-none" />

          {/* Topo: chip + fechar */}
          <div className="relative flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 border border-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              Novo por aqui
              <span className="opacity-70 font-semibold tracking-wide">
                · {tutorial.label}
              </span>
            </span>
            <button
              onClick={onClose}
              aria-label="Fechar tutorial"
              className="p-1.5 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Conteúdo do passo (anima a cada troca) */}
          <div
            key={step}
            className="relative flex flex-col items-center text-center py-5 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <div className="flex items-center justify-center">
              <div className="bg-white/15 border border-white/25 rounded-2xl p-3.5 shadow-lg backdrop-blur-md">
                <StepIcon className="w-8 h-8" />
              </div>
            </div>
            <h3 className="mt-4 text-xl font-extrabold leading-tight">
              {current.title}
            </h3>
            <p className="mt-2 text-sm text-white/85 leading-relaxed max-w-sm">
              {current.description}
            </p>
          </div>

          {/* Progresso */}
          <div className="relative flex items-center justify-center gap-1.5 mb-5">
            {tutorial.steps.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  idx === step
                    ? "w-7 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                    : idx < step
                      ? "w-2 bg-white/60"
                      : "w-1.5 bg-white/25"
                )}
              />
            ))}
          </div>

          {/* Ações */}
          <div className="relative flex items-center gap-2.5">
            <button
              onClick={prev}
              disabled={step === 0}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 rounded-xl px-3 py-3 text-sm font-semibold transition-colors",
                step === 0
                  ? "text-white/30 cursor-not-allowed"
                  : "bg-black/15 hover:bg-black/30"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </button>
            <button
              onClick={next}
              className="flex-[1.4] flex items-center justify-center gap-1.5 rounded-xl bg-white text-black px-3 py-3 text-sm font-bold shadow-lg hover:bg-gray-100 active:scale-[0.98] transition-all"
            >
              {isLast ? "Entendi, vamos lá!" : "Próximo"}
              {isLast ? (
                <Check className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}