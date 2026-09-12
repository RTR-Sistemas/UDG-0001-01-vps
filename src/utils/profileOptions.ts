/**
 * =============================================================================
 * File: src/utils/profileOptions.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

// Opções e helpers de perfil.

// O app agora usa "Gênero" (substitui "Sexualidade" na UI).
// Mantemos compatibilidade: caso algum dado antigo exista em `sexual_orientation`,
// a UI faz fallback para não quebrar perfis existentes.

export const genderOptions = [
  "Prefiro não informar",
  "Masculino",
  "Feminino",
  "Não-binário",
  "Transmasculino",
  "Transfeminino",
  "Gênero fluido",
  "Agênero",
  "Intersexo",
  "Outro",
] as const;

// Compatibilidade (código antigo pode importar este nome)
export const sexualOrientationOptions = genderOptions;

export const relationshipStatusOptions = [
  "Prefiro não informar",
  "Solteiro(a)",
  "Namorando",
  "Noivo(a)",
  "Casado(a)",
  "Em união estável",
  "Separado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "Relacionamento aberto",
  "Complicado",
] as const;

// Série A (lista prática para seleção no app; pode ser ajustada conforme a temporada)
export const brazilSerieATeams = [
  "Athletico-PR",
  "Atlético-MG",
  "Bahia",
  "Botafogo",
  "Bragantino",
  "Corinthians",
  "Cruzeiro",
  "Flamengo",
  "Fluminense",
  "Fortaleza",
  "Grêmio",
  "Internacional",
  "Palmeiras",
  "Santos",
  "São Paulo",
  "Vasco",
  "Vitória",
  "Cuiabá",
  "Goiás",
  "Ceará",
] as const;

// Partidos políticos (lista completa/prática; pode ser atualizada conforme mudanças do TSE)
export const brazilPoliticalParties = [
  "Prefiro não informar",
  "MDB",
  "PDT",
  "PT",
  "PCdoB",
  "PSB",
  "PSDB",
  "AGIR",
  "MOBILIZA",
  "CIDADANIA",
  "PV",
  "AVANTE",
  "PP",
  "PSTU",
  "PCB",
  "PRTB",
  "DC",
  "PCO",
  "PODE",
  "REPUBLICANOS",
  "PSOL",
  "PL",
  "PSD",
  "SOLIDARIEDADE",
  "NOVO",
  "REDE",
  "O DEMOCRATA",
  "UP",
  "UNIÃO",
  "PRD",
  "MISSÃO",
] as const;

export function makeAcronym(name: string, max = 3) {
  const cleaned = name
    .replace(/\(.*?\)/g, " ")
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9 ]/g, " ")
    .trim();
  if (!cleaned) return "";

  // Se já é uma sigla curta, retorna.
  if (cleaned.length <= max && cleaned.toUpperCase() === cleaned) return cleaned;

  const parts = cleaned.split(/\s+/).filter(Boolean);
  const fromParts = parts
    .filter((p) => p.toUpperCase() !== "DO" && p.toUpperCase() !== "DA" && p.toUpperCase() !== "DE" && p.toUpperCase() !== "DOS" && p.toUpperCase() !== "DAS")
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (fromParts || cleaned.slice(0, max)).slice(0, max).toUpperCase();
}

export function stableHue(input: string) {
  // Gera um hue (0-359) estável a partir do texto.
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

// =============================
// Logos oficiais (Times/Partidos)
// =============================

const commonsFile = (fileName: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;

const curitibaParty = (fileName: string) =>
  `https://www.curitiba.pr.leg.br/vereadores/imagens/logos-partidos/${encodeURIComponent(fileName)}/download`;

// Times (Série A) — logos do Wikimedia Commons (ou Wikipedia quando necessário)
const TEAM_LOGOS: Record<string, string> = {
  "Athletico-PR": commonsFile("Athletico Paranaense.svg"),
  "Atlético-MG": commonsFile("Clube Atlético Mineiro crest.svg"),
  Bahia: commonsFile("Esporte Clube Bahia logo.svg"),
  Botafogo: commonsFile("Escudo_Botafogo.png"),
  Bragantino: commonsFile("Red-bull-bragantino.svg"),
  Corinthians: "https://upload.wikimedia.org/wikipedia/en/1/1f/Sport_Club_Corinthians_Paulista_Logo.png",
  Cruzeiro: commonsFile("Cruzeiro_Esporte_Clube_logo.svg"),
  Flamengo: commonsFile("Clube_de_Regatas_do_Flamengo_logo.svg"),
  Fluminense: commonsFile("Fluminense_Football_Club_logo.svg"),
  Fortaleza: commonsFile("Fortaleza_Esporte_Clube_logo.svg"),
  Grêmio: commonsFile("Grêmio_Foot-Ball_Porto_Alegrense_logo.svg"),
  Internacional: commonsFile("Sport_Club_Internacional_logo.svg"),
  Palmeiras: commonsFile("Palmeiras_logo.svg"),
  Santos: commonsFile("Santos_Futebol_Clube_logo.svg"),
  "São Paulo": commonsFile("Brasao_do_Sao_Paulo_Futebol_Clube.svg"),
  Vasco: commonsFile("Vasco da Gama.svg"),
  Vitória: commonsFile("Esporte_Clube_Vitória_(2024).svg"),
  Cuiabá: commonsFile("Cuiabá_EC.svg"),
  Goiás: commonsFile("Goiás_EC_2021.svg"),
  Ceará: commonsFile("Ceará_Sporting_Club_logo.svg"),
};

// Partidos — preferimos os logos oficiais já organizados pela Câmara de Curitiba.
// Quando não há arquivo lá, usamos o Wikimedia Commons.
const PARTY_LOGOS: Record<string, string> = {
  MDB: curitibaParty("mdblogopartido_100_72.png"),
  PDT: curitibaParty("logopdt.png"),
  PT: curitibaParty("logopt.png"),
  PCdoB: commonsFile("PCdoB logo.svg"),
  PSB: curitibaParty("logopsb.png"),
  PSDB: curitibaParty("PSDB_170_bom.png"),
  AGIR: curitibaParty("logoagir.png"),
  MOBILIZA: commonsFile("PMN logo.svg"),
  CIDADANIA: curitibaParty("logocidadania.png"),
  PV: curitibaParty("logopv.png"),
  AVANTE: commonsFile("AVANTE Brazil Logo.png"),
  PP: curitibaParty("logopp.png"),
  PSTU: commonsFile("PSTU logo.svg"),
  PCB: commonsFile("Partido Comunista Brasileiro logo.svg"),
  PRTB: curitibaParty("logoprtb.png"),
  DC: curitibaParty("logodc.png"),
  PCO: commonsFile("PCO logo.svg"),
  PODE: curitibaParty("logopodemos.png"),
  REPUBLICANOS: curitibaParty("logorepublicanos.png"),
  PSOL: curitibaParty("logopsol.png"),
  PL: curitibaParty("logopl.png"),
  PSD: curitibaParty("logopsd.png"),
  SOLIDARIEDADE: curitibaParty("logosolidariedade.png"),
  NOVO: curitibaParty("logonovo.png"),
  REDE: curitibaParty("logorede.png"),
  "O DEMOCRATA": curitibaParty("logodem.png"),
  UP: commonsFile("Unidade Popular logo.svg"),
  UNIÃO: curitibaParty("logouniao.png"),
  PRD: curitibaParty("logoprd.png"),
  MISSÃO: commonsFile("Bandeira do Partido Missão.svg"),
};

export function getTeamLogoUrl(label: string) {
  return TEAM_LOGOS[label];
}

export function getPartyLogoUrl(label: string) {
  return PARTY_LOGOS[label];
}
