# Relatório de Conformidade e Vulnerabilidades — UndoinG

Este relatório apresenta uma análise crítica de segurança baseada na estrutura de microsserviços Go e no cliente React da plataforma **UndoinG**, com foco em riscos inerentes e arquitetura de rede social, juntamente com o plano de ação (Roadmap) para migração rumo a um estado **Quantum-Safe** e em conformidade com a LGPD.

---

## 1. Relatório de Vulnerabilidades Atuais e Riscos Inerentes

### 1.1 Ausência de Rate Limiting Prático no Gateway Go
- **Risco:** O arquivo `gateway/main.go` menciona rate limiting em sua documentação conceitual, mas **não há código de controle ativo de requisições por IP ou Token**. 
- **Impacto:** Um atacante pode saturar as portas dos microsserviços internos, abusar do endpoint de geração de tokens Agora (`/api/chat/calls/token`) ou realizar ataques de força bruta.
- **Mitigação Recomendada:** Integrar um middleware de limitação baseado em Token Bucket ou Leaky Bucket usando Redis ou memória compartilhada no Gateway, restringindo chamadas a, por exemplo, 100 requisições/minuto por token.

### 1.2 Vazamento Potencial de Dados Sensíveis em Logs de Erros
- **Risco:** Tratamento de erros nos serviços Go escreve detalhes estruturais diretamente na saída padrão (`log.Printf("Error fetching profile %s: %v\n", targetId, err)`).
- **Impacto:** Erros de parser de SQL, detalhes de chaves estrangeiras ou informações internas de schemas expostas em coletores de logs centralizados (ex: Datadog, Grafana Loki) sem higienização podem ser explorados em ataques de engenharia reversa.
- **Mitigação Recomendada:** Implementar logs estruturados com mascaramento de dados sensíveis (PII) e mascarar erros internos para o usuário final, retornando apenas códigos de rastreabilidade genéricos.

### 1.3 Armazenamento de Hashing de Senhas das Comunidades (Bubbles)
- **Risco:** A tabela `public.communities` possui o campo `password_hash text` para acesso a grupos privados. Se a validação e criptografia desse hash não forem rigorosamente controladas, senhas fracas podem ser expostas.
- **Impacto:** Comprometimento de salas privadas por quebra de dicionário offline em caso de vazamento da tabela.
- **Mitigação Recomendada:** Garantir o hashing utilizando **Argon2id** no microsserviço de `bubbles` antes da gravação no PostgreSQL.

### 1.4 Dependência de Criptografia Assimétrica Clássica no TLS e JWT
- **Risco:** Ataques do tipo *Store-Now-Decrypt-Later* são viáveis hoje se o tráfego atual for capturado e arquivado. Além disso, as sessões do Supabase dependem puramente de assinaturas ECDSA/HMAC tradicionais.
- **Impacto:** Comprometimento retroativo de todas as conversas e sessões históricas assim que computadores quânticos comercialmente viáveis forem introduzidos.
- **Mitigação Recomendada:** Adotar imediatamente a arquitetura pós-quântica descrita a seguir.

---

## 2. Roadmap de Implementação: Rumo ao Estado "Quantum-Safe"

Dividimos a migração do UndoinG em 4 fases sequenciais para minimizar impactos na experiência de uso do cliente final:

```
[ Fase 1: TLS Pós-Quântico ] ➔ [ Fase 2: Sessão Híbrida (JWT) ] ➔ [ Fase 3: E2EE no Chat (Kyber) ] ➔ [ Fase 4: Backup Pós-Quântico ]
```

### Fase 1: Habilitação de TLS Híbrido na Borda (Meses 1-2)
1. **Configuração da Infraestrutura:** Habilitar suporte a `X25519-MLKEM768` na CDN/Proxy Reverso.
   - *Se na Cloudflare:* Ativar a chave de controle de conexões pós-quânticas.
   - *Se no Nginx local:* Atualizar OpenSSL para v3.2 e adicionar o provedor OQS (Open Quantum Safe).
2. **Atualização de Clientes:** Garantir suporte nos navegadores parceiros e no app móvel (atualizando o WebView/ChromeEngine do Capacitor para versões recentes que suportam ML-KEM).

### Fase 2: Dupla Assinatura de Tokens JWT (Meses 3-4)
1. **Atualização do Gateway de Autenticação:** Implementar middleware em Go para decodificar e processar a assinatura dupla (RS256 + ML-DSA-65).
2. **Distribuição da Chave Dilithium:** Registrar chave pública Dilithium do servidor de identidade no Gateway de segurança.
3. **Mecanismo de Fallback:** Permitir verificação puramente clássica de forma transitória enquanto os aplicativos clientes antigos migram para o novo formato híbrido.

### Fase 3: Criptografia de Ponta a Ponta (E2EE) no Chat (Meses 5-7)
1. **Desenvolvimento da Biblioteca de Criptografia no Cliente (JS/TS):** Desenvolver ou integrar wrapper WebAssembly do Kyber/ML-KEM (como o `oqs-wasm`) no frontend do UndoinG.
2. **Upgrade do Protocolo de Troca:** Implementar o fluxo **PQ-X3DH** nas mensagens iniciais de chat, publicando os pacotes de chaves públicas pós-quânticas no Supabase.
3. **Double Ratchet Pós-Quântico:** Ajustar o loop de ratchets periódicos nas trocas de mensagens ativas nos canais Supabase Realtime WebSocket.

### Fase 4: Blindagem Pós-Quântica de Dados em Repouso (Meses 8-9)
1. **Partição de Chave de Backup:** Integrar algoritmo de Shamir's Secret Sharing na rotina de montagem de volumes do PostgreSQL.
2. **Criptografia de Envelopamento:** Migrar o gerenciamento de backups S3/Cloudinary para um serviço HSM ou KMS que utilize o padrão pós-quântico de encapsulamento de chaves.

---

## 3. Conformidade LGPD & Exclusão de Dados

A rede social UndoinG possui tabelas em conformidade primária com a LGPD (como a tabela `public.user_consents` e a flag `lgpd_data_deletion_requested_at` na tabela `profiles`). No entanto, para garantir conformidade total durante a migração pós-quântica:
1. **Direito ao Esquecimento:** Ao processar `lgpd_data_deletion_requested_at`, o microsserviço de identidade deve disparar uma deleção em cascata (posts, comentários, curtidas e chaves E2EE cadastradas).
2. **Mensagens Criptografadas E2EE:** Como as mensagens são criptografadas no cliente final e o servidor possui apenas payloads cifrados legíveis sob chaves descartadas (Double Ratchet), a integridade da exclusão é matematicamente garantida pela destruição das chaves locais no cliente, inviabilizando qualquer recuperação de backups históricos.
3. **Logs de Auditoria:** Logs da tabela `public.audit_logs` devem ser anonimizados após 180 dias de expiração legal.
