# Segurança pós-quântica da UndoinG

Documento operacional do subsistema criptográfico. Descreve **o que está
implementado agora**, o que ele protege, o que ele *não* protege e o que falta
para fechar o cerco.

---

## 1. O problema que isso resolve

Um adversário com recursos (um Estado, um provedor de rede) pode gravar hoje
todo o tráfego cifrado da plataforma e guardá-lo. Quando existir um computador
quântico com escala suficiente, o algoritmo de Shor quebra RSA, Diffie-Hellman
e curvas elípticas — e tudo que foi gravado se abre de uma vez. É o ataque
**"Store Now, Decrypt Later"**.

Contra isso não adianta trocar as chaves depois: só adianta **já estar usando
criptografia resistente a computadores quânticos hoje**, para que o material
gravado nunca tenha valor.

---

## 2. A suíte

Todos os algoritmos foram padronizados pelo NIST em agosto de 2024.

| Papel | Algoritmo | Padrão | Nível NIST |
|---|---|---|---|
| Encapsulamento de chave (KEM) | **ML-KEM-768** (ex-Kyber) | FIPS 203 | 3 |
| Assinatura digital | **ML-DSA-65** (ex-Dilithium) | FIPS 204 | 3 |
| Cifra simétrica autenticada | **AES-256-GCM** | FIPS 197 / SP 800-38D | — |
| Derivação de chaves | **HKDF-SHA-256** | RFC 5869 | — |

O nível 3 do NIST equivale, em resistência quântica, a AES-192 — margem
confortável acima do nível 1 usado pela maioria das implementações comerciais.

Implementação: [`@noble/post-quantum`](https://github.com/paulmillr/noble-post-quantum),
`@noble/ciphers` e `@noble/hashes`. JavaScript puro, auditado, sem dependência
nativa — o mesmo código roda no navegador, no APK Capacitor e no Node.

### Identificador da suíte

```
MLKEM768-MLDSA65-AES256GCM-HKDFSHA256
```

Ele viaja dentro de cada envelope. Um envelope que declare outra suíte é
**rejeitado**, não interpretado — é assim que se fecha a porta para ataques de
rebaixamento (*downgrade*).

---

## 3. Como uma mensagem é protegida

### 3.1 Identidade (uma vez por conta, por dispositivo)

Cada conta gera dois pares de chaves:

- **IK** — ML-DSA-65. É a identidade. O *código de segurança* que o usuário vê
  em Configurações é o SHA-256 truncado dessa chave pública.
- **SPK** — ML-KEM-768. É com ela que os outros encapsulam segredos para você.

No dispositivo guardamos **só as seeds** (64 + 32 bytes), nunca as chaves
privadas expandidas (2400 + 4032 bytes). As chaves são rederivadas em memória.

As chaves *públicas* vão para `profiles`, junto com o **binding**:

```
binding = ML-DSA-Sign( "UndoinG/pq-key-binding/v1 " || chave_ML-KEM ,  IK_privada )
```

**Por que o binding importa.** Sem ele, um servidor comprometido poderia trocar
a sua chave ML-KEM pela dele e ler tudo, sem que nada mudasse na tela de
ninguém. Com o binding, trocar a chave KEM obriga a trocar também a identidade
ML-DSA — e aí **o código de segurança muda**, o que é visível para o usuário.
Um bundle sem binding válido é tratado como "esta pessoa não tem PQ": nada é
cifrado para ela.

### 3.2 Abertura de sessão (mensagem nº 0)

1. O remetente sorteia uma raiz `R` de 32 bytes (CSPRNG do sistema).
2. Para **cada** destinatário — e para si mesmo — encapsula com ML-KEM-768:
   `(ct_i, ss_i) = Encap(pk_i)`.
3. Deriva `wrap_i` de `ss_i` via HKDF e cifra `R` com AES-256-GCM.
4. Assina o envelope inteiro com ML-DSA-65.

O envelope carrega, por destinatário, o par `(ct_i, R_embrulhado)`. Só quem
tem a chave privada ML-KEM correspondente recupera `ss_i`, e só quem recupera
`ss_i` abre `R`. Isso vale igual para conversa 1:1 e para grupo — muda só a
quantidade de entradas.

### 3.3 Mensagens seguintes

Reaproveitam `R` e derivam **uma chave nova por mensagem**:

```
prk  = HKDF-Extract(salt = sid, ikm = R)
mk_n = HKDF-Expand(prk, "udg-pq/msg-key|" + n, 32)
```

Comprometer a chave de uma mensagem não revela nenhuma outra. O nonce
AES-GCM é sorteado por mensagem e viaja no envelope.

### 3.4 AAD — o que amarra o texto cifrado ao seu contexto

```
AAD = "pq1.|<suíte>|<sid>|<contador>|<id do remetente>"
```

Trocar qualquer um desses campos invalida o tag GCM. É o que impede recolar um
envelope válido em outra conversa, remarcar o contador ou trocar o remetente.

### 3.5 Ratchet e forward secrecy

Uma sessão é aposentada após **500 mensagens** ou **7 dias**, o que vier
primeiro. A mensagem seguinte faz um encapsulamento ML-KEM novo, com raiz nova.
Raízes antigas são podadas do armazenamento local (limite de 400 sessões), e a
partir daí nem o próprio dispositivo reabre aquelas mensagens.

Isso dá **forward secrecy** e **post-compromise security** por janela: quem
capturar o dispositivo hoje não lê o que passou dessas janelas, e perde acesso
de novo depois da próxima rotação.

---

## 4. Formato na fiação

```
pq1.{"v":1,"a":"MLKEM768-…","s":"<sid>","n":0,"t":1757…,"f":"<remetente>",
     "ik":"<ML-DSA pub>","kp":"<ML-KEM pub>",
     "r":[{"u":"<id>","c":"<ct ML-KEM>","w":"<raiz embrulhada>"}],
     "iv":"<nonce>","c":"<texto cifrado+tag>","g":"<assinatura ML-DSA>"}
```

O prefixo `pq1.` é o mesmo exigido pela função `relay_mesh_messages()` no
Postgres: o gateway de mesh transporta a mensagem sem nunca conseguir lê-la.

`ik`, `kp` e `r` aparecem **só na mensagem de abertura**. Tamanhos medidos:

| Envelope | Tamanho |
|---|---|
| Abertura 1:1 | ~11,9 KB |
| Mensagem seguinte | ~4,6 KB |
| Abertura de grupo (3 pessoas) | ~13,4 KB |

A assinatura ML-DSA-65 (3309 bytes) é o custo dominante. É o preço de manter
**autenticidade por mensagem** — inclusive em grupo, onde todos compartilham a
raiz e sem assinatura qualquer membro poderia se passar por outro.

Custo de CPU medido: ~23 ms para cifrar, ~15 ms para decifrar a de abertura.
Textos já decifrados ficam em cache (2000 entradas), então rolagem e
re-renderização não repetem a verificação.

---

## 5. Onde isso está ligado no aplicativo

| Ponto | Arquivo | O que acontece |
|---|---|---|
| Envio de mensagem | `src/pages/Messages.tsx` → `handleSendMessage` | Cifra antes do `insert`, marca `is_pq_encrypted` |
| Leitura do histórico | `src/pages/Messages.tsx` → query `messages` | `pqDecryptBatch` decifra antes de qualquer render |
| Edição de mensagem | `src/pages/Messages.tsx` → `saveEditMessage` | Re-cifra antes do RPC; se não conseguir, cancela a edição em vez de rebaixar para texto puro |
| Prévia na lista | `src/pages/Messages.tsx` | Envelope vira "🔒 Mensagem protegida" |
| Toast de mensagem nova | `src/components/realtime/RealtimeMessageListener.tsx` | Idem |
| Push | `netlify/functions/db-webhook.js` | Nunca coloca conteúdo cifrado na notificação (flag **e** prefixo) |
| Identidade / publicação | `src/hooks/usePqIdentity.ts` | Cria e publica as chaves públicas |
| Logout | `src/hooks/useAuth.tsx` | Apaga identidade, sessões e caches |
| Painel do usuário | `src/components/security/PqSecurityCard.tsx` | Mostra suíte e código de segurança |

### Modo estrito

Definindo `VITE_PQ_STRICT=true`, o aplicativo **falha em vez de enviar em
texto puro** quando o destinatário não tem chaves PQ. O padrão é desligado
para não quebrar conversas com contas que ainda não abriram o aplicativo
atualizado. Recomenda-se ligar assim que a base de usuários migrar.

---

## 6. Banco de dados

`supabase/migrations/20260906120000_pq_key_binding.sql`

- `profiles.pq_mldsa_pubkey`, `pq_mlkem_pubkey`, `pq_mldsa_sig`,
  `pq_keys_updated_at` (carimbo automático por trigger).
- Constraint de sanidade nos tamanhos em base64url.
- Índice parcial `profiles_pq_ready_idx` para achar quem já ativou.
- `messages.is_pq_encrypted`, `messages.pq_signature`, com índice parcial.

Aplicar com `supabase db push` (ou colando o arquivo no SQL Editor). É
idempotente: rodar duas vezes não quebra nada.

**RLS:** as chaves públicas precisam ser legíveis por qualquer usuário
autenticado (é assim que se cifra para alguém) e graváveis só pelo dono
(`auth.uid() = id`). A migração não afrouxa nenhuma policy existente.

---

## 7. O que isto protege — e o que não protege

### Protege

- **Conteúdo das mensagens de texto**, contra o servidor, contra quem tiver
  acesso ao banco, contra dump de backup e contra gravação de tráfego para
  quebra futura por computador quântico.
- **Autenticidade**: ninguém forja mensagem no nome de outra pessoa, nem em
  grupo.
- **Integridade e contexto**: envelope não pode ser movido de conversa,
  reordenado nem ter o remetente trocado.
- **Substituição de chave pelo servidor**: detectável pelo código de segurança.

### Não protege (ainda)

| Lacuna | Situação |
|---|---|
| **Metadados** | Quem falou com quem, quando e com que frequência continuam visíveis no banco. Resolver isso exige mudança de arquitetura (sealed sender), não só de criptografia. |
| **Mídia** (imagens, áudio, vídeo) | Vai para o Cloudinary sem cifra de cliente. O próximo passo é cifrar o arquivo com uma chave derivada da sessão antes do upload. |
| **Menções** | Salvas em texto puro para que a notificação funcione. |
| **Mensagens agendadas** | O texto fica em `scheduled_messages` sem cifra até a hora do envio, porque quem envia é uma função de servidor. Cifrar isso exige guardar um envelope pré-selado no agendamento. |
| **Histórico entre dispositivos** | A identidade é por dispositivo. Entrar numa conta nova em outro aparelho não reabre o histórico cifrado anterior — isso é uma propriedade de segurança, não um defeito, mas precisa ser explicada ao usuário. |
| **TLS híbrido na borda** | Depende da CDN, não do código. Ver seção 8. |
| **CSP com `unsafe-inline`/`unsafe-eval`** | Necessários hoje por ffmpeg.wasm e mediapipe. Migrar para nonce + `wasm-unsafe-eval`. |

Dizer que uma plataforma é "inquebrável" seria propaganda. O que dá para dizer
com honestidade: **o conteúdo das conversas de texto está protegido por
criptografia de ponta a ponta pós-quântica de nível 3 do NIST, e o servidor não
tem como lê-lo.** Isso já coloca a UndoinG à frente da maioria absoluta das
redes sociais em operação.

---

## 8. Endurecimento fora do código

### TLS híbrido na borda (protege o *transporte*)

Independente do E2EE, vale negociar TLS com grupo de chave híbrido:

- **Cloudflare**: *Security → SSL/TLS → Edge Certificates* → ativar
  **Post-Quantum Cryptography**. Passa a negociar `X25519MLKEM768`.
- **Nginx próprio** (OpenSSL 3.2+ com oqs-provider):

```nginx
ssl_protocols TLSv1.3;
ssl_ecdh_curves X25519MLKEM768:x25519_kyber768:x25519;
ssl_ciphers TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256;
ssl_prefer_server_ciphers on;
```

### Cabeçalhos HTTP

Já configurados em `netlify.toml`: HSTS com preload, `frame-ancestors 'none'`,
`form-action 'self'`, `upgrade-insecure-requests`, COOP,
`X-Permitted-Cross-Domain-Policies`, `Permissions-Policy` restritiva.

### Supabase

- Rotacionar a `service_role` key periodicamente; ela nunca deve chegar ao
  cliente (hoje só é usada nas Netlify Functions).
- Revisar as policies de RLS a cada migração.
- Ligar auditoria de acesso ao banco.

---

## 9. Testes

`src/lib/pq/pq.test.ts` — 47 casos, executados por `npm test`:

- **Primitivas**: base64url (incluindo restos e entrada inválida), AES-256-GCM
  (adulteração, AAD trocado, tamanhos errados), HKDF, ML-KEM (roundtrip,
  determinismo por seed, chave errada, tamanho inválido), ML-DSA (mensagem
  alterada, assinatura alterada, chave errada).
- **Protocolo**: roundtrip 1:1, resposta, releitura das próprias mensagens,
  reuso de sessão, chaves distintas por mensagem, entrega fora de ordem,
  unicode e textos de 20 KB, texto vazio, persistência por conta, ratchet.
- **Grupos**: todos os membros leem; quem está fora não lê.
- **Ofensiva**: texto cifrado adulterado, contador remarcado, remetente
  falsificado, identidade trocada (MITM), assinatura zerada, suíte rebaixada,
  envelope truncado, envelope movido de sessão, terceiro sem chave.
- **Isolamento**: duas contas na mesma origem têm identidades, sessões e
  limpeza independentes.

```bash
npm test                       # suíte completa
npx vitest run src/lib/pq      # só a camada criptográfica
```

---

## 10. Regras para quem mexer nisto depois

1. **Nunca** faça uma função criptográfica devolver "vazio" em caso de erro.
   Foi exatamente assim que este módulo virou texto puro sem ninguém perceber:
   as funções passaram a retornar `new Uint8Array()` e o chat continuou
   "funcionando". Erro criptográfico **lança**.
2. Não mude o formato do envelope sem trocar o prefixo (`pq1.` → `pq2.`) e
   manter o leitor da versão anterior.
3. Não adicione um caminho que grave conteúdo de mensagem sem passar pelo
   cifrador.
4. Rode `npx vitest run src/lib/pq` antes de qualquer commit que toque em
   `src/lib/pq/`.
