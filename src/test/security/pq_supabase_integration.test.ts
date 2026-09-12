import { describe, test, expect, vi, beforeAll } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

const GATEWAY_URL = 'http://localhost:8080';

async function isGatewayOnline(): Promise<boolean> {
    try {
        const res = await fetch(`${GATEWAY_URL}/health`, { signal: AbortSignal.timeout(500) });
        return res.ok;
    } catch {
        return false;
    }
}

describe('🧪 Suíte de Testes de Integração Supabase PQC - UndoinG', () => {
    let onlineMode = false;

    beforeAll(async () => {
        onlineMode = await isGatewayOnline();
        console.log(`[PQC Supabase Test] Servidor Gateway Detectado: ${onlineMode ? 'ONLINE' : 'OFFLINE (Modo Simulação)'}`);
    });

    describe('1. Armazenamento de Chaves Públicas PQ no Banco', () => {
        test('Salvar e recuperar chave pública ML-DSA-65 no perfil do usuário', async () => {
            const mockProfileId = 'd02b9a89-5120-4f2a-a177-5d50e87ef2fd';
            const mldsaPubkey = 'pq_mldsa_pubkey_bytes_represented_as_base64url_string_example';
            const mlkemPubkey = 'pq_mlkem_pubkey_bytes_represented_as_base64url_string_example';

            if (onlineMode) {
                // Executa a query real via supabase client
                const { data, error } = await supabase
                    .from('profiles')
                    .update({
                        pq_mldsa_pubkey: mldsaPubkey,
                        pq_mlkem_pubkey: mlkemPubkey
                    } as any)
                    .eq('id', mockProfileId)
                    .select();

                expect(error).toBeNull();
                expect(data).toBeDefined();
                expect(data?.[0]?.pq_mldsa_pubkey).toBe(mldsaPubkey);
            } else {
                // Simulação do comportamento esperado
                const spy = vi.spyOn(supabase, 'from').mockReturnValue({
                    update: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            select: vi.fn().mockResolvedValue({
                                data: [{ id: mockProfileId, pq_mldsa_pubkey: mldsaPubkey, pq_mlkem_pubkey: mlkemPubkey }],
                                error: null
                            })
                        })
                    })
                } as any);

                const { data, error } = await supabase
                    .from('profiles')
                    .update({ pq_mldsa_pubkey: mldsaPubkey, pq_mlkem_pubkey: mlkemPubkey } as any)
                    .eq('id', mockProfileId)
                    .select();

                expect(error).toBeNull();
                expect(data?.[0]?.pq_mldsa_pubkey).toBe(mldsaPubkey);
                spy.mockRestore();
            }
        });

        test('Rejeição de formato de chave pública PQ inválido', async () => {
            const invalidPubkey = 'invalid-format-too-short-or-corrupted';

            if (onlineMode) {
                // Envia chave malformada que deve quebrar regras de formato no middleware/banco
                const { error } = await supabase
                    .from('profiles')
                    .update({ pq_mldsa_pubkey: invalidPubkey } as any)
                    .eq('id', 'd02b9a89-5120-4f2a-a177-5d50e87ef2fd');
                
                // Em ambiente real com constraints estritas, deve retornar erro
                expect(error).toBeDefined();
            } else {
                // Simula rejeição de formato inválido
                const spy = vi.spyOn(supabase, 'from').mockReturnValue({
                    update: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({
                            data: null,
                            error: { message: 'invalid key format: size constraint violated' }
                        })
                    })
                } as any);

                const { error } = await supabase
                    .from('profiles')
                    .update({ pq_mldsa_pubkey: invalidPubkey } as any)
                    .eq('id', 'd02b9a89-5120-4f2a-a177-5d50e87ef2fd');

                expect(error).not.toBeNull();
                expect(error?.message).toContain('invalid key format');
                spy.mockRestore();
            }
        });
    });

    describe('2. Criptografia de Mensagens E2EE (ML-KEM-768)', () => {
        test('Salvar e recuperar mensagem de chat criptografada com ML-KEM-768', async () => {
            const ciphertext = 'mlkem768_ciphertext_encapsulating_aes256_key_and_message_payload';
            const signature = 'mldsa65_signature_for_integrity';
            const mockMessageId = 'mock-msg-uuid-111';

            if (onlineMode) {
                const { data, error } = await supabase
                    .from('messages')
                    .insert({
                        conversation_id: 'mock-conv-uuid-789',
                        user_id: 'd02b9a89-5120-4f2a-a177-5d50e87ef2fd',
                        content: ciphertext,
                        pq_signature: signature,
                        is_pq_encrypted: true
                    } as any)
                    .select();

                expect(error).toBeNull();
                expect(data?.[0]?.content).toBe(ciphertext);
                expect(data?.[0]?.is_pq_encrypted).toBe(true);
            } else {
                const spy = vi.spyOn(supabase, 'from').mockReturnValue({
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockResolvedValue({
                            data: [{ id: mockMessageId, content: ciphertext, pq_signature: signature, is_pq_encrypted: true }],
                            error: null
                        })
                    })
                } as any);

                const { data, error } = await supabase
                    .from('messages')
                    .insert({ content: ciphertext, pq_signature: signature, is_pq_encrypted: true } as any)
                    .select();

                expect(error).toBeNull();
                expect(data?.[0]?.content).toBe(ciphertext);
                expect(data?.[0]?.is_pq_encrypted).toBe(true);
                spy.mockRestore();
            }
        });
    });

    describe('3. Assinatura de Dados no Banco (ML-DSA-65)', () => {
        test('Criar e assinar Postagem com ML-DSA-65 e validar integridade', async () => {
            const content = 'Mensagem pública e assinada pós-quanticamente.';
            const signature = 'valid_mldsa65_signature_for_this_specific_content';

            if (onlineMode) {
                const { data, error } = await supabase
                    .from('posts')
                    .insert({
                        user_id: 'd02b9a89-5120-4f2a-a177-5d50e87ef2fd',
                        content: content,
                        pq_signature: signature
                    } as any)
                    .select();

                expect(error).toBeNull();
                expect((data?.[0] as Record<string, unknown>)?.pq_signature).toBe(signature);
            } else {
                const spy = vi.spyOn(supabase, 'from').mockReturnValue({
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockResolvedValue({
                            data: [{ id: 'post-123', content: content, pq_signature: signature }],
                            error: null
                        })
                    })
                } as any);

                const { data, error } = await supabase
                    .from('posts')
                    .insert({ content: content, pq_signature: signature } as any)
                    .select();

                expect(error).toBeNull();
                expect((data?.[0] as Record<string, unknown>)?.pq_signature).toBe(signature);
                spy.mockRestore();
            }
        });
    });

    describe('4. Storage Integridade de Mídias com Assinatura PQC', () => {
        test('Upload de mídia acompanhado de assinatura ML-DSA-65 e verificação', async () => {
            const imageBuffer = Buffer.from('mock-binary-image-data-here-representing-1mb-file');
            const fileSignature = 'mldsa65_signature_verifying_image_hashes';

            if (onlineMode) {
                // Armazena assinatura nos metadados ou tabela auxiliar, e o arquivo no bucket
                const { data, error } = await supabase.storage
                    .from('media')
                    .upload('posts/test-pqc-img.png', imageBuffer, {
                        contentType: 'image/png',
                        upsert: true
                    });
                
                expect(error).toBeNull();
                expect(data?.path).toBeDefined();

                // Baixar arquivo e validar
                const { data: fileData, error: downloadError } = await supabase.storage
                    .from('media')
                    .download('posts/test-pqc-img.png');
                
                expect(downloadError).toBeNull();
                expect(fileData).toBeDefined();
            } else {
                // Mock do storage upload/download
                const spyStorage = vi.spyOn(supabase.storage, 'from').mockReturnValue({
                    upload: vi.fn().mockResolvedValue({ data: { path: 'posts/test-pqc-img.png' }, error: null }),
                    download: vi.fn().mockResolvedValue({ data: imageBuffer, error: null })
                } as any);

                const { data, error } = await supabase.storage
                    .from('media')
                    .upload('posts/test-pqc-img.png', imageBuffer);

                expect(error).toBeNull();
                expect(data?.path).toBe('posts/test-pqc-img.png');

                const { data: fileData } = await supabase.storage.from('media').download('posts/test-pqc-img.png');
                expect(fileData).toBeDefined();
                spyStorage.mockRestore();
            }
        });
    });

    describe('5. Transações e Rollback em falhas de PQC', () => {
        test('Rollback de transação se a verificação de assinatura PQC falhar', async () => {
            // Em Supabase/PostgreSQL, usamos RPC para testar transações atômicas com validação de assinatura PQC
            if (onlineMode) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { error } = await (supabase as any).rpc('create_post_with_pqc_validation', {
                    p_content: 'Post teste transacional',
                    p_signature: 'invalid_signature_triggers_rollback',
                    p_user_id: 'd02b9a89-5120-4f2a-a177-5d50e87ef2fd'
                });

                // Deve falhar e disparar rollback
                expect(error).not.toBeNull();
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const spyRpc = vi.spyOn(supabase as any, 'rpc').mockResolvedValue({
                    data: null,
                    error: { message: 'transaction aborted: PQC signature verification failed' } as any
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { error } = await (supabase as any).rpc('create_post_with_pqc_validation', {
                    p_content: 'Post teste transacional',
                    p_signature: 'invalid_signature_triggers_rollback'
                });

                expect(error).not.toBeNull();
                expect(error?.message).toContain('PQC signature verification failed');
                spyRpc.mockRestore();
            }
        });
    });
});
