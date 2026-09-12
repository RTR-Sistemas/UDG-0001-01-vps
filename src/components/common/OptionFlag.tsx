/**
 * =============================================================================
 * File: src/components/common/OptionFlag.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import React from "react";
import { cn } from "@/lib/utils";
import { getPartyLogoUrl, getTeamLogoUrl, makeAcronym, stableHue } from "@/utils/profileOptions";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type FlagKind = "team" | "party";

type OptionFlagProps = {
  label: string;
  kind: FlagKind;
  size?: number;
  className?: string;
};

/**
 * Logo/"bandeirinha" para opções do perfil.
 *
 * - Para Times/Partidos: tenta carregar um logo oficial (CDN/Wikimedia).
 * - Se falhar, faz fallback para o badge com acrônimo (não quebra a UI).
 */
export function OptionFlag({ label, kind, size = 18, className }: OptionFlagProps) {
  const logoUrl = kind === "team" ? getTeamLogoUrl(label) : getPartyLogoUrl(label);
  const [imgFailed, setImgFailed] = React.useState(false);

  const acr = makeAcronym(label, kind === "party" ? 4 : 3);
  const hue = stableHue(`${kind}:${label}`);
  const c1 = `hsl(${hue} 75% 45%)`;
  const c2 = `hsl(${(hue + 28) % 360} 75% 35%)`;

  const rounded = kind === "team" ? "rounded-full" : "rounded-sm";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center border border-foreground/10 overflow-hidden select-none bg-background",
        rounded,
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {logoUrl && !imgFailed ? (
        <img
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          className={cn("block", rounded)}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          className={cn("inline-flex items-center justify-center w-full h-full", rounded)}
          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        >
          <span
            className="text-white font-bold leading-none"
            style={{
              fontSize: Math.max(9, Math.floor(size / 3.2)),
              letterSpacing: "0.02em",
            }}
          >
            {acr}
          </span>
        </span>
      )}
    </span>
  );
}

export function TeamFlag(props: Omit<OptionFlagProps, "kind">) {
  return <OptionFlag {...props} kind="team" />;
}

export function PartyFlag(props: Omit<OptionFlagProps, "kind">) {
  return <OptionFlag {...props} kind="party" />;
}
