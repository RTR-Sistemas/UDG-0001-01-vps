import { supabase } from "@/integrations/supabase/client";
import { MONETIZACAO_ATIVA, exigirMonetizacaoAtiva } from "@/config/monetizacao";

export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export interface PixKey {
  id: string;
  user_id: string;
  key_value: string;
  key_type: PixKeyType;
  owner_name?: string | null;
  status: "pending" | "confirmed";
  is_default: boolean;
  confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export const PIX_TYPE_LABELS: Record<PixKeyType, string> = {
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "E-mail",
  PHONE: "Telefone",
  EVP: "Chave aleatória (EVP)",
};

export function pixKeyErrorMessage(code: string): string {
  const map: Record<string, string> = {
    chave_vazia: "Digite uma chave PIX.",
    chave_invalida: "Esta chave PIX não é válida. Confira o formato (CPF, CNPJ, e-mail, telefone com DDD ou chave aleatória do seu banco).",
    chave_invalida_email: "O e-mail informado não é válido para chave PIX.",
    chave_telefone_fora_brasil: "Só aceitamos chaves PIX de telefone brasileiro (+55).",
    chave_telefone_invalido: "Telefone inválido. Use DDD + número (ex.: 11 99999-9999).",
    chave_telefone_ddd_invalido: "DDD inválido.",
    chave_email_muito_longa: "O e-mail excede o limite de 77 caracteres do PIX.",
    chave_ja_cadastrada: "Esta chave PIX já está cadastrada na sua conta.",
    chave_em_uso_outro_usuario: "Esta chave PIX já está cadastrada em outra conta.",
    limite_chaves_atingido: "Você atingiu o limite de 3 chaves PIX. Remova uma para cadastrar outra.",
    chave_nao_encontrada: "Chave PIX não encontrada.",
    chave_ja_confirmada: "Esta chave PIX já está confirmada.",
    chave_nao_confirmada: "Confirme a chave PIX antes de usá-la.",
    codigo_nao_solicitado: "Solicite o código de confirmação primeiro.",
    codigo_expirado: "O código expirou. Solicite um novo.",
    codigo_invalido: "Código incorreto. Verifique e tente novamente.",
    codigo_muitas_tentativas: "Muitas tentativas. Solicite um novo código.",
    not_authenticated: "Sessão expirada. Faça login novamente.",
    pix_key_required: "Cadastre e confirme uma chave PIX para receber seu saque.",
  };
  return map[code] ?? "Não foi possível concluir. Tente novamente.";
}

export async function fetchMyPixKeys(): Promise<PixKey[]> {
  // Sem monetização não há saque, e sem saque não há por que guardar chave PIX
  // (que é dado pessoal: CPF, e-mail ou telefone). Ver LGPD, minimização.
  if (!MONETIZACAO_ATIVA) return [];
  const { data, error } = await supabase.rpc("get_my_pix_keys");
  if (error) throw error;
  return (data ?? []) as unknown as PixKey[];
}

export async function registerPixKey(key: string): Promise<PixKey> {
  exigirMonetizacaoAtiva("Cadastro de chave PIX");
  const { data, error } = await supabase.rpc("register_pix_key", { p_key: key });
  if (error) throw new Error(error.message);
  return data as unknown as PixKey;
}

export async function requestPixConfirmationCode(pixKeyId: string): Promise<{ delivery: string; expires_in_minutes: number; hint: string }> {
  exigirMonetizacaoAtiva("Confirmação de chave PIX");
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("not_authenticated");

  const res = await fetch("/api/pix-confirm-code", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pix_key_id: pixKeyId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || "pix_confirmation_error");
  return body;
}

export async function confirmPixKey(pixKeyId: string, code: string): Promise<boolean> {
  exigirMonetizacaoAtiva("Confirmação de chave PIX");
  const { data, error } = await supabase.rpc("confirm_pix_key", { p_key_id: pixKeyId, p_code: code });
  if (error) throw new Error(error.message);
  return Boolean((data as unknown as { ok?: boolean })?.ok);
}

export async function removePixKey(pixKeyId: string): Promise<void> {
  if (!MONETIZACAO_ATIVA) return;   // nada a remover: a lista já vem vazia
  const { error } = await supabase.rpc("delete_pix_key", { p_key_id: pixKeyId });
  if (error) throw new Error(error.message);
}

export async function setDefaultPixKey(pixKeyId: string): Promise<void> {
  if (!MONETIZACAO_ATIVA) return;
  const { error } = await supabase.rpc("set_default_pix_key", { p_key_id: pixKeyId });
  if (error) throw new Error(error.message);
}

export function maskPixKey(key: string, type: PixKeyType): string {
  switch (type) {
    case "EMAIL": {
      const [user, domain] = key.split("@");
      return `${user.slice(0, 2)}***@${domain}`;
    }
    case "EVP":
      return `${key.slice(0, 8)}-****-****-****-${key.slice(-12)}`;
    case "PHONE":
      return `+${key.slice(2, 4)}*****-${key.slice(-4)}`;
    case "CNPJ":
      return key.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "**.***.***/$4-**");
    case "CPF":
    default:
      return key.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "***.***.***-$4");
  }
}

export function detectPixKeyType(value: string): PixKeyType | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v.includes("@")) return "EMAIL";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)) return "EVP";
  if (/^\d{11}$/.test(v)) return "CPF";
  if (/^\d{14}$/.test(v)) return "CNPJ";
  if (/^\+?\d{10,13}$/.test(v.replace(/\D/g, "")) && v.replace(/\D/g, "").length >= 10) return "PHONE";
  return null;
}

export function formatPixInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length > 0 && digits.length <= 11) {
    const cpf = digits.slice(0, 11);
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  if (digits.length >= 10 && digits.length <= 13) {
    const phone = digits.length === 13 ? digits.slice(2) : digits.length === 12 ? digits.slice(2) : digits;
    if (phone.length === 11) {
      return phone.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    }
    return phone.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }
  return value;
}