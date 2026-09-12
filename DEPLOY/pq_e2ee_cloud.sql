-- UndoinG: E2EE pós-quântica (ML-KEM-768 + ML-DSA-65 + AES-256-GCM)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pq_mldsa_pubkey text,
ADD COLUMN IF NOT EXISTS pq_mlkem_pubkey text,
ADD COLUMN IF NOT EXISTS pq_mldsa_sig text;

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS pq_signature text,
ADD COLUMN IF NOT EXISTS is_pq_encrypted boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS messages_conv_created_idx ON public.messages (conversation_id, created_at);