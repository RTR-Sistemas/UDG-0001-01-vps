import { Medal } from "lucide-react";
import { cn } from "@/lib/utils";

interface GoldSealProps {
  registrationNumber: number | null | undefined;
  className?: string;
  showNumber?: boolean;
  size?: "sm" | "md";
}

/**
 * Selo dourado de membro fundador (100 primeiros cadastros).
 * Exibido ao lado do nome de usuário, estilo "verificado" do Instagram.
 */
export function GoldSeal({ registrationNumber, className, showNumber = true, size = "sm" }: GoldSealProps) {
  if (!registrationNumber || registrationNumber < 1 || registrationNumber > 100) {
    return null;
  }

  const iconSize = size === "md" ? "h-4 w-4" : "h-3 w-3";
  const badgeSize = size === "md" ? "h-6 w-6" : "h-4.5 w-4.5";

  return (
    <span className={cn("inline-flex items-center gap-1 align-middle select-none", className)}>
      <span
        className={cn(
          "relative inline-flex items-center justify-center rounded-full",
          badgeSize,
          "bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600",
          "ring-1 ring-amber-300/70 shadow-[0_0_6px_rgba(251,191,36,0.6)]"
        )}
        title={`Membro Fundador UDG · Cadastro #${registrationNumber}`}
      >
        <Medal className={cn(iconSize, "text-white drop-shadow-[0_1px_1px_rgba(120,53,15,0.7)]")} strokeWidth={2.5} />
      </span>
      {showNumber && (
        <span className="text-[10px] font-black tracking-tight text-amber-500 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 rounded-full px-1.5 py-px border border-amber-300/50 dark:border-amber-400/30 leading-none">
          {registrationNumber}
        </span>
      )}
    </span>
  );
}
