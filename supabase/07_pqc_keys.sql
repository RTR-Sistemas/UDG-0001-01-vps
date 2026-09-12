-- Migration: Add fields for Post-Quantum Cryptography (PQC) keys and signatures
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pq_mldsa_pubkey text,
ADD COLUMN IF NOT EXISTS pq_mlkem_pubkey text;

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS pq_signature text;

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS pq_signature text,
ADD COLUMN IF NOT EXISTS is_pq_encrypted boolean DEFAULT false;
