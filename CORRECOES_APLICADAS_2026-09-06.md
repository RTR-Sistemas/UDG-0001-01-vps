# Correções aplicadas — 06/09/2026

Este documento registra **o que foi alterado no código**, **por que**, e **o que ainda depende
de você** (coisas que só podem ser feitas no servidor, no GitHub ou no banco).

Companheiro deste arquivo: `AUDITORIA_E_PLANO_UNDOING_2026-09-06.md` (o diagnóstico completo)
e `ACESSO_VPS_UNDOING.md` (guia de acesso ao servidor — fora do Git).

---

## Parte 1 — Segurança: o incidente

### 1.1 Senha de root removida do repositório

| Arquivo | O que tinha | O que tem agora |
|---|---|---|
| `.github/workflows/deploy.yml` | `sshpass -p '<senha root>' rsync … root@<IP>` | Chave SSH vinda de GitHub Secrets, usuário `deploy`, `known_hosts` fixo |
| `DEPLOY/deploy_prod.bat` | `pscp -pw <senha root> -hostkey <fingerprint>` | Nenhum segredo; chama o `deploy_vps.ps1` |
| `DEPLOY/deploy_vps.ps1` | IP e impressão digital escritos como valor padrão | Lê de `DEPLOY/vps.local.ps1` (fora do Git) ou de variáveis de ambiente |

Também foi removido o `StrictHostKeyChecking=no`, que aceitava qualquer servidor que
respondesse no endereço — ou seja, tornava um ataque de intermediário trivial.

> ⚠️ **Trocar a senha do servidor continua sendo tarefa sua, e é a mais urgente de todas.**
> O passo a passo está no item 6 do `ACESSO_VPS_UNDOING.md`. Enquanto a senha antiga valer,
> o servidor continua acessível a quem já tem uma cópia do repositório.

### 1.2 `.gitignore` reforçado

`.env.production` estava versionado porque a regra antiga (`.env`, `.env.local`,
`.env.*.local`) não o alcançava. Agora o padrão é `.env.*` com exceção só para `.env.example`.
Foram acrescentados também: `DEPLOY/vps.local.ps1`, `ACESSO_*.md`, `*.pem`, `*.ppk`,
`id_rsa*`, `id_ed25519*` e as pastas `Claude outputs/` e `NAOENVIAR/`.

### 1.3 Função de moderação: dois furos fechados

`netlify/functions/moderate_content.js` era **pública** e aceitava **qualquer URL**:

- **SSRF** — dava para pedir a ela que buscasse `http://127.0.0.1:8000` (o seu Supabase), e o
  resultado voltava embutido na resposta. Agora só aceita HTTPS de domínios de mídia conhecidos
  (Cloudinary, Supabase, seus próprios domínios), recusa endereços IP e nomes internos, e não
  segue redirecionamento (era o jeito óbvio de contornar a lista).
- **Identidade forjada** — ela confiava no `userId` que o cliente mandava, então qualquer pessoa
  com `curl` podia gastar sua cota da Hugging Face e escrever registros de auditoria em nome de
  outro usuário. Agora exige o token do Supabase e usa **sempre** o id que vem do token.

O cliente (`src/services/contentModeration.ts`) passou a enviar o token junto.

### 1.4 Capacitor sem tráfego inseguro

`cleartext: true` autorizava o aplicativo Android a fazer requisições em HTTP puro — ou seja, a
ser lido e alterado por quem estivesse na mesma rede Wi-Fi. Foi removido, junto com
`allowMixedContent: false` e `androidScheme: 'https'`.

---

## Parte 2 — Saída da Netlify: tudo aponta para o seu VPS

### 2.1 O caminho oficial agora é `/api/`

O runtime de funções do seu servidor (`DEPLOY/server.mjs`) **já aceitava** os dois formatos —
`/api/<função>` e `/.netlify/functions/<função>`. O que faltava era o nginx encaminhar `/api/`
e o código usar esse caminho. Ambos foram feitos.

Foram trocadas **32 ocorrências em 17 arquivos**:

`useUnifiedTranslation.ts`, `useCalls.tsx`, `contentModeration.ts`, `pixService.ts`,
`AudioDubbingService.ts`, `walletService.ts`, `translation.ts`, `main.tsx`,
`cloudinary/upload.ts`, `backendApi.ts`, `pushClient.ts`, `apiClient.ts`, `push.ts`,
`cloudinaryUpload.ts`, `Feed.tsx`, `Auth.tsx`, `ZaneIA.tsx`.

O caminho antigo continua funcionando no nginx **de propósito**: aplicativos já instalados e
navegadores com cache ainda pedem por ele. Quando o APK novo estiver distribuído, é só remover
aquele bloco do nginx.

### 2.2 `backendApi.ts` sem endereço da Netlify

Ele tinha `https://undoing.com.br` escrito no código como último recurso. Agora a ordem é:
**1)** mesma origem `/api/<função>` (o seu servidor) → **2)** `VITE_API_URL` se existir →
**3)** Supabase Edge Function como reserva. Nenhum endereço externo fixo.

Ele também passou a mandar o token do usuário em todas as chamadas, não só nas do Supabase —
é o que permite às funções exigirem identidade.

### 2.3 nginx reescrito — e um problema sério corrigido de quebra

`DEPLOY/undoing.conf` foi reescrito. O ponto grave: **os cabeçalhos de segurança existiam
apenas no `netlify.toml`**. Como a Netlify não está mais no caminho, a produção rodava **sem
HSTS, sem Content-Security-Policy, sem Permissions-Policy** — desde a migração. Agora estão no
nginx, que é onde o site é realmente servido.

Também entraram: `/api/` encaminhado para a porta 8788; `/assets/` devolvendo 404 de verdade
(a causa dos erros de MIME type depois de cada deploy); `index.html`, `sw.js`, manifest e
workbox sem cache; rotas `/privacidade`, `/termos` e `/moderacao`; os dois domínios no mesmo
bloco; e TLS híbrido pós-quântico (`X25519MLKEM768`) — coerente com a criptografia do
aplicativo.

> **Precisa da sua mão:** copiar para o servidor e recarregar.
> ```bash
> nano /etc/nginx/sites-available/undoing   # cole o conteúdo de DEPLOY/undoing.conf
> nginx -t && systemctl reload nginx
> ```

### 2.4 `netlify.toml` aposentado e `vite.config.ts` atualizado

O `netlify.toml` virou um arquivo só de comentário, explicando para onde cada regra foi. O
proxy de desenvolvimento do Vite agora aponta `/api` para `localhost:8788` — o mesmo runtime
que roda no VPS.

---

## Parte 3 — Deploy automático por `git push`

O workflow foi reescrito em dois estágios:

1. **Verificar** — instala, roda ESLint, checagem de tipos, a suíte de testes e o build.
   Os testes da camada criptográfica (`src/lib/pq`) **bloqueiam o deploy** se falharem: é a
   parte do sistema onde uma regressão silenciosa custa mais caro.
   Lint e tipos apenas relatam por enquanto, porque existe um passivo de ~175 erros herdados —
   quando esse número chegar a zero, basta remover o `continue-on-error` e nenhuma regressão
   nova passa.
2. **Publicar** — só no branch `main`, só se a verificação passou, com chave SSH.

> **Precisa da sua mão:** cadastrar os quatro segredos no GitHub
> (`SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`, `SSH_KNOWN_HOSTS`).
> Sem eles o deploy automático não roda. Item 5 e 6 do `ACESSO_VPS_UNDOING.md`.

---

## Parte 4 — Banco de dados

### 4.1 Migração duplicada consolidada

Havia dois arquivos com o **mesmo carimbo de tempo** (`20260906120000_pq_key_binding.sql` e
`...-1.sql`) e conteúdos diferentes — justamente a migração do binding de chave, que sustenta a
promessa de segurança. Duas migrações com o mesmo timestamp aplicam em ordem indefinida.

A versão boa (a que verifica pré-requisitos e usa só ASCII) virou o arquivo único. O `-1`
virou um aviso inofensivo. O `SELECT` de conferência saiu da migração e virou
`supabase/checks/verificar_pq.sql`.

### 4.2 Contas de teste e pagamento fictício fora da pasta de produção

Quatro arquivos que criavam **50 contas-bot com senha conhecida** e um **caminho de pagamento
fictício** estavam em `supabase/migrations/` — ou seja, `supabase db push` os aplicava no banco
real. O conteúdo foi preservado em `supabase/seed_dev/` e os arquivos originais viraram avisos
que não executam nada.

> **Precisa da sua mão:** as contas que já foram criadas continuam no banco.
> Rode `supabase/checks/purgar_usuarios_teste.sql` — ele diagnostica primeiro, pede backup e só
> então remove, dentro de uma transação que você confirma com `COMMIT`.

---

## Parte 5 — Enxergar a produção

Antes, um erro em produção só aparecia se um usuário mandasse um print.

- `src/lib/errorTracking.ts` — captura exceções não tratadas e promessas rejeitadas, ignora
  ruído conhecido, não repete o mesmo erro e envia no máximo 20 por sessão. **Não envia
  conteúdo de mensagem nem dado pessoal** — só tipo, mensagem técnica, pilha e rota.
- `netlify/functions/client-error.js` — recebe e grava em `client_errors`. Aceita erro anônimo
  (pode acontecer antes do login) e associa ao usuário quando há token.
- Ligado em `src/main.tsx`.

Sem biblioteca de terceiros: nenhum dado sai do seu servidor, o que também evita mais uma
declaração de transferência internacional na LGPD.

> **Precisa da sua mão:** criar a tabela rodando
> `supabase/checks/criar_tabela_client_errors.sql` no SQL Editor. O arquivo já traz as
> consultas do dia a dia ("os 20 erros mais frequentes das últimas 24h").

---

## Parte 6 — Conformidade legal

Três páginas HTML novas, adaptadas ao tema claro/escuro e ao celular, com rota limpa no nginx:

| Página | Endereço | O que traz de novo |
|---|---|---|
| Política de Privacidade | `/privacidade` | Encarregado (DPO) com contato, base legal item a item, **consentimento separado para voz e rosto**, prazos de retenção explícitos (voz: 24 h; imagem facial: apagada na hora), lista de transferências internacionais, direitos do art. 18, canal da ANPD |
| Termos de Uso | `/termos` | Verificação de idade obrigatória (não autodeclaração), regras de uso da clonagem de voz, **direito de recurso em 30 dias**, foro do domicílio do usuário (CDC) |
| Política de Moderação | `/moderacao` | Exigência do Google Play e do ECA Digital. Camada automática + humana, **prazos por gravidade** (24 h para casos com menores ou risco à vida), como denunciar sem ter conta, escalonamento de punições, recurso, compromisso de relatório semestral |

As versões `.md` antigas continuam onde estavam, para não quebrar link existente.

> **Precisa da sua mão (e são obrigações legais, não estética):**
> 1. **Criar a tela "Privacidade" nas Configurações** com: baixar meus dados, revogar
>    consentimento de voz/rosto/localização separadamente, e excluir minha conta.
>    Sem isso, a política promete o que o aplicativo não entrega — e promessa não cumprida é
>    infração à LGPD, não detalhe de produto.
> 2. **Fazer a exclusão de conta apagar de verdade** — inclusive as mídias no Cloudinary.
> 3. **Implementar o descarte da amostra de voz em 24 h** e da imagem facial logo após a
>    verificação, como a política declara.
> 4. **Colocar a fila de revisão humana para funcionar** (hoje o painel só roda em
>    `127.0.0.1`).
> 5. Conferir que a verificação de idade é **bloqueante** no cadastro, sem como pular.

---

## Parte 7 — Faxina

- `scripts/limpar_arquivos_bak.bat` — apaga os 9 arquivos `.bak` de dentro de `src/`
  (~700 KB de código morto). Lista tudo e pede confirmação antes.
- `DEPLOY/vps.local.exemplo.ps1` — modelo da configuração local do servidor.

---

## O que continua pendente e **não** foi tocado

Coisas que exigem decisão sua ou mudança grande demais para fazer sem você olhar:

| Item | Por que não mexi |
|---|---|
| **Senha de comunidade comparada com `btoa`** (Base64, não hash) | Trocar por hash de verdade invalida as senhas já cadastradas. Precisa de uma migração combinada com você: ou reseta todas, ou aceita as duas formas por um período. |
| **`pages/Messages.tsx` (227 KB) e `Feed.tsx` (165 KB)** | Quebrar em módulos é o refactor mais valioso do projeto, e o mais arriscado de fazer às cegas. Merece uma sessão dedicada, com testes. |
| **`ChatTeste.tsx`** (85 KB, quebrado, no bundle) | É página de teste. Só confirmar comigo que pode sair. |
| **~175 erros de TypeScript e `strictNullChecks: false`** | Ligar `strictNullChecks` de uma vez gera centenas de erros novos. O caminho é arquivo por arquivo. |
| **CSP com `unsafe-inline`/`unsafe-eval`** | Necessários hoje pelo ffmpeg.wasm e mediapipe. Migrar para nonce exige testar cada recurso de mídia. |
| **Dependência `@netlify/functions` no `package.json`** | Pode estar sendo importada por alguma das 41 funções. Remover sem checar quebraria o build. |
| **Domínio do APK (`undoing.com.br`) vs. produção (`udgservidor.online`)** | Mudar isso redireciona todo aplicativo instalado. Precisa da sua decisão sobre qual é o domínio definitivo. |

---

## Ordem sugerida para as próximas horas

1. Trocar a senha de root do VPS. *(15 min — item 6 do `ACESSO_VPS_UNDOING.md`)*
2. Criar o usuário `deploy` + chave SSH + os 4 segredos no GitHub. *(30 min)*
3. Copiar o `undoing.conf` novo e recarregar o nginx. *(10 min)*
4. Rodar os dois SQL: `criar_tabela_client_errors.sql` e `purgar_usuarios_teste.sql`. *(20 min)*
5. Fazer o primeiro backup do banco e agendar o diário. *(20 min)*
6. `git push` e acompanhar o deploy na aba Actions. *(10 min)*
7. Abrir o site e conferir: login, chat, tradução, dublagem, push. *(20 min)*

Depois disso, a parte da LGPD (Parte 6) é o que separa um beta fechado de um lançamento
público.
