import { BellRing, Camera, MapPin, Mic } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type PermissionType = "notifications" | "microphone" | "camera" | "location";
export type PermissionStatus = "granted" | "denied" | "prompt" | "unsupported";

export interface PermissionMeta {
  title: string;
  shortTitle: string;
  description: string;
  benefits: string[];
  deniedHint: string;
  icon: LucideIcon;
}

export const PERMISSION_META: Record<PermissionType, PermissionMeta> = {
  notifications: {
    title: "Receba mensagens em tempo real",
    shortTitle: "Notificações",
    description:
      "Para você nunca perder uma mensagem, chamada ou resposta, a Undoing precisa enviar notificações — mesmo quando o app estiver em segundo plano ou fechado.",
    benefits: [
      "Mensagens e respostas chegando na hora",
      "Alertas de chamadas e atenção",
      "Avisos de comunidades e atualizações",
    ],
    deniedHint:
      "As notificações estão bloqueadas no navegador. Clique no ícone de cadeado na barra de endereço → Permissões → Notificações → Permitir. Depois, recarregue a página e tente novamente.",
    icon: BellRing,
  },
  microphone: {
    title: "Libere o acesso ao microfone",
    shortTitle: "Microfone",
    description:
      "O microfone é usado para enviar mensagens de voz, fazer chamadas de voz e participar de chamadas de vídeo.",
    benefits: [
      "Enviar mensagens de voz no chat",
      "Fazer chamadas de voz e vídeo",
      "Tradução e dublagem automática de áudios",
    ],
    deniedHint:
      "O microfone está bloqueado no navegador. Clique no ícone de cadeado na barra de endereço → Permissões → Microfone → Permitir. Depois, recarregue a página e tente novamente.",
    icon: Mic,
  },
  camera: {
    title: "Libere o acesso à câmera",
    shortTitle: "Câmera",
    description:
      "A câmera é usada para tirar fotos e gravar vídeos que você envia no chat e nas publicações, além de participar de chamadas de vídeo.",
    benefits: [
      "Tirar fotos e gravar vídeos na hora",
      "Enviar fotos e vídeos no chat",
      "Participar de chamadas de vídeo",
    ],
    deniedHint:
      "A câmera está bloqueada no navegador. Clique no ícone de cadeado na barra de endereço → Permissões → Câmera → Permitir. Depois, recarregue a página e tente novamente.",
    icon: Camera,
  },
  location: {
    title: "Compartilhe sua localização quando quiser",
    shortTitle: "Localização",
    description:
      "A localização é usada para compartilhar sua posição nas conversas, ver o clima da sua região e ativar o status de movimento. Você decide quando e o que compartilhar.",
    benefits: [
      "Enviar sua localização no chat",
      "Ver o clima da sua região",
      "Status de movimento (caminhada e corrida)",
    ],
    deniedHint:
      "A localização está bloqueada no navegador. Clique no ícone de cadeado na barra de endereço → Permissões → Localização → Permitir. Depois, recarregue a página e tente novamente.",
    icon: MapPin,
  },
};

const PERMISSION_NAMES: Record<PermissionType, PermissionName> = {
  notifications: "notifications",
  microphone: "microphone",
  camera: "camera",
  location: "geolocation",
};

export async function getPermissionStatus(type: PermissionType): Promise<PermissionStatus> {
  try {
    if (type === "notifications") {
      if (typeof window === "undefined" || typeof Notification === "undefined") {
        return "unsupported";
      }
      const permission = Notification.permission;
      if (permission === "granted") return "granted";
      if (permission === "denied") return "denied";
      return "prompt";
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.permissions ||
      typeof navigator.permissions.query !== "function"
    ) {
      return "prompt";
    }

    const status = await navigator.permissions.query({ name: PERMISSION_NAMES[type] });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "prompt";
  } catch {
    return "prompt";
  }
}

export async function requestNativePermission(type: PermissionType): Promise<boolean> {
  try {
    switch (type) {
      case "notifications": {
        if (typeof Notification === "undefined") return false;
        const result = await Notification.requestPermission();
        return result === "granted";
      }
      case "microphone": {
        if (!navigator.mediaDevices?.getUserMedia) return false;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      }
      case "camera": {
        if (!navigator.mediaDevices?.getUserMedia) return false;
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      }
      case "location": {
        if (!navigator.geolocation) return false;
        return await new Promise<boolean>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false),
            { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 }
          );
        });
      }
    }
  } catch {
    return false;
  }
}

export function isIosPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator?.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua);
  if (!isIos) return true;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  return standalone || (navigator as any).standalone === true;
}
