import React from "react";
import { Globe, Search, Lock, Users, Swords, Zap, Newspaper, User, Smartphone } from "lucide-react";

export type MobileTutorialStepItem = {
    id: number;
    title: string;
    description: string;
    icon: React.ReactNode;
    route: string;
    gradient: string;
};

export const MOBILE_TUTORIAL_STEPS: MobileTutorialStepItem[] = [
    {
        id: 1,
        title: "Bem-vindo ao UndoinG! 🎉",
        description: "Prepare-se para uma experiência única. Vamos fazer um tour super rápido pelas telas principais para você não perder nada.",
        icon: <Globe className="h-10 w-10 text-white" />,
        route: "/",
        gradient: "from-violet-600 to-purple-800",
    },
    {
        id: 2,
        title: "World-Flow 🌍",
        description: "Seu feed principal! Veja postagens, vídeos virais (Clips), reaja com corações ❤️ ou bombas 💣 e interaja com a comunidade.",
        icon: <Globe className="h-10 w-10 text-white" />,
        route: "/",
        gradient: "from-blue-600 to-cyan-700",
    },
    {
        id: 3,
        title: "Buscar 🔍",
        description: "Encontre novos perfis, conteúdos em alta e o que as pessoas estão comentando. É o lugar perfeito para descobrir novidades.",
        icon: <Search className="h-10 w-10 text-white" />,
        route: "/explore",
        gradient: "from-emerald-600 to-teal-700",
    },
    {
        id: 4,
        title: "Chat Privado 💬",
        description: "Suas conversas diretas. Envie áudios, imagens, figurinhas e use nossas mensagens com timer autodestrutivo (estilo Snap) para mais privacidade.",
        icon: <Lock className="h-10 w-10 text-white" />,
        route: "/messages",
        gradient: "from-pink-600 to-rose-800",
    },
    {
        id: 5,
        title: "Comunidades 👥",
        description: "As comunidades do UndoinG! Junte-se a grupos focados nos seus interesses, discuta em fóruns e conecte-se com sua tribo.",
        icon: <Users className="h-10 w-10 text-white" />,
        route: "/communities",
        gradient: "from-amber-500 to-orange-700",
    },
    {
        id: 6,
        title: "Arena ⚔️",
        description: "Competições divertidas entre os membros. Vote nos duelos, veja quem ganha disputas de popularidade e muito mais.",
        icon: <Swords className="h-10 w-10 text-white" />,
        route: "/arena",
        gradient: "from-red-600 to-rose-900",
    },
    {
        id: 7,
        title: "Rankings 🏆",
        description: "Descubra quem são os mais amados (Rei-UDG) e os que mais dividem opiniões (Bombados). Que suba o melhor!",
        icon: <Zap className="h-10 w-10 text-white" />,
        route: "/rankings",
        gradient: "from-yellow-400 to-orange-600",
    },
    {
        id: 8,
        title: "Notificador 📰",
        description: "Fique por dentro de todos os alertas do sistema, comunicados e do que acontece com suas postagens.",
        icon: <Newspaper className="h-10 w-10 text-white" />,
        route: "/news",
        gradient: "from-indigo-600 to-blue-800",
    },
    {
        id: 9,
        title: "Seu Perfil 👤",
        description: "Monte sua vitrine! Mostre suas vitórias, configure seus dados e compartilhe seu Código de Amigo (UDG) para novas conexões.",
        icon: <User className="h-10 w-10 text-white" />,
        route: "/profile",
        gradient: "from-slate-700 to-slate-900",
    },
    {
        id: 10,
        title: "Instale o App (PWA) 📱",
        description: "Para a melhor experiência, adicione o UndoinG à tela inicial (via menu do navegador). Curta agora todas as funções!",
        icon: <Smartphone className="h-10 w-10 text-white" />,
        route: "/",
        gradient: "from-fuchsia-600 to-purple-900",
    },
];
