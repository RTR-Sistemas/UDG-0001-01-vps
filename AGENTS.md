## Objective
- Implementar Fase 1 social na tela de Mensagens (src/pages/Messages.tsx + src/components/MessageInput.tsx): grupos de chat (criar/header/ABA de informações/@menções/@todos), reações, edição inline (15 min), "apagar para todos" e enquetes — seguindo o SQL já existente em DEPLOY/phase1_social.sql (RPCs com params `p_*`, coluna `group_description`, `expires_at`).
- Regras: zero erros eslint `no-explicit-any` em ARQUIVOS NOVOS; arquivos antigos seguem o estilo existente (`as any`); não tocar App.tsx/Feed.tsx/Search.tsx/sidebar/types.ts/pq/index.ts; sem comentários no código.

## Important Details
- Windows/PowerShell: usar `;`, NUNCA `&&`. Workdir: `C:\Users\Poderoso_DELL\Desktop\UDG_ATUAL`.
- **O SQL já existe**: `DEPLOY/phase1_social.sql` (adicionei `messages.is_edited boolean` no bloco 5 e o RPC `leave_group(uuid)` + GRANT, numerado 7.10; 7.11 = search_messages). O usuário deve rodar o arquivo no Supabase Dashboard (SQL Editor) — 100% idempotente.
- RPCs (assinaturas EXATAS a usar no front): `create_group(p_name, p_description, p_member_ids)`, `add_group_members(p_conversation_id, p_member_ids)`, `remove_group_member(p_conversation_id, p_user_id)`, `leave_group(p_conversation_id)`, `update_group_info(p_conversation_id, p_name, p_description, p_avatar)`, `toggle_message_reaction(p_message_id, p_emoji)` (boolean), `update_message_text(p_message_id, p_new_content)` (RETURNS messages; janela 15 min), `delete_message_for_all(p_message_id)`, `set_poll_vote(p_poll_id, p_option_id)`, `create_poll_message(p_conversation_id, p_content, p_question, p_options, p_is_anonymous, p_expires_at)`.
- Colunas novas: `conversations.group_avatar/group_description/pinned`; `conversation_participants.role(owner/admin/member)/added_by/nickname`; `messages.edited_at/is_edited`; tabelas `message_reactions` (UNIQUE msg+user+emoji), `polls` (msg UNIQUE, `expires_at`), `poll_options`, `poll_votes` (voto anônimo = user_id NULL, único por poll). RLS: SELECT p/participante; INSERT reaction própria; polls escrita só via RPC (SECURITY DEFINER).
- `src/lib/openDb.ts`: `openDb` = `supabase as unknown as SupabaseClient<OpenDatabase, "public">` — usa `openDb.from("<tabela nova>")` tipado (Record<string,unknown>) e `openDb.rpc(...)` para RPCs. NÃO funciona `(supabase as any)`? funciona, mas gera errinho eslint em arquivo novo — por isso openDb.
- tipagens/helpers reais: `uploadFileToCloudinary` em `src/utils/cloudinaryUpload.ts`; `extractMentions`/`saveMentions` em `src/utils/mentionsHelper.ts` (contentType `"message"`); `useAuth` em `src/hooks/useAuth.tsx`.
- PQ-E2EE é só chat privado (`isPrivateChat = !!privatePeerId && !selectedConvData?.is_group`). Grupos: texto plano; editar escondido p/ mensagens PQ (msg.is_pq_encrypted).
- Mensagens de enquete: content = `"__poll__"` (getMessageType retorna 'poll' para `'__poll__'` ou prefixo `__poll_`).
- lá do repo: `types.ts` NÃO tem colunas/RPCs novas; lint (`node .\node_modules\eslint\bin\eslint.js`) e typecheck (`node .\node_modules\.bin\tsc.cmd -b tsconfig.app.json --pretty false`) foram rodados como validação.

## Work State
### COMPLETO (Fase 1)
Criados (0 erros eslint + 0 erros tsc em todos):
- `src/components/reactions/ReactionPicker.tsx` — Popover com 👍❤️😂😮😢😡; props `{ onReact, myEmojis, className, trigger }`.
- `src/components/reactions/ReactionBar.tsx` — chips agrupados por emoji, tooltip com usernames; props `{ reactions: ReactionRow[], currentUserId, onToggle, className }`; `ReactionRow { id, message_id, user_id, emoji, username?, avatar_url? }`.
- `src/components/polls/PollCard.tsx` — `{ poll, options, myVoteOptionId, onVote, isVoting, className }`; `PollRow { id, message_id, question, is_anonymous, expires_at, created_at }`; `PollOptionRow { id, text, votes: PollVoteRow[] }`.
- `src/components/polls/CreatePollModal.tsx` — `{ open, onOpenChange, onSubmit: (payload: CreatePollPayload) => void, isSubmitting }`; payload `{ question, options[], closesAt: string|null, isAnonymous }` (opções 2–6, datetime-local, checkbox anônima).
- `src/components/groups/CreateGroupModal.tsx` — `{ open, onOpenChange, currentUserId, onCreated(conversationId) }`; usa RPC `create_group` + `update_group_info` p/ avatar (upload `chat/groups`).
- `src/components/groups/GroupInfoSheet.tsx` — Sheet com membros (roles Dono/Admin), adicionar/remover (RPCs), sair (`leave_group`), editar nome + avatar (`update_group_info`); `{ open, onOpenChange, conversationId, currentUserId, onChanged }`. queries de friends via `supabase` tipado (friendships/profiles); coisas novas via `openDb`.
- `src/lib/openDb.ts` — wrapper tipado (descrito acima).

Editados:
- `src/components/MessageInput.tsx` — props novas OPCIONAIS: `onPollClick?`, `mentionAllEnabled? (default false)`, `mentionableUsernames? (default [])`; helper `insertText(snippet)`; linha de chips acima do campo p/ grupos (`@todos` → `@all` + chips `@username`); botão "Enquete" (BarChart3 laranja) no menu "+". (11 erros eslint pré-existentes — iguais ao baseline; ZERO novos.)
- `src/pages/Messages.tsx` (arquivo maior, segue estilo `as any` já existente; ~24 any novos no MESMO estilo/exigência do acesso a tabelas novas):
  - Imports: ReactionPicker/ReactionBar(PollRow/PollOptionRow)/PollCard/CreatePollModal/CreateGroupModal/GroupInfoSheet, Textarea, `Info`+`Pencil` ícones, `openDb`.
  - Estado novo: isCreateGroupOpen/isGroupInfoOpen/isCreatePollOpen/isCreatingPoll/editingMsgId/editDraft/isSavingEditMsg/confirmDeleteMsgId/isReactionBusyId/votingPollId.
  - `useQuery`s: groupMembers (conversation_participants+profiles), reactions (`message_reactions`), polls (polls+poll_options+poll_votes nested), com `conversationMsgIdsRef`/`msgsKey`; helpers `reactionsForMessage`, `myReactionsForMessage`, `pollOptionsForMessage`, `myVoteOptionFor`.
  - Realtime: canal `social-<convId>` ouvindo `message_reactions` e `poll_votes` → refetch.
  - Persistência: `udg_last_conversation` no localStorage ao selecionar conversa.
  - Handlers: handleToggleReaction, startEditMessage/saveEditMessage (RPC update_message_text; trata "15 minutes"/prazo; chama saveMentions p/ não-PQ), cancelEditMessage, handleDeleteForAll (RPC + deletedMessages Set), handleCreatePoll (RPC com content `__poll__`), handlePollVote, handleGroupCreated (persiste, refetch, seleciona conversa).
  - UI: botão "criar grupo" (Users) na sidebar ao lado do CreatePrivateRoom; header de grupo (avatar clicável→info, `N participantes`, título do grupo); botão Info na direita quando grupo; nome do remetente acima da bolha de outros no grupo; PollCard antes do sticker; edição inline (Textarea + Cancelar/Salvar) substituindo a bolha; badge "Editado" nos dois footers; footer próprio com botões Editar (texto, não-PQ) e Apagar p/ todos com confirmação inline Sim/Não; linha de reações (ReactionBar + ReactionPicker) sob a bolha, oculta no modo seleção/temporizador; modals CreateGroupModal/GroupInfoSheet/CreatePollModal; MessageInput com `onPollClick`, `mentionAllEnabled={isGroupChat}`, `mentionableUsernames={groupMentionUsernames}`.
  - getMessageType: adicionou 'poll' (e 'video' p/ consertar bug pré-existente do tipo).
- `DEPLOY/phase1_social.sql`: **REESCRITA COMPLETA (17/08/2026, agente DB)**, idempotente, 28KB: conversas +group_avatar/group_description/pinned; participants +role('member' default)/added_by/nickname; message_reactions (UNIQUE msg+user+emoji); polls/poll_options/poll_votes (anônimo=user_id null); messages +edited_at; pg_trgm + índices GIN (profiles.username/full_name, messages.content, posts.content, communities.name); 10 RPCs p_* (create_group/add_group_members/remove_group_member/update_group_info/toggle_message_reaction(boolean)/update_message_text(15min)/delete_message_for_all/set_poll_vote/create_poll_message(transação, content p_content)/search_messages(p_query,p_limit)/leave_group); RLS reactions/polls SELECT participante + próprio user; GRANTs. **PENDENTE: usuário rodar no Dashboard.** (ATENÇÃO: messages usa `user_id` e NÃO `sender_id`; profiles não tem display_name — usa full_name/username.)

### NOVO SESSÃO 17/08 (tarde) — Migration APLICADA no cloud REAL
- O usuário forneceu Personal Access Token da Management API (formato `sbp_...`) → **`POST https://api.supabase.com/v1/projects/ipmldkprqdhybedhpgmt/database/query`** com `{"query":"..."}` executa SQL real (não é read-only como o MCP).
- Aplicado `deploy/phase1_social.sql` em 8 blocos pelas seções `-- N)` do arquivo (não dividir por `CREATE INDEX`): 0=extensions(pgcrypto,pg_trgm) → 1-5 colunas/tabelas → 6 índices → 7 RPCs → 8 RLS+GRANT.
- **2 erros corrigidos na aplicação:** (a) `gin_trgm_ops does not exist` = rodar bloco 0/extensions ANTES dos índices; (b) `create_poll_message` tinha `p_content text DEFAULT NULL, p_question text, ...` → PL/pgSQL `42P13: input parameters after one with a default value must also have defaults` → removido o DEFAULT (linha 483 do .sql; frontend sempre passa p_content).
- **Validação pós-aplicação (MCP confirma):** tabelas `message_reactions/polls/poll_options/poll_votes` existem; colunas `conversations.group_avatar/group_description/pinned`, `conversation_participants.role/added_by/nickname`, `messages.edited_at` presentes; **11 RPCs** com assinaturas EXATAS corretas; RLS `rowsecurity=true` nas 6 tabelas. `search_messages('udgpq1',5)` roda (0 = sem msgs visíveis p/ role do executor, esperado).
- ⚠️ NÃO commit/persistir o token `sbp_` em arquivos; fica no histórico de sessão.
- Pendentes (se o usuário pedir): `deploy/pq_e2ee_cloud.sql` (ativa E2EE prod) e `deploy/wallet_fix_cloud.sql`.

### NOVO SESSÃO 17/08 (auditoria de bugs, 7 fixes — 7/7 validados sin delta)
- **CRÍTICO segurança** `src/hooks/useBattleLive.ts`: removido App Certificate Agora (`10c44c...`) hardcoded + geração de token no client; agora só `fetchAgoraTokenServer` (Netlify fn), join com `token ?? null` (modo dev sem cert) — `agoraTokenBuilder.ts` ficou sem usos no front.
- **MÉDIO** `Messages.tsx` (timer efêmero): polls excluídos do auto-delete de 2 min (senão enquete morria do BD ao ser "vista" por qualquer participante).
- **MÉDIO** `Messages.tsx` (sidebar): `__poll__`/`__poll_*` agora vira "📊 Enquete" no último mensagem da lista.
- **MÉDIO** `Profile.tsx`: invalidate de avatar usava queryKey errada (`["profile"]` → `["profile", profileId]`) — foto nunca atualizava no perfil.
- **MÉDIO** `Feed.tsx` handleVote: violação UNIQUE 23505 (voto em modo vídeo deep-scroll c/ dados obsoletos) agora faz UPDATE em vez de toast de erro falso; +1 `as any` estilo existente.
- **MÉDIO** `Feed.tsx` e `Profile.tsx` isVideoUrl: regex agora aceita query string `(\?.*)?$` (consistente com VideoPostCard; antiga não detectava `.mp4?v=`).
- tsc: 185 erros no total (baseline 186; ChatEphemeral/ChatScreen/etc. pré-quebrados), ZERO nos trechos editados. eslint: Messages 95 = baseline; Feed 63 (+1 any novo); Profile 66; useBattleLive 2 (pré-existentes). `node .\node_modules\.bin\tsc.cmd` NÃO roda pelo PowerShell (node não executa .cmd) → usar `node .\node_modules\typescript\bin\tsc -b tsconfig.app.json --pretty false`.
- Ainda pendente (sem fix): senha de comunidade comparada via `btoa` (não hash); voto anônimo de enquete global único por poll (DELETE+INSERT por design do RPC); `agoraTokenBuilder.ts` órfão; copia isVideoUrl divergente em Arena/News/Explore/Search.

### NOVO SESSÃO 17/08 (manhã) — Fase 1 continuada com 4 agentes paralelos + build/deploy
- `src/pages/Search.tsx` (NOVO) + rota `/search` em App.tsx + item "Pesquisar" na SLIDES do `src/components/Layout/AppLayout.tsx:255` (o sidebar real; `src/components/ui/sidebar.tsx` é shadcn genérico e NÃO é usado). 4 abas (Pessoas/Mensagens/Posts/Comunidades), debounce 600ms, recentes `udg_recent_searches`. Aba Mensagens depende do RPC `search_messages`. Padrões de navegação: `/messages?conversation=<id>` (Messages.tsx:594), `/feed?post=<id>`, `/profile/:id`, `/communities` (não existe rota por id!).
- Vídeo vertical: `src/components/video/*` (VerticalVideoFeed, VideoPostCard, VideoActionBar, types.ts sem any) + Feed.tsx modo "Feed|Vídeos" (`feedModeRef`, query `videos-infinite` filtrando `.not('media_urls','is',null)` + isVideoUrl no cliente: `video::` prefixo OU `.mp4/.webm/...` regex). Votação/curtir/comentar/share REUTILIZAM callbacks do Feed (handleVote/handleLike/setOpeningCommentsFor/handleShare). Scroll-snap y mandatory; src só no vídeo ativo.
- `PLANO_DEV_2026.md` — roadmap benchmark (Fases 1-5).
- Corrigido erro TS novo: CreateGroupModal.tsx Checkbox `readOnly`→`onCheckedChange no-op + pointer-events-none` (o div pai faz o toggle).
- pscp no Windows: `dist\.` NÃO copia; usar `dist\*` com -r.

### Bugs corrigidos (17/08, build+deploy já feitos — bundle `index-DuExeH0v.js`, site 200)
- **Câmera da batalha:** `useBattleLive.ts:196` — `AgoraRTC.createMicrophoneAndCameraTrack()` não existe no SDK 4.24.6 empacotado → trocado por `createMicrophoneAudioTrack()` + `createCameraVideoTrack()` + `client.publish([micTrack, camTrack])` (mesmo padrão do useCalls.tsx).
- **Decriptação PQ no chat:** causa = `Messages.tsx:1391-1407` passava `peerId=""` p/ mensagens PRÓPRIAS (sessão salva sob `privatePeerId`) → decryptOwn falhava c/ "🔐 Falha". Corrigido: `peerId = isPrivateChat ? privatePeerId : ""` para TODAS as msgs + `pqIdentityRef`(useRef)→`pqIdentity`(useState) p/ re-decriptar quando identidade publica (race). Testes pq 16/16 OK.
- **Online/offline presença** (Messages.tsx, NÃO era bug, feature nova): `onlineUserIds` memo (user_ids c/ `last_seen`<60s no `presenceMap`, excl. user atual); header do chat: ring verde `border-green-500 ring-2 ring-green-500/40` online / `border-red-500/70 ring-2 ring-red-500/25` offline, bolinha `absolute bottom-0 right-0 w-3.5 h-3.5` verde/vermelha, texto "Online" verde `animate-pulse` vs "Offline • visto <data>" vermelho (era "Visto" muted); lista de conversas: `ring-green-500/70` online / `ring-red-500/30` senão + bolinha verde `w-3 h-3` (mantém badge não-lidas).

### NOVO SESSÃO 17/08 (noite) — Erros de prod + votação da Arena resolvidos
- **BUG PROD (Feed quebrado):** `column posts.boost_until does not exist` (42703) → aplicado `ALTER TABLE posts ADD COLUMN IF NOT EXISTS boost_until TIMESTAMPTZ` via Management API; Feed.tsx:1784/1799/1909 usa a coluna p/ posts impulsionados (`.order("boost_until", ...)`). App volta a carregar o feed.
- **Insight RLS post_votes:** a policy "Users can create votes" exige `auth.uid() = user_id` EXPLÍCITO no body (não deriva o user_id do JWT) → INSERT sem `user_id` → 403 42501. O app manda `user_id` sempre; scripts/curl NÃO. (403 era isto, não era bug do app.)
- **Posts "enceradas" em votação:** 4 posts dos agentes estavam `voting_period_active=true` com `voting_ends_at=NULL` (inseridos por SQL sem a janela) → nunca expiravam. Cron do projeto NÃO processa posts (só delete-expired-messages). Resolvido: `UPDATE voting_ends_at = now()-1min` + `SELECT process_expired_posts()` → os 4 ficaram `is_community_approved=true`, `voting_period_active=false` (hearts 2×0/2×1 > bombs).
- **Votos dos agentes criados via PostgREST REAL (com JWT de cada um, replicando o app):** Bruno `heart` em serra(1311baf1)/café/... e Carla `heart` no video/setup...; contagem final hearts>bombs em todos. (O voto duplicado deu 23505 num retry — ok, idempotente.)

### Validation (rodado, atualizado)
- eslint novo: arquivos novos = 0 erros; MessageInput = 11 (baseline 11); Messages.tsx = 95 erros `no-explicit-any` (baseline 71 — delta ~24 são `as any`/`(x: any)` no estilo do arquivo p/ tabelas/RPCs novos; nada do tipo novo).
- tsc: 186 erros totais (sem baseline histórico; primeira rodada tinha 198). ZERO erros nos arquivos criados/MessageInput/new files. Restantes: ChatTeste.tsx (página de teste já quebrada, pré-existente) + padrões pré-existentes (user_stickers builder-chaining 1073, catch em PromiseLike 555/1610/2470, full_name 2270, comparações de timer 3613/3691).
- Sessão 17/08: build `vite` OK (72 precache) + deploy no VPS (`dist\*` com -r; novo bundle `index-DuExeH0v.js`, site 200). vitest pq 16/16 OK.

## Next Move
1. **Aprovação concluída (17/08 noite):** 4 posts dos agentes aprovaram a votação da Arena (is_community_approved=true). Próximo teste manual: abrir o Feed (erro boost_until resolvido), ver os posts de Carla/Bruno com hearts, curtir/comentar/share, e o resto da Fase 1 (grupos/@menções/reações/edição/enquetes), `/search`, modo Vídeos, batalha, PQ.
2. Criar novo post via app p/ validar o fluxo completo de votação (create → voting → expires → approve) com `voting_ends_at` definido (o app seta a janela; só meu INSERT por SQL que não setou).
3. Opcional: rodar `deploy/pq_e2ee_cloud.sql` e `deploy/wallet_fix_cloud.sql`.
4. (Melhoria futura conhecida) ao sair de um grupo, o chat continua selecionado; fechar seleção em onChanged seria nice-to-have.

### SESSÃO 19/08 — Relatório Claude Opus verificado + build + deploy (bundle `index-BZVv9gnM.js`, site 200)
- Recebido relatório do Claude Opus (Fase 1 completa): 13 arquivos novos + 7 editados + 12 bugs achados (2 críticos: App Certificate Agora hardcoded em useBattleLive removido — agora só fetchAgoraTokenServer; boost_until inexistente quebrava o Feed).
- **Verificação independente (eu):** tsc `--force` = **175 erros totais** (baseline anterior 186/185 → o Claude corrigiu ~10); **ZERO** em Feed/Profile/Auth/useAuth/RequireAuth e em todos os arquivos novos; Arena.tsx 20 erros PRÉ-EXISTENTES (padrão idêntico ao backup 29/07). eslint 12 erros no Auth.tsx (pré-existentes, arquivo antigo).
- **Build vite OK** (72 precache; bundle `index-BZVv9gnM.js` 2.73MB) + **deploy VPS OK**: pscp/plink NÃO existiam na máquina → baixados de `https://the.earth.li/~sgtatham/putty/latest/w64/pscp.exe` (+plink.exe) para `%LOCALAPPDATA%\Programs\`; `pscp -r "dist\*"` → `/opt/undoing/dist/`; nginx `server_name udgservidor.online`; **`https://udgservidor.online/` → HTTP 200 servindo `index-BZVv9gnM.js`**.
- Detalhe: `curl` no PowerShell é alias do Invoke-WebRequest (flags POSIX falham) → usar `Invoke-WebRequest -UseBasicParsing`.

### SESSÃO 20/08 — Ecossistema completo: 50 bots sociais + admin localhost + deploy final
- **50 usuários-bot criados** via SQL da Management API (`scripts/create_50_users.sql` gerado por `scripts/generate_users_sql.cjs`): auth.users + auth.identities + profiles via trigger + 2463 friendships bidirecionais + 2457 followers. Senha `Udg#Teste2026`, emails `@udgtest.com`.
- **BUG FIX (crítico):** login 500 `email_change converting NULL to string unsupported` — o GoTrue quebra se `auth.users.email_change` for NULL (meu INSERT via SQL deixava NULL). Fix: `UPDATE auth.users SET email_change = COALESCE(...)` p/ todos `@udgtest.com`. Login voltou OK.
- **BUG FIX (RLS):** `users.js` não tinha `id` (UUID gerado no banco) → inserts sem `user_id` → 403 42501. Fix: `BotClient.auth()` captura `json.user.id` no login. E2E validado: postar → 10 votos (8H/2B) → expira → `process_expired_posts()` (executável por authenticated!) → `is_community_approved=true` no World Feed.
- **Estrutura nova (pasta raiz):**
  - `bots/` — robô social (node puro, zero deps): `config.js` `users.js` `content.js` (textos p/ data REAL, sem fatos falsos) `api.js` (login+refresh+retry) `engine.js` (ações: post texto/foto/video, like, comment, reply elaborado a comentários, follow, friend, criar/entrar comunidade, votar arena 82% heart) `scheduler.js` (daemon janela 0h–22h local, peso por hora: madrugada 0.35x → 1.8x 18-22h; vota arena a cada 10min; process_expired a cada ~50min; responde comentários a cada 8min). `start_bots.bat` (title UDG-BOTS-DAEMON, loop com restart) / `stop_bots.bat` (taskkill por WINDOWTITLE).
  - `adm-localhost/` — **painel admin, SOMENTE local (bind 127.0.0.1:3456)**, nunca vai pro VPS: `server.js` (node puro, executa SQL via Management API com token `sbp_` colado na tela, fica só em memória) + SPA `public/` (Dashboard/Usuarios/Arena/Posts/Comentarios/Comunidades/Robos/Logs/SQL Console; votação em massa por post; aprovar/reprovar/processar expirados). `start_admin.bat`.
  - `localhost/` — teste local do app antes do deploy: `start_dev.bat` (npm run dev).
  - `deploy/` — `deploy_prod.bat` (build + pscp + verificação HTTP).
  - `LEIA-ME_PASTAS.md` — guia das pastas e fluxo.
- **Deploy final OK:** build vite (72 precache, bundle `index-BZVv9gnM.js`) + upload `dist\*` → VPS + `https://udgservidor.online/` HTTP 200. Pastas bots/adm-localhost/scripts NÃO sobem (só `dist\*`).
- **Daemon rodando** (PID 11864, logs em `bots/logs/`): finalizado profile (avatar/bio/gender/birth) de bots; agendado até 22h local.
- **Token sbp_ NÃO persistido em arquivos** — somente variável de ambiente/processo (regra de segurança mantida).

### SESSÃO 20/08 (noite) — fix de 29 erros TS em 7 arquivos de serviços/paywall
- Corrigidos TODOS os erros tsc de `battleService.ts` (9), `monetization.ts` (9), `attentionCalls.ts` (2), `walletService.ts` (2), `pixService.ts` (1), `PayWall.tsx` (5), `useEntitlement.ts` (1): **0 erros tsc + 0 erros eslint nesses arquivos** (build completo: 47 linhas de erro restantes são todas pré-existentes — ChatTeste/DataTable/Dashboard/pq-test/agoraTokenBuilder/Wallet.tsx gateway "mercadopago").
- **Causa raiz descoberta:** com `strictNullChecks: false` (tsconfig), narrowing por discriminante `ok: true|false` NÃO funciona → `FeatureCheck` foi alargado nas DUAS ramificações (`ok:true` ganhou `reason?: never/need/have/tier`; `ok:false` ganhou `price_coins/credit_cost/tipo/granted`) — PayWall/useEntitlement ficaram SEM mudança de código e semântica.
- `attention_call_create` no BD CLOUD REAL tem params `receiver_id/message` (SEM prefixo p_) e types.ts reflete isso → chamada corrigida de `p_receiver_id` p/ `receiver_id` (era bug de runtime também).
- `battle_chat`/`battle_viewers` NÃO existem no Database types → tipos estruturais locais (shapes reais em `DEPLOY/battle_live_room.sql`) + `openDb.from("battle_chat")` p/ fetch/insert (padrão do projeto, sem `any`).
- Dois `any` pré-existentes de `attentionCalls.ts` também removidos (tipos estruturais inline).
- Wallet `PurchaseOptions.price?: number` restaurado (o RPC fallback `create_coin_purchase_order` exige `p_price`; callers nunca passam → `?? 0`, comportamento inalterado); `p_details` do `process_withdrawal` com `as unknown as Json`.
- `confirm_pix_key`: `data as unknown as { ok?: boolean }` (retorno Json). Casts Json→tipos em monetization (`store_config`/`feature_prices`/`my_entitlements`) via `as unknown as`.
- Temp: tsc completo é LENTO nesta máquina (>5min) — para checar arquivos específicos use o TS compiler API em script node (~3-4min) ou rode o projeto inteiro com timeout ≥900s.

## Relevant Files
- `bots/` + `adm-localhost/` + `localhost/` + `deploy/` + `scripts/create_50_users.sql` + `LEIA-ME_PASTAS.md` — ecossistema de testes (sessão 20/08).
- `DEPLOY/phase1_social.sql` — migração completa Fase 1 (reescrita 17/08, 28KB; ver seção acima).
- `PLANO_DEV_2026.md` — roadmap benchmarks (Fases 1-5).
- `src/pages/Search.tsx` + item no `AppLayout.tsx` SLIDES — pesquisa global 4 abas.
- `src/components/video/*` + `src/pages/Feed.tsx` — modo vídeo vertical com votação reutilizada.
- `src/lib/openDb.ts` — cliente tipado p/ tabelas/RPCs novos (sem no-explicit-any).
- `src/components/reactions/ReactionPicker.tsx` / `ReactionBar.tsx` — picker e barra de reações.
- `src/components/polls/PollCard.tsx` / `CreatePollModal.tsx` — enquete render + creator.
- `src/components/groups/CreateGroupModal.tsx` / `GroupInfoSheet.tsx` — gestão de grupos (RPCs).
- `src/components/MessageInput.tsx` — chips @menção (`@todos`→`@all`), botão Enquete, insertText.
- `src/pages/Messages.tsx` — integração completa (header grupo, reações, edição, delete-for-all, enquetes, modals, realtime).