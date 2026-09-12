# UndoinG (UDG-MASTER) — Varredura do Sistema, Plano de Novas Funções e Prontidão para Lançamento

**Data da varredura:** 06/09/2026
**Escopo auditado:** `C:\Users\Poderoso_DELL\Desktop\UDG-MASTER` (código-fonte, migrations, funções serverless, configurações de build/deploy, documentação interna)
**Método:** leitura estática do repositório + verificação do ambiente de produção público (`https://undoing.com.br`) + benchmark de mercado e requisitos regulatórios vigentes em set/2026.
**Não incluído:** execução de `npm run build`, `tsc`, `eslint` e `vitest` (o ambiente desta varredura não tem shell na máquina local; os números de erro citados vêm do `AGENTS.md`, precisam ser reconfirmados).

---

## 1. Veredito executivo

> **O sistema NÃO está apto a um lançamento público hoje.** Está apto a um **beta fechado por convite** depois de resolver 1 bloqueador crítico de segurança (48 h de trabalho). Para lançamento aberto ao público brasileiro, faltam ~4 a 6 semanas de trabalho concentrado em conformidade legal, higiene de produção e observabilidade.

| Dimensão | Nota | Situação |
|---|---|---|
| Produto / funcionalidades | **8,5 / 10** | Escopo maior que o de muitos apps já lançados. Sobra função, falta acabamento. |
| Criptografia / E2EE | **9,5 / 10** | Diferencial real e bem documentado. Melhor que o do mercado. |
| Segurança operacional | **3 / 10** | ⛔ Credencial de root do servidor em texto claro no repositório. |
| Conformidade LGPD / ECA Digital | **4 / 10** | Política existe, mas dados biométricos + público 18+ exigem muito mais. |
| Qualidade de código / testes | **5 / 10** | ~175 erros de TypeScript e cobertura de teste concentrada só na camada PQ. |
| Infra / go-live | **4,5 / 10** | Sem monitoramento, sem rastreio de erro, dois ambientes de produção divergentes. |
| **Prontidão global** | **5,7 / 10** | **Beta fechado: sim. Lançamento público: não ainda.** |

---

## 2. O que o sistema é hoje

### 2.1 Arquitetura

```
Frontend   React 18 + Vite 5 + TypeScript + Tailwind + shadcn/ui + TanStack Query
PWA        vite-plugin-pwa (Workbox) + service worker próprio (src/sw.js)
Mobile     Capacitor 8 (appId com.udoing.app) — wrapper apontando p/ undoing.com.br
Backend    Supabase (Postgres + Auth + Realtime + Storage + RLS + Edge Functions)
Serverless 41 Netlify Functions (push, tradução, dublagem, moderação, Agora, Yoti…)
Mídia      Cloudinary (upload assinado)
RTC        Agora (voz, vídeo, batalhas ao vivo)
E2EE       ML-KEM-768 + ML-DSA-65 + AES-256-GCM + HKDF-SHA256 (@noble/post-quantum)
Deploy     Netlify (produção real, undoing.com.br) + GitHub Actions → VPS (udgservidor.online)
```

### 2.2 Módulos entregues (verificados no código)

| Área | Estado | Evidência |
|---|---|---|
| Autenticação, cadastro, reset de senha, chave de segurança | Completo | `pages/Auth.tsx`, `ResetPassword.tsx`, `SecurityKeyCard.tsx` |
| Chat 1:1 e grupos (criar, papéis, @menções, @todos) | Completo | `groups/*`, RPCs `create_group`, `add_group_members` |
| Reações, edição (15 min), apagar para todos, enquetes | Completo | `reactions/*`, `polls/*`, RPCs correspondentes |
| Mensagens efêmeras, agendadas, salvas, modo furtivo | Completo | `ChatEphemeral.tsx`, `ScheduleMessageModal`, `SaveModeToggle`, `StealthModeToggle` |
| E2EE pós-quântica no chat privado | Completo, testado | `lib/pq/*` (63 casos de teste) |
| Feed social, votação da Arena, comunidades, stories | Completo | `Feed.tsx` (165 KB), `Arena.tsx`, `Communities.tsx`, `stories/*` |
| Vídeo vertical (Reels-like) com votação reaproveitada | Completo | `components/video/*` |
| Chamadas de voz/vídeo + batalhas ao vivo com placar | Completo | `useCalls.tsx`, `BattleRoom.tsx`, `useBattleLive.ts` |
| Tradução automática, dublagem com clonagem de voz, correção de texto | Completo | `useUnifiedTranslation`, `voice-clone-translate.js`, `correct-text.js` |
| Assistente de IA (Zane) | Completo | `ZaneIA.tsx`, `zane-ai-chat.js` |
| Push (web + FCM nativo), badge, som, presença online | Completo | `pushClient.ts`, `send-push.js`, `useCapacitorPush` |
| Pesquisa global (pessoas, mensagens, posts, comunidades) | Completo | `pages/Search.tsx` + RPC `search_messages` |
| Verificação de idade 18+ (Yoti + estimativa facial) | Implementado | `AgeVerificationModal.tsx`, `yoti-session.js`, `yoti-result.js` |
| Moderação de conteúdo (heurística + NSFW por IA) | Parcial | `moderate_content.js`, `contentModeration.ts` |
| Consentimento LGPD no primeiro acesso | Implementado | `LGPDConsentModal.tsx` |
| Carteira, moedas, diamantes, PIX, loja, presentes | **Desligado de propósito** | `MONETIZACAO_ATIVA = false`, 4 endpoints em 410 Gone |
| Painel administrativo | Só local | `adm-localhost/` (127.0.0.1, fora do repositório) |

**Leitura:** o produto já cobre, em funcionalidade, o que a literatura de mercado descreve como o conjunto "core + advanced" de uma rede social em 2026 — e vai além em três pontos (E2EE pós-quântica, dublagem com voz clonada, batalhas ao vivo). **A lacuna não é de features. É de operação, conformidade e acabamento.**

---

## 3. Bloqueadores críticos (P0 — impedem lançamento)

### 🔴 P0-1 — Senha root do VPS em texto claro no repositório
**Arquivo:** `.github/workflows/deploy.yml`
Os passos "Deploy dist to VPS" e "Deploy public to VPS" usam `sshpass -p '<senha em texto claro>' rsync … root@<IP>`. A senha **root** do servidor de produção e o IP estão gravados no arquivo, versionados no Git e visíveis em todo o histórico — inclusive para qualquer pessoa que já tenha clonado o repositório ou tido acesso a ele.

**Impacto:** comprometimento total do servidor, dos dados dos usuários e da reputação da plataforma. Torna sem efeito prático todo o esforço de criptografia pós-quântica.

**Correção (hoje, nesta ordem):**
1. Trocar a senha de root do VPS **agora**;
2. Desabilitar login por senha no SSH (`PasswordAuthentication no`) e usar chave;
3. Mover a chave para `secrets.SSH_PRIVATE_KEY` no GitHub e usar `webfactory/ssh-agent` ou `appleboy/scp-action`;
4. Remover `StrictHostKeyChecking=no` (aceita MITM) e fixar o host key;
5. Purgar o segredo do histórico (`git filter-repo`) e considerar o par IP+senha como definitivamente vazado.

### 🔴 P0-2 — Dois ambientes de produção divergentes
A produção pública real é `https://undoing.com.br` (confirmado: `/.netlify/functions/app-config` responde 200 → Netlify). Ao mesmo tempo, o CI publica o build em `udgservidor.online` (VPS nginx), e o `capacitor.config.ts` aponta o APK para `undoing.com.br`. **Dois destinos, um só `main`.** Se o VPS servir uma versão diferente, usuários do APK e da web veem estados distintos do sistema — e as Netlify Functions não existem no VPS, quebrando push, tradução, dublagem e moderação nesse host.

**Correção:** eleger um único ambiente de produção, apontar DNS/APK para ele e rebaixar o outro a *staging* (ou desligar).

### 🔴 P0-3 — Usuários de teste e pagamentos simulados dentro de `supabase/migrations/`
Há `20260814130000_confirm_test_users.sql`, `20260814140000_reset_test_profiles_session.sql`, `2026081416000_consent_test_users.sql`, `20260814110000_mock_payments.sql` e `legacy_pending/20260814120000_seed_test_users.sql` na pasta que o `supabase db push` aplica. São 50 contas-bot com senha conhecida e domínio `@udgtest.com`, mais um caminho de pagamento fictício.

**Impacto:** contas com senha padrão em produção = porta aberta; 50 perfis falsos poluindo métricas e feed no dia do lançamento; `mock_payments` num banco de produção é risco financeiro latente.

**Correção:** mover esses arquivos para `supabase/seed_dev/` (fora do caminho de migração), e rodar um script de expurgo confirmando que nenhuma conta `@udgtest.com` existe no banco de produção.

### 🔴 P0-4 — Migração duplicada com o mesmo timestamp
`supabase/migrations/20260906120000_pq_key_binding.sql` (4,5 KB) e `20260906120000_pq_key_binding-1.sql` (8,3 KB) têm o mesmo carimbo e conteúdos diferentes. O CLI aplicará ambas em ordem alfabética indefinida — ou falhará. É exatamente o binding de chave PQ, a peça que sustenta a promessa de segurança.

**Correção:** consolidar em um único arquivo idempotente, verificar no banco de produção quais objetos já existem, e só então versionar.

---

## 4. Riscos altos (P1 — resolver antes de abrir ao público)

| # | Risco | Onde | Por quê importa |
|---|---|---|---|
| P1-1 | `.env.production` **não** está coberto pelo `.gitignore` (que cobre só `.env`, `.env.local`, `.env.*.local`) | raiz | Hoje só contém chaves públicas (anon key, Agora App ID), mas o padrão convida a commitar segredo real amanhã. Adicione `.env.production` e `.env.*` ao ignore. |
| P1-2 | `moderate_content` é chamado do cliente sem autenticação e usa `createAdminClient()` | `netlify/functions/moderate_content.js` | Endpoint aberto que gasta cota da HuggingFace, faz SSRF (`fetch(imageUrl)` de URL arbitrária) e escreve em tabela com service_role. Exigir JWT do Supabase + allowlist de domínio de imagem (só Cloudinary). |
| P1-3 | Sem rastreio de erro e sem monitoramento (nenhum Sentry/Rollbar/analytics no `package.json`) | — | No dia do lançamento você descobre que quebrou pelo print de um usuário no WhatsApp. É a lacuna operacional mais cara. |
| P1-4 | Senha de comunidade comparada com `btoa` (Base64, não hash) | pendência registrada no `AGENTS.md` | Base64 não é criptografia. Trocar por hash (bcrypt/argon2 no servidor) ou remover o recurso. |
| P1-5 | `cleartext: true` no Capacitor | `capacitor.config.ts` | Permite HTTP sem TLS no app Android. Remover — nada no app precisa disso. |
| P1-6 | CSP com `unsafe-inline` + `unsafe-eval` | `netlify.toml` | Assumido e documentado (ffmpeg.wasm/mediapipe), mas anula boa parte da proteção contra XSS num app com conteúdo gerado por usuário. Migrar para nonce + `wasm-unsafe-eval`. |
| P1-7 | CI não roda `lint`, `tsc` nem `test` antes de publicar | `.github/workflows/deploy.yml` | Qualquer regressão vai direto para produção. |
| P1-8 | ~175 erros de TypeScript no build e `strictNullChecks: false` | `tsconfig` + `AGENTS.md` | Não impedem o build (Vite não checa tipos), mas são bugs silenciosos esperando o pico de tráfego. |
| P1-9 | 9 arquivos `.bak` versionados dentro de `src/` (Messages, Feed, Arena, Profile, News, MessageInput…) | `src/` | ~700 KB de código morto entrando no repositório e confundindo busca/refactor. |
| P1-10 | `pages/Messages.tsx` com 227 KB e `Feed.tsx` com 165 KB num só arquivo | `src/pages/` | Nenhum humano revisa isso com segurança. É a maior dívida técnica de manutenção do projeto. |
| P1-11 | Página de teste quebrada em produção (`ChatTeste.tsx`, 85 KB, com erros de tipo) | `src/pages/` | Remover do bundle. |

---

## 5. Conformidade legal — o ponto mais subestimado

O UndoinG coleta **CPF, data de nascimento, geolocalização, áudio de voz e imagem de rosto**, e envia voz e texto para APIs fora do Brasil (Hugging Face, Google, Agora, Supabase). Isso o coloca no regime mais exigente da LGPD: **dado pessoal sensível (biométrico), Art. 11**, com transferência internacional.

### 5.1 LGPD — lacunas identificadas

| Exigência | Situação | Ação |
|---|---|---|
| Base legal para biometria (consentimento **específico e destacado**, não no meio dos termos) | Parcial — há `LGPDConsentModal`, mas o consentimento de voz/rosto precisa ser **separado** do consentimento geral e revogável de forma independente | Criar consentimento granular por finalidade (clonagem de voz, detecção facial de idade, geolocalização) |
| Registro de operações de tratamento (ROPA) | Ausente | Documento obrigatório se a ANPD pedir |
| Encarregado (DPO) nomeado e publicado | Ausente na política | Nomear e publicar nome + e-mail de contato |
| Relatório de Impacto (RIPD) | Ausente | Praticamente obrigatório para biometria em escala |
| Prazo de retenção dos dados biométricos | Não declarado | Definir (ex.: áudio de voz descartado em 24 h após a dublagem) e implementar expurgo |
| Exclusão de conta e eliminação dos dados | Prometida na política ("Excluir Conta") | **Verificar se o botão existe e se realmente apaga áudios/rostos no Cloudinary e no Supabase** — a política promete, e promessa não cumprida é infração |
| Transferência internacional | Declarada, sem salvaguarda formal | Cláusulas contratuais padrão / avaliação de adequação |
| Política e Termos servidos como `.md` cru (`/POLITICA_DE_PRIVACIDADE.md`) | Fraco | Publicar como página HTML acessível (`/privacidade`, `/termos`), com data e versão — requisito de loja de aplicativos |

### 5.2 ECA Digital (Lei nº 15.211/2025, em vigor desde 17/03/2026)

Plataforma 18+ com conteúdo adulto **não pode depender de autodeclaração de idade**. A lei exige mecanismo confiável de verificação a cada acesso, ferramentas de supervisão, canal de denúncia com remoção independente de ordem judicial, e prevê multa de até 10% do faturamento (teto de R$ 50 mi por infração).

**O que já ajuda:** a integração Yoti (`yoti-session.js` / `yoti-result.js`) e o `AgeVerificationModal` são exatamente o tipo de mecanismo que a lei pede.
**O que falta:** confirmar que a verificação é **obrigatória e bloqueante** no cadastro (e não pulável), documentar o fluxo, e criar canal formal de denúncia com SLA e registro — o `ReportButton` existe, mas não há política de moderação publicada nem fila de revisão humana operando.

### 5.3 Lojas de aplicativos (se for publicar o APK)

- Exclusão de conta **dentro do app e por URL pública** (exigência do Google Play);
- Data Safety declarado com precisão — o Google agora cruza a declaração com o binário; um app que grava voz e rosto e não declara é removido;
- App de UGC precisa demonstrar capacidade de moderação e ter a política na ficha da loja;
- `targetSdk` ≥ 34;
- Contas de desenvolvedor pessoais criadas recentemente exigem teste fechado com 12 testadores por 14 dias antes da publicação — **isso sozinho adiciona 2 semanas ao cronograma**, então comece já.

---

## 6. Benchmark de mercado e plano de novas funções

O `PLANO_DEV_2026.md` já traz um roadmap de 21 itens em 5 fases, e a Fase 1 está entregue. O plano abaixo **não o substitui**: reorganiza o que falta pela ótica de *lançamento*, acrescenta o que a pesquisa de mercado de 2026 indica como esperado e que ainda não existe no código, e separa o que dá receita do que dá sobrevivência.

### 6.1 Bloco A — Funções que faltam para "operar como produto" (obrigatórias, 4 a 6 semanas)

| # | Função | Por que é obrigatória | Esforço |
|---|---|---|---|
| A1 | **Painel de moderação com fila humana** (denúncias → triagem → ação → registro) | ECA Digital e política do Google Play exigem; hoje a moderação é só automática e o painel só roda em `127.0.0.1` | Alto |
| A2 | **Exclusão de conta ponta a ponta** (app + URL pública + expurgo em Cloudinary/Supabase + confirmação por e-mail) | LGPD Art. 18 + Google Play | Médio |
| A3 | **Rastreio de erro e monitoramento** (Sentry no front, healthcheck + uptime nas funções, alerta no celular) | Sem isso não existe operação, só torcida | Baixo |
| A4 | **Analytics de produto** (ativação, D1/D7/D30, funil de cadastro → primeira mensagem) | É o único jeito de saber se o lançamento funcionou | Baixo |
| A5 | **Central de privacidade no app** (ver meus dados, baixar meus dados, revogar consentimento por finalidade) | LGPD Art. 18 (portabilidade e revogação) | Médio |
| A6 | **Páginas legais em HTML** (`/privacidade`, `/termos`, `/moderacao`, `/contato-dpo`) com versionamento | Lojas, LGPD, ECA Digital | Baixo |
| A7 | **Rate limiting e antiabuso** nas Netlify Functions (JWT obrigatório, quota por usuário, allowlist de domínio) | Endpoints de IA custam dinheiro por chamada; hoje vários são abertos | Médio |
| A8 | **Backup e restauração testados do Postgres** (PITR ligado + um restore de verdade ensaiado) | Sem restore testado, backup é fé | Baixo |
| A9 | **Onboarding guiado de 60 segundos** (do cadastro à primeira conversa) | Todo o produto está atrás de um cadastro com CPF e verificação de idade; sem onboarding, a conversão despenca | Médio |
| A10 | **Bloqueio de conteúdo por padrão até moderação** para mídia com `pending_review` | Hoje, sem token da HF, tudo passa como "pendente" e é publicado | Baixo |

### 6.2 Bloco B — Funções que o mercado de 2026 já trata como esperadas e faltam no UDG

| # | Função | Referência | Impacto × Esforço |
|---|---|---|---|
| B1 | **Cifra de mídia ponta a ponta** (imagem/áudio/vídeo cifrados antes do upload ao Cloudinary) | Signal, WhatsApp | Alto × Alto — **é a maior incoerência atual**: o texto é pós-quântico, a foto vai em claro |
| B2 | **Backup/restauração de histórico entre dispositivos** (com senha do usuário) | WhatsApp, Signal | Alto × Alto — hoje, trocar de aparelho perde o histórico cifrado |
| B3 | **Feed algorítmico** (ranqueamento por sinal de comportamento, não só cronológico) | Instagram, TikTok | Alto × Médio |
| B4 | **Mensagens de voz com transcrição automática** | WhatsApp 2026 | Alto × Baixo — o Whisper já está integrado na dublagem, é reaproveitamento puro |
| B5 | **Editar/apagar em qualquer superfície + "recuperar apagados"** | Telegram | Médio × Baixo |
| B6 | **Comunidades com canais internos e tópicos** | Telegram, Discord | Alto × Médio |
| B7 | **Painel do criador** (alcance, retenção, melhores posts) | Instagram, TikTok | Médio × Médio |
| B8 | **Tradução ao vivo em chamadas** (ASR + TTS sobreposto) | já no `PLANO_DEV_2026` Fase 3 | Alto × Alto — diferencial forte, mas depende de infra própria de inferência |
| B9 | **Modo de baixo consumo / offline-first** (fila de envio, cache de conversa) | mercado BR, rede instável | Alto × Médio |
| B10 | **Acessibilidade** (contraste, leitor de tela, alvos de toque, `prefers-reduced-motion`) | requisito de loja e de decência | Médio × Baixo |

### 6.3 Bloco C — Monetização (só depois do lançamento estabilizado)

A decisão de 30/08/2026 de desligar a trilha de dinheiro foi **acertada e bem executada** (interruptor único, endpoints em 410, motivo documentado). Reativar exige, antes:

1. Assinatura HMAC real no webhook do Mercado Pago com comparação em tempo constante (hoje é segredo estático comparado ingenuamente);
2. Idempotência por `order_id` (webhook repetido não pode creditar duas vezes);
3. Auditoria imutável de crédito/débito (tabela append-only, reconciliação diária);
4. Conformidade de saque: PIX movimenta dinheiro de terceiros — avaliar necessidade de parceiro regulado, KYC e obrigações fiscais antes de ligar `withdraw-diamonds`.

Só então: UndoinG Plus (assinatura), presentes em live, PIX social para criadores, e o ranking semanal premiado — nesta ordem, que é a de menor risco regulatório para o maior retorno.

---

## 7. Cronograma proposto até o lançamento

| Semana | Foco | Saída |
|---|---|---|
| **0 (imediato)** | P0-1 (rotacionar senha, chave SSH, purgar histórico), P0-4 (migração duplicada) | Servidor seguro |
| **1** | P0-2 (ambiente único), P0-3 (expurgar contas de teste), P1-1, P1-2, P1-5 | Produção limpa e coerente |
| **2** | A3, A4, A8 (observabilidade e backup), P1-7 (CI com lint/tsc/test) | Operação visível |
| **3–4** | A1, A2, A5, A6, A10 (moderação + LGPD + páginas legais) | Conformidade defensável |
| **4** | Início do teste fechado no Google Play (12 testadores, 14 dias) | Relógio da loja correndo |
| **5** | A7, A9, B4, B10 + correção do backlog de tipos | Produto apresentável |
| **6** | Beta fechado com 100–300 usuários reais (o "selo dourado" é o gancho perfeito) | Dados reais antes do público |
| **7–8** | Correções do beta, teste de carga, ensaio de restore, revisão jurídica final | **Lançamento público** |

---

## 8. O que está muito bom (e deve ser preservado)

Vale registrar, porque é raro:

- **A criptografia pós-quântica está entre as melhores implementações que se vê fora de uma empresa de segurança.** Suíte de nível 3 do NIST, binding de chave assinado, AAD amarrando contexto, ratchet por janela, 63 testes incluindo cenário de servidor malicioso, e — o mais importante — a regra explícita de que erro criptográfico **lança** em vez de retornar vazio. Isso é maturidade de engenharia.
- **O `SEGURANCA_PQ.md` diz honestamente o que o sistema *não* protege** (metadados, mídia, menções, mensagens agendadas). Documentação que admite lacuna vale mais que documentação que promete perfeição.
- **O desligamento da monetização foi feito na camada certa** — serviço e endpoint, não só o botão. É o raciocínio correto sobre superfície de ataque.
- **O `AGENTS.md` é um diário de engenharia excepcional**: causa raiz de cada bug, comandos que funcionaram, armadilhas do ambiente. Isso encurta drasticamente o onboarding de qualquer pessoa ou agente que entre no projeto.

---

## 9. Resposta direta à pergunta

**"O sistema está apto a um lançamento?"**

Funcionalmente, sim — e com folga. O UndoinG tem hoje mais recursos entregues do que a maioria das redes sociais tem no dia em que abre ao público, e um diferencial criptográfico que nenhum concorrente de mercado oferece.

Operacional e juridicamente, **não ainda**, por três motivos que não dependem de opinião:

1. **A credencial de root do servidor de produção está em texto claro no repositório.** Enquanto isso for verdade, todo o resto — inclusive a criptografia pós-quântica — é decorativo. Isso se resolve hoje.
2. **O sistema coleta biometria (voz e rosto) e CPF de um público 18+ no Brasil, sob LGPD Art. 11 e ECA Digital.** Consentimento granular, RIPD, DPO nomeado, prazo de retenção e exclusão real de dados não são burocracia opcional: são o que separa um lançamento de uma multa.
3. **Não há como enxergar o sistema em produção.** Sem rastreio de erro, sem métrica e sem restore de backup testado, o primeiro pico de usuários é um voo cego.

**Recomendação:** execute a Semana 0 e 1 imediatamente, abra um **beta fechado por convite** ao fim da Semana 2 (o selo dourado para os 100 primeiros é a mecânica perfeita para isso), e trate a Semana 8 como a data do lançamento público. Lançar antes disso não acelera nada — só transfere o custo do erro para os primeiros usuários, que são justamente os que você menos pode perder.

---

## Fontes

- [Estatuto Digital da Criança e do Adolescente (Lei nº 15.211/2025) — Machado Meyer](https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/direito-digital/estatuto-digital-da-crianca-e-do-adolescente-lei-n-15-211-2025-entra-em-vigor-em-17-de-marco-de-2026)
- [ECA Digital: o que muda em 2026 — FADC](https://www.fadc.org.br/noticias/eca-digital-entenda-nova-lei)
- [Google Play Policy Updates 2026 — AppTester](https://www.apptester.co/blog/google-play-policy-updates-2025)
- [Google Play — requisitos de exclusão de conta](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Social media app development in 2026: features, tech stack and cost — AgileEngine](https://agileengine.com/social-media-app-development-features-tech-stack-and-cost-breakdown/)
- [How to Build a Social Networking App in 2026 — Chop Dawg](https://www.chopdawg.com/how-to-build-a-social-networking-app-in-2026-features-costs-and-what-most-founders-get-wrong/)
- [LGPD e dados biométricos — Confidata](https://confidata.com.br/blog/lgpd-dados-biometricos-reconhecimento-facial-digital)
- [ANPD — tomada de subsídios sobre dados biométricos](https://www.gov.br/participamaisbrasil/ts-dados-biometricos)
- [Novidades do WhatsApp 2026 — Z-API](https://z-api.io/blog/whatsapp-2026-novos-recursos-ia/)
