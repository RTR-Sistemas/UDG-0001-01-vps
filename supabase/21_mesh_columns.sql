-- Migration: Rede Mesh-UDG — colunas de entrega DTN e contador de dados
-- Aplicar no Supabase Dashboard (SQL Editor) ou via CLI: npx supabase db push

-- Marca mensagens entregues através da malha Mesh-UDG (fila DTN / ponte internet)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS via_mesh boolean NOT NULL DEFAULT false;

-- Contador de bytes transmitidos na Rede Mesh-UDG por usuário (ranking)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mesh_data_sent_bytes bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.messages.via_mesh IS 'Mensagem entregue através da Rede Mesh-UDG (fila DTN/ponte internet)';
COMMENT ON COLUMN public.profiles.mesh_data_sent_bytes IS 'Total de bytes transmitidos na Rede Mesh-UDG';
