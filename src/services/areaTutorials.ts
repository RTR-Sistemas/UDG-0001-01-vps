import type { LucideIcon } from "lucide-react";
import {
  Zap, Tv2, Gift, Trophy, Heart, Flame, Swords, Crown, Sparkles,
  Users, MessageCircle, ShieldCheck, Coins, Gem, QrCode, User, Bell,
  Search, TrendingUp, Bomb,
} from "lucide-react";
import { safeLocalStorage } from "@/utils/safeStorage";

export interface AreaTutorialStep {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface AreaTutorialDef {
  id: string;
  label: string;
  gradient: string;
  steps: AreaTutorialStep[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Registro de tutoriais por área. Adicione uma nova área e pronto:
// o tutorial abre automaticamente na primeira visita do usuário.
// ─────────────────────────────────────────────────────────────────────────────
export const AREA_TUTORIALS: AreaTutorialDef[] = [
  {
    id: "battles",
    label: "Batalhas Ao Vivo",
    gradient: "from-rose-600 via-red-600 to-orange-500",
    steps: [
      {
        title: "Desafie quem quiser",
        description:
          "Na aba Batalhas você vê os duelos ao vivo acontecendo agora e os convites que recebeu. Toque em “Criar” para desafiar qualquer membro.",
        icon: Zap,
      },
      {
        title: "Battle ao vivo",
        description:
          "Aceitou o desafio? A sala abre na hora, com entrada livre para a torcida assistir e participar ao vivo com você.",
        icon: Tv2,
      },
      {
        title: "Presentes valem pontos",
        description:
          "Durante os rounds, envie presentes com suas moedas. Cada apoio aumenta a força da sua equipe no placar.",
        icon: Gift,
      },
      {
        title: "Leve o prêmio",
        description:
          "Quem tiver mais pontos ao final vence e recebe as moedas da premiação direto na sua Carteira. Bora pra cima!",
        icon: Trophy,
      },
    ],
  },
  {
    id: "battle",
    label: "Batalha ao Vivo",
    gradient: "from-fuchsia-600 to-purple-800",
    steps: [
      {
        title: "Você está ao vivo",
        description:
          "Esta é a sala da batalha. Tudo acontece em tempo real: rounds, placar e a torcida reagindo com você.",
        icon: Tv2,
      },
      {
        title: "Mostre apoio",
        description:
          "Reaja e mande presents para reforçar o seu lado. O apoio do público é o que decide os rounds.",
        icon: Heart,
      },
      {
        title: "Fique de olho no PK",
        description:
          "A barra de força mostra quem está na frente a cada momento. Deixe a sua equipe acima até o fim.",
        icon: Flame,
      },
      {
        title: "Prêmio garantido",
        description:
          "Vencendo o duelo, as moedas da premiação caem na sua Carteira automaticamente. Sem burocracia.",
        icon: Coins,
      },
    ],
  },
  {
    id: "arena",
    label: "Arena",
    gradient: "from-red-600 to-rose-800",
    steps: [
      {
        title: "O ringue do UDG",
        description:
          "A Arena é onde acontecem os duelos de popularidade entre membros. Escolha seu lado e participe.",
        icon: Swords,
      },
      {
        title: "Vote de verdade",
        description:
          "Veja os combatentes e reaja com coração ou bomba. Cada reação vale um ponto no duelo.",
        icon: Heart,
      },
      {
        title: "Placar em tempo real",
        description:
          "A contagem atualiza na hora. Quando o tempo acabar, quem tiver mais apoio vence o duelo.",
        icon: TrendingUp,
      },
      {
        title: "Construa reputação",
        description:
          "Vitórias na Arena aumentam sua fama e te empurram para o topo dos rankings da comunidade.",
        icon: Trophy,
      },
    ],
  },
  {
    id: "rankings",
    label: "Ranking",
    gradient: "from-yellow-500 to-orange-600",
    steps: [
      {
        title: "O pódio da comunidade",
        description:
          "O Ranking reúne os destaques do UDG: os mais amados e os que mais movimentam a galera.",
        icon: Trophy,
      },
      {
        title: "Rei-UDG",
        description:
          "O topo mostra quem recebeu mais corações. Cada ❤️ recebido nos seus posts conta para a coroa.",
        icon: Crown,
      },
      {
        title: "Bombados",
        description:
          "Tem também o ranking dos mais polêmicos: quem recebe mais 💣 aparece por aqui em destaque.",
        icon: Bomb,
      },
      {
        title: "Alcance o topo",
        description:
          "Domine as interações, acumule pontos e garanta seu lugar no topo da comunidade.",
        icon: Sparkles,
      },
    ],
  },
  {
    id: "communities",
    label: "Comunidades",
    gradient: "from-amber-500 to-orange-700",
    steps: [
      {
        title: "Encontre sua tribo",
        description:
          "Comunidades são grupos por interesse: música, games, esportes e muito mais. Explore e entre nas que combinam com você.",
        icon: Users,
      },
      {
        title: "Participe dos tópicos",
        description:
          "Publique, comente e reaja nos fóruns. Quanto mais você participa, mais visibilidade ganha no grupo.",
        icon: MessageCircle,
      },
      {
        title: "Ambiente seguro",
        description:
          "Cada comunidade tem moderação e regras claras para todo mundo se divertir com respeito.",
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: "wallet",
    label: "Carteira",
    gradient: "from-emerald-600 to-teal-700",
    steps: [
      {
        title: "Suas moedas",
        description:
          "Moedas compram presents nas batalhas. Ganhe participando, vencendo duelos e aproveitando as premiações.",
        icon: Coins,
      },
      {
        title: "Diamantes valem dinheiro",
        description:
          "Diamantes são a moeda de saque do UDG: cada 1💎 vale R$ 0,05. Quanto mais diamantes, mais você pode sacar.",
        icon: Gem,
      },
      {
        title: "Saques via PIX",
        description:
          "Cadastre e confirme sua chave PIX em Ajustes, escolha o valor (mínimo 200💎) e o dinheiro cai direto na sua conta.",
        icon: QrCode,
      },
    ],
  },
  {
    id: "settings",
    label: "Ajustes",
    gradient: "from-slate-700 to-slate-900",
    steps: [
      {
        title: "Sua conta",
        description:
          "Edite avatar, nome e os dados do seu perfil aqui.",
        icon: User,
      },
      {
        title: "Chave PIX",
        description:
          "Cadastre e confirme sua chave PIX para receber todos os prêmios e saques com segurança total.",
        icon: QrCode,
      },
      {
        title: "Privacidade e notificações",
        description:
          "Controle alertas, quem pode interagir com você e as preferências do app em um só lugar.",
        icon: Bell,
      },
    ],
  },
  {
    id: "profile",
    label: "Seu Perfil",
    gradient: "from-sky-600 to-indigo-700",
    steps: [
      {
        title: "Sua vitrine",
        description:
          "Seu perfil é o seu cartão de visitas: avatar, bio, estatísticas e atividades públicas.",
        icon: User,
      },
      {
        title: "Sua reputação",
        description:
          "Acompanhe os corações e bombas que você recebe da comunidade em tempo real.",
        icon: Heart,
      },
      {
        title: "Código de Amigo",
        description:
          "Compartilhe seu código UDG e ganhe moedas quando convidados entrarem na plataforma.",
        icon: Gift,
      },
    ],
  },
  {
    id: "news",
    label: "Notificações",
    gradient: "from-indigo-600 to-blue-800",
    steps: [
      {
        title: "Tudo em um lugar",
        description:
          "Convites de batalha, novas mensagens, prêmios e comunicados da plataforma chegam aqui.",
        icon: Bell,
      },
      {
        title: "Ação rápida",
        description:
          "Toque na notificação para ir direto para onde ela aconteceu. Nada de procurar no escuro.",
        icon: Zap,
      },
    ],
  },
  {
    id: "explore",
    label: "Buscar",
    gradient: "from-emerald-500 to-cyan-700",
    steps: [
      {
        title: "Descubra perfis",
        description:
          "Procure pessoas pelo nome ou @ e encontre o que está rolando no UDG.",
        icon: Search,
      },
      {
        title: "O que está em alta",
        description:
          "A aba de tendências mostra os posts mais comentados e curtidos da comunidade.",
        icon: Flame,
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento rota → tutorial (estado interno, não persistido)
// ─────────────────────────────────────────────────────────────────────────────
const AREA_ROUTE_MAP: Record<string, string> = {
  "/battles": "battles",
  "/arena": "arena",
  "/rankings": "rankings",
  "/communities": "communities",
  "/explore": "explore",
  "/profile": "profile",
  "/wallet": "wallet",
  "/news": "news",
  "/settings": "settings",
};

export function getAreaTutorial(areaId: string): AreaTutorialDef | undefined {
  return AREA_TUTORIALS.find((t) => t.id === areaId);
}

export function getAreaForPath(path: string): string | null {
  if (path.startsWith("/battle/")) return "battle";
  return AREA_ROUTE_MAP[path] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistência: uma visita por área, por usuário (por aparelho)
// Chave: udg_area_tutorials_v1:<userId>  →  ["battles", "wallet", ...]
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_PREFIX = "udg_area_tutorials_v1";

function readSeen(userId: string): string[] {
  try {
    const raw = safeLocalStorage.getItem(`${STORAGE_PREFIX}:${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSeen(userId: string, seen: string[]) {
  try {
    safeLocalStorage.setItem(`${STORAGE_PREFIX}:${userId}`, JSON.stringify(seen));
  } catch {
    // armazenamento indisponível: tutoriais reexibirão na próxima visita
  }
}

export function isTutorialPending(areaId: string, userId: string): boolean {
  return !readSeen(userId).includes(areaId);
}

export function markTutorialSeen(areaId: string, userId: string) {
  const seen = readSeen(userId);
  if (!seen.includes(areaId)) {
    seen.push(areaId);
    writeSeen(userId, seen);
  }
}